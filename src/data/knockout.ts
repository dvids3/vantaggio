/**
 * Eliminatorias del Mundial 2026.
 *
 * Formato real: 48 selecciones, 12 grupos. Pasan los dos primeros de cada
 * grupo (24) más los ocho mejores terceros → 32 equipos.
 *
 * El cuadro se siembra por rendimiento: primeros de grupo, luego segundos y
 * luego terceros, ordenados por puntos, diferencia y goles. Se empareja el 1
 * con el 32, el 2 con el 31… y se evita, cuando se puede, que dos equipos del
 * mismo grupo se crucen en dieciseisavos.
 *
 * Los partidos ajenos se resuelven por fuerza; los empates se definen en
 * penales. El partido del jugador lo juega el motor real.
 */

import { teamById, type Team } from './teams.ts';
import { simulate, strength, tableOf, type GroupState, type TableRow } from './tournament.ts';

export const ROUND_NAMES = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Final'] as const;
export const ROUNDS = ROUND_NAMES.length;

export interface KnockoutMatch {
  id: string;
  /** 0 = dieciseisavos … 4 = final. */
  round: number;
  slot: number;
  home: string | null;
  away: string | null;
  hg: number | null;
  ag: number | null;
  /** Penales del local y del visitante (solo si hubo empate). */
  ph: number | null;
  pa: number | null;
  winner: string | null;
}

export interface Knockout {
  /** Los 32 clasificados en orden de siembra (1.º a 32.º). */
  seeds: string[];
  rounds: KnockoutMatch[][];
  champion: string | null;
  /** Partido por el tercer puesto (perdedores de las semifinales). */
  third: KnockoutMatch | null;
}

function rank(rows: TableRow[]): TableRow[] {
  return [...rows].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dif !== a.dif) return b.dif - a.dif;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.name.localeCompare(b.team.name, 'es');
  });
}

/** Los 32 clasificados, del mejor sembrado al peor. */
export function qualifiedSeeds(groups: GroupState[]): string[] {
  const winners: TableRow[] = [];
  const runners: TableRow[] = [];
  const thirds: TableRow[] = [];
  for (const group of groups) {
    const rows = rank(tableOf(group));
    if (rows[0]) winners.push(rows[0]);
    if (rows[1]) runners.push(rows[1]);
    if (rows[2]) thirds.push(rows[2]);
  }
  const bestThirds = rank(thirds).slice(0, 8);
  return [...rank(winners), ...rank(runners), ...bestThirds].map((r) => r.team.id);
}

function emptyMatch(round: number, slot: number): KnockoutMatch {
  return {
    id: `K${round}-${slot}`,
    round,
    slot,
    home: null,
    away: null,
    hg: null,
    ag: null,
    ph: null,
    pa: null,
    winner: null,
  };
}

export function buildKnockout(groups: GroupState[]): Knockout {
  const seeds = qualifiedSeeds(groups);
  const groupOf = new Map<string, string>();
  for (const g of groups) for (const t of g.teams) groupOf.set(t.id, g.id);

  // Siembra clásica: 1-32, 2-31, 3-30…
  const pairs: [number, number][] = [];
  for (let i = 0; i < seeds.length / 2; i++) pairs.push([i, seeds.length - 1 - i]);

  // Evita cruces del mismo grupo en dieciseisavos (no siempre es posible).
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i]!;
    if (groupOf.get(seeds[a]!) !== groupOf.get(seeds[b]!)) continue;
    for (let j = i + 1; j < pairs.length; j++) {
      const [c, d] = pairs[j]!;
      const okA = groupOf.get(seeds[a]!) !== groupOf.get(seeds[d]!);
      const okB = groupOf.get(seeds[c]!) !== groupOf.get(seeds[b]!);
      if (!okA || !okB) continue;
      pairs[i] = [a, d];
      pairs[j] = [c, b];
      break;
    }
  }

  const rounds: KnockoutMatch[][] = [];
  rounds.push(
    pairs.map(([a, b], slot) => {
      const m = emptyMatch(0, slot);
      m.home = seeds[a] ?? null;
      m.away = seeds[b] ?? null;
      return m;
    }),
  );
  for (let r = 1; r < ROUNDS; r++) {
    const count = 2 ** (ROUNDS - 1 - r);
    rounds.push(Array.from({ length: count }, (_, slot) => emptyMatch(r, slot)));
  }

  return { seeds, rounds, champion: null, third: null };
}

