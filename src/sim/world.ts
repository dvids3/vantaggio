import { BALL, GOAL, MATCH, PLAYER, WORLD } from './config.ts';
import { approach, clamp, circleSegment, damp, makeRng } from '../core/math.ts';
import { NO_INPUT } from './types.ts';
import type { Ball, BotBrain, Input, Match, Particle, Player } from './types.ts';

// El jugador puede meterse dentro del arco (portero). El tope es la red, no la
// línea: antes se quedaba clavado en la raya y no podía despejar un balón
// muerto sobre la línea.
const PLAYER_MIN_X = GOAL.lineLeft - GOAL.depth + 0.55;
const PLAYER_MAX_X = GOAL.lineRight + GOAL.depth - 0.55;

function makePlayer(side: number, x: number): Player {
  return {
    side,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing: side === 0 ? 1 : -1,
    onGround: true,
    coyote: 0,
    jumpBuffer: 0,
    jumpCut: false,
    charging: false,
    charge: 0,
    kickAnim: 0,
    kickCooldown: 0,
    dash: 0,
    dashCooldown: 0,
    dashDir: 1,
    runPhase: 0,
    squash: 0,
    hitFlash: 0,
    headerCd: 0,
    kickGrace: 0,
    prevJump: false,
    prevKick: false,
    prevDash: false,
    trail: [],
  };
}

function makeBall(): Ball {
  // El balón espera pegado al techo y baja al saque: la caída es la que abre el
  // partido (y la que lo reabre tras cada gol). Aterriza sin botar; el rebote
  // de goma fue justo lo que había que quitar, así que el aterrizaje del saque
  // se resuelve aparte en updateBall (fase 'kickoff').
  return {
    x: WORLD.width / 2,
    y: WORLD.ceiling - BALL.r,
    vx: 0,
    vy: 0,
    rot: 0,
    /** Giro lento mientras cae: se lee que viene del techo, no que aparece. */
    spin: 2.2,
    trail: [],
  };
}

function makeBrain(): BotBrain {
  return {
    target: WORLD.width / 2,
    decision: 0,
    decisionCount: 0,
    pattern: 'press',
    patternHistory: [],
    patternT: 0,
    hold: 0,
    cooldown: 0,
    jumpCd: 0,
    feintDir: 1,
    feintT: 0,
    dashT: 0,
    passiveT: 0,
  };
}

export function createMatch(): Match {
  return {
    phase: 'kickoff',
    phaseT: 0,
    clock: 0,
    score: [0, 0],
    players: [makePlayer(0, MATCH.spawnX), makePlayer(1, WORLD.width - MATCH.spawnX)],
    ball: makeBall(),
    particles: [],
    shake: 0,
    goalSide: -1,
    lastTouch: -1,
    lastKick: -1,
    timeLimit: 0,
    goals: [],
    stats: {
      shots: [0, 0],
      headers: [0, 0],
      kicks: [0, 0],
      ownGoals: [0, 0],
      saves: [0, 0],
      maxBallSpeed: 0,
      possession: [0, 0],
    },
    mul: [
      { speed: 1, jump: 1, power: 1, precision: 1 },
      { speed: 1, jump: 1, power: 1, precision: 1 },
    ],
    botLevel: 1,
    humanSide: 0,
    versusBot: true,
    wind: 0,
    windEnabled: false,
    windTarget: 0,
    windTimer: 0,
    fans: false,
    fanTimer: 0,
    wet: false,
    brains: [makeBrain(), makeBrain()],
    botMemory: { shots: 0, shotSide: 0, shotDist: 0, jumpGap: 0, lastJump: -10, lob: 0, conceded: 0 },
    rngSeed: 1337,
    events: [],
    paused: false,
  };
}

export function resetPositions(m: Match): void {
  const a = m.players[0];
  const b = m.players[1];
  a.x = MATCH.spawnX;
  a.y = 0;
  a.vx = 0;
  a.vy = 0;
  a.facing = 1;
  a.onGround = true;
  a.charging = false;
  a.charge = 0;
  a.kickAnim = 0;
  a.kickCooldown = 0;
  a.dash = 0;
  a.dashCooldown = 0;
  a.runPhase = 0;
  a.trail.length = 0;

  b.x = WORLD.width - MATCH.spawnX;
  b.y = 0;
  b.vx = 0;
  b.vy = 0;
  b.facing = -1;
  b.onGround = true;
  b.charging = false;
  b.charge = 0;
  b.kickAnim = 0;
  b.kickCooldown = 0;
  b.dash = 0;
  b.dashCooldown = 0;
  b.runPhase = 0;
  b.trail.length = 0;

  const fresh = makeBall();
  m.ball.x = fresh.x;
  m.ball.y = fresh.y;
  m.ball.vx = 0;
  m.ball.vy = 0;
  m.ball.rot = 0;
  m.ball.spin = fresh.spin;
  m.ball.trail.length = 0;
  m.goalSide = -1;
  m.lastTouch = -1;
}

// ---------------------------------------------------------------- partículas

