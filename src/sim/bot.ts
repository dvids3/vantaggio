import { BALL, GOAL, PLAYER, WORLD } from './config.ts';
import { clamp } from '../core/math.ts';
import { NO_INPUT } from './types.ts';
import type { BotBrain, Input, Match } from './types.ts';

/**
 * Bot de Vantaggio.
 *
 * La dificultad no viene de "fallar más o menos": viene de cómo piensa.
 *
 *  - fácil     → reacciona tarde, se coloca a ojo, pero **presiona** y ataca.
 *  - normal    → juega ordenado, alterna presión y espera.
 *  - difícil   → predice la caída, castiga rebotes y tapa remates.
 *  - legendario → trayectoria exacta, memoria del rival y repertorio completo.
 *
 * El repertorio crece por nivel y los patrones recientes se evitan para que la
 * secuencia no sea fácil de memorizar. También cambia la frecuencia y calidad.
 *
 * Dos reglas que no se negocian en ningún nivel:
 *  1. El bot **siempre quiere ganar**. Nunca se queda quieto, ni siquiera si va
 *     arriba en el marcador: sigue presionando y buscando el arco rival.
 *  2. Defiende por el lado del balón. Cuando el balón ronda su arco se coloca
 *     entre el balón y la red, nunca detrás, para no empujarlo a su propia
 *     portería.
 */

type Pattern = 'press' | 'shape' | 'counter' | 'lob' | 'low' | 'volley' | 'feint';

interface LevelSpec {
  /** Segundos entre replanteos del objetivo. */
  reaction: number;
  /** Error de colocación (metros). */
  wobble: number;
  /** Peso de la trayectoria prevista frente a la posición actual. */
  predict: number;
  /** Cuánto presiona y persigue. */
  aggression: number;
  /** Cuánto usa los patrones aprendidos del humano. */
  learn: number;
  /** Precisión del remate: 1 = siempre al arco. */
  aim: number;
  /** Control de la potencia de tiro. */
  charge: number;
  /** Qué tan adelantado juega cuando toca esperar (metros desde su arco). */
  anchor: number;
  /** 0 = nunca salta a tapar un remate; 1 = siempre y a tiempo. */
  block: number;
  /** Si reacciona a un disparo en curso. */
  reactShot: boolean;
  /** Cada cuánto cambia de patrón (segundos base). */
  variety: number;
  /** Calidad del salto: 1 = llega justo; 0 = salta a destiempo. */
  jumpSkill: number;
}

const LEVELS: LevelSpec[] = [
  { reaction: 0.48, wobble: 2.5, predict: 0.2, aggression: 0.42, learn: 0.0, aim: 0.48, charge: 0.48, anchor: 0.9, block: 0.05, reactShot: false, variety: 0.48, jumpSkill: 0.25 },
  { reaction: 0.18, wobble: 0.75, predict: 0.52, aggression: 0.68, learn: 0.3, aim: 0.72, charge: 0.72, anchor: 1.0, block: 0.55, reactShot: true, variety: 0.58, jumpSkill: 0.62 },
  { reaction: 0.08, wobble: 0.18, predict: 0.86, aggression: 0.86, learn: 0.75, aim: 0.9, charge: 0.9, anchor: 0.78, block: 0.86, reactShot: true, variety: 0.72, jumpSkill: 0.88 },
  { reaction: 0.012, wobble: 0.0, predict: 1.0, aggression: 1.0, learn: 1.0, aim: 1.0, charge: 1.0, anchor: 0.42, block: 1.0, reactShot: true, variety: 0.88, jumpSkill: 1.0 },
];

/** Distancia máxima a la que se para delante de su arco (línea de espera). */
const LINES = [2.2, 1.9, 1.45, 0.95];