/** ¿El equipo sigue vivo en el cuadro? */
export function isAlive(k: Knockout, teamId: string): boolean {
  if (k.rounds.some((round) => round.some((m) => (m.home === teamId || m.away === teamId) && m.winner === null))) return true;
  const third = k.third;
  return !!third && !third.winner && (third.home === teamId || third.away === teamId);
}

/**
 * Crea el partido por el tercer puesto en cuanto las dos semifinales tienen
 * ganador. Los que lo juegan son los perdedores de esas semifinales.
 */
export function syncThirdPlace(k: Knockout): void {
  const semis = k.rounds[3];
  if (!semis || semis.length < 2) return;
  if (semis.some((m) => !m.winner || !m.home || !m.away)) return;
  const [a, b] = semis;
  const losers = [a!.home === a!.winner ? a!.away : a!.home, b!.home === b!.winner ? b!.away : b!.home];
  if (!losers[0] || !losers[1]) return;
  const existing = k.third;
  if (existing && existing.home === losers[0] && existing.away === losers[1]) return;
  k.third = {
    id: 'K3-0',
    round: 4,
    slot: 1,
    home: losers[0],
    away: losers[1],
    hg: existing?.home === losers[0] && existing?.away === losers[1] ? existing.hg : null,
    ag: existing?.home === losers[0] && existing?.away === losers[1] ? existing.ag : null,
    ph: null,
    pa: null,
    winner: existing?.home === losers[0] && existing?.away === losers[1] ? existing.winner : null,
  };
}

/** El partido por el tercer puesto del equipo, si le toca jugarlo. */
export function thirdFor(k: Knockout, teamId: string): KnockoutMatch | null {
  const third = k.third;
  if (!third || third.winner || !third.home || !third.away) return null;
  return third.home === teamId || third.away === teamId ? third : null;
}

/** Partido pendiente del equipo, si sigue con vida. */
export function matchForTeam(k: Knockout, teamId: string): KnockoutMatch | null {
  for (const round of k.rounds) {
    for (const m of round) {
      if ((m.home === teamId || m.away === teamId) && m.winner === null) return m;
    }
  }
  return null;
}

export function matchById(k: Knockout, id: string): KnockoutMatch | null {
  for (const round of k.rounds) {
    const found = round.find((m) => m.id === id);
    if (found) return found;
  }
  return k.third?.id === id ? k.third : null;
}

/** El id del ganador de un partido ya jugado (o null). */
export function winnerOf(m: KnockoutMatch): string | null {
  return m.winner;
}

function shootout(home: Team, away: Team, rng: () => number): [number, number] {
  // La fuerza inclina un poco la balanza, pero los penales son lotería.
  const edge = (strength(home) - strength(away)) / 260;
  const pHome = Math.max(0.55, Math.min(0.86, 0.73 + edge));
  const pAway = Math.max(0.55, Math.min(0.86, 0.73 - edge));
  let ph = 0;
  let pa = 0;
  for (let i = 0; i < 5; i++) {
    if (rng() < pHome) ph++;
    if (rng() < pAway) pa++;
  }
  let guard = 0;
  while (ph === pa && guard++ < 20) {
    const a = rng() < pHome;
    const b = rng() < pAway;
    if (a) ph++;
    if (b) pa++;
  }
  if (ph === pa) ph++; // imposible en la práctica; evita un empate eterno
  return [ph, pa];
}

/** Juega un partido ajeno: marcador por fuerza y penales si hace falta. */
export function simulateKnockoutMatch(
  m: KnockoutMatch,
  rng: () => number = Math.random,
): void {
  if (!m.home || !m.away || m.winner) return;
  const [hg, ag] = simulate(teamById(m.home), teamById(m.away), rng);
  m.hg = hg;
  m.ag = ag;
  if (hg === ag) {
    const [ph, pa] = shootout(teamById(m.home), teamById(m.away), rng);
    m.ph = ph;
    m.pa = pa;
    m.winner = ph > pa ? m.home : m.away;
  } else {
    m.winner = hg > ag ? m.home : m.away;
  }
}

