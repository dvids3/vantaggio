import './styles.css';

import { Renderer } from './render/render.ts';
import type { Kit, Look } from './render/render.ts';
import { createMatch, step } from './sim/world.ts';
import { BOT_JUMP, BOT_POWER, BOT_PRECISION, BOT_SPEED, botInput } from './sim/bot.ts';
import { InputController } from './core/input.ts';
import { Sfx } from './core/audio.ts';
import { startLoop } from './core/loop.ts';
import { NO_INPUT } from './sim/types.ts';
import type { Input, Match } from './sim/types.ts';
import { TEAMS, teamById } from './data/teams.ts';
import type { RosterPlayer, Team } from './data/teams.ts';
import { altKitFor, kitStyleFor, lookFor } from './data/look.ts';
import { precargarArte, tieneArte } from './render/arte.ts';
import { makeRng } from './core/math.ts';
import { MATCH } from './sim/config.ts';
import type { ResultHints } from './data/records.ts';
import { buildGroups, groupFromId, groupOf, nextPlayerFixture, playMatchday, simulate, tableOf } from './data/tournament.ts';
import type { DrawMode } from './data/tournament.ts';
import {
  buildKnockout,
  isAlive,
  matchById,
  matchForTeam,
  finishKnockout,
  playThirdPlace,
  simulateKnockoutMatch,
  recordKnockoutResult,
  resumeKnockout,
  thirdFor,
  ROUND_NAMES,
} from './data/knockout.ts';
import type { Knockout } from './data/knockout.ts';
import { backdropBallSvg, h, icon } from './ui/kit.ts';
import { MatchHud } from './ui/hud.ts';
import * as S from './ui/screens.ts';
import { DEFAULT_OPTIONS, DIFFICULTY_LEVEL, EMPTY_SAVE } from './ui/state.ts';
import type { AppState, Difficulty, MatchOptions, SaveData, ScreenId } from './ui/state.ts';
import type { Api } from './ui/api.ts';

const STORAGE_KEY = 'vantaggio.save.v1';
const MATCH_SECONDS = 90;

// ------------------------------------------------------------------ arranque

document.querySelectorAll<HTMLElement>('.backdrop-ball').forEach((el) => {
  el.innerHTML = backdropBallSvg();
});

const screensHost = document.querySelector<HTMLElement>('#screens');
if (!screensHost) throw new Error('Falta #screens en el HTML');

const sfx = new Sfx();
const controls = new InputController(document.body);

if (window.matchMedia('(pointer: coarse)').matches) {
  document.body.classList.add('is-touch');
}

document.addEventListener(
  'pointerdown',
  () => sfx.unlock(),
  { once: true },
);

// ------------------------------------------------------------------- estado

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_SAVE, trophies: [], championships: [] };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...EMPTY_SAVE,
      ...parsed,
      trophies: parsed.trophies ?? [],
      championships: parsed.championships ?? [],
    };
  } catch {
    return { ...EMPTY_SAVE, trophies: [], championships: [] };
  }
}

const save = loadSave();

/** Goles reales (minuto y autogol) de los partidos jugados, por id. */
let matchHints: Record<string, ResultHints> = {};

const state: AppState = {
  mode: 'tournament',
  difficulty: 'normal',
  drawMode: 'real',
  drawSeed: 1,
  pickIndex: 0,
  picks: ['colombia', 'argentina'],
  players: [0, 0],
  options: { ...DEFAULT_OPTIONS },
  groups: buildGroups(),
  activeGroup: 'K',
  viewGroup: 'K',
  teamId: 'colombia',
  knockout: null,
  result: null,
};

if (save.tournament) {
  restoreTournament();
}

function restoreTournament(): void {
  const t = save.tournament;
  if (!t) return;
  state.mode = 'tournament';
  state.teamId = t.teamId;
  state.difficulty = t.difficulty;
  state.drawMode = t.drawMode ?? 'real';
  state.drawSeed = t.drawSeed ?? 1;
  state.players[0] = t.player;
  state.picks[0] = t.teamId;
  state.picks[1] = null;
  state.groups = buildGroups(state.drawMode, state.drawSeed);
  state.activeGroup = groupOf(state.groups, t.teamId);
  state.viewGroup = state.activeGroup;
  for (const group of state.groups) {
    for (const fx of group.fixtures) {
      const res = t.results[fx.id];
      if (res) {
        fx.hg = res[0];
        fx.ag = res[1];
      }
    }
  }
  state.knockout = t.knockout ?? null;
  matchHints = t.hints ?? {};
  if (state.knockout) resumeKnockout(state.knockout);
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    /* sin espacio o modo privado: se juega igual */
  }
}

function unlock(id: string): void {
  if (save.trophies.includes(id)) return;
  save.trophies.push(id);
  persist();
}

// ------------------------------------------------------------------ partido

