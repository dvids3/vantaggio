/**
 * Pantallas de Vantaggio. Cada función devuelve un nodo `.screen` completo.
 * El estado vive en AppState; aquí solo se lee y se pinta.
 */

import { ACHIEVEMENTS } from '../data/achievements.ts';
import { TEAMS, teamById } from '../data/teams.ts';
import type { RosterPlayer, Team } from '../data/teams.ts';
import { nextPlayerFixture, tableOf } from '../data/tournament.ts';
import { tournamentReport } from '../data/records.ts';
import type { ScoreRow } from '../data/records.ts';
import { matchForTeam, thirdFor, ROUND_NAMES } from '../data/knockout.ts';
import type { KnockoutMatch } from '../data/knockout.ts';
import type { Api } from './api.ts';
import {
  arrowButton,
  avatarSvg,
  ballImg,
  crestSvg,
  flagEmoji,
  h,
  icon,
  jerseySvg,
  pill,
  pitchSvg,
  shade,
  toggle,
} from './kit.ts';
import { altKitFor } from '../data/look.ts';
import { DIFFICULTY_LABEL, DIFFICULTY_LEVEL } from './state.ts';
import { publicUrl } from '../core/assets.ts';
import { cabezaUrl, cargarArte, tieneArte } from '../render/arte.ts';
import type { Difficulty } from './state.ts';

// ------------------------------------------------------------------ comunes

function screenEl(cls: string): HTMLElement {
  return h('div', { class: `screen ${cls}` });
}

/**
 * Cara del futbolista en la interfaz: si tiene arte dibujado a mano se muestra
 * su retrato; si no, el muñeco de vectores de siempre. Mientras el SVG carga,
 * se pinta el vector y `repintar` vuelve a construir la pantalla al terminar.
 */
function caraJugador(team: Team, player: RosterPlayer | undefined, size: number, repintar?: () => void): Element {
  const name = player?.name;
  const url = cabezaUrl(team.id, name);
  if (url) {
    const img = h('img', { class: 'cara-arte', src: url, alt: name ?? team.name, draggable: 'false' });
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    return img;
  }
  if (name && tieneArte(team.id, name)) cargarArte(team.id, name, repintar);
  return avatarSvg(team, player, size);
}

function ribbon(text: string, small = false): HTMLElement {
  return h('div', { class: `ribbon${small ? ' small' : ''}`, text });
}

function cornerFlag(): HTMLElement {
  return h('div', { class: 'corner-flag' }, flagEmoji('🇨🇴'), h('span', { text: 'ES' }));
}

function helpButton(mode: 'tournament' | 'duo'): HTMLElement {
  const btn = h('button', { class: 'corner-btn help', type: 'button', 'aria-label': 'Controles' });
  btn.append(icon('help'));
  btn.addEventListener('click', () => openControls(mode));
  return btn;
}

/** El goleador "de casa": el futbolista que eligió el jugador. */
function humanStar(api: Api): { teamId: string; name: string } | null {
  if (api.state.mode !== 'tournament') return null;
  const team = teamById(api.state.teamId);
  const player = team.roster[api.state.players[0]] ?? team.roster[0];
  return player ? { teamId: team.id, name: player.name } : null;
}

function gearButton(api: Api): HTMLElement {
  const btn = h('button', { class: 'corner-btn gear', type: 'button', 'aria-label': 'Ajustes' });
  btn.append(icon('gear'));
  btn.addEventListener('click', () => api.openSettings());
  return btn;
}

function footer(...items: HTMLElement[]): HTMLElement {
  return h('div', { class: 'screen-foot' }, ...items);
}

function backButton(api: Api, target: Parameters<Api['to']>[0]): HTMLElement {
  return pill('Atrás', { onClick: () => api.to(target) });
}

// --------------------------------------------------------------------- menú

export function buildMenu(api: Api): HTMLElement {
  const scr = screenEl('menu');
  scr.append(cornerFlag(), gearButton(api));

  // Emblema real del Mundial 2026 (el trofeo dentro del "26"). El balón queda
  // como detalle del partido, no como logo: la marca del torneo manda.
  const emblem = h('div', { class: 'logo-emblem' });
  emblem.append(h('img', { src: publicUrl('marca/mundial26.webp'), alt: 'Mundial 2026', draggable: 'false' }));
  const logo = h(
    'div',
    { class: 'logo' },
    emblem,
    h('div', { class: 'logo-ribbon', text: 'VANTAGGIO' }),
    h('div', { class: 'logo-title', text: 'MUNDIAL 2026' }),
    h('div', { class: 'logo-sub', text: '48 selecciones · 12 grupos · 104 partidos' }),
  );

  const actions = h('div', { class: 'menu-actions' });
  if (api.save.tournament) {
    actions.append(
      pill('Continuar campeonato', {
        wide: true,
        primary: true,
        iconName: 'trophy',
        onClick: () => api.continueTournament(),
      }),
    );
  }
  actions.append(
    pill('Nuevo campeonato', {
      wide: true,
      primary: !api.save.tournament,
      onClick: () => api.newTournament(),
    }),
    pill('Dos jugadores', { wide: true, onClick: () => api.startDuo() }),
  );

  const shelf = h('button', { class: 'trophy-shelf', type: 'button', 'aria-label': 'Trofeos' });
  const cup = h('span', { class: 'cup' });
  cup.append(icon('trophy'));
  shelf.append(cup, h('span', { text: `Trofeos · ${api.save.trophies.length}/${ACHIEVEMENTS.length}` }));
  shelf.addEventListener('click', () => api.to('trophies'));

  // Palmarés: los Mundiales ganados y en qué dificultad. Es lo que queda
  // guardado cuando cierras el juego (los trofeos sueltos son otra lista).
  const champs = api.save.championships ?? [];
  let palmares: HTMLElement | null = null;
  if (champs.length > 0) {
    palmares = h('div', { class: 'palmares' });
    const total = champs.length;
    palmares.append(
      h('span', { class: 'pal-title', text: `${total} Mundial${total === 1 ? '' : 'es'} ganado${total === 1 ? '' : 's'}` }),
    );
    const chips = h('div', { class: 'pal-chips' });
    for (const d of ['facil', 'normal', 'dificil', 'legendario'] as Difficulty[]) {
      const n = champs.filter((c) => c.difficulty === d).length;
      if (n === 0) continue;
      const chip = h('span', { class: `pal-chip ${d}` });
      chip.append(h('span', { class: 'pal-n', text: String(n) }), h('span', { text: DIFFICULTY_LABEL[d] }));
      chips.append(chip);
    }
    palmares.append(chips);
  }

  scr.append(logo, actions, shelf, ...(palmares ? [palmares] : []), h('div', { class: 'menu-version', text: 'v0.4 · Edición Mundial 2026' }));
  return scr;
}

// --------------------------------------------------------------- dificultad

const CUP_COLOR: Record<Difficulty, string> = {
  facil: '#c98b4b',
  normal: '#cfd4da',
  dificil: '#ffcb45',
  legendario: '#ff7a45',
};

const DIFF_NOTE: Record<Difficulty, string> = {
  facil: 'para empezar',
  normal: 'equilibrado',
  dificil: 'te va a costar',
  legendario: 'sin piedad',
};

export function buildDifficulty(api: Api): HTMLElement {
  const scr = screenEl('difficulty');
  scr.append(cornerFlag(), gearButton(api));

  const list = h('div', { class: 'diff-list' });
  const order: Difficulty[] = ['facil', 'normal', 'dificil', 'legendario'];
  for (const d of order) {
    const row = h('button', {
      class: `diff-row${api.state.difficulty === d ? ' on' : ''}`,
      type: 'button',
    });
    const cupWrap = h('span', { class: 'diff-cup' });
    const cupIcon = icon('trophy');
    cupIcon.style.color = CUP_COLOR[d];
    cupIcon.style.filter = `drop-shadow(0 3px 6px ${CUP_COLOR[d]}55)`;
    cupWrap.append(cupIcon);

    const radio = h('span', { class: 'diff-radio' });
    const check = icon('check', 'diff-check');
    radio.append(check);

    row.append(cupWrap, radio, h('span', { class: 'diff-label', text: DIFFICULTY_LABEL[d] }));
    if (d === 'legendario') {
      const star = icon('bolt');
      star.style.color = '#ff7a45';
      star.style.width = '16px';
      star.style.height = '16px';
      row.append(star);
    }
    row.append(h('span', { class: 'diff-note', text: DIFF_NOTE[d] }));
    row.addEventListener('click', () => {
      api.setDifficulty(d);
      api.refresh();
    });
    list.append(row);
  }

  scr.append(
    h('div', { class: 'screen-body' }, h('div', { class: 'screen-head' }, ribbon('Nivel de dificultad')), list),
    footer(backButton(api, 'menu'), pill('Siguiente', { primary: true, onClick: () => api.advancePick() })),
  );
  return scr;
}