function rand(m: Match): number {
  // PRNG determinista por partícula; no afecta la física jugable.
  m.rngSeed = (m.rngSeed + 0x6d2b79f5) >>> 0;
  let t = m.rngSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function addParticle(m: Match, p: Particle): void {
  if (m.particles.length > 420) m.particles.shift();
  m.particles.push(p);
}

function burst(
  m: Match,
  x: number,
  y: number,
  count: number,
  kind: Particle['kind'],
  color: string,
  speed: number,
  size: number,
): void {
  for (let i = 0; i < count; i++) {
    const ang = rand(m) * Math.PI * 2;
    const spd = speed * (0.35 + rand(m) * 0.9);
    addParticle(m, {
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd * 0.75 + rand(m) * 1.5,
      life: 0.25 + rand(m) * 0.45,
      max: 0.7,
      size: size * (0.5 + rand(m) * 0.8),
      color,
      kind,
      rot: rand(m) * Math.PI,
      vr: (rand(m) - 0.5) * 12,
      grav: kind === 'confetti' ? 9 : kind === 'dust' ? 1.5 : 0,
      drag: kind === 'confetti' ? 1.1 : 3.2,
    });
  }
}

function confetti(m: Match, x: number, y: number, side: number): void {
  const colors = ['#f5c518', '#22d3ee', '#f472b6', '#a3e635', '#fafafa', '#fb923c'];
  for (let i = 0; i < MATCH.confetti; i++) {
    const ang = -Math.PI / 2 + (rand(m) - 0.5) * 2.4;
    const spd = 6 + rand(m) * 12;
    addParticle(m, {
      x: x + (rand(m) - 0.5) * 1.2,
      y: y + (rand(m) - 0.5) * 0.8,
      vx: Math.cos(ang) * spd + side * 2,
      vy: Math.sin(ang) * spd,
      life: 1.6 + rand(m) * 1.4,
      max: 3,
      size: 0.055 + rand(m) * 0.05,
      color: colors[(i * 7) % colors.length]!,
      kind: 'confetti',
      rot: rand(m) * Math.PI * 2,
      vr: (rand(m) - 0.5) * 16,
      grav: 7.5,
      drag: 0.9,
    });
  }
}

function throwBottle(m: Match): void {
  // Sale de la grada hacia la cancha: cae cerca de la banda y rueda.
  const fromLeft = rand(m) > 0.5;
  const x = fromLeft ? 1.2 + rand(m) * 5.4 : WORLD.width - 1.2 - rand(m) * 5.4;
  addParticle(m, {
    x,
    y: 5.6 + rand(m) * 2.2,
    vx: (WORLD.width / 2 - x) * 0.24 + (rand(m) - 0.5) * 0.8,
    vy: 1.1 + rand(m) * 1.1,
    life: 5,
    max: 5,
    size: 0.17,
    color: '#2c6b3b',
    kind: 'bottle',
    rot: rand(m) * 6,
    vr: (rand(m) - 0.5) * 9,
    grav: 13,
    drag: 0.22,
  });
}

function updateParticles(m: Match, dt: number): void {
  const arr = m.particles;
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i]!;
    p.life -= dt;
    if (p.life <= 0) {
      arr.splice(i, 1);
      continue;
    }
    if (p.kind === 'bottle' && p.y <= 0.16 && p.vy < 0) {
      burst(m, p.x, 0.08, 5, 'dust', '#cbead8', 2.2, 0.07);
      // Si cae cerca del balón, lo toca: el partido se ensucia de verdad.
      if (m.phase === 'play' && Math.abs(p.x - m.ball.x) < 1.5 && m.ball.y < 1.6) {
        m.ball.vx += (p.x >= m.ball.x ? 1 : -1) * (1.1 + rand(m) * 1.2);
        m.ball.vy += 1.6;
        m.events.push({ type: 'bounce', power: 0.3 });
      }
      arr.splice(i, 1);
      continue;
    }
    p.vy -= p.grav * dt;
    const d = 1 / (1 + p.drag * dt);
    p.vx *= d;
    p.vy *= d;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.y < 0.02 && p.kind === 'confetti') {
      p.y = 0.02;
      p.vy = 0;
      p.vx *= 0.5;
      p.vr *= 0.4;
    }
  }
}

// ------------------------------------------------------------------- jugador