let match: Match | null = null;
let renderer: Renderer | null = null;
let hud: MatchHud | null = null;
let stageEl: HTMLElement | null = null;
let homeTeam: Team | null = null;
let awayTeam: Team | null = null;
let homePlayer: RosterPlayer | null = null;
let awayPlayer: RosterPlayer | null = null;
/** Lado del campo que defiende el jugador humano (0 izquierda, 1 derecha). */
let humanSide: 0 | 1 = 0;
let matchOver = false;
/** Lado (0 local, 1 visitante) y índice del futbolista del RIVAL en cancha. */
let rivalSide: 0 | 1 = 1;
let rivalIndex = 0;
/** Cambios que le quedan al humano en este partido. */
let subsLeft = 5;
/** Futbolistas que ya salieron: en un partido no pueden volver a entrar. */
let subbedOut = new Set<string>();
/** Autores reales de cada gol, en orden (el rival rota y hay que fijarlos). */
let goalAuthors: { scorer: string; own: boolean }[] = [];
/** Cinta LED de eliminatorias: resultados de los otros partidos de la ronda. */
let tickerRuns: { home: string; away: string; goals: { side: number; minute: number }[] }[] | null = null;
/** Cierre del partido: cámara lenta y cartel antes de la ficha. */
let finale: { t: number } | null = null;

/**
 * Partido que se está preparando. El jugador puede ser local o visitante, así
 * que se guardan los equipos y no "mi equipo / el rival".
 */
let pendingMatch: { kind: 'group' | 'ko' | 'third'; id: string; homeId: string; awayId: string } | null = null;

const scratch: [Input, Input] = [{ ...NO_INPUT }, { ...NO_INPUT }];

function mulFor(p: RosterPlayer): { speed: number; jump: number; power: number; precision: number } {
  const cap = (v: number): number => Math.max(0.82, Math.min(1.12, v));
  return {
    speed: cap(0.84 + p.spd / 380),
    jump: cap(0.86 + p.jmp / 420),
    power: cap(0.82 + p.pow / 360),
    precision: 0.72 + p.pre / 340,
  };
}

function kitFor(team: Team, player?: RosterPlayer | null, alternate = false): Kit {
  // Rasgos estables por futbolista: el mismo que elegiste en la selección es el
  // que aparece en la cancha (pelo, barba y tono), no una cara genérica.
  const face = lookFor(team, player ?? undefined);
  const kit = kitStyleFor(team);
  const alt = alternate ? altKitFor(team) : null;
  return {
    jersey: alt?.jersey ?? team.jersey,
    shorts: alt?.shorts ?? team.shorts,
    socks: alt?.socks ?? team.socks,
    skin: face.skin,
    hair: team.hair,
    hairColor: face.hairColor,
    hairStyle: face.hairStyle,
    beard: face.beard,
    jaw: face.jaw,
    nose: face.nose,
    eyes: face.eyes,
    brows: face.brows,
    mouth: face.mouth,
    eyeColor: face.eyeColor,
    pattern: kit.pattern,
    alt: alt?.alt ?? kit.alt,
    trim: alt?.trim ?? kit.trim,
    // El id va SIEMPRE: el renderizador lo usa para sortear los botines de
    // cada futbolista. La cabeza dibujada se busca aparte y, si no existe, cae
    // en la de vectores.
    artId: team.id,
    artPlayer: player?.name,
    altKit: alternate,
  };
}

function buildLook(home: Team, away: Team): Look {
  // El uniforme alternativo es para tu equipo: se aplica al lado que juegas.
  const alt = state.options.altKit;
  return {
    kits: [kitFor(home, homePlayer, alt && home.id === state.teamId), kitFor(away, awayPlayer, alt && away.id === state.teamId)],
    flags: [home.flag, away.flag],
    ball: Math.min(1, Math.max(0, state.options.ball)),
    weather: state.options.weather,
    wind: state.options.wind,
    fans: state.options.fans,
  };
}

/** Juega los demás partidos de la ronda antes del tuyo (cinta en vivo). */
function preplayRound(ko: Knockout, matchId: string): void {
  const mine = matchById(ko, matchId);
  if (!mine) return;
  const round = ko.rounds[mine.round];
  if (!round) return;
  for (const other of round) {
    if (other.id === mine.id) continue;
    if (other.winner === null && other.home && other.away) simulateKnockoutMatch(other);
  }
}

/** Semilla estable por texto, para repartir los goles de los partidos ajenos. */
function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Resultados de los demás partidos de la ronda, repartidos en minutos. La cinta
 * LED los va mostrando como si se jugaran a la vez que el tuyo.
 */
