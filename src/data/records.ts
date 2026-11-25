/**
 * Estadísticas del campeonato.
 *
 * No se guardan en disco: se derivan de los resultados ya jugados. Cada partido
 * tiene un marcador y un id fijos, así que la atribución de goles es determinista
 * —la tabla es la misma al volver a entrar— y no hay un estado paralelo que se
 * pueda desincronizar del marcador. Si cambia un resultado, cambia el reparto.
 *
 * Reglas de atribución:
 *  - Un gol normal se lo lleva un jugador del equipo que lo anota.
 *  - Un autogol NO se le cuenta al equipo que se beneficia: se le carga al
 *    defensor que lo hizo en propia puerta, y suma en la tabla de autogoles.
 *  - El partido que juega el humano puede traer sus goles reales (minuto y
 *    autor) por medio de `hints`; si no, se generan con la semilla del partido.
 *
 * Es 1 contra 1: no hay pases, así que no hay asistencias que registrar.
 */

import { makeRng } from '../core/math.ts';
import type { GroupState } from './tournament.ts';
import type { Knockout } from './knockout.ts';
import { teamById, type RosterPlayer, type Team } from './teams.ts';

export interface ScoreRow {
  /** `teamId:nombre`, la clave estable para ordenar y pintar. */
  id: string;
  teamId: string;
  name: string;
  num: number;
  goals: number;
}

export interface OwnRow {
  id: string;
  teamId: string;
  name: string;
  num: number;
  ownGoals: number;
}

export interface GoalEvent {
  fixture: string;
  /** Equipo que se beneficia del gol. */
  teamId: string;
  /** Equipo que lo recibe. */
  againstId: string;
  minute: number;
  /** En propia puerta. */
  own: boolean;
  /** Autor material del gol (si es autogol, es del equipo `againstId`). */
  scorer: string;
  scorerNum: number;
  scorerTeamId: string;
}

export interface TeamAgg {
  teamId: string;
  matches: number;
  goals: number;
  conceded: number;
}

/** Lo que el partido real del humano aporta a las estadísticas. */
export interface GoalHint {
  side: number;
  minute: number;
  own: boolean;
}

export interface ResultHints {
  /** Goles en propia puerta por lado, tal como pasaron en la cancha. */
  own?: [number, number];
  /** Goles reales con minuto (solo el partido del humano). */
  goals?: GoalHint[];
}

export interface TournamentReport {
  matches: number;
  goals: number;
  avg: number;
  /** Goles por partido del torneo. */
  scorers: ScoreRow[];
  own: OwnRow[];
  ownTotal: number;
  fastest: GoalEvent | null;
  latest: GoalEvent | null;
  timeline: GoalEvent[];
  teams: TeamAgg[];
  /** Equipo más goleador y la valla menos batida. */
  bestAttack: TeamAgg | null;
  bestDefense: TeamAgg | null;
}

function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Probabilidad relativa de marcar según el puesto y sus atributos. */
function goalWeight(p: RosterPlayer): number {
  const pos = p.pos === 'DEL' ? 3.4 : p.pos === 'MED' ? 1.7 : p.pos === 'DEF' ? 0.55 : 0.1;
  return pos * (0.45 + p.pow / 110) * (0.5 + p.pre / 150);
}

/** Peso de un autogol: lo hace un defensor (o el portero), no un delantero. */
function ownWeight(p: RosterPlayer): number {
  const pos = p.pos === 'DEF' ? 3.2 : p.pos === 'POR' ? 2.4 : p.pos === 'MED' ? 1 : 0.25;
  return pos * (0.6 + p.pow / 120);
}

function pick(pool: RosterPlayer[], rng: () => number, weight: (p: RosterPlayer) => number): RosterPlayer {
  const total = pool.reduce((acc, p) => acc + weight(p), 0);
  let r = rng() * total;
  for (const p of pool) {
    r -= weight(p);
    if (r <= 0) return p;
  }
  return pool[pool.length - 1]!;
}

interface RawMatch {
  id: string;
  home: string;
  away: string;
  hg: number;
  ag: number;
}