function updatePlayer(m: Match, p: Player, input: Input, dt: number): void {
  const mul = m.mul[p.side]!;
  p.kickCooldown = Math.max(0, p.kickCooldown - dt);
  p.kickAnim = Math.max(0, p.kickAnim - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.hitFlash = Math.max(0, p.hitFlash - dt);
  p.headerCd = Math.max(0, p.headerCd - dt);
  p.kickGrace = Math.max(0, p.kickGrace - dt);
  p.squash = approach(p.squash, 0, dt * 2.6);

  // --- dash
  if (input.dash && !p.prevDash && p.dashCooldown <= 0 && p.dash <= 0) {
    p.dash = PLAYER.dashTime;
    // El dash va hacia donde se está pulsando, no hacia donde miraba el
    // jugador en el frame anterior (eso lanzaba al bot en dirección contraria).
    const held = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.dashDir = held !== 0 ? held : p.facing;
    p.dashCooldown = PLAYER.dashCooldown;
    m.events.push({ type: 'dash', side: p.side });
    burst(m, p.x - p.facing * 0.2, p.y + 0.15, 8, 'dust', '#d7f5e2', 3.4, 0.1);
  }
  p.prevDash = input.dash;

  // --- carga de patada
  if (input.kick) {
    if (!p.charging) {
      p.charging = true;
      p.charge = 0;
    }
    p.charge = Math.min(PLAYER.maxCharge, p.charge + dt);
  } else if (p.charging) {
    p.charging = false;
    performKick(m, p, input);
  }
  p.prevKick = input.kick;

  // --- salto (con buffer y coyote time)
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  if (input.up && !p.prevJump) p.jumpBuffer = PLAYER.jumpBuffer;
  p.prevJump = input.up;

  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = PLAYER.jump * mul.jump;
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    p.jumpCut = false;
    p.squash = -0.28;
    if (p.side === m.humanSide) {
      const mem = m.botMemory;
      const gap = m.clock - mem.lastJump;
      if (gap > 0.2 && gap < 4) mem.jumpGap = mem.jumpGap === 0 ? gap : mem.jumpGap * 0.7 + gap * 0.3;
      mem.lastJump = m.clock;
    }
    burst(m, p.x, p.y + 0.05, 5, 'dust', '#cbead8', 2.2, 0.08);
  }
  // altura variable: si sueltas arriba mientras subes, se corta el salto
  if (!input.up && p.vy > 0 && !p.jumpCut) {
    p.vy *= PLAYER.jumpCut;
    p.jumpCut = true;
  }

  // --- movimiento horizontal
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) p.facing = dir;

  if (p.dash > 0) {
    p.dash = Math.max(0, p.dash - dt);
    p.vx = p.dashDir * PLAYER.dashSpeed;
    p.trail.push({ x: p.x, y: p.y, a: 1, rot: p.vx });
    if (p.trail.length > 8) p.trail.shift();
  } else {
    const cap = PLAYER.maxSpeed * mul.speed * (p.charging ? PLAYER.chargeSlow : 1);
    const target = dir * cap;
    const rate = p.onGround
      ? dir !== 0
        ? PLAYER.accelGround
        : PLAYER.frictionGround
      : dir !== 0
        ? PLAYER.accelAir
        : PLAYER.frictionAir;
    p.vx = approach(p.vx, target, rate * dt);
  }

  // --- gravedad e integración
  p.vy -= PLAYER.gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (p.x < PLAYER_MIN_X) {
    p.x = PLAYER_MIN_X;
    p.vx = Math.max(0, p.vx);
  } else if (p.x > PLAYER_MAX_X) {
    p.x = PLAYER_MAX_X;
    p.vx = Math.min(0, p.vx);
  }

  if (p.y <= 0) {
    const impact = -p.vy;
    p.y = 0;
    if (impact > 1) {
      if (impact > 5.5) {
        p.squash = clamp(impact / 42, 0.12, 0.5);
        burst(m, p.x, 0.06, 6, 'dust', '#cbead8', 2.6, 0.09);
        m.events.push({ type: 'land', side: p.side, power: clamp(impact / 12, 0, 1) });
      }
      p.vy = 0;
    }
    p.onGround = true;
  } else {
    p.onGround = false;
  }
  p.coyote = p.onGround ? PLAYER.coyote : Math.max(0, p.coyote - dt);

  // --- animación de carrera
  if (p.onGround && Math.abs(p.vx) > 0.4) {
    p.runPhase += Math.abs(p.vx) * dt * 1.15;
  } else {
    p.runPhase = approach(p.runPhase % (Math.PI * 2), 0, dt * 6);
  }

  for (let i = p.trail.length - 1; i >= 0; i--) {
    const t = p.trail[i]!;
    t.a -= dt * 4.5;
    if (t.a <= 0) p.trail.splice(i, 1);
  }
}