function buildTickerRuns(): void {
  tickerRuns = null;
  const ko = state.knockout;
  const pm = pendingMatch;
  if (!ko || !pm || pm.kind !== 'ko') return;
  const mine = matchById(ko, pm.id);
  if (!mine) return;
  const round = ko.rounds[mine.round] ?? [];
  const others = round.filter((m) => m.id !== mine.id && m.home && m.away && m.hg !== null && m.ag !== null);
  if (others.length === 0) return;
  tickerRuns = others.map((m) => {
    const rng = makeRng(seedOf(m.id) ^ 0x9e3779b9);
    const goals: { side: number; minute: number }[] = [];
    for (let i = 0; i < (m.hg ?? 0); i++) goals.push({ side: 0, minute: 1 + Math.floor(rng() * 89) });
    for (let i = 0; i < (m.ag ?? 0); i++) goals.push({ side: 1, minute: 1 + Math.floor(rng() * 89) });
    goals.sort((a, b) => a.minute - b.minute);
    return { home: teamById(m.home!).short, away: teamById(m.away!).short, goals };
  });
}

/**
 * Un cartel de la cinta por partido. Se devuelve la lista (no una cadena) para
 * que el render pueda encadenarlos en bucle sin huecos ni saltos.
 */
function tickerText(minute: number): string[] {
  if (!tickerRuns) return [];
  return tickerRuns.map((r) => {
    const hg = r.goals.filter((g) => g.side === 0 && g.minute <= minute).length;
    const ag = r.goals.filter((g) => g.side === 1 && g.minute <= minute).length;
    return `${r.home} ${hg} - ${ag} ${r.away}  ${minute}'`;
  });
}

function randomRival(excludeId: string): string {
  const pool = TEAMS.filter((t) => t.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)]!.id;
}

/** El futbolista por defecto es la estrella de la selección, no el portero. */
function bestPlayerIndex(team: Team): number {
  let best = 0;
  let score = -1;
  team.roster.forEach((p, i) => {
    const total = p.spd + p.jmp + p.pow + p.pre;
    if (total > score) {
      score = total;
      best = i;
    }
  });
  return best;
}

function beginMatch(): void {
  let home: Team;
  let away: Team;

  if (pendingMatch) {
    home = teamById(pendingMatch.homeId);
    away = teamById(pendingMatch.awayId);
  } else {
    home = teamById(state.picks[0] ?? 'colombia');
    let awayId = state.picks[1];
    if (!awayId) awayId = randomRival(home.id);
    away = teamById(awayId);
    state.picks[1] = away.id;
  }

  // Condiciones aleatorias: clima, viento y público se sortean en cada partido.
  // (Antes este interruptor cambiaba el futbolista, que no era lo que se pedía.)
  if (state.options.random) rollConditions();

  // Local o visitante: si el jugador es visitante, defiende el arco derecho.
  const playerIsHome = state.mode === 'duo' ? true : home.id === state.teamId;
  humanSide = playerIsHome ? 0 : 1;

  if (state.mode === 'duo') {
    homePlayer = home.roster[state.players[0]] ?? home.roster[0]!;
    awayPlayer = away.roster[state.players[1]] ?? away.roster[0]!;
  } else if (home.id === state.teamId) {
    homePlayer = home.roster[state.players[0]] ?? home.roster[0]!;
    awayPlayer = away.roster[bestPlayerIndex(away)] ?? away.roster[0]!;
  } else {
    awayPlayer = away.roster[state.players[0]] ?? away.roster[0]!;
    homePlayer = home.roster[bestPlayerIndex(home)] ?? home.roster[0]!;
  }

  homeTeam = home;
  awayTeam = away;
  matchOver = false;
  finale = null;
  goalAuthors = [];
  subsLeft = 5;
  subbedOut = new Set<string>();
  // El rival no siempre es el visitante: si juegas de local, el rival es el
  // equipo de la derecha. Se guarda el lado para rotar SOLO al rival.
  rivalSide = home.id === state.teamId ? 1 : 0;
  {
    const rivalTeam = rivalSide === 0 ? home : away;
    const rivalPlayer = rivalSide === 0 ? homePlayer : awayPlayer;
    rivalIndex = Math.max(0, rivalTeam.roster.findIndex((p) => p === rivalPlayer));
  }
  // En eliminatorias los otros partidos de la ronda se juegan "a la vez" que
  // el tuyo: se resuelven antes para que la cinta LED pueda ir mostrando sus
  // goles minuto a minuto mientras juegas.
  if (pendingMatch?.kind === 'ko' && state.knockout) preplayRound(state.knockout, pendingMatch.id);
  buildTickerRuns();

  const host = h('div', { class: 'screen match' });
  const canvas = h('canvas', { class: 'stage', 'aria-label': 'Cancha de juego' });
  host.append(canvas);
  screensHost!.replaceChildren(host);
  stageEl = host;

  renderer = new Renderer(canvas);
  renderer.setLook(buildLook(home, away));
  // El arte se carga al entrar al partido (no al arrancar la app): la portada
  // no paga los 3,6 MB de SVG de quien tenga dibujos.
  precargarArte();

  const m = createMatch();
  m.botLevel = DIFFICULTY_LEVEL[state.difficulty];
  m.humanSide = humanSide;
  m.versusBot = state.mode === 'tournament';
  // El partido de campeonato tiene 90 de reloj; en dos jugadores se juega a
  // goles y no hay límite de tiempo.
  m.timeLimit = state.mode === 'duo' ? 0 : MATCH_SECONDS;
  m.windEnabled = state.options.wind;
  m.wind = 0;
  m.fans = state.options.fans;
  m.wet = state.options.weather;
  m.mul = [mulFor(homePlayer), mulFor(awayPlayer)];
  // Al bot se le da un filo de velocidad y precisión que crece con la
  // dificultad: sin esto, el dash del humano siempre le gana y legendario se
  // convierte en goleada.
  if (state.mode === 'tournament') {
    const botSide = 1 - humanSide;
    const level = DIFFICULTY_LEVEL[state.difficulty];
    m.mul[botSide].speed *= BOT_SPEED[level]!;
    m.mul[botSide].precision *= BOT_PRECISION[level]!;
    m.mul[botSide].power *= BOT_POWER[level]!;
    m.mul[botSide].jump *= BOT_JUMP[level]!;
  }
  match = m;

  controls.reset();
  controls.versusBot = state.mode === 'tournament';
  hud = new MatchHud({
    home,
    away,
    versusBot: state.mode === 'tournament',
    humanSide,
    soundOn: !sfx.muted,
    onSub: () => substituteHuman(),
    onPause: () => {
      if (match) match.paused = true;
    },
    onResume: () => {
      if (match) match.paused = false;
    },
    onQuit: () => {
      if (state.mode === 'tournament' && match && !matchOver) {
        // Abandonar un partido de campeonato es una derrota por 0-3.
        endMatch(true);
      } else {
        teardownMatch();
        to('menu');
      }
    },
    onSound: () => toggleSound(),
  });
  hud.setClock(state.mode === 'duo' ? 0 : MATCH_SECONDS);
  hud.setScore(0, 0);
  hud.setSubs(subsLeft);
  host.append(hud.el);

  if (document.body.classList.contains('is-touch')) {
    host.append(buildTouchControls());
  }
  controls.bindTouch(host);

  requestAnimationFrame(() => renderer?.resize());
  to('match', true);
}