/** Repertorio por nivel: todos juegan a todo, con más o menos repertorio. */
const PATTERNS: Pattern[][] = [
  ['press', 'shape', 'lob', 'low'],
  ['press', 'shape', 'counter', 'lob', 'low', 'volley'],
  ['press', 'counter', 'lob', 'low', 'volley', 'feint'],
  ['press', 'counter', 'lob', 'low', 'volley', 'feint', 'shape'],
];

const PATTERN_AGGRO: Record<Pattern, number> = {
  press: 1,
  counter: 0.55,
  shape: 0.4,
  lob: 0.8,
  low: 0.8,
  volley: 0.9,
  feint: 0.85,
};

function noise(m: Match, salt: number): number {
  const x = Math.sin((m.clock * 0.31 + salt) * 12.9898 + m.rngSeed * 0.00007) * 43758.5453;
  return x - Math.floor(x);
}

interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Integra el balón con la misma física del mundo durante `seconds`. */
function ballAt(m: Match, seconds: number): BallState {
  const dt = 1 / 120;
  let x = m.ball.x;
  let y = m.ball.y;
  let vx = m.ball.vx;
  let vy = m.ball.vy;
  const steps = clamp(Math.round(seconds / dt), 1, 240);
  for (let i = 0; i < steps; i++) {
    vy -= BALL.gravity * dt;
    const k = Math.max(0, 1 - BALL.airDrag * dt);
    vx *= k;
    vy *= k;
    x += vx * dt;
    y += vy * dt;
    if (y < BALL.r) {
      y = BALL.r;
      vy = -vy * BALL.bounce;
      vx *= BALL.bounceFriction;
    }
    if (x < GOAL.lineLeft + BALL.r) {
      x = GOAL.lineLeft + BALL.r;
      vx = Math.abs(vx) * 0.55;
    }
    if (x > GOAL.lineRight - BALL.r) {
      x = GOAL.lineRight - BALL.r;
      vx = -Math.abs(vx) * 0.55;
    }
    if (y > WORLD.ceiling) {
      y = WORLD.ceiling;
      vy = -Math.abs(vy) * 0.4;
    }
  }
  return { x, y, vx, vy };
}

/** Punto donde el balón baja a la altura de la cabeza. */
function landingPoint(m: Match): { x: number; t: number } | null {
  const dt = 1 / 120;
  let x = m.ball.x;
  let y = m.ball.y;
  let vx = m.ball.vx;
  let vy = m.ball.vy;
  for (let i = 0; i < 300; i++) {
    vy -= BALL.gravity * dt;
    const k = Math.max(0, 1 - BALL.airDrag * dt);
    vx *= k;
    vy *= k;
    x += vx * dt;
    y += vy * dt;
    if (y < BALL.r) {
      y = BALL.r;
      vy = -vy * BALL.bounce;
      vx *= BALL.bounceFriction;
    }
    if (x < GOAL.lineLeft + BALL.r) {
      x = GOAL.lineLeft + BALL.r;
      vx = Math.abs(vx) * 0.55;
    }
    if (x > GOAL.lineRight - BALL.r) {
      x = GOAL.lineRight - BALL.r;
      vx = -Math.abs(vx) * 0.55;
    }
    if (y <= 1.15 && vy < 0 && i > 4) return { x: clamp(x, GOAL.lineLeft, GOAL.lineRight), t: i * dt };
    if (y > WORLD.ceiling) {
      y = WORLD.ceiling;
      vy = -Math.abs(vy) * 0.4;
    }
  }
  return null;
}

/** Cuándo y a qué altura el balón cruza la línea de `goalX` (si va hacia allá). */
function crossGoal(m: Match, goalX: number): { t: number; y: number } | null {
  const dt = 1 / 120;
  let x = m.ball.x;
  let y = m.ball.y;
  let vx = m.ball.vx;
  let vy = m.ball.vy;
  if ((goalX - x) * vx <= 0) return null;
  for (let i = 0; i < 240; i++) {
    const px = x;
    vy -= BALL.gravity * dt;
    const k = Math.max(0, 1 - BALL.airDrag * dt);
    vx *= k;
    vy *= k;
    x += vx * dt;
    y += vy * dt;
    if ((px - goalX) * (x - goalX) <= 0) return { t: i * dt, y };
    if (y < BALL.r) {
      y = BALL.r;
      vy = -vy * BALL.bounce;
      vx *= BALL.bounceFriction;
    }
  }
  return null;
}