function performKick(m: Match, p: Player, input: Input): void {
  const charge = p.charge;
  p.charge = 0;
  const level = charge < PLAYER.chargeTap ? 1 : charge < PLAYER.chargeMid ? 2 : 3;
  if (p.kickCooldown > 0) return;

  p.kickCooldown = PLAYER.kickCooldown;
  p.kickAnim = PLAYER.kickAnim;
  m.stats.kicks[p.side]! += 1;

  const b = m.ball;
  // Se patea hacia donde está el balón, no hacia donde mira el cuerpo.
  // Así un toque nunca se pierde por estar de espaldas: en un 1v1 arcade la
  // frustración de fallar un balón quieto a los pies es peor que el realismo.
  const toBall = b.x - p.x;
  let aim = Math.abs(toBall) > 0.18 ? Math.sign(toBall) : p.facing;
  const botSide = m.versusBot && p.side !== m.humanSide;
  const attackDir = p.side === 0 ? 1 : -1;
  // El bot NUNCA patea hacia su propio arco. Si el balón le quedó del lado de
  // su red, no se queda quieto: lo despeja hacia la cancha (despeje de
  // portero). Antes directamente no pateaba, el balón le seguía llegando al
  // cuerpo y lo empujaba dentro: autogol tras autogol en legendario.
  let clearance = false;
  if (botSide && aim !== attackDir) {
    aim = attackDir;
    clearance = true;
  }
  if (aim !== p.facing) p.facing = aim;
  // Con el balón detrás, el punto de contacto es el pie de apoyo, no el de
  // delante: el despeje se mide a los pies.
  const fx = p.x + (clearance ? -aim * 0.12 : aim * PLAYER.kickReach);
  const fy = p.y + 0.42;
  const reach = (clearance ? PLAYER.kickRadius + 0.55 : PLAYER.kickRadius) + BALL.r;
  const dx = b.x - fx;
  const dy = b.y - fy;

  if (dx * dx + dy * dy > reach * reach) {
    // aire: no pasa nada, pero se nota el intento
    p.kickAnim = PLAYER.kickAnim * 0.7;
    return;
  }

  const lift = clearance
    ? PLAYER.kickLiftUp
    : input.up
      ? PLAYER.kickLiftUp
      : input.down
        ? PLAYER.kickLiftDown
        : PLAYER.kickLift;
  const len = Math.hypot(aim, lift) || 1;
  let nx = aim / len;
  let ny = lift / len;
  const mul = m.mul[p.side]!;
  const power = PLAYER.kickPower[level]! * mul.power;
  // Precisión: un remate con poca precisión se desvía unos grados.
  const spread = (1 - mul.precision) * 0.38;
  if (spread > 0.001) {
    const ang = (rand(m) - 0.5) * spread;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const rx = nx * cs - ny * sn;
    const ry = nx * sn + ny * cs;
    nx = rx;
    ny = ry;
  }

  b.vx = nx * power + p.vx * 0.5;
  b.vy = ny * power + Math.max(0, p.vy) * 0.3;
  b.spin = -aim * (0.5 + level * 0.45);
  if (clearance) p.kickGrace = 0.18;

  // El bot nunca deja el balón apuntando a su arco, ni siquiera al despejar de
  // espaldas: si la inercia del cuerpo lo empuja hacia la red, se corrige.
  if (botSide) {
    const toOwn = ownGoalDir(p.side);
    const ownLine = p.side === 0 ? GOAL.lineLeft : GOAL.lineRight;
    if (b.vx * toOwn > 0.2 && Math.abs(p.x - ownLine) < 9) {
      b.vx = -toOwn * Math.min(9, Math.abs(b.vx) * 0.55 + 1.5);
    }
  }

  const speed = Math.hypot(b.vx, b.vy);
  if (speed > BALL.maxSpeed) {
    const k = BALL.maxSpeed / speed;
    b.vx *= k;
    b.vy *= k;
  }

  m.lastTouch = p.side;
  m.lastKick = p.side;
  m.stats.shots[p.side]! += 1;

  // el bot aprende del humano: hacia dónde y desde dónde remata, y si pica
  if (p.side === m.humanSide) {
    const mem = m.botMemory;
    const heroGoal = p.side === 0 ? GOAL.lineRight : GOAL.lineLeft;
    const sideSign = Math.sign(b.vx) || 1;
    const dist = Math.abs(heroGoal - p.x);
    mem.shots += 1;
    const a = Math.min(0.25, 1 / mem.shots);
    mem.shotSide = mem.shotSide * (1 - a) + sideSign * a;
    mem.shotDist = mem.shotDist * (1 - a) + dist * a;
    mem.lob = mem.lob * (1 - a) + (input.up ? 1 : 0) * a;
  }

  m.shake = Math.max(m.shake, 0.12 + level * 0.1);
  m.events.push({ type: 'kick', side: p.side, level, power });

  burst(
    m,
    b.x,
    b.y,
    level === 3 ? 14 : level === 2 ? 9 : 5,
    'spark',
    level === 3 ? '#ffe89a' : '#e8fff6',
    level === 3 ? 6.5 : 4.2,
    0.075,
  );
}

function separatePlayers(m: Match): void {
  const a = m.players[0];
  const b = m.players[1];
  const dx = b.x - a.x;
  const minD = 0.72;
  if (Math.abs(dx) > minD) return;
  // Si uno va por encima del otro, no se empujan: se puede saltar por encima
  // (y quedar montado) en vez de rebotar como dos imanes.
  if (a.y > b.y + PLAYER.headY * 0.7 || b.y > a.y + PLAYER.headY * 0.7) return;
  const push = (minD - Math.abs(dx)) * 0.5 * (dx >= 0 ? 1 : -1);
  a.x = clamp(a.x - push, PLAYER_MIN_X, PLAYER_MAX_X);
  b.x = clamp(b.x + push, PLAYER_MIN_X, PLAYER_MAX_X);
  const rel = a.vx - b.vx;
  a.vx -= rel * 0.08;
  b.vx += rel * 0.08;
}

// --------------------------------------------------------------------- balón