function buildTouchControls(): HTMLElement {
  const wrap = h('div', { class: 'touch' });
  const leftPad = h('div', { class: 'pad' });
  for (const [control, label] of [
    ['left', '◀'],
    ['right', '▶'],
  ] as const) {
    leftPad.append(h('button', { class: 'tbtn', type: 'button', 'data-control': control, text: label, 'aria-label': control }));
  }
  const rightPad = h('div', { class: 'pad' });
  for (const [control, label, cls] of [
    ['down', '▼', 'tbtn small'],
    ['up', '▲', 'tbtn'],
    ['kick', 'PATEAR', 'tbtn kick'],
    ['dash', 'DASH', 'tbtn small'],
  ] as const) {
    rightPad.append(h('button', { class: cls, type: 'button', 'data-control': control, text: label, 'aria-label': control }));
  }
  wrap.append(leftPad, rightPad);
  return wrap;
}

/**
 * Cambia al futbolista del rival: entra el siguiente de su plantel. Se usa
 * después de cada gol para que la cancha nunca repita la misma cara.
 */
function rotateRival(): void {
  const rivalTeam = rivalSide === 0 ? homeTeam : awayTeam;
  if (!rivalTeam || rivalTeam.roster.length < 2) return;
  rivalIndex = (rivalIndex + 1) % rivalTeam.roster.length;
  const next = rivalTeam.roster[rivalIndex] ?? null;
  if (!next) return;
  if (rivalSide === 0) homePlayer = next;
  else awayPlayer = next;
}

/**
 * Cambio manual: abre la lista del plantel para elegir quién entra.
 * Antes rotaba al siguiente a ciegas; ahora decides tú, viendo sus atributos.
 */
function substituteHuman(): void {
  if (!match || matchOver || !homeTeam || !awayTeam) return;
  if (state.mode !== 'tournament') return;
  if (subsLeft <= 0) {
    hud?.toast('No te quedan cambios');
    return;
  }
  const team = humanSide === 0 ? homeTeam : awayTeam;
  const current = humanSide === 0 ? homePlayer : awayPlayer;
  if (team.roster.length < 2) return;
  const choices = team.roster.map((p) => ({
    name: p.name,
    num: p.num,
    pos: p.pos,
    onField: p === current,
    used: subbedOut.has(p.name),
    spd: p.spd,
    jmp: p.jmp,
    pow: p.pow,
    pre: p.pre,
  }));
  hud?.openSubs(subsLeft, choices, (index) => {
    const team2 = humanSide === 0 ? homeTeam : awayTeam;
    applySub(team2, team2?.roster[index] ?? null);
  });
}

/** Mete al futbolista elegido y descuenta el cambio. */
function applySub(team: Team | null, next: RosterPlayer | null): void {
  if (!match || matchOver || !team || !next) return;
  const current = humanSide === 0 ? homePlayer : awayPlayer;
  if (next === current || subbedOut.has(next.name) || subsLeft <= 0) return;
  if (current) subbedOut.add(current.name);
  if (humanSide === 0) homePlayer = next;
  else awayPlayer = next;
  subsLeft -= 1;
  // El físico del que entra manda desde este momento.
  match.mul[humanSide] = mulFor(next);
  renderer?.setLook(buildLook(homeTeam ?? team, awayTeam ?? team));
  hud?.setSubs(subsLeft);
  hud?.toast(`Entra ${next.name} · ${team.short}`);
}