// ---------------------------------------------------------------- sorteo

export function buildDraw(api: Api): HTMLElement {
  const scr = screenEl('draw');
  scr.append(cornerFlag(), gearButton(api));

  const grid = h('div', { class: 'draw-grid' });

  const card = (
    mode: 'real' | 'random',
    title: string,
    tag: string,
    desc: string,
    glyph: Parameters<typeof icon>[0],
  ): HTMLElement => {
    const el = h('button', { class: 'draw-card', type: 'button' });
    const glyphEl = h('span', { class: 'draw-glyph' });
    glyphEl.append(icon(glyph));
    const body = h('div', { class: 'draw-body' });
    body.append(
      h('span', { class: 'draw-title', text: title }),
      h('span', { class: 'draw-tag', text: tag }),
      h('span', { class: 'draw-desc', text: desc }),
    );
    el.append(glyphEl, body);
    el.addEventListener('click', () => api.chooseDraw(mode));
    return el;
  };

  grid.append(
    card('real', 'Sorteo real', 'OFICIAL', 'Los 12 grupos de la FIFA, idénticos a los del Mundial 2026.', 'trophy'),
    card('random', 'Sorteo aleatorio', 'DISTINTO CADA VEZ', 'Se barajan las 48 selecciones y se reparten al azar en cada campeonato.', 'dice'),
  );

  scr.append(
    h('div', { class: 'screen-body' }, h('div', { class: 'screen-head' }, ribbon('Sorteo del campeonato')), grid),
    footer(backButton(api, 'difficulty')),
  );
  return scr;
}

// ------------------------------------------------------------ selección

const STAT_LABEL: [keyof RosterPlayer, string][] = [
  ['spd', 'Vel'],
  ['jmp', 'Sal'],
  ['pow', 'Pot'],
  ['pre', 'Pre'],
];

export function buildTeam(api: Api): HTMLElement {
  const scr = screenEl('team');
  scr.append(cornerFlag(), gearButton(api));

  const index = api.state.pickIndex;
  const dyn = h('div', { class: 'team-stage' });

  const render = (): void => {
    dyn.replaceChildren();
    const teamId = api.state.picks[index] ?? TEAMS[0]!.id;
    const team = teamById(teamId);
    const pIndex = api.state.players[index] ?? 0;
    const player = team.roster[pIndex] ?? team.roster[0]!;

    const crestSlot = h('div', { class: 'crest-slot' });
    const crest = crestSvg(team, 124);
    crest.classList.add('pop');
    crestSlot.append(crest);

    const faceSlot = h('div', { class: 'face-slot' });
    const face = h('div', { class: 'player-face' });
    face.append(caraJugador(team, player, 104, render));
    faceSlot.append(face);

    const jersey = h('div', { class: 'jersey-chip' });
    jersey.append(jerseySvg(team, player.num, 30), h('span', { class: 'jersey-num', text: `#${player.num} · ${player.pos}` }));

    const stats = h('div', { class: 'player-stats' });
    for (const [key, label] of STAT_LABEL) {
      const chip = h('div', { class: 'stat-chip' });
      const bar = h('div', { class: 'bar' });
      const fill = h('i');
      fill.style.width = `${player[key]}%`;
      bar.append(fill);
      chip.append(bar, h('span', { class: 'cap', text: label }));
      stats.append(chip);
    }

    dyn.append(
      h('div', { class: 'team-flag', text: team.flag }),
      h('div', { class: 'team-name', text: team.name }),
      h(
        'div',
        { class: 'stepper' },
        arrowButton('left', () => cycleTeam(api, -1, render), 'Selección anterior'),
        crestSlot,
        arrowButton('right', () => cycleTeam(api, 1, render), 'Selección siguiente'),
      ),
      jersey,
      h(
        'div',
        { class: 'stepper' },
        arrowButton('left', () => cyclePlayer(api, -1, render), 'Futbolista anterior'),
        faceSlot,
        arrowButton('right', () => cyclePlayer(api, 1, render), 'Futbolista siguiente'),
      ),
      h('div', { class: 'player-name', html: `${player.name}<span>${team.short}</span>` }),
      stats,
    );
  };
  render();

  const subtitle = api.state.mode === 'duo' ? `Jugador ${index + 1}` : 'Tu selección';
  scr.append(
    h('div', { class: 'screen-body' }, h('div', { class: 'screen-head' }, ribbon('Selección de equipo'), h('div', { class: 'screen-sub', text: subtitle })), dyn),
    footer(
      pill('Atrás', {
        onClick: () => {
          if (api.state.mode === 'duo' && index === 1) {
            api.state.pickIndex = 0;
            api.refresh();
          } else if (api.state.mode === 'duo') {
            api.to('menu');
          } else {
            api.to('draw');
          }
        },
      }),
      pill(api.state.mode === 'duo' && index === 0 ? 'Siguiente' : 'Jugar', {
        primary: true,
        onClick: () => api.advancePick(),
      }),
    ),
  );
  return scr;
}

function cycleTeam(api: Api, delta: number, rerender: () => void): void {
  const index = api.state.pickIndex;
  const current = api.state.picks[index] ?? TEAMS[0]!.id;
  const at = Math.max(0, TEAMS.findIndex((t) => t.id === current));
  const next = TEAMS[(at + delta + TEAMS.length) % TEAMS.length]!;
  api.pickTeam(next.id);
  rerender();
}

function cyclePlayer(api: Api, delta: number, rerender: () => void): void {
  const index = api.state.pickIndex;
  const team = teamById(api.state.picks[index] ?? TEAMS[0]!.id);
  const at = api.state.players[index] ?? 0;
  api.state.players[index] = (at + delta + team.roster.length) % team.roster.length;
  rerender();
}

// ---------------------------------------------------------------- opciones