function buildTimeline(
  rounds: RawMatch[],
  prefer: { teamId: string; name: string } | null,
  hints: Record<string, ResultHints> | null,
): GoalEvent[] {
  const timeline: GoalEvent[] = [];

  for (const fx of rounds) {
    const home = teamById(fx.home);
    const away = teamById(fx.away);
    const seed = hashOf(fx.id) ^ (fx.hg * 2654435761) ^ (fx.ag * 40503);
    const rng = makeRng(seed);
    const hint = hints?.[fx.id];

    // Distribución de goles por lado, con minuto.
    const sides: number[] = [];
    for (let i = 0; i < fx.hg; i++) sides.push(0);
    for (let i = 0; i < fx.ag; i++) sides.push(1);

    let minutes: number[];
    if (hint?.goals && hint.goals.length === sides.length) {
      minutes = hint.goals.map((g) => g.minute);
    } else {
      minutes = sides.map(() => 1 + Math.floor(rng() * 89));
    }

    // Autogoles: los del partido real se respetan; los demás, con la semilla
    // del encuentro (pocos: ~4 % de los goles).
    const ownBySide: [number, number] = hint?.own
      ? [Math.min(hint.own[0], fx.hg), Math.min(hint.own[1], fx.ag)]
      : [0, 0];
    if (!hint?.own) {
      for (let i = 0; i < sides.length; i++) {
        if (rng() < 0.04) {
          const side = sides[i]!;
          const cap = side === 0 ? fx.hg : fx.ag;
          if (ownBySide[side]! < cap) ownBySide[side] = ownBySide[side]! + 1;
        }
      }
    }

    // Orden de los goles: minuto ascendente. El minuto real manda si vino.
    const events = sides.map((side, i) => ({ side, minute: minutes[i] ?? 1 + i }));
    events.sort((a, b) => a.minute - b.minute);

    // Los autogoles se cargan a los goles más tardíos de ese lado (un defensa
    // agotado), y el autor es un defensor del equipo que los recibe.
    const ownLeft: [number, number] = [ownBySide[0]!, ownBySide[1]!];
    const isOwn = events.map(() => false);
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i]!;
      if (ownLeft[ev.side]! > 0) {
        ownLeft[ev.side] = ownLeft[ev.side]! - 1;
        isOwn[i] = true;
      }
    }

    for (let i = 0; i < events.length; i++) {
      const ev = events[i]!;
      const minute = Math.max(1, Math.min(90, Math.round(ev.minute)));
      const benefiting = ev.side === 0 ? home : away;
      const conceding = ev.side === 0 ? away : home;
      if (isOwn[i]) {
        const defender = pick(conceding.roster, rng, ownWeight);
        timeline.push({
          fixture: fx.id,
          teamId: benefiting.id,
          againstId: conceding.id,
          minute,
          own: true,
          scorer: defender.name,
          scorerNum: defender.num,
          scorerTeamId: conceding.id,
        });
        continue;
      }
      const star = prefer && prefer.teamId === benefiting.id ? prefer.name : null;
      const w = (p: RosterPlayer): number => goalWeight(p) * (p.name === star ? 9 : 1);
      const scorer = pick(benefiting.roster, rng, w);
      timeline.push({
        fixture: fx.id,
        teamId: benefiting.id,
        againstId: conceding.id,
        minute,
        own: false,
        scorer: scorer.name,
        scorerNum: scorer.num,
        scorerTeamId: benefiting.id,
      });
    }
  }

  return timeline;
}