function teardownMatch(): void {
  match = null;
  hud?.el.remove();
  hud = null;
  renderer = null;
  stageEl?.remove();
  stageEl = null;
  matchOver = false;
  controls.reset();
}

function toggleSound(): void {
  sfx.setMuted(!sfx.muted);
  hud?.setSound(!sfx.muted);
}

function endMatch(forfeit = false): void {
  if (!match || !homeTeam || !awayTeam || matchOver) return;
  matchOver = true;
  const m = match;
  const wasKo = pendingMatch?.kind === 'ko';
  const playerIsHome = state.mode === 'duo' ? true : homeTeam.id === state.teamId;

  const playedId = pendingMatch?.id ?? null;
  const hg = forfeit ? (playerIsHome ? 0 : 3) : m.score[0];
  const ag = forfeit ? (playerIsHome ? 3 : 0) : m.score[1];
  const possTotal = m.stats.possession[0] + m.stats.possession[1] || 1;
  const possession: [number, number] = forfeit
    ? [50, 50]
    : [
        Math.round((m.stats.possession[0] / possTotal) * 100),
        Math.round((m.stats.possession[1] / possTotal) * 100),
      ];

  const koInfo = state.mode === 'tournament' ? recordTournament(hg, ag) : { pen: null as [number, number] | null };

  // Goles con minuto, para la ficha del resultado. El reloj del sim va 1:1 con
  // el minuto de partido, así que basta redondear hacia arriba.
  const goalLog = forfeit
    ? []
    : m.goals.map((g, i) => {
        const ownScorer = g.side === 0 ? awayPlayer : homePlayer;
        const normalScorer = g.side === 0 ? homePlayer : awayPlayer;
        // El rival cambia de futbolista con cada gol: se guarda quién estaba en
        // la cancha en ese momento, no el que terminó el partido.
        const recorded = goalAuthors[i]?.scorer;
        return {
          side: g.side,
          minute: Math.max(1, Math.min(90, Math.ceil(g.t))),
          own: g.own,
          scorer: recorded || (g.own ? ownScorer : normalScorer)?.name || '',
        };
      });

  state.result = {
    homeId: homeTeam.id,
    awayId: awayTeam.id,
    hg,
    ag,
    shots: forfeit ? [0, 0] : [m.stats.shots[0], m.stats.shots[1]],
    headers: forfeit ? [0, 0] : [m.stats.headers[0], m.stats.headers[1]],
    saves: forfeit ? [0, 0] : [m.stats.saves[0], m.stats.saves[1]],
    ownGoals: forfeit ? [0, 0] : [m.stats.ownGoals[0], m.stats.ownGoals[1]],
    possession,
    maxSpeed: forfeit ? 0 : m.stats.maxBallSpeed,
    mode: state.mode,
    difficulty: state.difficulty,
    knockout: wasKo && state.mode === 'tournament',
    pen: koInfo.pen,
    forfeit,
    goals: goalLog,
  };

  // Los goles reales (minuto y autogol) quedan guardados para las estadísticas
  // del torneo: así la tabla de autogoles coincide con lo que pasó en la cancha.
  if (!forfeit && playedId) {
    matchHints[playedId] = {
      own: [m.stats.ownGoals[0], m.stats.ownGoals[1]],
      goals: m.goals.map((g) => ({
        side: g.side,
        minute: Math.max(1, Math.min(90, Math.ceil(g.t))),
        own: g.own,
      })),
    };
  }

  save.matches += 1;
  save.gf += hg;
  save.ga += ag;
  if (hg > ag) save.wins += 1;
  else if (hg === ag) save.draws += 1;
  else save.losses += 1;

  unlock('debut');
  if (hg > ag) unlock('victoria');
  if (hg - ag >= 3) unlock('goleada');
  if (ag === 0) unlock('muralla');
  if (hg >= 5) unlock('repoker');
  if (!forfeit && m.stats.headers[0] > 0) unlock('cabezazo');
  if (state.mode === 'duo') unlock('duelo');
  if (hg > ag && state.difficulty === 'legendario') unlock('legendario');

  finale = null;
  noteChampion();
  persist();
  teardownMatch();
  to('result');
}