export function buildOptions(api: Api): HTMLElement {
  const scr = screenEl('options');
  scr.append(cornerFlag(), gearButton(api), helpButton(api.state.mode));

  const home = teamById(api.state.picks[0] ?? 'colombia');
  const away = teamById(api.state.picks[1] ?? 'argentina');
  const isDuo = api.state.mode === 'duo';
  const userTeam = isDuo ? home : teamById(api.state.teamId);
  const playerIsHome = userTeam.id === home.id;
  const player = userTeam.roster[api.state.players[0]] ?? userTeam.roster[0]!;

  const matchup = h('div', { class: 'matchup' });
  for (const [team, side] of [
    [home, 'home'],
    [away, 'away'],
  ] as [Team, string][]) {
    const cell = h('div', { class: `matchup-team ${side}` });
    const crest = crestSvg(team, 44);
    cell.append(crest, h('span', { text: team.name }));
    matchup.append(cell);
    if (side === 'home') matchup.append(h('span', { class: 'matchup-vs', text: 'VS' }));
  }

  const venueNote = isDuo
    ? 'Cada jugador defiende su arco: P1 a la izquierda, P2 a la derecha.'
    : playerIsHome
      ? 'Defiendes el arco izquierdo y atacas el derecho.'
      : 'Defiendes el arco derecho y atacas el izquierdo.';

  const venue = h('div', { class: 'venue-note' });
  venue.append(
    h('span', { class: `venue-tag${playerIsHome || isDuo ? ' local' : ''}`, text: isDuo ? '2 JUGADORES' : playerIsHome ? 'LOCAL' : 'VISITANTE' }),
    h('span', { class: 'venue-text', text: venueNote }),
  );

  const altOn = api.state.options.altKit;
  const homeColor = altOn && home.id === api.state.teamId ? altKitFor(home).jersey : home.jersey;
  const awayColor = altOn && away.id === api.state.teamId ? altKitFor(away).jersey : away.jersey;

  const left = h('div', { class: 'opt-card' });
  left.append(h('div', { class: 'opt-card-head' }, h('span', { text: 'Terreno de juego' })));
  const preview = h('div', { class: 'pitch-preview' });
  preview.append(pitchSvg([homeColor, awayColor]));
  left.append(preview);

  // Leyenda: de qué color eres tú y de qué color el rival, en el mismo mapa.
  const legend = h('div', { class: 'pitch-legend' });
  for (const [team, color, tag] of [
    [home, homeColor, isDuo ? 'P1' : playerIsHome ? 'TÚ' : 'RIVAL'],
    [away, awayColor, isDuo ? 'P2' : playerIsHome ? 'RIVAL' : 'TÚ'],
  ] as [Team, string, string][]) {
    const item = h('span', { class: 'pitch-key' });
    const dot = h('i');
    dot.style.background = color;
    item.append(dot, h('span', { text: `${team.short} · ${tag}` }));
    legend.append(item);
  }
  left.append(legend);
  left.append(h('div', { class: 'opt-group' }, h('div', { class: 'opt-group-title', text: 'Balón' })));
  const ballRow = h('div', { class: 'ball-row' });
  const currentBall = Math.min(1, Math.max(0, api.state.options.ball));
  for (let i = 0; i < 2; i++) {
    const pick = h('button', {
      class: `ball-pick${currentBall === i ? ' on' : ''}`,
      type: 'button',
      'aria-label': i === 0 ? 'Balón Trionda' : 'Balón clásico',
    });
    pick.append(ballImg(i, 52), h('span', { class: 'pointer' }));
    pick.addEventListener('click', () => {
      api.setOption('ball', i);
      for (const [n, other] of [...ballRow.children].entries()) {
        other.classList.toggle('on', n === i);
      }
    });
    ballRow.append(pick);
  }
  left.append(ballRow);

  const right = h('div', { class: 'opt-card' });
  right.append(h('div', { class: 'opt-card-head' }, h('span', { text: 'Futbolista' })));
  const face = h('div', { class: 'player-face' });
  face.append(caraJugador(userTeam, player, 116, () => api.refresh()));
  // Cambiar de futbolista en la antesala: en torneo eliges al tuyo; en dos
  // jugadores cada uno lo hace en la pantalla de selección.
  const faceRow = h('div', { class: 'stepper face-step' });
  if (!isDuo) {
    const cycle = (delta: number): void => {
      const at = api.state.players[0] ?? 0;
      api.state.players[0] = (at + delta + userTeam.roster.length) % userTeam.roster.length;
      api.refresh();
    };
    faceRow.append(
      arrowButton('left', () => cycle(-1), 'Futbolista anterior'),
      face,
      arrowButton('right', () => cycle(1), 'Futbolista siguiente'),
    );
  } else {
    faceRow.append(face);
  }
  const stats = h('div', { class: 'player-stats' });
  for (const [key, label] of STAT_LABEL) {
    const chip = h('div', { class: 'stat-chip' });
    const bar = h('div', { class: 'bar' });
    const fill = h('i');
    fill.style.width = `${player[key]}%`;
    bar.append(fill);
    chip.append(bar, h('span', { class: 'cap', text: label }));
    stats.append(chip);
  }

  // La camiseta, con su estampado: es la forma más rápida de reconocer al equipo.
  // Uniforme: principal o alternativo. El alternativo invierte los colores
  // (oscuro si la camiseta es clara) y conserva el estampado del equipo.
  const kitRow = h('div', { class: 'kit-row' });
  const kitOptions: { label: string; on: boolean; alt: boolean }[] = [
    { label: 'Principal', on: !api.state.options.altKit, alt: false },
    { label: 'Alternativa', on: api.state.options.altKit, alt: true },
  ];
  for (const opt of kitOptions) {
    const btn = h('button', { class: `kit-pick${opt.on ? ' on' : ''}`, type: 'button', 'aria-label': `Uniforme ${opt.label}` });
    btn.append(jerseySvg(userTeam, player.num, 34, opt.alt), h('span', { class: 'kit-lbl', text: opt.label }));
    btn.addEventListener('click', () => {
      api.setOption('altKit', opt.alt);
      api.refresh();
    });
    kitRow.append(btn);
  }

  right.append(
    h(
      'div',
      { class: 'footballer' },
      faceRow,
      h('div', { class: 'player-name', text: player.name }),
      h('div', { class: 'player-meta', text: `#${player.num} · ${player.pos} · ${userTeam.name}` }),
      kitRow,
      stats,
    ),
  );

  const rows = h('div', { class: 'opt-rows' });
  const addRow = (label: string, glyph: Parameters<typeof icon>[0], key: 'weather' | 'wind' | 'fans'): void => {
    const g = h('span', { class: 'glyph' });
    g.append(icon(glyph));
    const row = h('div', { class: 'opt-row' }, g, h('span', { class: 'lbl', text: label }), toggle(api.state.options[key], (v) => api.setOption(key, v)));
    rows.append(row);
  };
  addRow('Clima', 'cloud', 'weather');
  addRow('Viento', 'wind', 'wind');
  addRow('Fanáticos enojados', 'bottle', 'fans');
  // Condiciones aleatorias: clima, viento y público. Al activarlo se sortean
  // en el acto (y se ven los interruptores cambiar) y se vuelven a sortear en
  // cada partido. No toca equipos ni futbolistas: eso lo eliges tú.
  {
    const g = h('span', { class: 'glyph' });
    g.append(icon('dice'));
    const row = h('div', { class: 'opt-row' });
    row.append(
      g,
      h('span', { class: 'lbl', text: 'Condiciones aleatorias' }),
      toggle(api.state.options.random, (v) => {
        api.setOption('random', v);
        if (v) api.rerollConditions();
        api.refresh();
      }),
    );
    rows.append(row);
  }

  // Los controles, a un clic y fuera del flujo de la pantalla.
  const controlsRow = h('div', { class: 'opt-row controls-row' });
  const cGlyph = h('span', { class: 'glyph' });
  cGlyph.append(icon('help'));
  const seeBtn = h('button', { class: 'pill ghost tiny', type: 'button', text: 'Ver' });
  seeBtn.addEventListener('click', () => openControls(api.state.mode));
  controlsRow.append(cGlyph, h('span', { class: 'lbl', text: 'Controles' }), seeBtn);
  rows.append(controlsRow);

  if (isDuo) {
    const goalRow = h('div', { class: 'opt-row action' });
    const glyph = h('span', { class: 'glyph' });
    glyph.append(icon('trophy'));
    const choices = h('div', { class: 'goal-choices' });
    for (const n of [3, 5, 7]) {
      const btn = h('button', {
        class: `goal-pill${api.state.options.goalTarget === n ? ' on' : ''}`,
        type: 'button',
        text: `${n}`,
      });
      btn.addEventListener('click', () => {
        api.setOption('goalTarget', n);
        for (const [i, other] of [...choices.children].entries()) other.classList.toggle('on', [3, 5, 7][i] === n);
      });
      choices.append(btn);
    }
    goalRow.append(glyph, h('span', { class: 'lbl', text: 'Goles para ganar' }), choices);
    rows.append(goalRow);
  }
  const optionsBar = h('div', { class: 'options-bar' }, rows);

  const grid = h('div', { class: 'options-grid' }, left, right);

  scr.append(
    h('div', { class: 'screen-body' }, ribbon('Antes del partido', true), matchup, venue, grid, optionsBar),
    footer(pill('Atrás', { onClick: () => api.backFromOptions() }), pill('Jugar', { primary: true, onClick: () => api.beginMatch() })),
  );
  return scr;
}

// ---------------------------------------------------------------- controles

/**
 * Los controles viven en un panel aparte. Antes eran una tarjeta más en la
 * antesala y empujaban el botón «Jugar» fuera de la pantalla.
 */
export function openControls(mode: 'tournament' | 'duo' = 'tournament'): void {
  const overlay = h('div', { class: 'modal' });
  const card = h('div', { class: 'modal-card controls-modal' });
  card.append(ribbon(mode === 'duo' ? 'Mandos' : 'Controles', true));

  const rows = h('div', { class: 'controls-card' });
  const addKey = (keys: string, what: string): void => {
    rows.append(h('span', { class: 'key', text: keys }), h('span', { class: 'what', text: what }));
  };
  if (mode === 'duo') {
    addKey('P1 · A / D · W · S', 'moverse · saltar · bajar el remate');
    addKey('P1 · ESPACIO', 'patear (mantener = cargar) · SHIFT = dash');
    addKey('P2 · ← / → · ↑ · ↓', 'moverse · saltar · bajar el remate');
    addKey('P2 · ENTER', 'patear (mantener = cargar) · / = dash');
  } else {
    addKey('A / D  ·  ← / →', 'moverse y apuntar');
    addKey('W · ↑', 'saltar · S / ↓ baja el remate');
    addKey('ESPACIO · ENTER', 'patear (mantener = cargar)');
    addKey('SHIFT · C · /', 'arranque rápido');
    addKey('ESC', 'pausa');
  }
  card.append(rows);

  const close = pill('Cerrar', { onClick: () => overlay.remove() });
  card.append(h('div', { class: 'screen-foot' }, close));
  overlay.append(card);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.append(overlay);
}

