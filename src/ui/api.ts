import type { MatchOptions, ScreenId } from './state.ts';
import type { AppState, Difficulty, SaveData } from './state.ts';
import type { GroupId } from '../data/teams.ts';
import type { DrawMode } from '../data/tournament.ts';

/** Contrato entre la interfaz y el controlador de la aplicación. */
export interface Api {
  state: AppState;
  save: SaveData;
  soundOn: boolean;
  to(id: ScreenId): void;
  refresh(): void;
  newTournament(): void;
  continueTournament(): void;
  startDuo(): void;
  setDifficulty(d: Difficulty): void;
  chooseDraw(mode: DrawMode): void;
  pickTeam(teamId: string): void;
  /** Sortea al instante según el modo: rival (2 jugadores) o futbolista. */
  /** Vuelve a sortear clima, viento y público en el acto. */
  rerollConditions(): void;
  setPlayer(index: number): void;
  advancePick(): void;
  nextFixture(): void;
  nextKoMatch(): void;
  ensureKnockout(): void;
  setViewGroup(id: GroupId): void;
  backFromOptions(): void;
  beginMatch(): void;
  repeatMatch(): void;
  quitToMenu(): void;
  openSettings(): void;
  setOption<K extends keyof MatchOptions>(key: K, value: MatchOptions[K]): void;
  toggleSound(): void;
  resetProgress(): void;
  groupFinished(): boolean;
}