function recordTournament(hg: number, ag: number): { pen: [number, number] | null } {
  let pen: [number, number] | null = null;

  if (pendingMatch?.kind === 'group') {
    const group = groupFromId(state.groups, state.activeGroup);
    const fx = group.fixtures.find((f) => f.id === pendingMatch!.id);
    if (fx) {
      // hg/ag ya vienen como goles del local y del visitante: no se vuelven a
      // invertir. Antes, jugando de visitante, el resultado quedaba al revés.
      fx.hg = hg;
      fx.ag = ag;
      // Se juegan TODOS los partidos de las jornadas ya disputadas, en todos los
      // grupos. Antes solo se simulaba el grupo del jugador y los demás quedaban
      // en 0 para siempre.
      playMatchday(state.groups, fx.day, fx.id);
    }
    if (groupFinished()) ensureKnockout();
  } else if ((pendingMatch?.kind === 'ko' || pendingMatch?.kind === 'third') && state.knockout) {
    const m = matchById(state.knockout, pendingMatch.id);
    recordKnockoutResult(state.knockout, pendingMatch.id, hg, ag);
    if (m && m.ph !== null && m.pa !== null) pen = [m.ph, m.pa];
    // El tercer puesto se juega solo si no te toca a ti. Después, si ya no
    // tienes partidos, se completa el resto del cuadro hasta tener campeón.
    if (state.knockout.third && !thirdFor(state.knockout, state.teamId)) playThirdPlace(state.knockout);
    if (!isAlive(state.knockout, state.teamId)) finishKnockout(state.knockout);
  }

  pendingMatch = null;
  syncTournamentSave();
  noteChampion();

  if (api.groupFinished()) {
    const group = groupFromId(state.groups, state.activeGroup);
    const rows = tableOf(group);
    const pos = rows.findIndex((r) => r.team.id === state.teamId);
    if (pos >= 0 && pos < 2) unlock('grupo');
    if (pos === 0) unlock('lider');
  }
  return { pen };
}

function syncTournamentSave(): void {
  const results: Record<string, [number, number]> = {};
  for (const g of state.groups) {
    for (const f of g.fixtures) {
      if (f.hg !== null && f.ag !== null) results[f.id] = [f.hg, f.ag];
    }
  }
  save.tournament = {
    teamId: state.teamId,
    player: state.players[0],
    difficulty: state.difficulty,
    drawMode: state.drawMode,
    drawSeed: state.drawSeed,
    results,
    knockout: state.knockout,
    hints: matchHints,
    championNoted: save.tournament?.championNoted ?? false,
  };
  persist();
}

/**
 * Anota el Mundial en el palmarés, con la dificultad en la que se ganó. Se
 * llama después de cada resultado para que no se pierda si cierras la pestaña.
 */
function noteChampion(): void {
  const ko = state.knockout;
  if (!ko?.champion || ko.champion !== state.teamId) return;
  if (!save.tournament || save.tournament.championNoted) return;
  save.tournament.championNoted = true;
  save.championships.push({ difficulty: state.difficulty, teamId: state.teamId, at: Date.now() });
  unlock('campeon');
  persist();
}

function ensureKnockout(): void {
  if (!state.knockout) {
    state.knockout = buildKnockout(state.groups);
    resumeKnockout(state.knockout);
    syncTournamentSave();
  }
  // No clasificaste: el cuadro igual se juega hasta el final para poder
  // mostrar quién salió campeón.
  if (state.knockout && !state.knockout.seeds.includes(state.teamId) && !state.knockout.champion) {
    finishKnockout(state.knockout);
    syncTournamentSave();
  }
  noteChampion();
}

// ------------------------------------------------------------------ pantallas

let current: ScreenId = 'menu';

function render(id: ScreenId): void {
  if (id === 'match') return;
  screensHost!.replaceChildren();
  const builders: Record<Exclude<ScreenId, 'match'>, () => HTMLElement> = {
    menu: () => S.buildMenu(api),
    difficulty: () => S.buildDifficulty(api),
    draw: () => S.buildDraw(api),
    team: () => S.buildTeam(api),
    options: () => S.buildOptions(api),
    groups: () => S.buildGroups(api),
    knockout: () => S.buildKnockout(api),
    result: () => S.buildResult(api),
    stats: () => S.buildStats(api),
    trophies: () => S.buildTrophies(api),
  };
  screensHost!.append(builders[id]());
}

function to(id: ScreenId, skipRender = false): void {
  current = id;
  if (!skipRender) render(id);
}

function newTournament(): void {
  state.mode = 'tournament';
  state.pickIndex = 0;
  state.picks = ['colombia', null];
  state.players = [bestPlayerIndex(teamById('colombia')), 0];
  state.drawMode = 'real';
  state.drawSeed = 1;
  state.groups = buildGroups();
  state.activeGroup = groupOf(state.groups, 'colombia');
  state.viewGroup = state.activeGroup;
  state.knockout = null;
  state.result = null;
  pendingMatch = null;
  matchHints = {};
  save.tournament = null;
  persist();
  to('difficulty');
}

function chooseDraw(mode: DrawMode): void {
  state.drawMode = mode;
  state.drawSeed = mode === 'random' ? Math.floor(Math.random() * 0x7fffffff) || 1 : 1;
  state.groups = buildGroups(mode, state.drawSeed);
  state.activeGroup = groupOf(state.groups, state.teamId);
  state.viewGroup = state.activeGroup;
  state.knockout = null;
  to('team');
}