export function tournamentReport(
  groups: GroupState[],
  ko: Knockout | null,
  opts: {
    prefer?: { teamId: string; name: string } | null;
    hints?: Record<string, ResultHints> | null;
  } = {},
): TournamentReport {
  const rounds: RawMatch[] = [];
  const teams = new Map<string, TeamAgg>();
  const agg = (id: string): TeamAgg => {
    let row = teams.get(id);
    if (!row) {
      row = { teamId: id, matches: 0, goals: 0, conceded: 0 };
      teams.set(id, row);
    }
    return row;
  };

  for (const group of groups) {
    for (const fx of group.fixtures) {
      if (fx.hg === null || fx.ag === null) continue;
      rounds.push({ id: fx.id, home: fx.home, away: fx.away, hg: fx.hg, ag: fx.ag });
    }
  }
  if (ko) {
    for (const round of ko.rounds) {
      for (const m of round) {
        if (!m.home || !m.away || m.hg === null || m.ag === null) continue;
        rounds.push({ id: m.id, home: m.home, away: m.away, hg: m.hg, ag: m.ag });
      }
    }
    if (ko.third?.home && ko.third.away && ko.third.hg !== null && ko.third.ag !== null) {
      rounds.push({ id: ko.third.id, home: ko.third.home, away: ko.third.away, hg: ko.third.hg, ag: ko.third.ag });
    }
  }

  for (const fx of rounds) {
    const h = agg(fx.home);
    const a = agg(fx.away);
    h.matches++;
    a.matches++;
    h.goals += fx.hg;
    h.conceded += fx.ag;
    a.goals += fx.ag;
    a.conceded += fx.hg;
  }

  const timeline = buildTimeline(rounds, opts.prefer ?? null, opts.hints ?? null);

  const scorers = new Map<string, ScoreRow>();
  const own = new Map<string, OwnRow>();
  let goals = 0;
  for (const ev of timeline) {
    goals++;
    if (ev.own) {
      const id = `${ev.scorerTeamId}:${ev.scorer}`;
      let row = own.get(id);
      if (!row) {
        row = { id, teamId: ev.scorerTeamId, name: ev.scorer, num: ev.scorerNum, ownGoals: 0 };
        own.set(id, row);
      }
      row.ownGoals += 1;
      continue;
    }
    const id = `${ev.teamId}:${ev.scorer}`;
    let row = scorers.get(id);
    if (!row) {
      row = { id, teamId: ev.teamId, name: ev.scorer, num: ev.scorerNum, goals: 0 };
      scorers.set(id, row);
    }
    row.goals += 1;
  }

  const sortedScorers = [...scorers.values()].sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    return a.name.localeCompare(b.name, 'es');
  });
  const sortedOwn = [...own.values()].sort((a, b) => {
    if (b.ownGoals !== a.ownGoals) return b.ownGoals - a.ownGoals;
    return a.name.localeCompare(b.name, 'es');
  });

  const byMinute = [...timeline].sort((a, b) => a.minute - b.minute || a.fixture.localeCompare(b.fixture));
  const teamRows = [...teams.values()];
  const attack = [...teamRows].sort((a, b) => b.goals - a.goals || a.matches - b.matches)[0] ?? null;
  const defense =
    [...teamRows]
      .filter((t) => t.matches >= 2)
      .sort((a, b) => a.conceded / a.matches - b.conceded / b.matches || a.matches - b.matches)[0] ?? null;

  return {
    matches: rounds.length,
    goals,
    avg: rounds.length > 0 ? goals / rounds.length : 0,
    scorers: sortedScorers,
    own: sortedOwn,
    ownTotal: sortedOwn.reduce((acc, r) => acc + r.ownGoals, 0),
    fastest: byMinute[0] ?? null,
    latest: byMinute[byMinute.length - 1] ?? null,
    timeline: byMinute,
    teams: [...teamRows].sort((a, b) => b.goals - a.goals),
    bestAttack: attack,
    bestDefense: defense,
  };
}

/** Compatibilidad: la tabla de goleadores del campeonato. */
export function topScorers(
  groups: GroupState[],
  ko: Knockout | null,
  prefer?: { teamId: string; name: string } | null,
  hints?: Record<string, ResultHints> | null,
): ScoreRow[] {
  return tournamentReport(groups, ko, { prefer: prefer ?? null, hints: hints ?? null }).scorers;
}

/** Totales del campeonato, para el resumen. */
export function tournamentTotals(groups: GroupState[], ko: Knockout | null): { matches: number; goals: number; avg: number } {
  const report = tournamentReport(groups, ko);
  return { matches: report.matches, goals: report.goals, avg: report.avg };
}