/** Filo de velocidad del bot por nivel (lo aplica la partida y la prueba). */
export const BOT_SPEED = [0.82, 1.0, 1.18, 1.65];

/** Precisión de remate del bot por nivel (multiplica la del futbolista). */
export const BOT_PRECISION = [0.5, 0.72, 0.92, 1];

/** Potencia y salto extra: solo el legendario supera claramente al jugador. */
export const BOT_POWER = [0.9, 1.0, 1.08, 1.22];
export const BOT_JUMP = [0.9, 1.0, 1.08, 1.2];

function pickPattern(m: Match, brain: BotBrain, pool: Pattern[], salt: number): Pattern {
  // Al elegir solo por índice, la secuencia se sentía cíclica y fácil de leer.
  // En niveles altos evita los dos últimos patrones mientras haya alternativas.
  const recent = new Set(brain.patternHistory.slice(-2));
  let choices = pool.filter((pattern) => !recent.has(pattern));
  if (choices.length === 0) choices = pool.filter((pattern) => pattern !== brain.pattern);
  if (choices.length === 0) choices = pool;
  const i = Math.min(choices.length - 1, Math.floor(noise(m, salt) * choices.length));
  return choices[i] ?? 'press';
}

export function botInput(m: Match, side: number, dt: number): Input {
  const me = m.players[side]!;
  const opp = m.players[1 - side]!;
  const b = m.ball;
  const input: Input = { ...NO_INPUT };

  // El saque está congelado mientras la pelota cae. No prepares una carrera o
  // un salto durante esa pausa: decide la primera jugada cuando el balón esté
  // realmente en juego.
  if (m.phase !== 'play') return input;

  const level = clamp(m.botLevel, 0, 3);
  const spec = LEVELS[level]!;
  const brain = m.brains[side]!;
  const mem = m.botMemory;

  const ownGoal = side === 0 ? GOAL.lineLeft : GOAL.lineRight;
  const attackGoal = side === 0 ? GOAL.lineRight : GOAL.lineLeft;
  const dirAtk = attackGoal > ownGoal ? 1 : -1; // hacia el arco rival
  const dirOwn = -dirAtk;
  const ballOnMyHalf = (b.x - WORLD.width / 2) * dirAtk < 0;
  const minX = GOAL.lineLeft + 0.16;
  const maxX = GOAL.lineRight - 0.16;

  brain.decision -= dt;
  brain.patternT -= dt;
  brain.cooldown = Math.max(0, brain.cooldown - dt);
  brain.jumpCd = Math.max(0, brain.jumpCd - dt);
  brain.feintT = Math.max(0, brain.feintT - dt);

  if (brain.patternT <= 0) {
    brain.patternT = spec.variety * 2.4 + noise(m, side + 33) * 2.2;
    const nextPattern = pickPattern(m, brain, PATTERNS[level]!, side * 11 + brain.decisionCount * 1.7);
    if (nextPattern !== brain.pattern || brain.decisionCount === 0) {
      brain.pattern = nextPattern;
      brain.patternHistory.push(nextPattern);
      if (brain.patternHistory.length > 4) brain.patternHistory.shift();
    }
    brain.decisionCount += 1;
  }

  const distMe = Math.abs(b.x - me.x);
  const distOpp = Math.abs(b.x - opp.x);
  const oppHasBall = m.lastTouch === 1 - side;
  const iHaveBall = m.lastTouch === side;
  const loose = m.lastTouch === -1;
  const gapOwn = Math.abs(b.x - ownGoal);
  const gapAtk = Math.abs(attackGoal - b.x);
  const iAmCloser = distMe <= distOpp + 0.25;
  const attacking = iHaveBall || (loose && iAmCloser) || (oppHasBall && gapOwn > 3.2);

  // Trayectoria prevista del balón.
  const horizon = 0.08 + (1 - spec.predict) * 0.3;
  const ahead = ballAt(m, horizon);

  // ¿Me están tirando?
  const shot = crossGoal(m, ownGoal);
  const underFire = spec.reactShot && shot !== null && shot.t < 1.2 && shot.y < GOAL.height + 0.8;
  const oppCharging = opp.charging && Math.abs(opp.x - ownGoal) < 15;

  // Si el humano se queda con el balón sin moverse (esperando), el bot sale a
  // quitárselo: nunca se queda a ver pasar el partido.
  brain.passiveT = oppHasBall && Math.abs(opp.vx) < 0.6 ? brain.passiveT + dt : 0;

  if (brain.decision <= 0) {
    brain.decision = Math.max(0.012, spec.reaction);
    brain.target = decideTarget({
      m,
      me,
      opp,
      b,
      brain,
      spec,
      ownGoal,
      attackGoal,
      dirAtk,
      dirOwn,
      gapOwn,
      gapAtk,
      attacking,
      oppHasBall,
      underFire,
      shot,
      ahead,
      oppCharging,
      minX,
      maxX,
      side,
      level,
    });
  }

  const targetX = clamp(brain.target, minX, maxX);
  const dx = targetX - me.x;
  // Zona muerta que crece con la velocidad: a 9 m/s un frame recorre 7 cm y el
  // bot vibraba alrededor del objetivo sin patear nunca.
  const dead = 0.05 + spec.wobble * 0.12 + Math.abs(me.vx) * 0.085;
  if (dx > dead) input.right = true;
  else if (dx < -dead) input.left = true;

  // ------------------------------------------------------------- dash
  // Un pulso corto: el mundo solo dispara el dash en el flanco de subida.
  brain.dashT = Math.max(0, (brain.dashT ?? 0) - dt);
  if (brain.dashT > 0) input.dash = true;
  if (me.onGround && me.dashCooldown <= 0 && me.dash <= 0 && brain.dashT <= 0) {
    const gap = Math.abs(dx);
    // Nunca dashear para acomodarse detrás del balón: el dash recorre ~2 m y
    // lo pasaba de largo, quedando del lado equivocado y empujándolo a su arco.
    const wantDash =
      (gap > 3.4 - spec.aggression * 0.8 && gapOwn > 4.5) ||
      (oppHasBall && gap > 1.8 && gapOwn > 6 && Math.abs(opp.x - me.x) < 3.4 && level >= 2);
    if (wantDash) brain.dashT = 0.045;
  }

  // ------------------------------------------------------------- salto
  const distX = Math.abs(b.x - me.x);
  const ballLow = b.y < 2.1;
  const comingDown = !underFire && b.vy < 0 && b.y > 1.5 && b.y < 4.7;
  if (ballOnMyHalf && comingDown && distX < 1.55 && me.onGround && brain.jumpCd <= 0) {
    // Solo intenta cabecear si el balón va a cruzar la zona de la cabeza.
    // El antiguo `b.y < 2.4` hacía saltar también por balones bajos.
    const headBottom = me.y + PLAYER.headY + 0.25;
    const headTop = me.y + PLAYER.headY + PLAYER.headR + 0.35;
    if (b.y >= headBottom && b.y <= headTop) {
      input.up = true;
      brain.jumpCd = 0.42;
    }
  }

  // Bloqueo medido del remate.
  if (underFire && shot && me.onGround && brain.jumpCd <= 0) {
    const highShot = shot.y > 1.5;
    if (highShot && spec.block >= 0.45) {
      const aim = shot.y - PLAYER.headR * 0.85;
      const dy = aim - (me.y + PLAYER.headY);
      if (dy > 0.02) {
        const jumpSpeed = PLAYER.jump * m.mul[side]!.jump;
        const disc = jumpSpeed * jumpSpeed - 2 * PLAYER.gravity * dy;
        if (disc >= 0) {
          const tau = (jumpSpeed - Math.sqrt(disc)) / PLAYER.gravity;
          // La poca habilidad anticipa mal y salta antes; la alta espera al
          // momento útil. La fórmula anterior invertía esa relación.
          const lead = (1 - spec.jumpSkill) * 0.9;
          if (shot.t <= tau + 0.05 + lead) {
            input.up = true;
            brain.jumpCd = 0.45;
          }
        }
      }
    }
  }


  // ------------------------------------------------- cruzar sin arrastrar
  // Si voy a pasar por encima de la pelota cerca de mi arco, salto en vez de
  // empujarla hacia la red. Es la forma legítima de no hacerse un autogol:
  // antes lo "arreglaba" la física y el balón aparecía al otro lado del cuerpo.
  // Solo cuando el balón quedó del lado de MI arco y tengo que salir a la
  // cancha: ahí sí hay que pasar por encima. En un duelo normal, saltar
  // dejaría el arco abierto.
  const ballGoalward = (b.x - me.x) * dirAtk < 0;
  const crossing = ballGoalward && (targetX - me.x) * dirAtk > 0;
  if (
    crossing &&
    Math.abs(b.x - me.x) < 1.4 &&
    b.y < 1.25 &&
    me.onGround &&
    brain.jumpCd <= 0 &&
    Math.abs(me.x - ownGoal) < 6.5
  ) {
    input.up = true;
    brain.jumpCd = 0.42;
  }

  // ------------------------------------------------------------- remate
  const ballAhead = (b.x - me.x) * dirAtk > 0;
  // Comprueba el mismo punto de contacto que usa performKick. El límite de
  // altura por sí solo iniciaba cargas que no podían alcanzar el balón.
  const kickAim = Math.abs(b.x - me.x) > 0.18 ? Math.sign(b.x - me.x) : me.facing;
  const kickFx = me.x + kickAim * PLAYER.kickReach;
  const kickDy = b.y - (me.y + 0.42);
  const kickReach = PLAYER.kickRadius + BALL.r;
  const kickContact = (b.x - kickFx) ** 2 + kickDy ** 2 <= kickReach ** 2;
  // Con el balón pegado a mi arco pateo aunque esté detrás: es un despeje, y
  // el motor lo manda siempre hacia la cancha, nunca hacia mi red.
  const dangerZone = gapOwn < 5.4;
  const canKick = distX < 1.32 && kickContact && (ballAhead || dangerZone) && me.kickCooldown <= 0 && brain.hold === 0 && brain.cooldown <= 0;

  if (canKick) {
    const clearance = gapOwn < 6.0;
    const inRange = gapAtk < 15.5 || clearance;
    if (inRange) brain.hold = 0.0001;
  }

  if (brain.hold > 0) {
    brain.hold += dt;
    input.kick = true;

    const oppInLine = (opp.x - b.x) * dirAtk > 0 && Math.abs(opp.x - b.x) < 2.7;
    const clearance = gapOwn < 6.0;

    // Lejos se toca suave para llevar el balón hacia adelante; cerca se
    // descarga el remate. Antes era al revés y el bot rifaba desde su casa.
    let want: number;
    if (clearance) want = 0.1;
    else if (gapAtk < 6.5) want = 0.34;
    else if (gapAtk < 11.5) want = 0.54;
    else want = 0.72;

    // Patrón de remate: picar, raso, cabecear o el instinto del nivel.
    let lift = 0;
    if (clearance) lift = 1;
    else if (brain.pattern === 'lob') lift = 1;
    else if (brain.pattern === 'low') lift = -1;
    else if (brain.pattern === 'volley') lift = 0;
    else if (oppInLine || (spec.learn > 0.5 && mem.lob > 0.55)) lift = 1;
    else if (gapAtk < 7.5 && spec.aim > 0.8 && noise(m, side + 3) > 0.45) lift = -1;

    if (lift > 0) {
      input.up = true;
      want *= 0.9;
    } else if (lift < 0) {
      input.down = true;
      want *= 0.92;
    }

    // Ruido de potencia: solo en niveles bajos.
    const err = (1 - spec.charge) * (noise(m, side + 7 + brain.decisionCount * 0.3) - 0.5) * 0.34;
    want = clamp(want * (1 + err), 0.07, 0.88);

    if (brain.hold >= want) {
      input.kick = false;
      brain.hold = 0;
      brain.cooldown = 0.24 + (3 - level) * 0.18;
    }
  }

  // Mantiene el salto completo mientras sube (el corte de salto es del humano).
  if (!me.onGround && me.vy > 0) input.up = true;

  // Balón altísimo: no saltar al vacío.
  if (b.y > 5.2) input.up = false;

  // No se mete dentro del arco.
  if (me.x <= minX + 0.02 && input.left) input.left = false;
  if (me.x >= maxX - 0.02 && input.right) input.right = false;

  return input;
}