function ballVsPlayer(m: Match, p: Player): boolean {
  const b = m.ball;
  // Justo después de un despeje el balón sale del pie sin chocar con la
  // espalda del que lo pateó (era el autogol del portero).
  if (p.kickGrace > 0) return false;
  // Con el jugador pudiendo entrar al arco, la colisión también vale dentro.
  if (b.x < GOAL.lineLeft - GOAL.depth - 0.2 || b.x > GOAL.lineRight + GOAL.depth + 0.2) return false;
  let touched = false;

  const ownLine = p.side === 0 ? GOAL.lineLeft : GOAL.lineRight;
  const towardGoal = ownLine < WORLD.width / 2 ? -1 : 1;
  const botSide = m.versusBot && p.side !== m.humanSide;
  // ¿Venía al arco? Se mira antes de tocar el balón.
  const headingIn = b.vx * towardGoal > 1.5;

  // Nota histórica: aquí vivía un "blindaje" que invertía la normal del
  // contacto para que el balón nunca entrara en el arco del bot. Funcionaba,
  // pero al resolver la penetración el balón aparecía al otro lado del cuerpo:
  // se veía como un teletransporte del balón delante del jugador. Se quitó.
  // La defensa del arco ahora es cosa de la IA (colocarse, saltar y despejar),
  // no de la física.

  const impulse = (nx: number, ny: number, restitution: number, isHead: boolean): boolean => {
    const rvx = b.vx - p.vx;
    const rvy = b.vy - p.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return false;

    // Un solo número de rebote no servía para las dos cosas:
    //  - al ACERCARSE caminando, el balón tiene que apartarse un poco (antes
    //    se quedaba pegado al pie);
    //  - a un REMATE fuerte, el cuerpo amortigua y el balón muere ahí (con
    //    rebote alto los bloqueos de legendario se colaban en el arco).
    // Por eso el rebote depende de la fuerza del choque.
    const impact = -vn;
    const soft = clamp(1 - (impact - 1.2) / 7.5, 0, 1);
    const rest = restitution * (0.15 + 0.85 * soft);
    const dampK = (isHead ? BALL.headDamp : BALL.bodyDamp) * (1 - 0.45 * (1 - soft));
    const j = -(1 + rest) * vn;
    b.vx += nx * j;
    b.vy += ny * j;
    b.vx *= dampK;
    b.vy *= dampK;

    if (!isHead && headingIn && -vn > 6.5 && Math.abs(p.x - ownLine) < 13) {
      m.stats.saves[p.side]! += 1;
    }

    // Solo es cabezazo si el balón llega a la altura de la cabeza. En un
    // cabezón la cabeza llega hasta el pecho, y sin este filtro cualquier
    // balón raso "cabecеaba" y salía disparado con el impulso extra.
    if (isHead && vn < -4.5 && p.headerCd <= 0 && b.y > p.y + PLAYER.headY - 0.08) {
      p.headerCd = 0.35;
      b.vy += 3.4;
      // El cabezazo empuja hacia donde mira el jugador. En el bot, si mira a su
      // propia red, el impulso va a la cancha: un cabezazo nunca es autogol.
      const headerDir = botSide && p.facing * towardGoal > 0 ? -towardGoal : p.facing;
      b.vx += headerDir * 1.8;
      m.stats.headers[p.side]! += 1;
      m.lastTouch = p.side;
      m.events.push({ type: 'header', side: p.side, power: clamp(-vn / 14, 0, 1) });
      burst(m, b.x, b.y, 6, 'spark', '#dff6ff', 3, 0.06);
    } else if (vn < -1.2) {
      m.lastTouch = p.side;
    }

    const speed = Math.hypot(b.vx, b.vy);
    if (speed > BALL.maxSpeed) {
      const k = BALL.maxSpeed / speed;
      b.vx *= k;
      b.vy *= k;
    }
    p.hitFlash = 0.12;
    return true;
  };

  // Cuerpo: cápsula vertical de los pies a los hombros. Resuelve horizontal
  // cuando el balón va raso (si no, lo empujaría bajo el césped).
  const cap = circleSegment(
    b.x,
    b.y,
    BALL.r + 0.26,
    p.x,
    p.y + PLAYER.bodyBottom - 0.15,
    p.x,
    p.y + PLAYER.bodyTop,
  );
  if (cap) {
    let nx = cap.nx;
    let ny = cap.ny;
    if (ny < -0.5) {
      nx = b.x >= p.x ? 1 : -1;
      ny = 0;
    }
    b.x += nx * cap.penetration;
    b.y += ny * cap.penetration;
    if (b.y < BALL.r) b.y = BALL.r;
    impulse(nx, ny, BALL.bodyRestitution, false);
    touched = true;
  }

  // Cabeza: cabezazo.
  const dx = b.x - p.x;
  const dy = b.y - (p.y + PLAYER.headY);
  const minD = PLAYER.headR + BALL.r;
  const d2 = dx * dx + dy * dy;
  if (d2 <= minD * minD) {
    const d = Math.sqrt(d2) || 1e-5;
    let nx = d > 1e-4 ? dx / d : p.facing;
    let ny = d > 1e-4 ? dy / d : 0;
    // Se empuja SOLO lo que se solapa, nunca se recoloca al otro lado: antes
    // `b.x = p.x + nx * minD` cruzaba el balón de lado cuando la normal se
    // invertía, y eso es el teletransporte que se veía.
    const pen = minD - d;
    b.x += nx * pen;
    b.y += ny * pen;
    if (b.y < BALL.r) b.y = BALL.r;
    impulse(nx, ny, BALL.headRestitution, true);
    touched = true;
  }
  return touched;
}

