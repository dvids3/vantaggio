export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  kick: boolean;
  dash: boolean;
}

export const NO_INPUT: Input = {
  left: false,
  right: false,
  up: false,
  down: false,
  kick: false,
  dash: false,
};

export interface Player {
  side: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
  coyote: number;
  jumpBuffer: number;
  jumpCut: boolean;
  charging: boolean;
  charge: number;
  kickAnim: number;
  kickCooldown: number;
  dash: number;
  dashCooldown: number;
  dashDir: number;
  runPhase: number;
  squash: number;
  hitFlash: number;
  headerCd: number;
  /**
   * Ventana en la que el balón que acaba de despejar no choca con su propio
   * cuerpo. Sale del pie de atrás y, sin esto, rebotaba en su propia espalda
   * y se metía en el arco: el "autogol" del portero.
   */
  kickGrace: number;
  prevJump: boolean;
  prevKick: boolean;
  prevDash: boolean;
  trail: Trail[];
}

export interface Trail {
  x: number;
  y: number;
  a: number;
  rot: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  trail: Trail[];
}

export type ParticleKind = 'dust' | 'spark' | 'confetti' | 'ring' | 'grass' | 'bottle';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: ParticleKind;
  rot: number;
  vr: number;
  grav: number;
  drag: number;
}

export type Phase = 'kickoff' | 'play' | 'goal';

/** Un gol con el minuto en que entró, para la ficha del resultado. */
export interface GoalLog {
  /** 0 = local, 1 = visitante. */
  side: number;
  /** Segundo de partido (el reloj del sim va 1:1 con el minuto). */
  t: number;
  /** Entró en propia puerta: lo metió el otro lado. */
  own: boolean;
}

export interface Stats {
  shots: [number, number];
  headers: [number, number];
  kicks: [number, number];
  /** Goles en propia puerta por lado (el balón entró en su propio arco). */
  ownGoals: [number, number];
  /** Atajadas: balones parados por el cuerpo cuando iban al arco. */
  saves: [number, number];
  maxBallSpeed: number;
  possession: [number, number];
}
export interface Mul {
  speed: number;
  jump: number;
  power: number;
  precision: number;
}

export type BotPattern = 'press' | 'shape' | 'counter' | 'lob' | 'low' | 'volley' | 'feint';

/** Estado interno del bot: objetivo, ritmo y patrón actual. */
export interface BotBrain {
  target: number;
  decision: number;
  decisionCount: number;
  pattern: BotPattern;
  /** Patrones recientes para evitar que el bot repita la misma secuencia. */
  patternHistory: BotPattern[];
  patternT: number;
  hold: number;
  cooldown: number;
  jumpCd: number;
  feintDir: number;
  feintT: number;
  dashT: number;
  /** Segundos que el rival lleva quieto con el balón. */
  passiveT: number;
}

/**
 * Lo que el bot recuerda del humano. Sirve para que los niveles altos
 * "aprendan patrones": hacia dónde remata, desde dónde y con qué ritmo salta.
 */
export interface BotMemory {
  /** Remates del humano ya registrados. */
  shots: number;
  /** Lado medio del arco al que apunta el humano (-1 izquierda, +1 derecha). */
  shotSide: number;
  /** Distancia media desde la que remata el humano. */
  shotDist: number;
  /** Intervalo medio entre saltos del humano (s). */
  jumpGap: number;
  /** Tiempo del último salto del humano. */
  lastJump: number;
  /** Proporción de remates picados del humano (0..1). */
  lob: number;
  /** Goles que el humano ya le hizo al bot. */
  conceded: number;
}

export interface Match {
  phase: Phase;
  phaseT: number;
  /** Tiempo total simulado (s). */
  clock: number;
  score: [number, number];
  players: [Player, Player];
  ball: Ball;
  particles: Particle[];
  shake: number;
  goalSide: number;
  /** Último lado que tocó el balón (cualquier parte del cuerpo). */
  lastTouch: number;
  /** Último lado que lo PATEÓ. Solo una patada puede ser autogol. */
  lastKick: number;
  /**
   * Minuto de partido en el que suena el final (0 = sin límite, dos
   * jugadores). Pasado ese instante ningún gol más cuenta.
   */
  timeLimit: number;
  /** Goles en orden, con su minuto. Se usa en la ficha del resultado. */
  goals: GoalLog[];
  stats: Stats;
  /** Multiplicadores por lado según el futbolista elegido. */
  mul: [Mul, Mul];
  /** Nivel del bot: 0 fácil … 3 legendario. */
  botLevel: number;
  /** Lado que controla el humano (0 o 1). El bot juega el otro. */
  humanSide: number;
  /** Hay un bot en el otro lado (falso en dos jugadores). */
  versusBot: boolean;
  /** Viento lateral en m/s² (positivo = hacia la derecha). */
  wind: number;
  /** Viento activo: si es falso, no hay rachas aunque `wind` quede en 0. */
  windEnabled: boolean;
  /** Racha objetivo y cuenta atrás para cambiarla. */
  windTarget: number;
  windTimer: number;
  /** Público enardecido: lanza objetos a la cancha cada tanto. */
  fans: boolean;
  fanTimer: number;
  /** Clima adverso: más roce del balón y menos rebote. */
  wet: boolean;
  /** Estado interno de cada bot (el del lado que no juega el humano). */
  brains: [BotBrain, BotBrain];
  /** Patrones que el bot ha aprendido del humano. */
  botMemory: BotMemory;
  rngSeed: number;
  /** Ganchos de eventos para audio/render: se vacían en cada lectura. */
  events: SimEvent[];
  paused: boolean;
}


export type SimEvent =
  | { type: 'kick'; side: number; level: number; power: number }
  | { type: 'header'; side: number; power: number }
  | { type: 'land'; side: number; power: number }
  | { type: 'dash'; side: number }
  | { type: 'post'; power: number }
  | { type: 'goal'; side: number }
  | { type: 'whistle' }
  | { type: 'bounce'; power: number };