// ------------------------------------------------------------------ grupos

export function buildGroups(api: Api): HTMLElement {
  const scr = screenEl('groups');
  scr.append(cornerFlag(), gearButton(api));

  const myGroupId = api.state.activeGroup;
  const group = api.state.groups.find((g) => g.id === api.state.viewGroup) ?? api.state.groups[0]!;
  const mine = group.id === myGroupId;
  const rows = tableOf(group);

  const tabs = h('div', { class: 'group-tabs' });
  for (const g of api.state.groups) {
    const isMine = g.id === myGroupId;
    const tab = h('button', {
      class: `group-tab${g.id === group.id ? ' on' : ''}${isMine ? ' mine' : ''}`,
      type: 'button',
      text: `Grupo ${g.id}`,
    });
    tab.addEventListener('click', () => {
      // Solo cambia la vista: el grupo del jugador no se mueve. Antes, mirar
      // otro grupo cambiaba el grupo activo y la app creía que el torneo había
      // terminado (y ofrecía "Nuevo campeonato").
      api.setViewGroup(g.id);
      api.refresh();
    });
    tabs.append(tab);
  }

  const table = h('div', { class: 'panel' });
  table.append(
    h(
      'div',
      { class: 'table-head' },
      h('span', { class: 'pos', text: '#' }),
      h('span', { text: 'Equipo' }),
      h('span', { class: 'num', text: 'PJ' }),
      h('span', { class: 'num', text: 'G' }),
      h('span', { class: 'num', text: 'E' }),
      h('span', { class: 'num', text: 'P' }),
      h('span', { class: 'num', text: 'GF-GC' }),
      h('span', { class: 'num', text: 'Dif' }),
      h('span', { class: 'num', text: 'Pts' }),
    ),
  );
  // Zonas de clasificación: los dos primeros pasan directo y el tercero puede
  // entrar como mejor tercero. Se pinta la fila, no el número, para que se lea
  // de un vistazo quién sigue vivo.
  const seeds = api.state.knockout?.seeds ?? null;
  rows.forEach((r, i) => {
    const isYou = r.team.id === api.state.teamId;
    let zone = '';
    if (seeds) {
      if (seeds.includes(r.team.id)) zone = ' qualify';
      else if (i === 2) zone = ' third-out';
    } else if (i < 2) zone = ' qualify';
    else if (i === 2) zone = ' third';
    const row = h('div', { class: `table-row${zone}${isYou ? ' you' : ''}` });
    row.append(
      h('span', { class: 'pos', text: String(i + 1) }),
      h('span', { class: 'teamcell' }, h('span', { class: 'flag', text: r.team.flag }), h('span', { class: 'nm', text: r.team.name })),
      h('span', { class: 'num', text: String(r.pj) }),
      h('span', { class: 'num', text: String(r.g) }),
      h('span', { class: 'num', text: String(r.e) }),
      h('span', { class: 'num', text: String(r.p) }),
      h('span', { class: 'num', text: `${r.gf}-${r.gc}` }),
      h('span', { class: 'num', text: r.dif > 0 ? `+${r.dif}` : String(r.dif) }),
      h('span', { class: 'pts', text: String(r.pts) }),
    );
    table.append(row);
  });

  table.append(
    h(
      'div',
      { class: 'table-legend' },
      h('span', { class: 'lg q', text: '1.º y 2.º clasifican' }),
      h('span', { class: 'lg t', text: '3.º puede entrar como mejor tercero' }),
    ),
  );

  const fixtures = h('div', { class: 'panel' });
  const list = h('div', { class: 'fixtures' });
  for (const day of [1, 2, 3] as const) {
    const dayFixtures = group.fixtures.filter((f) => f.day === day);
    list.append(h('div', { class: 'fixture-day', text: `Jornada ${day}` }));
    for (const f of dayFixtures) {
      const home = teamById(f.home);
      const away = teamById(f.away);
      const you = f.home === api.state.teamId || f.away === api.state.teamId;
      const row = h('div', { class: `fixture${you ? ' you' : ''}` });
      const score = f.hg === null ? h('span', { class: 'sc pending', text: '– : –' }) : h('span', { class: 'sc', text: `${f.hg} : ${f.ag}` });
      row.append(
        h('span', { class: 't' }, h('span', { text: home.flag }), h('span', { text: home.name })),
        score,
        h('span', { class: 't away' }, h('span', { text: away.name }), h('span', { text: away.flag })),
      );
      list.append(row);
    }
  }
  fixtures.append(list);

  const cols = h('div', { class: 'groups-cols' }, table, fixtures);
  const finished = api.groupFinished();

  // Aviso de clasificación, solo cuando el jugador terminó su grupo.
  let status: HTMLElement | null = null;
  if (finished) {
    const qualified = api.state.knockout?.seeds.includes(api.state.teamId) ?? null;
    status = h('div', { class: `group-status${qualified === false ? ' out' : ''}` });
    status.append(
      h('span', { class: 'gs-title', text: 'Fase de grupos terminada' }),
      h('span', {
        class: 'gs-text',
        text:
          qualified === true
            ? 'Clasificaste a dieciseisavos. Sigue en eliminatorias.'
            : qualified === false
              ? 'No entraste entre los 32. El campeonato terminó para ti.'
              : 'Pulsa «Jugar eliminatorias» para armar el cuadro.',
      }),
    );
  }

  const foot = footer();
  foot.append(pill('Atrás', { onClick: () => api.to('menu') }));
  if (!mine) {
    foot.append(
      pill('Mi grupo', {
        primary: true,
        onClick: () => {
          api.setViewGroup(myGroupId);
          api.refresh();
        },
      }),
    );
  } else if (finished) {
    foot.append(
      pill(api.state.knockout ? 'Ver eliminatorias' : 'Jugar eliminatorias', {
        primary: true,
        onClick: () => {
          api.ensureKnockout();
          api.to('knockout');
        },
      }),
    );
  } else {
    foot.append(pill('Siguiente', { primary: true, onClick: () => api.nextFixture() }));
  }
  // Goleadores del torneo, consultables sin salir de la fase de grupos.
  foot.append(pill('Estadísticas', { iconName: 'chart', onClick: () => api.to('stats') }));

  // El pie va fuera del cuerpo: así se queda pegado abajo cuando la pantalla
  // es baja y «Siguiente» no se sale de la ventana.
  scr.append(
    h(
      'div',
      { class: 'screen-body' },
      h('div', { class: 'screen-head' }, ribbon('Fase de grupos'), h('div', { class: 'screen-sub', text: mine ? 'Tu grupo' : `Mirando el grupo ${group.id}` })),
      status,
      h('div', { class: 'groups-wrap' }, tabs, cols),
    ),
    foot,
  );
  return scr;
}

// -------------------------------------------------------------- eliminatorias

function koLine(api: Api, match: KnockoutMatch, teamId: string | null, score: number | null, pen: number | null): HTMLElement {
  const line = h('div', { class: 'ko-line' });
  if (!teamId) {
    line.append(h('span', { class: 'nm empty', text: '—' }), h('span', { class: 'sc', text: '' }));
    return line;
  }
  const team = teamById(teamId);
  const isYou = teamId === api.state.teamId;
  const won = match.winner === teamId;
  if (isYou) line.classList.add('you');
  if (won) line.classList.add('win');
  line.append(
    h('span', { class: 'flag', text: team.flag }),
    h('span', { class: 'nm', text: team.short }),
    h('span', { class: 'sc', text: score === null ? '' : pen === null ? String(score) : `${score} (${pen})` }),
  );
  return line;
}

/**
 * Cuando el torneo termina (te eliminan, no clasificas o sales campeón) se
 * muestra el campeón y los líderes del campeonato. Antes la pantalla se quedaba
 * con el cuadro a medias y no decía quién había ganado.
 */