const POST_R = GOAL.bar / 2;

function bounceBall(m: Match, nx: number, ny: number, restitution: number): void {
  const b = m.ball;
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return;
  b.vx -= nx * (1 + restitution) * vn;
  b.vy -= ny * (1 + restitution) * vn;
  if (-vn > 2) {
    m.events.push({ type: 'post', power: clamp(-vn / 20, 0, 1) });
    m.shake = Math.max(m.shake, 0.12);
    burst(m, b.x, b.y, 5, 'spark', '#ffffff', 2.6, 0.05);
  }
}

function collideGoalFrame(m: Match, side: -1 | 1): void {
  const b = m.ball;
  const line = side === 1 ? GOAL.lineLeft : GOAL.lineRight;
  const back = line - side * GOAL.depth;
  const r = BALL.r + POST_R;

  // travesaño (horizontal) y poste trasero (vertical)
  const bar = circleSegment(b.x, b.y, r, back, GOAL.height, line, GOAL.height);
  if (bar) {
    b.x += bar.nx * bar.penetration;
    b.y += bar.ny * bar.penetration;
    bounceBall(m, bar.nx, bar.ny, 0.42);
  }
  // La red es tela: cuando el balón ya está dentro del arco no rebota contra
  // la pared del fondo, se hunde y se queda. Antes salía disparado hacia fuera
  // y parecía que el gol "no entraba".
  const inside = side === 1 ? b.x < GOAL.lineLeft : b.x > GOAL.lineRight;
  if (!inside) {
    const backPost = circleSegment(b.x, b.y, r, back, 0, back, GOAL.height);
    if (backPost) {
      b.x += backPost.nx * backPost.penetration;
      b.y += backPost.ny * backPost.penetration;
      bounceBall(m, backPost.nx, backPost.ny, 0.3);
    }
  }
  // esquina delantera (el "palito" contra el que se estrella el balón)
  const dx = b.x - line;
  const dy = b.y - GOAL.height;
  const dd = Math.hypot(dx, dy);
  if (dd < r && dd > 1e-5) {
    const nx = dx / dd;
    const ny = dy / dd;
    b.x = line + nx * r;
    b.y = GOAL.height + ny * r;
    bounceBall(m, nx, ny, 0.45);
  }
}