interface DecideArgs {
  m: Match;
  me: Match['players'][number];
  opp: Match['players'][number];
  b: Match['ball'];
  brain: BotBrain;
  spec: LevelSpec;
  ownGoal: number;
  attackGoal: number;
  dirAtk: number;
  dirOwn: number;
  gapOwn: number;
  gapAtk: number;
  attacking: boolean;
  oppHasBall: boolean;
  underFire: boolean;
  shot: { t: number; y: number } | null;
  ahead: BallState;
  oppCharging: boolean;
  minX: number;
  maxX: number;
  side: number;
  level: number;
}

function decideTarget(a: DecideArgs): number {
  const { m, opp, me, b, brain, spec, ownGoal, dirAtk, gapOwn, gapAtk, underFire, shot, ahead, side, level } = a;
  const mem = m.botMemory;
  const line = LINES[level] ?? 6;

  // 1. Remate en camino: plantar el cuerpo en la línea de tiro.
  if (underFire && shot) {
    const cover = shot.y > 2.4 ? 0 : 0.18;
    return clamp(ownGoal - dirAtk * cover, a.minX, a.maxX);
  }

  // 2. Balón rondando mi arco. Si está del lado de la red, me quedo del lado
  //    del campo y despejo desde ahí (el mundo deja al portero golpear hacia
  //    la cancha aunque el balón esté detrás). Si está del lado del campo, me
  //    pongo entre el balón y la red. Lo que nunca hago es caminar a través
  //    del balón hacia mi propia portería: eso era el autogol.
  if (gapOwn < 5.0) {
    const ballGoalward = (b.x - me.x) * dirAtk < 0;
    const guard = ballGoalward ? b.x + dirAtk * 0.45 : b.x - dirAtk * 0.55;
    return clamp(guard, a.minX, a.maxX);
  }

  // 3. ¿Salgo a disputar el balón o espero en la línea?
  // Determina la mitad respecto al centro real de la cancha. Medir desde el
  // arco con un umbral grande hacía que el centro pareciera zona propia y el
  // bot abandonara la portería en el saque.
  const inMyHalf = (b.x - WORLD.width / 2) * dirAtk < 0;
  const pressChance = spec.aggression * (0.65 + 0.35 * PATTERN_AGGRO[brain.pattern]);
  const iHave = m.lastTouch === side;
  const oppHas = m.lastTouch === 1 - side;
  const loose = m.lastTouch === -1;
  const closer = Math.abs(b.x - me.x) <= Math.abs(b.x - opp.x) + 1.0;

  let contest = false;
  if (iHave) contest = true;
  else if (loose) {
    const clearlyCloser = Math.abs(b.x - me.x) + 1.6 < Math.abs(b.x - opp.x);
    const nearby = Math.abs(b.x - me.x) < 6.5 && Math.abs(b.x - me.x) <= Math.abs(b.x - opp.x) + 1.8;
    contest = ((inMyHalf && Math.abs(b.x - me.x) <= Math.abs(b.x - opp.x) + 1.0) || clearlyCloser || nearby) && pressChance > 0.32;
  }
  else if (oppHas) {
    contest = (inMyHalf && pressChance > 0.42) || pressChance > 0.86 || brain.passiveT > 0.65;
  }

  // La línea de espera: nunca se queda a más de `line` metros de su arco si no
  // tiene la pelota. Es lo que evita que un despeje largo lo pille arriba.
  // Si el humano se queda quieto, el bot sale a quitarle el balón aunque tenga
  // que abandonar su línea: quiere ganar, no dejar correr el reloj.
  const passiveChase = brain.passiveT > 0.65 ? [1.4, 2.8, 4.5, 6.5][level]! : 0;
  const looseAdvance = loose ? [0.3, 0.5, 0.8, 1.1][level]! : 0;
  const limit = ownGoal + dirAtk * (line + passiveChase + looseAdvance);

  if (contest) {
    let target = b.x - dirAtk * 0.62;
    if (b.y > 2.2) {
      const land = landingPoint(m);
      if (land) target = land.x - dirAtk * 0.4;
    } else {
      target += clamp(ahead.vx * 0.1, -0.3, 0.3);
    }

    // Amague: se cruza un instante al otro lado para descolocar al humano.
    if (brain.pattern === 'feint' && brain.feintT <= 0) {
      brain.feintDir = noise(m, side + 61) > 0.5 ? 1 : -1;
      brain.feintT = 0.42;
    }
    if (brain.pattern === 'feint' && brain.feintT > 0.18) target += brain.feintDir * 0.75;

    // La línea solo frena al bot cuando persigue a un rival con balón. Si el
    // balón está libre (o es suyo) va a por él aunque quede lejos.
    if ((oppHas || loose) && !iHave && !inMyHalf) {
      target = dirAtk > 0 ? Math.min(target, limit) : Math.max(target, limit);
    }
    return clamp(target, a.minX, a.maxX);
  }

  // 3.b En fácil, tras robar el balón vuelve a su mitad en vez de driblar hasta
  //     el arco: es el nivel para aprender, no para sufrir una goleada.
  if (level === 0 && m.lastTouch === side && gapAtk < 9.5) {
    return clamp(ownGoal + dirAtk * (line + 0.6), a.minX, a.maxX);
  }

  // 4. Espera activa: entre el balón y el arco, a una distancia que cubre el
  //    despeje largo y que no deja el arco regalado.
  const stand = Math.min(Math.max(gapOwn * 0.4, spec.anchor), line);
  let target = ownGoal + dirAtk * stand;

  // Memoria: si el humano remata siempre al mismo lado, se cubre ese lado.
  if (spec.learn > 0 && mem.shots >= 2) {
    target += mem.shotSide * spec.learn * 0.5;
    if (mem.shotDist > 12) target = ownGoal + dirAtk * Math.max(1.4, stand * 0.85);
    if (mem.lob > 0.6) target += dirAtk * 0.2;
  }

  // Si el humano carga el remate, el bot se mete en la línea del tiro en vez
  // de quedarse mirando desde lejos.
  if (a.oppCharging && level >= 1 && gapOwn < 13) {
    target = ownGoal + dirAtk * Math.min(stand, 1.4);
  }

  // Nunca quieto: si ya está en el sitio y el balón está lejos, se acerca al
  // punto medio. Así el bot siempre está disputando algo.
  const idle = Math.abs(me.x - target) < 0.14;
  if (idle && gapOwn > 6) target += dirAtk * 0.8;

  // Error de colocación que desaparece con el nivel.
  target += (noise(m, side + 1 + brain.decisionCount * 0.7) - 0.5) * spec.wobble;
  return clamp(target, a.minX, a.maxX);
}