function championPanel(api: Api, ko: NonNullable<Api['state']['knockout']>): HTMLElement {
  const champion = teamById(ko.champion!);
  const final = ko.rounds[ko.rounds.length - 1]?.[0] ?? null;
  // Subcampeón: el otro finalista. Tercero: el que ganó el partido de 3.º y 4.º.
  const runnerUpId = final ? (final.home === champion.id ? final.away : final.home) : null;
  const runnerUp = runnerUpId ? teamById(runnerUpId) : null;
  const thirdId = ko.third?.winner ?? null;
  const third = thirdId ? teamById(thirdId) : null;
  const report = tournamentReport(api.state.groups, ko, { prefer: humanStar(api), hints: api.save.tournament?.hints ?? null });
  const scorer = report.scorers[0] ?? null;
  const youWon = champion.id === api.state.teamId;

  const panel = h('div', { class: `champion-panel${youWon ? ' mine' : ''}` });
  panel.append(h('div', { class: 'champ-ribbon', text: youWon ? '¡Campeón del Mundial 2026!' : 'Campeón del Mundial 2026' }));

  // ---- podio -----------------------------------------------------------
  const podium = h('div', { class: 'podium' });
  const podiumCol = (pos: number, team: Team | null, hero: boolean): HTMLElement => {
    const col = h('div', { class: `podium-col p${pos}${hero ? ' hero' : ''}` });
    const who = h('div', { class: 'who' });
    if (team) {
      if (hero) {
        const me = team.roster[api.state.players[0]] ?? team.roster[0];
        if (me) {
          const face = h('div', { class: 'podium-face' });
          face.append(caraJugador(team, me, 96));
          who.append(face);
        } else {
          who.append(crestSvg(team, 64));
        }
      } else {
        who.append(crestSvg(team, 54));
      }
    }
    const trophy = h('span', { class: 'podium-cup', text: '🏆' });
    const base = h('div', { class: 'base' }, h('span', { class: 'pos', text: String(pos) }));
    const name = h('div', { class: 'nm', text: team ? team.name : '—' });
    col.append(who, trophy, name, base);
    return col;
  };
  podium.append(podiumCol(2, runnerUp, false), podiumCol(1, champion, youWon), podiumCol(3, third, false));
  panel.append(podium);

  // ---- líderes ---------------------------------------------------------
  const leaders = h('div', { class: 'champ-leaders' });
  if (scorer) {
    leaders.append(
      h(
        'div',
        { class: 'champ-lead' },
        h('span', { class: 'k', text: 'Bota de Oro' }),
        h('span', { class: 'v', text: scorer.name }),
        h('span', { class: 'tm', text: `${teamById(scorer.teamId).short} · ${scorer.goals} goles` }),
      ),
    );
  }
  if (report.bestDefense) {
    const t = teamById(report.bestDefense.teamId);
    const keeper = t.roster.find((p) => p.pos === 'POR');
    leaders.append(
      h(
        'div',
        { class: 'champ-lead' },
        h('span', { class: 'k', text: 'Guante de Oro' }),
        h('span', { class: 'v', text: keeper?.name ?? t.short }),
        h('span', { class: 'tm', text: `${t.short} · ${report.bestDefense.conceded} goles recibidos` }),
      ),
    );
  }
  panel.append(leaders);

  panel.append(
    h('div', { class: 'lead-title', text: 'Goleadores del torneo' }),
    h(
      'div',
      { class: 'lead-head' },
      h('span', { class: 'pos', text: '#' }),
      h('span'),
      h('span', { class: 'nm', text: 'Jugador' }),
      h('span', { class: 'tm', text: 'EQ' }),
      h('span', { class: 'n', text: 'G' }),
    ),
    scoreTable(report.scorers, 5),
    h('div', { class: 'champ-actions' }, pill('Ver estadísticas completas', { onClick: () => api.to('stats') })),
  );
  return panel;
}

/** Partido de 3.º y 4.º puesto: se juega y se muestra aparte del cuadro. */
function thirdPanel(api: Api, ko: NonNullable<Api['state']['knockout']>): HTMLElement | null {
  const third = ko.third;
  if (!third || !third.home || !third.away) return null;
  const home = teamById(third.home);
  const away = teamById(third.away);
  const y = api.state.teamId;
  const mine = third.home === y || third.away === y;
  const wrap = h('div', { class: `third-panel${mine ? ' mine' : ''}` });
  wrap.append(h('div', { class: 'third-title', text: '3.º y 4.º puesto' }));
  const line = h('div', { class: 'third-line' });
  const mk = (team: Team, score: number | null, won: boolean): HTMLElement => {
    const cell = h('span', { class: `third-team${won ? ' win' : ''}${team.id === y ? ' you' : ''}` });
    cell.append(h('span', { class: 'flag', text: team.flag }), h('span', { class: 'nm', text: team.short }));
    if (score !== null) cell.append(h('span', { class: 'sc', text: String(score) }));
    return cell;
  };
  line.append(mk(home, third.hg, third.winner === home.id), h('span', { class: 'third-x', text: '·' }), mk(away, third.ag, third.winner === away.id));
  wrap.append(line);
  return wrap;
}

/** Etiquetas cortas de cada ronda, como en los cuadros de verdad. */
const BRACKET_LABELS = ['16VOS', '8VOS', 'CUARTOS', 'SEMIFINAL', 'FINAL'];

/**
 * Cuadro de eliminatorias con forma de llave: las dos ramas se cierran en la
 * final, con el trofeo en el centro. Antes eran cinco columnas sueltas, una al
 * lado de otra, y no se leía como un árbol.
 *
 * La rejilla tiene 9 columnas (16vos → final → 16vos) y 8 filas: cada ronda
 * ocupa el doble de filas que la anterior, así que los cruces quedan alineados
 * sin trucos de márgenes. Las líneas se dibujan después, midiendo cada tarjeta.
 */