function updateBall(m: Match, dt: number): void {
  const b = m.ball;

  b.vy -= BALL.gravity * dt;
  const drag = m.wet ? BALL.airDrag * 2.4 : BALL.airDrag;
  b.vx = damp(b.vx, drag, dt);
  b.vy = damp(b.vy, drag * 0.5, dt);
  // El viento solo empuja con el balón en juego. Durante el saque el balón cae
  // del techo y tiene que llegar al punto central: con una racha fuerte aterrizaba
  // dos metros a un lado y el saque dejaba de ser parejo para los dos.
  if (m.wind !== 0 && m.phase === 'play') b.vx += m.wind * dt;
  b.spin = damp(b.spin, 1.4, dt);

  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.rot += (b.vx / BALL.r) * dt * 0.55;

  // La gravedad se suma al impulso: se recorta antes de medir para que el
  // máximo registrado nunca supere el tope físico.
  {
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > BALL.maxSpeed) {
      const k = BALL.maxSpeed / sp;
      b.vx *= k;
      b.vy *= k;
    }
  }
  const speed = Math.hypot(b.vx, b.vy);
  // Solo cuentan los remates en juego: la caída del saque desde el techo llega
  // a ~23 m/s y se habría llevado el récord de "remate más fuerte".
  if (m.phase === 'play' && speed > m.stats.maxBallSpeed) m.stats.maxBallSpeed = speed;

  b.trail.push({ x: b.x, y: b.y, a: 1, rot: b.rot });
  if (b.trail.length > 10) b.trail.shift();
  for (let i = b.trail.length - 1; i >= 0; i--) {
    const t = b.trail[i]!;
    t.a -= dt * 5;
    if (t.a <= 0) b.trail.splice(i, 1);
  }

  let touchA = false;
  let touchB = false;
  if (m.phase === 'play') {
    touchA = ballVsPlayer(m, m.players[0]);
    touchB = ballVsPlayer(m, m.players[1]);
  }

  // Balón prensado entre los dos cuerpos. Los cuerpos lo empujan hacia arriba y
  // las cabezas hacia abajo: queda fijado en el aire y el partido se traba. Se
  // saca del encierro por encima de las cabezas, como cuando el balón "revienta"
  // de una montonera.
  if (touchA && touchB) {
    const p0 = m.players[0];
    const p1 = m.players[1];
    const between =
      Math.abs(p0.x - b.x) < 0.95 && Math.abs(p1.x - b.x) < 0.95 && Math.abs(p0.x - p1.x) < 1.9;
    if (between && Math.hypot(b.vx, b.vy) < 9) {
      const top = Math.max(p0.y + PLAYER.headY + PLAYER.headR, p1.y + PLAYER.headY + PLAYER.headR);
      b.y = top + 0.15;
      b.vy = 5.5 + rand(m) * 1.5;
      b.vx = (rand(m) - 0.5) * 6;
      m.events.push({ type: 'bounce', power: 0.35 });
    }
  }

  const inLeftGoal = b.x < GOAL.lineLeft;
  const inRightGoal = b.x > GOAL.lineRight;
  const insideGoal = (inLeftGoal || inRightGoal) && b.y < GOAL.height;

  // --- suelo
  if (b.y < BALL.r) {
    b.y = BALL.r;
    const impact = -b.vy;
    if (m.phase === 'kickoff') {
      // El balón del saque baja del techo y se asienta en el punto central: sin
      // rebote. Un saque botando media cancha se lee como un error, y el gol
      // que viene después (o el que acaba de entrar) merece un balón quieto.
      if (impact > 1) {
        m.events.push({ type: 'bounce', power: clamp(impact / 24, 0, 1) });
        burst(m, b.x, 0.05, 12, 'grass', '#d9f7e4', 2.6, 0.07);
        burst(m, b.x, 0.05, 3, 'dust', '#e8f4e2', 1.1, 0.12);
      }
      b.vy = 0;
      b.vx *= 0.2;
      b.spin = 0;
    } else if (impact > BALL.minBounce) {
      // Un bote solo cuenta si el impacto es fuerte: por debajo del umbral el
      // balón se asienta y rueda. Antes cualquier caída de 10 cm botaba, así que
      // el balón parecía una pelota de goma toda la jugada.
      const k = m.wet ? BALL.bounce * 0.8 : BALL.bounce;
      b.vy = impact * k;
      b.vx *= BALL.bounceFriction;
      if (impact > 4) {
        m.events.push({ type: 'bounce', power: clamp(impact / 20, 0, 1) });
        burst(m, b.x, 0.05, 4, 'grass', '#d9f7e4', 2, 0.06);
      }
    } else {
      b.vy = 0;
      b.vx = damp(b.vx, insideGoal ? 3.4 : BALL.rollDrag, dt);
    }
  }

  // --- techo
  if (b.y + BALL.r > WORLD.ceiling) {
    b.y = WORLD.ceiling - BALL.r;
    if (b.vy > 0) b.vy = -b.vy * 0.45;
  }

  // --- estructura del arco
  collideGoalFrame(m, 1);
  collideGoalFrame(m, -1);

  // Balón dormido encima del travesaño (la colisión lo sostiene y la gravedad
  // lo empuja: queda flotando para siempre). Se le da un empujón hacia la
  // cancha para que ruede y el partido no se congele.
  if (
    b.y > GOAL.height - BALL.r * 0.15 &&
    b.y < GOAL.height + BALL.r + 0.06 &&
    Math.abs(b.vy) < 1.3 &&
    Math.abs(b.vx) < 1.6
  ) {
    b.vx += Math.sign(WORLD.width / 2 - b.x) * 1.4;
  }

  // --- tope de velocidad
  // La gravedad se suma después del impulso; sin este recorte el balón podía
  // superar BALL.maxSpeed por unas centésimas.
  {
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > BALL.maxSpeed) {
      const k = BALL.maxSpeed / sp;
      b.vx *= k;
      b.vy *= k;
    }
  }

  // --- paredes altas (por encima del travesaño)
  if (b.y > GOAL.height - BALL.r) {
    if (b.x - BALL.r < GOAL.lineLeft - GOAL.depth) {
      b.x = GOAL.lineLeft - GOAL.depth + BALL.r;
      if (b.vx < 0) b.vx = -b.vx * 0.35;
    } else if (b.x + BALL.r > GOAL.lineRight + GOAL.depth) {
      b.x = GOAL.lineRight + GOAL.depth - BALL.r;
      if (b.vx > 0) b.vx = -b.vx * 0.35;
    }
  }

  if (insideGoal) {
    const back = (inLeftGoal ? GOAL.lineLeft : GOAL.lineRight) + (inLeftGoal ? -GOAL.depth : GOAL.depth);
    // Se hunde en la red (el centro puede pasar un poco del fondo: la tela
    // cede) y la velocidad se apaga del todo. Nada de rebotar hacia la cancha.
    const sink = BALL.r * 0.78;
    if (inLeftGoal && b.x - sink < back) {
      b.x = back + sink;
      if (b.vx < 0) b.vx = 0;
    } else if (inRightGoal && b.x + sink > back) {
      b.x = back - sink;
      if (b.vx > 0) b.vx = 0;
    }
    // La red frena, pero deja que el balón llegue hasta el fondo: antes se
    // apagaba en seco nada más cruzar la línea y el gol no se "veía" entrar.
    b.vx = damp(b.vx, 1.5, dt);
    b.vy = damp(b.vy, 1.1, dt);
  }
}

// -------------------------------------------------------------------- reglas