/** Rellena la ronda siguiente con los ganadores de la ronda anterior. */
function advanceRound(k: Knockout, round: number): void {
  const next = k.rounds[round + 1];
  if (!next) {
    if (round === ROUNDS - 1) k.champion = k.rounds[round]![0]?.winner ?? null;
    return;
  }
  for (const m of next) {
    const a = k.rounds[round]![m.slot * 2];
    const b = k.rounds[round]![m.slot * 2 + 1];
    m.home = a?.winner ?? null;
    m.away = b?.winner ?? null;
    m.hg = null;
    m.ag = null;
    m.ph = null;
    m.pa = null;
    m.winner = null;
  }
  if (round === ROUNDS - 1) k.champion = k.rounds[round]![0]?.winner ?? null;
}

/** Completa una ronda: simula lo que falta y avanza el cuadro. */
export function settleRound(k: Knockout, round: number, rng: () => number = Math.random): void {
  const matches = k.rounds[round];
  if (!matches) return;
  for (const m of matches) {
    if (m.winner === null && m.home && m.away) simulateKnockoutMatch(m, rng);
  }
  if (matches.every((m) => m.winner !== null)) advanceRound(k, round);
  if (round === ROUNDS - 1) k.champion = matches[0]?.winner ?? null;
  syncThirdPlace(k);
}

/** Registra el resultado del partido del jugador y completa la ronda. */
export function recordKnockoutResult(
  k: Knockout,
  matchId: string,
  hg: number,
  ag: number,
  rng: () => number = Math.random,
): void {
  const m = matchById(k, matchId);
  if (!m || !m.home || !m.away) return;
  m.hg = hg;
  m.ag = ag;
  if (hg === ag) {
    const [ph, pa] = shootout(teamById(m.home), teamById(m.away), rng);
    m.ph = ph;
    m.pa = pa;
    m.winner = ph > pa ? m.home : m.away;
  } else {
    m.winner = hg > ag ? m.home : m.away;
  }
  if (k.third && m.id === k.third.id) return;
  settleRound(k, m.round, rng);
}

/** Juega el tercer puesto si quedó pendiente (nadie del humano lo reclama). */
export function playThirdPlace(k: Knockout, rng: () => number = Math.random): void {
  syncThirdPlace(k);
  const third = k.third;
  if (!third || third.winner || !third.home || !third.away) return;
  simulateKnockoutMatch(third, rng);
}

/**
 * Termina el cuadro cuando el jugador ya no está: simula todas las rondas que
 * falten hasta tener campeón. Sin esto, al quedar eliminado el torneo se
 * quedaba congelado y nunca había un ganador que mostrar.
 */
export function finishKnockout(k: Knockout, rng: () => number = Math.random): void {
  if (!k.champion) {
    for (let r = 0; r < ROUNDS; r++) {
      const matches = k.rounds[r];
      if (!matches || matches.length === 0) break;
      if (matches.some((m) => !m.home || !m.away)) break;
      if (matches.every((m) => m.winner !== null)) continue;
      settleRound(k, r, rng);
      if (k.champion) break;
    }
    if (!k.champion) k.champion = k.rounds[ROUNDS - 1]?.[0]?.winner ?? null;
  }
  playThirdPlace(k, rng);
}

/**
 * Continúa un cuadro guardado. No vuelve a simular nada: solo rellena la ronda
 * siguiente si el guardado quedó a medias entre un resultado y el avance.
 */
export function resumeKnockout(k: Knockout): void {
  for (let r = 0; r < ROUNDS; r++) {
    const matches = k.rounds[r];
    if (!matches?.length) break;
    if (!matches.every((m) => m.winner !== null)) break;
    const next = k.rounds[r + 1];
    if (!next) {
      k.champion = matches[0]?.winner ?? null;
      break;
    }
    if (next.every((m) => m.home === null)) advanceRound(k, r);
  }
  syncThirdPlace(k);
}
