import type { GroupId } from '../data/teams.ts';
import type { DrawMode, GroupState } from '../data/tournament.ts';
import type { Knockout } from '../data/knockout.ts';
import type { ResultHints } from '../data/records.ts';

export type ScreenId =
  | 'menu'
  | 'difficulty'
  | 'draw'
  | 'team'
  | 'options'
  | 'groups'
  | 'knockout'
  | 'match'
  | 'result'
  | 'stats'
  | 'trophies';

export type Difficulty = 'facil' | 'normal' | 'dificil' | 'legendario';
export type Mode = 'tournament' | 'duo';

export interface MatchOptions {
  weather: boolean;
  wind: boolean;
  fans: boolean;
  /** Selección aleatoria: sortea rival (2 jugadores) o futbolista (campeonato). */
  random: boolean;
  ball: number;
  /** Uniforme alternativo para tu equipo. */
  altKit: boolean;
  /** Goles para ganar en 2 jugadores. */
  goalTarget: number;
}

export const DEFAULT_OPTIONS: MatchOptions = {
  weather: false,
  wind: false,
  fans: false,
  random: false,
  ball: 0,
  altKit: false,
  goalTarget: 5,
};

/** Un gol en la ficha del resultado, con minuto y autor. */
export interface ResultGoal {
  /** 0 = local, 1 = visitante. */
  side: number;
  minute: number;
  /** En propia puerta: el autor es del otro equipo. */
  own: boolean;
  /** Nombre del futbolista que la metió (el que estaba en la cancha). */
  scorer: string;
}

export interface ResultData {
  homeId: string;
  awayId: string;
  hg: number;
  ag: number;
  shots: [number, number];
  headers: [number, number];
  possession: [number, number];
  /** Atajadas de cada lado (balones parados por el cuerpo yendo al arco). */
  saves: [number, number];
  /** Autogoles de cada lado (los que se metieron en su propio arco). */
  ownGoals: [number, number];
  maxSpeed: number;
  mode: Mode;
  difficulty: Difficulty;
  /** El partido era de eliminatorias. */
  knockout: boolean;
  /** Penales, si el partido se definió desde los once metros. */
  pen: [number, number] | null;
  /** El jugador abandonó: se cuenta como derrota 0-3. */
  forfeit: boolean;
  /** Goles en orden, con su minuto. */
  goals: ResultGoal[];
}

export interface SaveData {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  trophies: string[];
  /** Mundiales ganados, con su dificultad. */
  championships: { difficulty: Difficulty; teamId: string; at: number }[];
  tournament: {
    teamId: string;
    player: number;
    difficulty: Difficulty;
    drawMode: DrawMode;
    drawSeed: number;
    results: Record<string, [number, number]>;
    knockout: Knockout | null;
    /** Goles reales (minuto y autogol) de los partidos del humano. */
    hints?: Record<string, ResultHints>;
    /** Ya se anotó el título en el palmarés. */
    championNoted?: boolean;
  } | null;
}

export const EMPTY_SAVE: SaveData = {
  matches: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  gf: 0,
  ga: 0,
  trophies: [],
  championships: [],
  tournament: null,
};

export interface AppState {
  mode: Mode;
  difficulty: Difficulty;
  drawMode: DrawMode;
  drawSeed: number;
  pickIndex: 0 | 1;
  picks: [string | null, string | null];
  players: [number, number];
  options: MatchOptions;
  groups: GroupState[];
  /** Grupo del jugador (donde juega sus partidos). */
  activeGroup: GroupId;
  /** Grupo que se está mirando en la pantalla de grupos. */
  viewGroup: GroupId;
  teamId: string;
  knockout: Knockout | null;
  result: ResultData | null;
}

export const DIFFICULTY_LEVEL: Record<Difficulty, number> = {
  facil: 0,
  normal: 1,
  dificil: 2,
  legendario: 3,
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
  legendario: 'Legendario',
};