function koBracket(api: Api, ko: NonNullable<Api['state']['knockout']>, currentRound: number): HTMLElement {
  const wrap = h('div', { class: 'ko-bracket' });
  const grid = h('div', { class: 'ko-grid' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ko-links');
  svg.setAttribute('aria-hidden', 'true');
  grid.append(svg);

  const title = (col: number, text: string, round: number): void => {
    const t = h('div', { class: `ko-col-title${round === currentRound ? ' on' : ''}`, text });
    t.style.gridColumn = String(col);
    t.style.gridRow = '1';
    grid.append(t);
  };
  for (let i = 0; i < 4; i++) {
    title(i + 1, BRACKET_LABELS[i]!, i);
    title(9 - i, BRACKET_LABELS[i]!, i);
  }
  title(5, BRACKET_LABELS[4]!, 4);

  const card = (m: KnockoutMatch, round: number): HTMLElement => {
    const el = h('div', { class: 'ko-card' });
    el.dataset.round = String(round);
    el.dataset.slot = String(m.slot);
    el.dataset.winner = m.winner ?? '';
    // Solo TU partido va resaltado: antes se encendían todas las tarjetas de
    // la ronda y el cuadro parecía un árbol de Navidad.
    const mine = m.home === api.state.teamId || m.away === api.state.teamId;
    if (mine) el.classList.add('you');
    if (mine && !m.winner) el.classList.add('current');
    if (m.winner) el.classList.add('done');
    el.append(koLine(api, m, m.home, m.hg, m.ph), koLine(api, m, m.away, m.ag, m.pa));
    return el;
  };

  // Cada ronda: 16, 8, 4, 2 tarjetas por lado… salvo la final, que va al centro.
  for (let r = 0; r < 4; r++) {
    const perHalf = 2 ** (3 - r);
    const span = 2 ** r;
    for (let slot = 0; slot < perHalf * 2; slot++) {
      const m = ko.rounds[r]?.[slot];
      if (!m) continue;
      const el = card(m, r);
      const left = slot < perHalf;
      const row = (slot % perHalf) * span;
      el.style.gridColumn = String(left ? 1 + r : 9 - r);
      el.style.gridRow = `${row + 2} / span ${span}`;
      grid.append(el);
    }
  }

  const center = h('div', { class: 'ko-center' });
  center.style.gridColumn = '5';
  center.style.gridRow = '2 / span 8';
  center.append(h('img', { class: 'ko-trophy', src: publicUrl('marca/mundial26.webp'), alt: '', draggable: 'false' }));
  const finalMatch = ko.rounds[4]?.[0];
  if (finalMatch) center.append(card(finalMatch, 4));
  if (ko.champion) {
    const champ = teamById(ko.champion);
    center.append(h('div', { class: 'ko-champ', text: `Campeón · ${champ.name}` }));
  }
  grid.append(center);

  wrap.append(grid);
  // Las líneas necesitan medidas reales: se dibujan en cuanto el cuadro está
  // en el documento (y otra vez si cambia de tamaño).
  queueMicrotask(() => layoutBracket(wrap, api.state.teamId));
  return wrap;
}

/** Dibuja las líneas del cuadro midiendo las tarjetas ya colocadas. */
function layoutBracket(root: HTMLElement, teamId: string): void {
  const grid = root.querySelector<HTMLElement>('.ko-grid');
  const svg = root.querySelector<SVGSVGElement>('.ko-links');
  if (!grid || !svg) return;
  const box = grid.getBoundingClientRect();
  if (box.width < 80 || box.height < 80) return;
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);

  const cards = new Map<string, HTMLElement>();
  for (const el of grid.querySelectorAll<HTMLElement>('.ko-card')) {
    cards.set(`${el.dataset.round}:${el.dataset.slot}`, el);
  }
  const rel = (el: HTMLElement): { l: number; r: number; cy: number } => {
    const r = el.getBoundingClientRect();
    return { l: r.left - box.left, r: r.right - box.left, cy: r.top - box.top + r.height / 2 };
  };

  const lines: string[] = [];
  const hot: string[] = [];
  // De cada ronda salen tantas llaves como partidos tiene la siguiente.
  for (let round = 0; round < 4; round++) {
    const parents = 2 ** (3 - round);
    for (let slot = 0; slot < parents; slot++) {
      const p = cards.get(`${round + 1}:${slot}`);
      const a = cards.get(`${round}:${slot * 2}`);
      const b = cards.get(`${round}:${slot * 2 + 1}`);
      if (!p || !a || !b) continue;
      const pr = rel(p);
      const ar = rel(a);
      const br = rel(b);
      // ¿La rama entra por la izquierda o por la derecha? Se ve en la posición.
      const fromLeft = ar.r <= pr.l + 2;
      const xa = fromLeft ? ar.r : ar.l;
      const xb = fromLeft ? br.r : br.l;
      const xp = fromLeft ? pr.l : pr.r;
      const mid = (xa + xp) / 2;
      const seg = (x: number, y: number): string => `M${x},${y} H${mid} V${pr.cy} H${xp}`;
      lines.push(seg(xa, ar.cy), seg(xb, br.cy));
      // El camino del jugador se marca en oro.
      if (a.dataset.winner === teamId) hot.push(seg(xa, ar.cy));
      if (b.dataset.winner === teamId) hot.push(seg(xb, br.cy));
    }
  }

  svg.innerHTML =
    `<path class="ko-link" d="${lines.join(' ')}"/>` + (hot.length ? `<path class="ko-link hot" d="${hot.join(' ')}"/>` : '');

  // Recalcular cuando cambie el tamaño (rotar el móvil, tipografías al cargar).
  const ro = new ResizeObserver(() => {
    ro.disconnect();
    layoutBracket(root, teamId);
  });
  ro.observe(grid);
}

export function buildKnockout(api: Api): HTMLElement {
  const scr = screenEl('knockout');
  scr.append(cornerFlag(), gearButton(api));

  let ko = api.state.knockout;
  if (!ko) {
    api.ensureKnockout();
    ko = api.state.knockout;
  }
  if (!ko) {
    scr.append(
      h('div', { class: 'screen-body' }, ribbon('Eliminatorias', true), h('p', { class: 'overlay-text', text: 'Todavía no hay cuadro: termina la fase de grupos.' })),
      footer(pill('Atrás', { onClick: () => api.to('groups') })),
    );
    return scr;
  }

  const userMatch = matchForTeam(ko, api.state.teamId);
  const third = thirdFor(ko, api.state.teamId);
  const qualified = ko.seeds.includes(api.state.teamId);
  const champion = ko.champion === api.state.teamId;
  const lostMatch = ko.rounds
    .flat()
    .find((m) => (m.home === api.state.teamId || m.away === api.state.teamId) && m.winner && m.winner !== api.state.teamId);
  const currentRound = userMatch?.round ?? lostMatch?.round ?? ko.rounds.length - 1;

  const head = h('div', { class: 'screen-head' }, ribbon('Eliminatorias', true));
  const sub = champion
    ? '¡Campeón del Mundial 2026!'
    : userMatch
      ? `${ROUND_NAMES[userMatch.round]} · te toca jugar`
      : third
        ? 'Te toca el partido por el tercer puesto'
        : qualified
          ? lostMatch
            ? `Eliminado en ${ROUND_NAMES[lostMatch.round]}`
            : 'Esperando rival'
          : 'No clasificaste a las eliminatorias';
  head.append(h('div', { class: 'screen-sub', text: sub }));
  // En el móvil el cuadro no cabe a lo ancho: se avisa de que se desliza.
  head.append(h('div', { class: 'ko-hint', text: 'Desliza para ver el cuadro completo →' }));

  const wrap = koBracket(api, ko, currentRound);

  const foot = footer();
  foot.append(pill('Atrás', { onClick: () => api.to('menu') }));
  foot.append(pill('Mi grupo', { onClick: () => api.to('groups') }));
  if (third) {
    foot.append(pill('Jugar 3.º puesto', { primary: true, onClick: () => api.nextKoMatch() }));
  } else if (userMatch) {
    foot.append(pill('Jugar', { primary: true, onClick: () => api.nextKoMatch() }));
  } else if (champion) {
    const cup = h('span', { class: 'ko-cup', text: '🏆' });
    foot.append(cup, pill('Nuevo campeonato', { primary: true, onClick: () => api.newTournament() }));
  } else if (!qualified || lostMatch) {
    foot.append(pill('Nuevo campeonato', { primary: true, onClick: () => api.newTournament() }));
  }

  // El torneo ya tiene campeón y al jugador no le queda partido: resumen.
  const summary = ko.champion && !userMatch && !third ? championPanel(api, ko) : null;
  const thirdCard = thirdPanel(api, ko);
  scr.append(h('div', { class: 'screen-body' }, head, summary, ...(thirdCard ? [thirdCard] : []), wrap), foot);
  return scr;
}

// --------------------------------------------------------------- resultado

export function buildResult(api: Api): HTMLElement {
  const scr = screenEl('result');
  const r = api.state.result;
  if (!r) return buildMenu(api);
  const home = teamById(r.homeId);
  const away = teamById(r.awayId);

  const card = h('div', { class: 'result-card fade-in' });
  const score = h('div', { class: 'result-score' });
  const mkTeam = (team: Team): HTMLElement => {
    const cell = h('div', { class: 't' });
    cell.append(crestSvg(team, 64), h('span', { text: team.name }));
    return cell;
  };
  score.append(mkTeam(home), h('span', { class: 'n', text: `${r.hg} : ${r.ag}` }), mkTeam(away));

  const stats = h('div', { class: 'result-stats' });
  const addStat = (label: string, a: number, b: number, suffix = ''): void => {
    const total = a + b || 1;
    const row = h('div', { class: 'rstat' });
    const track = h('div', { class: 'track' });
    const fill = h('i');
    fill.style.width = `${Math.round((a / total) * 100)}%`;
    track.append(fill);
    row.append(
      h('span', { class: 'k', text: `${a}${suffix}` }),
      h('span', { class: 'lbl', text: label }),
      h('span', { class: 'k', text: `${b}${suffix}` }),
      track,
    );
    stats.append(row);
  };
  addStat('Remates', r.shots[0], r.shots[1]);
  addStat('Cabezazos', r.headers[0], r.headers[1]);
  addStat('Atajadas', r.saves[0], r.saves[1]);
  // Posesión en porcentaje: los segundos crudos no le dicen nada a nadie.
  addStat('Posesión', r.possession[0], r.possession[1], '%');

  const ownTotal = r.ownGoals[0] + r.ownGoals[1];
  if (ownTotal > 0) {
    stats.append(
      h('div', { class: 'rstat-note', text: `Autogoles: ${home.short} ${r.ownGoals[0]} · ${away.short} ${r.ownGoals[1]}` }),
    );
  }
  if (r.maxSpeed > 0) {
    stats.append(
      h('div', { class: 'rstat-note', text: `Balón más rápido: ${Math.round(r.maxSpeed * 3.6)} km/h` }),
    );
  }

  // ---- goles con minuto -------------------------------------------------
  const goalLog = h('div', { class: 'goal-log' });
  if (r.goals.length > 0) {
    goalLog.append(h('div', { class: 'goal-log-title', text: 'Goles' }));
    for (const g of r.goals) {
      // En propia puerta el autor es del otro equipo: se muestra SU equipo,
      // no el que se beneficia del gol.
      const authorSide = g.own ? 1 - g.side : g.side;
      const team = authorSide === 0 ? home : away;
      const row = h('div', { class: `goal-row ${g.side === 0 ? 'home' : 'away'}${g.own ? ' own' : ''}` });
      row.append(
        h('span', { class: 'min', text: `${g.minute}'` }),
        h('span', { class: 'dot' }),
        h('span', { class: 'who', text: g.scorer + (g.own ? ' (p.p.)' : '') }),
        h('span', { class: 'tm', text: team.short }),
      );
      goalLog.append(row);
    }
  } else {
    goalLog.append(
      h('div', { class: 'goal-log-title', text: 'Goles' }),
      h('div', {
        class: 'goal-none',
        text: r.forfeit ? 'Saliste del partido: el rival suma 3 goles y no hay registro de goles.' : 'Partido sin goles.',
      }),
    );
  }

  const penWinner = r.pen ? (r.pen[0] > r.pen[1] ? home : away) : null;
  const title = r.forfeit
    ? 'Derrota por abandono'
    : penWinner
      ? `Ganó ${penWinner.name}`
      : r.hg === r.ag
        ? 'Empate'
        : r.hg > r.ag
          ? `Ganó ${home.name}`
          : `Ganó ${away.name}`;
  card.append(ribbon(title, true), score);
  if (r.pen) card.append(h('div', { class: 'result-note', text: `Penales ${r.pen[0]} - ${r.pen[1]}` }));
  if (r.forfeit) card.append(h('div', { class: 'result-note', text: 'Saliste del partido: se cuenta como derrota 0-3.' }));
  card.append(stats, goalLog);

  const buttons = h('div', { class: 'screen-foot' });
  // Las estadísticas tienen que estar donde se consultan: al salir del partido.
  const statsPill = (): HTMLElement => pill('Estadísticas', { iconName: 'chart', onClick: () => api.to('stats') });
  if (r.mode === 'tournament') {
    if (r.knockout) {
      buttons.append(pill('Ver eliminatorias', { primary: true, onClick: () => api.to('knockout') }));
    } else if (api.groupFinished()) {
      buttons.append(
        pill('Ir a eliminatorias', {
          primary: true,
          onClick: () => {
            api.ensureKnockout();
            api.to('knockout');
          },
        }),
      );
    } else {
      buttons.append(pill('Volver al grupo', { primary: true, onClick: () => api.to('groups') }));
    }
    buttons.append(statsPill());
  } else {
    buttons.append(pill('Revancha', { primary: true, onClick: () => api.repeatMatch() }), pill('Menú', { onClick: () => api.quitToMenu() }));
  }
  scr.append(card, buttons);
  return scr;
}

// ------------------------------------------------------------ estadísticas

function scoreTable(rows: ScoreRow[], limit: number): HTMLElement {
  const table = h('div', { class: 'lead-table' });
  if (rows.length === 0) {
    table.append(h('div', { class: 'lead-empty', text: 'Todavía sin datos.' }));
    return table;
  }
  rows.slice(0, limit).forEach((row, i) => {
    const team = teamById(row.teamId);
    const line = h('div', { class: 'lead-row' });
    line.append(
      h('span', { class: 'pos', text: String(i + 1) }),
      h('span', { class: 'flag', text: team.flag }),
      h('span', { class: 'nm', text: row.name }),
      h('span', { class: 'tm', text: team.short }),
      h('span', { class: 'n', text: String(row.goals) }),
    );
    table.append(line);
  });
  return table;
}

/** Resultados del jugador dentro del campeonato en curso (no la carrera). */
function myTournamentRecord(api: Api): { played: number; wins: number; draws: number; losses: number; gf: number; ga: number } {
  const me = api.state.teamId;
  let played = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let gf = 0;
  let ga = 0;
  const add = (home: string, away: string, hg: number, ag: number): void => {
    if (home !== me && away !== me) return;
    const mine = home === me ? hg : ag;
    const theirs = home === me ? ag : hg;
    played++;
    gf += mine;
    ga += theirs;
    if (mine > theirs) wins++;
    else if (mine === theirs) draws++;
    else losses++;
  };
  for (const group of api.state.groups) {
    for (const fx of group.fixtures) if (fx.hg !== null && fx.ag !== null) add(fx.home, fx.away, fx.hg, fx.ag);
  }
  for (const round of api.state.knockout?.rounds ?? []) {
    for (const m of round) if (m.home && m.away && m.hg !== null && m.ag !== null) add(m.home, m.away, m.hg, m.ag);
  }
  return { played, wins, draws, losses, gf, ga };
}

function metricsRow(cells: [string, string][]): HTMLElement {
  const wrap = h('div', { class: 'stat-totals' });
  for (const [k, v] of cells) {
    wrap.append(h('div', { class: 'metric' }, h('span', { class: 'v', text: v }), h('span', { class: 'k', text: k })));
  }
  return wrap;
}

function awardCard(title: string, value: string, detail: string, glyph = 'trophy'): HTMLElement {
  const card = h('div', { class: 'award' });
  const g = h('span', { class: 'award-glyph' });
  g.append(icon(glyph as Parameters<typeof icon>[0]));
  card.append(g, h('span', { class: 'award-k', text: title }), h('span', { class: 'award-v', text: value }), h('span', { class: 'award-d', text: detail }));
  return card;
}

function tournamentBlock(api: Api): HTMLElement {
  const block = h('div', { class: 'stats-block' });
  const ko = api.state.knockout;
  const report = tournamentReport(api.state.groups, ko, {
    prefer: humanStar(api),
    hints: api.save.tournament?.hints ?? null,
  });
  const champ = ko?.champion ? teamById(ko.champion) : null;

  block.append(
    metricsRow([
      ['Partidos', String(report.matches)],
      ['Goles', String(report.goals)],
      ['Goles/partido', report.avg.toFixed(2)],
      ['Autogoles', String(report.ownTotal)],
      ['Campeón', champ ? `${champ.flag} ${champ.short}` : '—'],
    ]),
  );

  // Tus números dentro de este campeonato. Van en % porque el total de
  // partidos cambia según hasta dónde llegues.
  const mine = myTournamentRecord(api);
  if (mine.played > 0) {
    block.append(h('div', { class: 'lead-title', text: 'Tu torneo' }));
    const pct = (n: number): string => `${Math.round((n / mine.played) * 100)}%`;
    block.append(
      metricsRow([
        ['Partidos', String(mine.played)],
        ['% victorias', pct(mine.wins)],
        ['% derrotas', pct(mine.losses)],
        ['Goles F/C', `${mine.gf}:${mine.ga}`],
        ['Goles/partido', (mine.gf / mine.played).toFixed(2)],
      ]),
    );
  }

  if (report.matches === 0) {
    block.append(h('div', { class: 'lead-empty', text: 'Juega un partido para llenar la tabla de goleadores.' }));
    return block;
  }

  // ---- premios ---------------------------------------------------------
  const boot = report.scorers[0] ?? null;
  const keeperTeam = report.bestDefense ? teamById(report.bestDefense.teamId) : null;
  const keeper = keeperTeam?.roster.find((p) => p.pos === 'POR') ?? null;
  const goldenBall = champ ? (report.scorers.find((r) => r.teamId === champ.id) ?? boot) : boot;
  const awards = h('div', { class: 'awards' });
  if (boot) {
    awards.append(awardCard('Bota de Oro', boot.name, `${teamById(boot.teamId).short} · ${boot.goals} goles`, 'trophy'));
  }
  if (keeperTeam && report.bestDefense) {
    awards.append(
      awardCard(
        'Guante de Oro',
        keeper?.name ?? keeperTeam.short,
        `${keeperTeam.short} · ${(report.bestDefense.conceded / Math.max(1, report.bestDefense.matches)).toFixed(2)} por partido`,
        'shield',
      ),
    );
  }
  if (report.bestAttack) {
    const t = teamById(report.bestAttack.teamId);
    awards.append(awardCard('Mejor ataque', `${t.flag} ${t.short}`, `${report.bestAttack.goals} goles`, 'bolt'));
  }
  if (goldenBall) {
    awards.append(awardCard('Balón de Oro', goldenBall.name, `${teamById(goldenBall.teamId).short} · ${goldenBall.goals} goles`, 'star'));
  }
  block.append(h('div', { class: 'lead-title', text: 'Premios del torneo' }), awards);

  // ---- goleadores ------------------------------------------------------
  block.append(
    h('div', { class: 'lead-title', text: 'Goleadores' }),
    h(
      'div',
      { class: 'lead-head' },
      h('span', { class: 'pos', text: '#' }),
      h('span'),
      h('span', { class: 'nm', text: 'Jugador' }),
      h('span', { class: 'tm', text: 'EQ' }),
      h('span', { class: 'n', text: 'G' }),
    ),
    scoreTable(report.scorers, 8),
  );

  // ---- autogoles (no cuentan como gol a favor de nadie) ----------------
  if (report.ownTotal > 0) {
    const ownTable = h('div', { class: 'lead-table' });
    report.own.slice(0, 6).forEach((row, i) => {
      const team = teamById(row.teamId);
      const line = h('div', { class: 'lead-row own' });
      line.append(
        h('span', { class: 'pos', text: String(i + 1) }),
        h('span', { class: 'flag', text: team.flag }),
        h('span', { class: 'nm', text: row.name }),
        h('span', { class: 'tm', text: team.short }),
        h('span', { class: 'n', text: String(row.ownGoals) }),
      );
      ownTable.append(line);
    });
    block.append(
      h('div', { class: 'lead-title', text: 'Autogoles' }),
      h('div', { class: 'lead-note', text: 'Van a la cuenta de quien los hizo, no del equipo que se beneficia.' }),
      h(
        'div',
        { class: 'lead-head' },
        h('span', { class: 'pos', text: '#' }),
        h('span'),
        h('span', { class: 'nm', text: 'Jugador' }),
        h('span', { class: 'tm', text: 'EQ' }),
        h('span', { class: 'n', text: 'AG' }),
      ),
      ownTable,
    );
  }

  // ---- récords ---------------------------------------------------------
  const records: [string, string][] = [];
  if (report.fastest) {
    records.push(['Gol más rápido', `${report.fastest.minute}' ${report.fastest.scorer} (${teamById(report.fastest.teamId).short})`]);
  }
  if (report.latest) {
    records.push(['Gol más tardío', `${report.latest.minute}' ${report.latest.scorer} (${teamById(report.latest.teamId).short})`]);
  }
  const quick = [...report.timeline].filter((g) => !g.own).slice(0, 3);
  if (quick.length > 0) {
    records.push(['Goles más tempranos', quick.map((g) => `${g.minute}' ${g.scorer}`).join(' · ')]);
  }
  if (report.bestAttack) {
    const t = teamById(report.bestAttack.teamId);
    records.push(['Equipo más goleador', `${t.flag} ${t.name} · ${report.bestAttack.goals} GF`]);
  }
  const leakiest = [...report.teams].sort((a, b) => b.conceded - a.conceded)[0] ?? null;
  if (leakiest) {
    const t = teamById(leakiest.teamId);
    records.push(['Equipo más goleado', `${t.flag} ${t.name} · ${leakiest.conceded} GC`]);
  }
  block.append(h('div', { class: 'lead-title', text: 'Récords' }), metricsRow(records));

  // ---- goles por equipo ------------------------------------------------
  const teamTable = h('div', { class: 'lead-table' });
  teamTable.append(
    h(
      'div',
      { class: 'lead-head' },
      h('span', { class: 'pos', text: '#' }),
      h('span'),
      h('span', { class: 'nm', text: 'Equipo' }),
      h('span', { class: 'tm', text: 'PJ' }),
      h('span', { class: 'n', text: 'GF' }),
      h('span', { class: 'n', text: 'GC' }),
    ),
  );
  report.teams.slice(0, 8).forEach((row, i) => {
    const team = teamById(row.teamId);
    const line = h('div', { class: 'lead-row' });
    line.append(
      h('span', { class: 'pos', text: String(i + 1) }),
      h('span', { class: 'flag', text: team.flag }),
      h('span', { class: 'nm', text: team.name }),
      h('span', { class: 'tm', text: String(row.matches) }),
      h('span', { class: 'n', text: String(row.goals) }),
      h('span', { class: 'n', text: String(row.conceded) }),
    );
    teamTable.append(line);
  });
  block.append(h('div', { class: 'lead-title', text: 'Goles por equipo' }), teamTable);
  return block;
}

export function buildStats(api: Api): HTMLElement {
  const scr = screenEl('stats');
  scr.append(cornerFlag(), gearButton(api));

  const inTournament = api.state.mode === 'tournament' && api.state.groups.length > 0;
  const body = h('div', { class: 'screen-body' }, h('div', { class: 'screen-head' }, ribbon('Estadísticas del torneo')));
  if (inTournament) {
    body.append(tournamentBlock(api));
  } else {
    body.append(h('p', { class: 'lead-empty', text: 'Estas estadísticas son las del campeonato: empieza uno para verlas.' }));
  }

  // Vuelve al sitio del torneo donde estabas, no al menú.
  const back = (): void => api.to(api.state.knockout ? 'knockout' : inTournament ? 'groups' : 'menu');
  scr.append(body, footer(pill('Atrás', { onClick: back })));
  return scr;
}

export function buildTrophies(api: Api): HTMLElement {
  const scr = screenEl('trophies');
  scr.append(cornerFlag(), gearButton(api));
  const grid = h('div', { class: 'trophy-grid' });
  for (const a of ACHIEVEMENTS) {
    const got = api.save.trophies.includes(a.id);
    const cell = h('div', { class: `trophy${got ? '' : ' locked'}` });
    cell.append(h('div', { class: 'cup', text: a.cup }), h('div', { class: 'nm', text: a.name }), h('div', { class: 'nm', text: a.desc }));
    grid.append(cell);
  }

  // Palmarés: cada Mundial ganado, con su selección y su dificultad. Es lo
  // que el jugador quiere ver al entrar: cuántos y en qué nivel.
  const champs = [...(api.save.championships ?? [])].sort((a, b) => b.at - a.at);
  const palmares = h('div', { class: 'palmares-list' });
  if (champs.length === 0) {
    palmares.append(h('div', { class: 'lead-empty', text: 'Todavía no ganaste un Mundial. Cuando lo hagas, queda anotado aquí con su dificultad.' }));
  } else {
    for (const c of champs) {
      const team = teamById(c.teamId);
      const row = h('div', { class: `pal-row ${c.difficulty}` });
      row.append(
        h('span', { class: 'pal-cup', text: '🏆' }),
        h('span', { class: 'pal-team', text: `${team.flag} ${team.name}` }),
        h('span', { class: 'pal-diff', text: DIFFICULTY_LABEL[c.difficulty] }),
      );
      palmares.append(row);
    }
  }

  scr.append(
    h(
      'div',
      { class: 'screen-body' },
      h('div', { class: 'screen-head' }, ribbon('Trofeos')),
      h('div', { class: 'lead-title', text: `Palmarés · ${champs.length} Mundial${champs.length === 1 ? '' : 'es'}` }),
      palmares,
      h('div', { class: 'lead-title', text: 'Logros' }),
      grid,
    ),
    footer(pill('Atrás', { onClick: () => api.to('menu') })),
  );
  return scr;
}

// ------------------------------------------------------------------ ajustes

export function openSettings(api: Api): void {
  const overlay = h('div', { class: 'modal' });
  const card = h('div', { class: 'modal-card' });
  card.append(ribbon('Ajustes', true));

  const rows = h('div', { class: 'opt-rows' });
  const soundRow = h('div', { class: 'opt-row' });
  const soundGlyph = h('span', { class: 'glyph' });
  soundGlyph.append(icon(api.soundOn ? 'sound' : 'soundOff'));
  soundRow.append(
    h('span', { class: 'lbl', text: 'Sonido' }),
    soundGlyph,
    toggle(api.soundOn, () => {
      api.toggleSound();
      soundGlyph.replaceChildren(icon(api.soundOn ? 'sound' : 'soundOff'));
    }),
  );
  rows.append(soundRow);

  const resetRow = h('div', { class: 'opt-row' });
  const resetBtn = h('button', { class: 'pill ghost', type: 'button', text: 'Borrar progreso' });
  resetBtn.addEventListener('click', () => {
    api.resetProgress();
    overlay.remove();
    api.to('menu');
  });
  resetRow.append(h('span', { class: 'lbl', text: 'Borrar estadísticas y trofeos' }), h('span', { class: 'glyph' }), resetBtn);
  rows.append(resetRow);
  card.append(rows);

  const close = pill('Cerrar', { onClick: () => overlay.remove() });
  card.append(h('div', { class: 'screen-foot' }, close));
  overlay.append(card);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.append(overlay);
}

export { DIFFICULTY_LEVEL, nextPlayerFixture };
