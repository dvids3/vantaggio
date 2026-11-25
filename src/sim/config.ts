/**
 * Todos los números que definen "cómo se siente" el juego están aquí.
 * Si algo se siente mal, se toca este archivo — no la lógica.
 *
 * Unidades: metros y segundos. El jugador mide 2,14 m hasta la coronilla.
 * La cancha mide 24 m: cruzarla corriendo toma ~3,4 s, como en el original.
 */

export const WORLD = {
  /** Ancho de la cancha. Más corta que un campo real: los cabezones se ven grandes. */
  width: 18,
  /** Techo invisible (el balón no sale del estadio). */
  ceiling: 11,
} as const;

export const GOAL = {
  /** Línea de gol izquierda (el arco está a la izquierda de esta x). */
  lineLeft: 1.2,
  lineRight: 16.8,
  /** Altura del travesaño. */
  height: 3.1,
  /** Profundidad de la red. */
  depth: 1.15,
  /** Grosor visual del poste/travesaño. */
  bar: 0.1,
} as const;

export const BALL = {
  /** Radio del balón. Generoso a propósito: en un cabezón arcade el balón se
   *  tiene que leer de un vistazo, no ser una peca sobre el césped. */
  r: 0.27,
  gravity: 25,
  /** Rebote contra el suelo (0 = no rebota, 1 = rebote perfecto).
   *  Un balón inflado a 1 bar devuelve ~60 % de la energía vertical, pero en un
   *  arcade eso se lee como "globo". A 0.28 el bote es corto y seco. */
  bounce: 0.28,
  /** Cuánta velocidad horizontal se conserva en cada bote. */
  bounceFriction: 0.86,
  /** Por debajo de esta velocidad de impacto el balón no bota: se asienta. */
  minBounce: 2.2,
  /** Rebote contra un cuerpo: el futbolista amortigua, pero el balón no se
   *  queda pegado al pie. Antes (0,04) parecía pegado con pegamento. */
  bodyRestitution: 0.3,
  /** Cuánta velocidad conserva el balón después del choque con el cuerpo. */
  bodyDamp: 0.66,
  /** Cabeza: algo más elástica (un cabezazo empuja) pero también blanda. */
  headRestitution: 0.36,
  headDamp: 0.8,
  /** Pérdida de velocidad mientras rueda por el pasto (por segundo). */
  rollDrag: 1.15,
  /** Resistencia del aire (por segundo). */
  airDrag: 0.05,
  maxSpeed: 42,
} as const;

export const PLAYER = {
  /** Altura de la cadera (donde nacen las piernas). */
  hip: 0.22,
  bodyBottom: 0.22,
  bodyTop: 0.48,
  bodyWidth: 0.5,
  /** Cabeza: centro y radio. Cabezón: la cabeza domina la silueta (≈72 %).
   *  El tamaño VISIBLE se ajusta en `PLAYER_ART` (render); esto es la física. */
  headY: 1.1,
  headR: 0.62,
  /** Cápsula del torso usada para colisión con el balón. */
  torsoY: 0.36,
  torsoR: 0.24,

  maxSpeed: 7,
  accelGround: 46,
  accelAir: 16,
  frictionGround: 52,
  frictionAir: 3,

  gravity: 26,
  /** Salto: 8.2 m/s con esta gravedad da un ápice de 1,29 m. Antes eran 1,77 m
   *  y el jugador se comía el travesaño de un brinco: parecía que volaba. */
  jump: 8.2,
  /** Al soltar el salto subiendo, se recorta la velocidad vertical. */
  jumpCut: 0.46,
  /** Margen tras salir del suelo en el que aún puedes saltar. */
  coyote: 0.09,
  /** Margen de anticipación del salto. */
  jumpBuffer: 0.12,

  dashSpeed: 15,
  dashTime: 0.13,
  dashCooldown: 0.8,

  /** Alcance del pie al patear. */
  kickReach: 0.62,
  kickRadius: 0.95,
  kickCooldown: 0.34,
  kickAnim: 0.26,

  /** Carga: toque / media / completa. */
  chargeTap: 0.15,
  chargeMid: 0.46,
  maxCharge: 0.85,
  /** Mientras carga se mueve más lento: patear cuesta. */
  chargeSlow: 0.55,

  /** Velocidad impartida al balón según nivel (1, 2, 3). */
  kickPower: [0, 12, 16.5, 21] as const,
  /** Cuánto del impulso se va hacia arriba por defecto. */
  kickLift: 0.82,
  kickLiftUp: 1.55,
  kickLiftDown: 0.1,
} as const;

export const MATCH = {
  celebration: 2.1,
  kickoffFreeze: 0.55,
  resetDelay: 0.25,
  /** Dónde espera cada jugador el saque: junto a su arco, fuera de la red.
   *  Antes esperaban casi en el círculo central y el saque empezaba con los dos
   *  ya encima del balón. */
  spawnX: 2.9,
  /** Tope de espera del saque si el balón no llega a tocar el pasto (red de
   *  seguridad: el partido nunca debe quedarse congelado). */
  dropMaxWait: 2.6,
  confetti: 90,
  /** Cierre del partido: cámara lenta + cartel antes de la ficha. */
  finale: 1.9,
  /** Velocidad de la simulación durante ese cierre. */
  finaleSlow: 0.32,
} as const;

/** Colores de los dos lados (provisional, luego saldrán de las selecciones). */
export const TEAMS = [
  { name: 'Colombia', short: 'COL', jersey: '#f5c518', shorts: '#1b3a8c', socks: '#f5c518', skin: '#dda57b', hair: '#241a16', keeper: '#111827' },
  { name: 'Argentina', short: 'ARG', jersey: '#8ecdf7', shorts: '#0b1a33', socks: '#eef6ff', skin: '#e0a878', hair: '#1b1410', keeper: '#111827' },
] as const;