function continueTournament(): void {
  restoreTournament();
  if (state.knockout && groupFinished()) {
    to('knockout');
    return;
  }
  to('groups');
}

function startDuo(): void {
  state.mode = 'duo';
  state.pickIndex = 0;
  state.picks = ['colombia', 'argentina'];
  state.players = [bestPlayerIndex(teamById('colombia')), bestPlayerIndex(teamById('argentina'))];
  state.result = null;
  pendingMatch = null;
  to('team');
}

/**
 * Sortea las condiciones del partido: clima, viento y público. Es lo que hace
 * el interruptor "Condiciones aleatorias" de la antesala, y también se aplica
 * solo al empezar cada partido para que dos partidos seguidos no sean iguales.
 */
function rollConditions(): void {
  state.options.weather = Math.random() < 0.45;
  state.options.wind = Math.random() < 0.5;
  state.options.fans = Math.random() < 0.3;
}

function pickTeam(teamId: string): void {
  const team = teamById(teamId);
  state.picks[state.pickIndex] = teamId;
  state.players[state.pickIndex] = bestPlayerIndex(team);
  if (state.pickIndex === 0) {
    state.teamId = teamId;
    state.activeGroup = groupOf(state.groups, teamId);
    state.viewGroup = state.activeGroup;
  }
}

function advancePick(): void {
  if (current === 'difficulty') {
    to('draw');
    return;
  }
  if (current === 'team') {
    if (state.mode === 'duo' && state.pickIndex === 0) {
      state.pickIndex = 1;
      state.picks[1] = randomRival(state.picks[0] ?? 'colombia');
      state.players[1] = 0;
      to('team');
      return;
    }
    state.pickIndex = 0;
    if (state.mode === 'tournament') {
      state.teamId = state.picks[0] ?? 'colombia';
      state.groups = buildGroups(state.drawMode, state.drawSeed);
      state.activeGroup = groupOf(state.groups, state.teamId);
      state.viewGroup = state.activeGroup;
      state.knockout = null;
      to('groups');
      return;
    }
    to('options');
    return;
  }
  to('options');
}

function nextFixture(): void {
  const group = groupFromId(state.groups, state.activeGroup);
  const fx = nextPlayerFixture(group, state.teamId);
  if (!fx) {
    // Ya jugó sus tres partidos: pasa a eliminatorias.
    ensureKnockout();
    to('knockout');
    return;
  }
  pendingMatch = { kind: 'group', id: fx.id, homeId: fx.home, awayId: fx.away };
  state.picks[0] = fx.home;
  state.picks[1] = fx.away;
  to('options');
}

function nextKoMatch(): void {
  ensureKnockout();
  const ko = state.knockout;
  if (!ko) return;
  // Si perdiste la semifinal, primero va el tercer puesto.
  const third = thirdFor(ko, state.teamId);
  const m = third ?? matchForTeam(ko, state.teamId);
  if (!m || !m.home || !m.away) return;
  pendingMatch = { kind: third ? 'third' : 'ko', id: m.id, homeId: m.home, awayId: m.away };
  state.picks[0] = m.home;
  state.picks[1] = m.away;
  to('options');
}

function groupFinished(): boolean {
  const group = groupFromId(state.groups, state.activeGroup);
  return nextPlayerFixture(group, state.teamId) === null;
}

function backFromOptions(): void {
  if (pendingMatch?.kind === 'ko' || pendingMatch?.kind === 'third') to('knockout');
  else if (state.mode === 'duo') to('team');
  else to('groups');
}

function resetProgress(): void {
  save.matches = 0;
  save.wins = 0;
  save.draws = 0;
  save.losses = 0;
  save.gf = 0;
  save.ga = 0;
  save.trophies = [];
  save.championships = [];
  save.tournament = null;
  matchHints = {};
  state.knockout = null;
  persist();
}

const api: Api = {
  state,
  save,
  get soundOn() {
    return !sfx.muted;
  },
  to,
  refresh: () => render(current),
  newTournament,
  continueTournament,
  startDuo,
  setDifficulty: (d: Difficulty) => {
    state.difficulty = d;
  },
  chooseDraw,
  pickTeam,
  rerollConditions: rollConditions,
  setPlayer: (index: number) => {
    state.players[state.pickIndex] = index;
  },
  advancePick,
  nextFixture,
  nextKoMatch,
  ensureKnockout,
  setViewGroup: (id) => {
    state.viewGroup = id;
  },
  backFromOptions,
  beginMatch,
  repeatMatch: () => {
    state.picks[0] = state.result?.homeId ?? state.picks[0];
    state.picks[1] = state.result?.awayId ?? state.picks[1];
    pendingMatch = null;
    beginMatch();
  },
  quitToMenu: () => {
    teardownMatch();
    to('menu');
  },
  openSettings: () => S.openSettings(api),
  setOption: <K extends keyof MatchOptions>(key: K, value: MatchOptions[K]) => {
    state.options[key] = value;
    if (renderer) renderer.setLook(buildLook(teamById(state.picks[0]!), teamById(state.picks[1] ?? 'argentina')));
  },
  resetProgress,
  groupFinished,
  toggleSound,
};