function tryGoal(m: Match): void {
  if (m.phase !== 'play') return;
  // Con el tiempo cumplido el partido está terminado: un balón que cruza la
  // línea después del final no es gol.
  if (m.timeLimit > 0 && m.clock >= m.timeLimit) return;
  const b = m.ball;
  if (b.y > GOAL.height) return;

  // El balón tiene que cruzar la línea ENTERO. Antes bastaba con que asomara
  // un cuarto de radio y goles que se veían fuera del arco contaban igual.
  if (b.x + BALL.r <= GOAL.lineLeft) {
    scoreGoal(m, 1);
  } else if (b.x - BALL.r >= GOAL.lineRight) {
    scoreGoal(m, 0);
  }
}

function scoreGoal(m: Match, side: number): void {
  m.score[side]! += 1;
  // Autogol de verdad: lo pateó el equipo que se lo come y nadie más la tocó
  // después. Un desvío en el cuerpo o en la cabeza NO es autogol: es gol del
  // que atacaba, como en el fútbol. Antes cualquier roce contaba como propia
  // puerta y salían "autogoles" que nadie se creía.
  const own = m.lastKick >= 0 && m.lastKick === 1 - side && m.lastTouch === m.lastKick;
  m.goals.push({ side, t: m.clock, own });
  m.phase = 'goal';
  m.phaseT = 0;
  m.goalSide = side;
  if (side === m.humanSide) m.botMemory.conceded += 1;
  if (own) m.stats.ownGoals[m.lastKick]! += 1;
  m.shake = 1;
  m.events.push({ type: 'goal', side });
  m.events.push({ type: 'whistle' });

  const b = m.ball;
  confetti(m, b.x, Math.max(b.y, 1.5), side === 0 ? 1 : -1);
  if (m.fans) {
    for (let i = 0; i < 3; i++) throwBottle(m);
  }
  burst(m, b.x, b.y, 8, 'spark', '#ffffff', 7, 0.05);
}

// --------------------------------------------------------------------- paso

/** Dirección (en x) del arco propio de cada lado. */
function ownGoalDir(side: number): number {
  return side === 0 ? -1 : 1;
}

export function step(m: Match, inputs: [Input, Input], dt: number): void {
  if (m.paused) return;

  // El reloj corre solo con el balón en juego: durante la celebración del gol
  // (y el saque) el tiempo se detiene. Antes el minuto seguía avanzando con el
  // balón parado y cada gol "robaba" 2,3 s de partido.
  if (m.phase === 'play') m.clock += dt;
  m.phaseT += dt;
  m.shake = Math.max(0, m.shake - dt * 1.9);

  // El viento no es una constante: entra en rachas que cambian de dirección y
  // de fuerza cada pocos segundos, como en un estadio abierto.
  if (m.windEnabled) {
    m.windTimer -= dt;
    if (m.windTimer <= 0) {
      const dir = rand(m) > 0.5 ? 1 : -1;
      m.windTarget = dir * (1.3 + rand(m) * 3.9);
      m.windTimer = 5 + rand(m) * 8;
    }
    m.wind = approach(m.wind, m.windTarget, dt * 2.1);
  } else {
    m.wind = 0;
  }

  // Público enardecido: cada tanto vuela una botella a la cancha.
  if (m.fans && m.phase === 'play') {
    m.fanTimer -= dt;
    if (m.fanTimer <= 0) {
      m.fanTimer = 4.5 + rand(m) * 6.5;
      throwBottle(m);
    }
  }

  if (m.phase === 'goal') {
    // El balón sigue su camino hasta el fondo de la red (solo física: sin
    // jugadores ni reglas, que el gol ya está cantado).
    updateBall(m, dt);
    updateParticles(m, dt);
    m.ball.trail.length = 0;
    if (m.phaseT > MATCH.celebration + MATCH.resetDelay) {
      resetPositions(m);
      m.phase = 'kickoff';
      m.phaseT = 0;
    }
    return;
  }

  if (m.phase === 'kickoff') {
    updateParticles(m, dt);
    // El balón baja del techo durante el saque. Antes el saque lo dibujaba ya
    // apoyado en el pasto y a los dos jugadores en el centro: el reinicio no se
    // veía, simplemente estaba.
    updateBall(m, dt);
    const b = m.ball;
    const onGrass = b.y <= BALL.r + 0.002;
    if (m.phaseT > MATCH.kickoffFreeze && (onGrass || m.phaseT > MATCH.dropMaxWait)) {
      // Por si la red de seguridad entra en juego: el balón nunca debe quedar
      // en el aire cuando arranca el juego.
      if (!onGrass) {
        b.y = BALL.r;
        b.vy = 0;
        b.vx *= 0.2;
      }
      m.phase = 'play';
      m.phaseT = 0;
      m.events.push({ type: 'whistle' });
    }
    return;
  }

  updatePlayer(m, m.players[0], inputs[0], dt);
  updatePlayer(m, m.players[1], inputs[1], dt);
  separatePlayers(m);
  updateBall(m, dt);
  tryGoal(m);
  updateParticles(m, dt);

  if (m.lastTouch === 0) m.stats.possession[0]! += dt;
  else if (m.lastTouch === 1) m.stats.possession[1]! += dt;
}

export function emptyInputs(): [Input, Input] {
  return [{ ...NO_INPUT }, { ...NO_INPUT }];
}

export { makeRng };
