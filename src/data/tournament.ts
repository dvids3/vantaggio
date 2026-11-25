/**
 * Fase de grupos del Mundial 2026: 12 grupos de 4, tres jornadas.
 * Los cruces salen del orden del sorteo, así que son deterministas.
 */

import { makeRng } from '../core/math.ts';
import { TEAMS, teamById, type GroupId, type Team } from './teams.ts';

export type DrawMode = 'real' | 'random';

export interface Fixture {
  id: string;
  group: GroupId;
  day: 1 | 2 | 3;
  home: string;
  away: string;
  hg: number | null;
  ag: number | null;
}

export interface GroupState {
  id: GroupId;
  teams: Team[];
  fixtures: Fixture[];
}

export interface TableRow {
  team: Team;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dif: number;
  pts: number;
}

const ORDER: GroupId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

/** Cruces de un grupo de 4, en orden de sorteo [t0,t1,t2,t3]. */
const PAIRS: [1 | 2 | 3, [number, number][]][] = [
  [1, [[0, 1], [2, 3]]],
  [2, [[0, 2], [3, 1]]],
  [3, [[3, 0], [1, 2]]],
];

function makeGroup(id: GroupId, teams: Team[]): GroupState {
  const fixtures: Fixture[] = [];
  for (const [day, pairs] of PAIRS) {
    for (const [a, b] of pairs) {
      const home = teams[a];
      const away = teams[b];
      if (!home || !away) continue;
      fixtures.push({
        id: `${id}${day}${a}${b}`,
        group: id,
        day,
        home: home.id,
        away: away.id,
        hg: null,
        ag: null,
      });
    }
  }
  return { id, teams, fixtures };
}

/**
 * Construye los 12 grupos.
 *  - 'real': el sorteo oficial de FIFA, fijo y determinista.
 *  - 'random': baraja las 48 selecciones con una semilla (Fisher–Yates) y las
 *    reparte de 4 en 4. Con la misma semilla reproduce exactamente el mismo
 *    sorteo, para poder guardar y continuar el campeonato.
 */
export function buildGroups(mode: DrawMode = 'real', seed = 1): GroupState[] {
  if (mode === 'random') {
    const rng = makeRng(seed);
    const pool = [...TEAMS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]]!;
    }
    return ORDER.map((id, gi) => makeGroup(id, pool.slice(gi * 4, gi * 4 + 4)));
  }
  return ORDER.map((id) => makeGroup(id, TEAMS.filter((t) => t.group === id)));
}

/** Grupo al que pertenece una selección dentro de unos grupos ya construidos. */
export function groupOf(groups: GroupState[], teamId: string): GroupId {
  const found = groups.find((g) => g.teams.some((t) => t.id === teamId));
  if (!found) throw new Error(`Selección ${teamId} no está en ningún grupo`);
  return found.id;
}

export function emptyTable(group: GroupState): TableRow[] {
  return group.teams.map((team) => ({
    team,
    pj: 0,
    g: 0,
    e: 0,
    p: 0,
    gf: 0,
    gc: 0,
    dif: 0,
    pts: 0,
  }));
}

export function tableOf(group: GroupState): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const team of group.teams) {
    rows.set(team.id, { team, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dif: 0, pts: 0 });
  }
  for (const f of group.fixtures) {
    if (f.hg === null || f.ag === null) continue;
    const home = rows.get(f.home);
    const away = rows.get(f.away);
    if (!home || !away) continue;
    home.pj++;
    away.pj++;
    home.gf += f.hg;
    home.gc += f.ag;
    away.gf += f.ag;
    away.gc += f.hg;
    if (f.hg > f.ag) {
      home.g++;
      home.pts += 3;
      away.p++;
    } else if (f.hg < f.ag) {
      away.g++;
      away.pts += 3;
      home.p++;
    } else {
      home.e++;
      away.e++;
      home.pts++;
      away.pts++;
    }
  }
  const list = [...rows.values()];
  for (const r of list) r.dif = r.gf - r.gc;
  list.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dif !== a.dif) return b.dif - a.dif;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.name.localeCompare(b.team.name, 'es');
  });
  return list;
}

/** Fuerza aproximada de una selección: promedio de sus mejores atributos. */
export function strength(team: Team): number {
  const roster = team.roster;
  if (!roster.length) return 60;
  const best = [...roster]
    .map((p) => (p.spd + p.jmp + p.pow + p.pre) / 4)
    .sort((a, b) => b - a)
    .slice(0, 3);
  return best.reduce((acc, v) => acc + v, 0) / best.length;
}

/**
 * Simula un partido entre dos selecciones que no juega el usuario.
 * Marcador bajo y con empates frecuentes, como en una fase de grupos real.
 */
export function simulate(home: Team, away: Team, rng: () => number = Math.random): [number, number] {
  const diff = (strength(home) - strength(away)) / 22;
  const lambdaHome = Math.max(0.35, 1.25 + diff * 0.55);
  const lambdaAway = Math.max(0.35, 1.05 - diff * 0.55);
  const poisson = (lambda: number): number => {
    let k = 0;
    let p = Math.exp(-lambda);
    let acc = p;
    const u = rng();
    while (u > acc && k < 6) {
      k++;
      p = (p * lambda) / k;
      acc += p;
    }
    return k;
  };
  return [Math.min(5, poisson(lambdaHome)), Math.min(5, poisson(lambdaAway))];
}

/**
 * Juega todas las jornadas pendientes hasta `day` en TODOS los grupos.
 * Así las tablas de los grupos que no son el del jugador también avanzan.
 */
export function playMatchday(groups: GroupState[], day: number, skipId?: string): void {
  for (const group of groups) {
    for (const fx of group.fixtures) {
      if (fx.hg !== null || fx.day > day || fx.id === skipId) continue;
      const [a, b] = simulate(teamById(fx.home), teamById(fx.away));
      fx.hg = a;
      fx.ag = b;
    }
  }
}

export function nextPlayerFixture(group: GroupState, teamId: string): Fixture | null {
  return group.fixtures.find((f) => f.hg === null && (f.home === teamId || f.away === teamId)) ?? null;
}

export function groupFromId(groups: GroupState[], id: GroupId): GroupState {
  const found = groups.find((g) => g.id === id);
  if (!found) throw new Error(`Grupo ${id} no existe`);
  return found;
}