// --------------------------------------------------------------------- bucle

function mergedInput(): Input {
  // En un partido contra la máquina el humano puede usar WASD **o** flechas:
  // los dos pads se suman antes de dárselos a su jugador.
  return {
    left: controls.state[0].left || controls.state[1].left,
    right: controls.state[0].right || controls.state[1].right,
    up: controls.state[0].up || controls.state[1].up,
    down: controls.state[0].down || controls.state[1].down,
    kick: controls.state[0].kick || controls.state[1].kick,
    dash: controls.state[0].dash || controls.state[1].dash,
  };
}

function writeInput(target: Input, source: Input): void {
  target.left = source.left;
  target.right = source.right;
  target.up = source.up;
  target.down = source.down;
  target.kick = source.kick;
  target.dash = source.dash;
}

function feedInputs(m: Match, dt: number): void {
  if (controls.versusBot) {
    writeInput(scratch[humanSide], mergedInput());
    const botSide = (1 - humanSide) as 0 | 1;
    writeInput(scratch[botSide], botInput(m, botSide, dt));
  } else {
    writeInput(scratch[0], controls.state[0]);
    writeInput(scratch[1], controls.state[1]);
  }
}

/** Cierre del partido: la simulación baja a cámara lenta y aparece el cartel. */
function startFinale(): void {
  if (finale) return;
  finale = { t: 0 };
  hud?.showFinal();
}

function stepOnce(dt: number): void {
  const m = match;
  if (!m || m.paused || matchOver) return;

  if (finale) {
    finale.t += dt;
    if (finale.t >= MATCH.finale) {
      endMatch();
      return;
    }
    feedInputs(m, dt);
    step(m, scratch, dt * MATCH.finaleSlow);
    return;
  }

  feedInputs(m, dt);
  step(m, scratch, dt);

  if (state.mode === 'duo') {
    if (m.score[0] >= state.options.goalTarget || m.score[1] >= state.options.goalTarget) {
      if (m.phase === 'goal' && m.phaseT > 1.6) startFinale();
      else if (m.phase !== 'goal') startFinale();
    }
  } else if (m.clock >= MATCH_SECONDS) {
    startFinale();
  }
}

function drawFrame(frameDt: number): void {
  const m = match;
  if (!m || !renderer || !hud) return;

  for (const ev of m.events) {
    sfx.play(ev);
    if (ev.type === 'goal') {
      const g = m.goals[m.goals.length - 1];
      const authorSide = g?.own ? 1 - ev.side : ev.side;
      const scorer = authorSide === 0 ? homePlayer : awayPlayer;
      goalAuthors.push({ scorer: scorer?.name ?? '', own: !!g?.own });
      const team = ev.side === 0 ? homeTeam : awayTeam;
      if (team) hud.flashGoal(team);

      // Cada gol cambia al futbolista del RIVAL (el equipo contra el que
      // juegas), no al visitante. Antes, jugando de visitante, el que rotaba
      // era tu propio equipo sin permiso: tus cambios los decides tú.
      if (state.mode === 'tournament' && awayTeam && homeTeam) {
        rotateRival();
        const rivalTeam = rivalSide === 0 ? homeTeam : awayTeam;
        const rivalPlayer = rivalSide === 0 ? homePlayer : awayPlayer;
        renderer.setLook(buildLook(homeTeam, awayTeam));
        if (rivalPlayer) hud.toast(`Entra ${rivalPlayer.name} · ${rivalTeam.short}`);
      }
    }
  }
  m.events.length = 0;

  hud.setScore(m.score[0], m.score[1]);
  hud.setWind(m.windEnabled ? m.wind : 0);
  if (state.mode === 'duo') {
    hud.setClock(m.clock);
  } else {
    const left = Math.max(0, MATCH_SECONDS - m.clock);
    hud.setClock(left, left <= 15);
  }

  renderer.draw(m, {
    time: performance.now() / 1000,
    debug: false,
    fps: Math.round(1 / Math.max(frameDt, 1 / 240)),
    bot: controls.versusBot,
    sound: !sfx.muted,
    ticker: tickerText(Math.max(1, Math.min(90, Math.ceil(m.clock)))),
  });
}

startLoop(stepOnce, drawFrame);

// ------------------------------------------------------------------ entorno

window.addEventListener('resize', () => renderer?.resize());

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    controls.reset();
    if (match && !matchOver) match.paused = true;
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && match && hud) {
    hud.togglePause();
  }
});

render('menu');

// Acceso de depuración desde la consola.
(window as unknown as { vantaggio: unknown }).vantaggio = {
  state,
  save,
  api,
  get match() {
    return match;
  },
  get renderer() {
    return renderer;
  },
  icon,
  ROUND_NAMES,
  isAlive,
  finishKnockout,
};
