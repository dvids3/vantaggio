/**
 * Pruebas del motor sin navegador:  node --experimental-strip-types src/sim/test.ts
 *
 * No prueba "se ve bonito" (eso es jugar la F0), prueba que la física no
 * explote, que se pueda anotar, que el estado se reinicie y que la simulación
 * sea determinista (requisito del desafío por código de la V2).
 */
import { BALL, GOAL, MATCH, PLAYER, WORLD } from './config.ts';
import { createMatch, step } from './world.ts';
import { buildGroups, groupOf, playMatchday, tableOf } from '../data/tournament.ts';
import { buildKnockout, finishKnockout, isAlive, recordKnockoutResult, settleRound } from '../data/knockout.ts';
import { topScorers, tournamentReport, tournamentTotals } from '../data/records.ts';
import { BOT_JUMP, BOT_POWER, BOT_PRECISION, BOT_SPEED, botInput } from './bot.ts';
import { TEAMS, teamById } from '../data/teams.ts';
import { GUAYOS, guayoId, tieneArte } from '../render/arte.ts';
import { NO_INPUT } from './types.ts';
import type { Input, Match } from './types.ts';

const DT = 1 / 240;

function setExitCode(code: number): void {
  const g = globalThis as { process?: { exitCode?: number } };
  if (g.process) g.process.exitCode = code;
}
let passed = 0;
const failures: string[] = [];

function ok(cond: boolean, label: string, detail = ''): void {
  if (cond) passed++;
  else failures.push(`${label}${detail ? ` → ${detail}` : ''}`);
}

const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol;

function play(m: Match, seconds: number, inputs: (m: Match) => [Input, Input]): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) step(m, inputs(m), DT);
}

function hash(m: Match): string {
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  return JSON.stringify([
    r(m.ball.x),
    r(m.ball.y),
    r(m.ball.vx),
    r(m.ball.vy),
    r(m.players[0].x),
    r(m.players[0].y),
    r(m.players[1].x),
    r(m.players[1].y),
    m.score,
  ]);
}

function valid(m: Match): string | null {
  const nums = [m.ball.x, m.ball.y, m.ball.vx, m.ball.vy, m.players[0].x, m.players[0].y, m.players[1].x, m.players[1].y];
  if (nums.some((n) => !Number.isFinite(n))) return 'hay un NaN o infinito';
  if (m.ball.y < -0.001) return `balón bajo el suelo: ${m.ball.y}`;
  if (m.ball.y > WORLD.ceiling + 0.001) return `balón sobre el techo: ${m.ball.y}`;
  if (m.ball.x < GOAL.lineLeft - GOAL.depth - 0.02) return `balón detrás de la red: ${m.ball.x}`;
  if (m.ball.x > GOAL.lineRight + GOAL.depth + 0.02) return `balón detrás de la red: ${m.ball.x}`;
  return null;
}

const IDLE: [Input, Input] = [{ ...NO_INPUT }, { ...NO_INPUT }];

/**
 * "Humano ingenuo": corre hacia el balón, lo empuja hacia el arco derecho y
 * dispara a carga completa siempre igual. Sirve para medir cuánto encaja el bot
 * en cada dificultad sin depender de habilidad real.
 */
function naiveHumanScript(): (m: Match) => Input {
  let hold = 0;
  return (m) => {
    const me = m.players[0]!;
    const b = m.ball;
    const input: Input = { ...NO_INPUT };
    const target = b.x < me.x - 0.3 ? b.x : GOAL.lineRight;
    const dx = target - me.x;
    if (dx > 0.12) input.right = true;
    else if (dx < -0.12) input.left = true;
    if (hold === 0 && b.x > me.x - 0.4 && Math.abs(b.x - me.x) < 1.15 && b.y < 1.9 && me.kickCooldown <= 0) {
      hold = 0.0001;
    }
    if (hold > 0) {
      hold += DT;
      input.kick = true;
      if (hold >= 0.5) {
        input.kick = false;
        hold = 0;
      }
    }
    return input;
  };
}

function chipHumanScript(): (m: Match) => Input {
  let hold = 0;
  return (m) => {
    const me = m.players[0]!;
    const b = m.ball;
    const input: Input = { ...NO_INPUT };
    const target = b.x < me.x - 0.25 ? b.x - 0.45 : b.x;
    const dx = target - me.x;
    if (dx > 0.08) input.right = true;
    else if (dx < -0.08) input.left = true;
    const near = Math.abs(b.x - me.x) < 1.05 && b.y < 1.7 && me.kickCooldown <= 0;
    if (hold === 0 && near) hold = 0.0001;
    if (hold > 0) {
      hold += DT;
      input.kick = true;
      if (hold >= 0.3) {
        input.kick = false;
        hold = 0;
        input.up = true;
      }
    }
    return input;
  };
}

// 1. En reposo, nada se mueve ni explota.
{
  const m = createMatch();
  play(m, 30, () => IDLE);
  ok(valid(m) === null, 'reposo estable', valid(m) ?? '');
  ok(near(m.ball.y, BALL.r, 0.02), 'el balón cae y se posa', `y=${m.ball.y.toFixed(3)}`);
  ok(m.score[0] === 0 && m.score[1] === 0, 'nadie anota solo');
  ok(m.players[0].onGround && m.players[1].onGround, 'los jugadores quedan en el suelo');
}

// 2. Una patada cargada sale hacia adelante y termina en gol.
{
  const m = createMatch();
  m.phase = 'play';
  m.players[0].x = 10;
  m.players[1].x = 3; // despeja la trayectoria: el rival no debe cabecear el remate
  m.ball.x = 10.62;
  m.ball.y = 0.4;

  const hold: Input = { ...NO_INPUT, kick: true };
  for (let i = 0; i < Math.round(0.3 / DT); i++) step(m, [hold, { ...NO_INPUT }], DT);
  step(m, IDLE, DT);

  ok(m.ball.vx > 8, 'la patada impulsa el balón hacia adelante', `vx=${m.ball.vx.toFixed(2)}`);
  ok(m.stats.shots[0] >= 1, 'la patada cuenta como remate');

  play(m, 8, () => IDLE);
  ok(m.score[0] >= 1, 'un remate desde media cancha termina en gol', `marcador=${m.score.join('-')}`);
}

// 3. Se patea hacia el balón aunque el cuerpo esté de espaldas (regresión).
{
  const m = createMatch();
  m.phase = 'play';
  m.players[0].x = 10;
  m.players[0].facing = -1;
  m.ball.x = 10.62;
  m.ball.y = 0.4;

  const hold: Input = { ...NO_INPUT, kick: true };
  for (let i = 0; i < Math.round(0.3 / DT); i++) step(m, [hold, { ...NO_INPUT }], DT);
  step(m, IDLE, DT);

  ok(m.ball.vx > 8, 'el remate va hacia el balón y no hacia la espalda', `vx=${m.ball.vx.toFixed(2)}`);
  ok(m.players[0].facing === 1, 'el cuerpo gira al patear', `facing=${m.players[0].facing}`);
}

// 4. Un toque suave es más lento que una carga completa.
{
  const kickTest = (holdSeconds: number): number => {
    const m = createMatch();
    m.phase = 'play';
    m.players[0].x = 10;
    m.ball.x = 10.62;
    m.ball.y = 0.4;
    const hold: Input = { ...NO_INPUT, kick: true };
    for (let i = 0; i < Math.round(holdSeconds / DT); i++) step(m, [hold, { ...NO_INPUT }], DT);
    step(m, IDLE, DT);
    return Math.hypot(m.ball.vx, m.ball.vy);
  };
  const tap = kickTest(0.04);
  const full = kickTest(0.7);
  ok(full > tap + 3, 'cargar más patea más fuerte', `toque=${tap.toFixed(1)} carga=${full.toFixed(1)}`);
}

// 5. Cruzar la línea es gol, y el marcador se reinicia bien.
{
  const m = createMatch();
  m.phase = 'play';
  // La regla nueva exige que el balón cruce entero: se coloca con el borde
  // derecho apenas pasado de la línea.
  m.ball.x = GOAL.lineLeft - 0.2 - BALL.r;
  m.ball.y = 1.2;
  m.ball.vx = -4;
  step(m, IDLE, DT);
  ok(String(m.phase) === 'goal', 'cruzar la línea izquierda es gol', `fase=${m.phase}`);
  ok(m.score[1] === 1, 'el gol lo anota el lado correcto', `marcador=${m.score.join('-')}`);

  let guard = 0;
  while (String(m.phase) !== 'kickoff' && guard++ < 240 * 5) step(m, IDLE, DT);
  ok(String(m.phase) === 'kickoff', 'tras la celebración vuelve el saque', `fase=${m.phase}`);
  ok(near(m.players[0].x, MATCH.spawnX, 0.01) && near(m.players[0].y, 0, 0.01), 'los jugadores vuelven junto a su arco', `x=${m.players[0].x.toFixed(2)}`);
  ok(near(m.ball.x, WORLD.width / 2, 0.05) && m.ball.y > WORLD.ceiling - BALL.r - 0.01, 'el balón vuelve al centro, pegado al techo');

  play(m, 1.6, () => IDLE);
  ok(String(m.phase) === 'play', 'el saque arranca solo cuando el balón aterriza');
}

// 6. 120 segundos de bot contra bot: nunca sale del estadio ni se cuelga.
{
  const m = createMatch();
  // Inicia en juego y en la mitad de un bot: en un saque neutral ambos
  // porteros deben conservar su posición hasta que el balón entre en su mitad.
  m.phase = 'play';
  m.ball.x = 8;
  m.ball.y = BALL.r;
  let bad: string | null = null;
  const steps = Math.round(120 / DT);
  for (let i = 0; i < steps; i++) {
    step(m, [botInput(m, 0, DT), botInput(m, 1, DT)], DT);
    if (i % 240 === 0) {
      bad = valid(m);
      if (bad) break;
    }
  }
  ok(bad === null, '120 s de bot vs bot sin salirse', bad ?? '');
  ok(Number.isFinite(m.stats.maxBallSpeed) && m.stats.maxBallSpeed <= BALL.maxSpeed + 0.001, 'la velocidad del balón está acotada');
  ok(m.score[0] + m.score[1] > 0, 'el bot anota al menos una vez en 120 s', `marcador=${m.score.join('-')}`);
}

// 7. Determinismo: misma entrada, mismo resultado.
{
  const run = (): string => {
    const m = createMatch();
    for (let i = 0; i < Math.round(25 / DT); i++) step(m, [botInput(m, 0, DT), botInput(m, 1, DT)], DT);
    return hash(m);
  };
  ok(run() === run(), 'la simulación es determinista');
}

// 8. Los jugadores no se atraviesan.
{
  const m = createMatch();
  m.phase = 'play';
  m.players[0].x = WORLD.width * 0.62;
  m.players[1].x = WORLD.width * 0.62 + 0.1;
  step(m, IDLE, DT);
  ok(Math.abs(m.players[0].x - m.players[1].x) >= 0.63, 'los jugadores se separan al tocarse');
}

// 9. El balón no se hunde al chocar con la estructura del arco.
{
  const m = createMatch();
  m.phase = 'play';
  m.ball.x = GOAL.lineLeft + 1.2;
  m.ball.y = GOAL.height + 0.5;
  m.ball.vx = -12;
  play(m, 0.5, () => IDLE);
  ok(m.ball.y > 0, 'el balón no se hunde al chocar con la estructura');
  ok(valid(m) === null, 'el choque con el arco no rompe el estado', valid(m) ?? '');
}

// 10. Un balón disparado a máxima potencia nunca atraviesa la red.
{
  const m = createMatch();
  m.phase = 'play';
  m.ball.x = 30;
  m.ball.y = 1;
  m.ball.vx = BALL.maxSpeed;
  m.ball.vy = 3;
  play(m, 3, () => IDLE);
  ok(valid(m) === null, 'tiro a máxima potencia dentro del estadio', valid(m) ?? '');
}

// 11. Un balón raso NO atraviesa a un jugador (regresión: no había colisión de piernas).
{
  const m = createMatch();
  m.phase = 'play';
  m.players[0].x = 12;
  m.players[1].x = 20;
  m.ball.x = 9;
  m.ball.y = 0.2;
  m.ball.vx = 14;
  play(m, 1, () => IDLE);
  ok(m.ball.x < 12.6, 'el cuerpo bloquea el balón a ras de piso', `x=${m.ball.x.toFixed(2)}`);
}

// 12. El balón no se queda prensado entre dos jugadores (regresión: quedaba fijado).
{
  const m = createMatch();
  m.phase = 'play';
  m.players[0].x = 11.6;
  m.players[1].x = 12.4;
  m.ball.x = 12;
  m.ball.y = 1.5;
  const x0 = m.ball.x;
  play(m, 2, () => IDLE);
  const moved = Math.abs(m.ball.x - x0) > 1 || m.ball.y > 2.6 || String(m.phase) === 'goal';
  ok(moved, 'el balón se escapa de una montonera', `x=${m.ball.x.toFixed(2)} y=${m.ball.y.toFixed(2)}`);
}

// 13. El cabezazo impulsa y cuenta una sola vez, no en ráfaga.
{
  const m = createMatch();
  m.phase = 'play';
  m.players[0].x = 12;
  m.players[1].x = 20;
  m.ball.x = 12;
  m.ball.y = 2.9;
  m.ball.vy = -6;
  play(m, 0.6, () => IDLE);
  const headers = m.stats.headers[0];
  ok(headers >= 1 && headers <= 3, 'el cabezazo cuenta sin ráfaga', `cabezazos=${headers}`);
}

// 14. La dificultad escala: un atacante ingenuo encaja igual o menos contra legendario.
{
  // Dos partidos por nivel y se suman: con una sola semilla el margen entre
  // niveles es de un gol y la comparación era una moneda al aire.
  const conceded = (level: number): number => {
    let total = 0;
    for (let run = 0; run < 2; run++) {
      const m = createMatch();
      m.botLevel = level;
      m.mul[1].speed = BOT_SPEED[level]!;
      m.mul[1].precision = BOT_PRECISION[level]!;
      m.mul[1].jump = BOT_JUMP[level]!;
      m.mul[1].power = BOT_POWER[level]!;
      m.rngSeed = 1337 + run * 911;
      const human = naiveHumanScript();
      const steps = Math.round(60 / DT);
      for (let i = 0; i < steps; i++) step(m, [human(m), botInput(m, 1, DT)], DT);
      total += m.score[0]!;
    }
    return total;
  };
  const easy = conceded(0);
  const hard = conceded(3);
  ok(hard <= easy, 'legendario encaja igual o menos que fácil', `fácil=${easy} legendario=${hard}`);

  // El gol cómodo era el remate picado de cerca: el bot saltaba antes de
  // tiempo y dejaba el arco abierto por abajo. Ya no debe ser más barato contra
  // el legendario que contra el fácil.
  //
  // Tres partidos por nivel: con el saque nuevo (cada uno arranca junto a su
  // arco) el humano ya no recibe el balón en el centro en cada reinicio, así
  // que un solo partido de 60 s da entre 0 y 2 goles de ese tipo y la
  // comparación era una moneda al aire.
  const chipped = (level: number): number => {
    let total = 0;
    for (let run = 0; run < 3; run++) {
      const m = createMatch();
      m.botLevel = level;
      m.mul[1].speed = BOT_SPEED[level]!;
      m.mul[1].precision = BOT_PRECISION[level]!;
      m.mul[1].jump = BOT_JUMP[level]!;
      m.mul[1].power = BOT_POWER[level]!;
      m.rngSeed = 1337 + run * 911;
      const human = chipHumanScript();
      const steps = Math.round(60 / DT);
      for (let i = 0; i < steps; i++) step(m, [human(m), botInput(m, 1, DT)], DT);
      total += m.score[0]!;
    }
    return total;
  };
  const easyChips = chipped(0);
  const hardChips = chipped(3);
  ok(hardChips <= easyChips, 'fácil encaja más picados que legendario', `fácil=${easyChips} legendario=${hardChips}`);
  ok(hardChips <= 2, 'legendario no regala la portería al que solo pica el balón', `concedidos=${hardChips} en 3 partidos`);
  ok(BOT_SPEED[0]! < BOT_SPEED[3]! && BOT_PRECISION[0]! < BOT_PRECISION[3]!, 'la dificultad escala en velocidad y precisión');
}

// 15. Todos los grupos avanzan: al jugar la jornada 1, los 12 grupos tienen resultados.
{
  const groups = buildGroups();
  playMatchday(groups, 1, 'A1');
  const played = groups.map((g) => g.fixtures.filter((f) => f.hg !== null).length);
  const allGroups = groups.every((g) => g.fixtures.filter((f) => f.hg !== null).length >= 2);
  const totalPlayed = played.reduce((a, b) => a + b, 0);
  ok(allGroups, 'las tablas de todos los grupos avanzan', `jugados=${totalPlayed} de ${groups.length * 6}`);
  const rows = tableOf(groups[1]!);
  ok(
    rows.some((r) => r.pj > 0),
    'un grupo ajeno ya tiene estadísticas tras la jornada 1',
    rows.map((r) => r.pj).join(','),
  );
}

// 16. El cuadro de eliminatorias: 32 clasificados y cinco rondas.
{
  const groups = buildGroups();
  playMatchday(groups, 3);
  const ko = buildKnockout(groups);
  ok(ko.seeds.length === 32, 'clasifican 32 selecciones', `clasificados=${ko.seeds.length}`);
  ok(
    ko.rounds.map((r) => r.length).join(',') === '16,8,4,2,1',
    'el cuadro tiene cinco rondas',
    ko.rounds.map((r) => r.length).join(','),
  );
  const first = ko.rounds[0]!;
  ok(first.every((m) => m.home !== null && m.away !== null), 'dieciseisavos completos');

  let sameGroup = 0;
  for (const m of first) {
    if (m.home && m.away && groupOf(groups, m.home) === groupOf(groups, m.away)) sameGroup++;
  }
  ok(sameGroup === 0, 'no hay cruces del mismo grupo en dieciseisavos', `repetidos=${sameGroup}`);

  settleRound(ko, 0, () => 0.5);
  ok(
    ko.rounds[1]!.every((m) => m.home !== null && m.away !== null),
    'los ganadores llenan octavos',
  );
  ok(ko.rounds[0]!.every((m) => m.hg !== null && m.ag !== null && m.winner !== null), 'toda la ronda queda jugada');
}

// 17. El partido del jugador se registra y las rondas avanzan solas.
{
  const groups = buildGroups();
  playMatchday(groups, 3);
  const ko = buildKnockout(groups);
  const userTeam = ko.seeds[0]!;
  const mine = ko.rounds[0]!.find((m) => m.home === userTeam || m.away === userTeam)!;
  recordKnockoutResult(ko, mine.id, 2, 0, () => 0.5);
  ok(mine.winner === userTeam, 'el ganador del partido del jugador avanza', `ganador=${mine.winner}`);
  ok(ko.rounds[0]!.every((m) => m.winner !== null), 'la ronda se completa al jugar el jugador');
  ok(ko.rounds[1]!.every((m) => m.home !== null && m.away !== null), 'octavos quedan armados');
}

// 18. Si el jugador es visitante (lado 1), el bot juega el lado 0 y no patea
//     hacia su propio arco.
{
  const m = createMatch();
  m.humanSide = 1;
  m.phase = 'play';
  m.players[0].x = 3;
  m.ball.x = 1.6;
  m.ball.y = 0.4;
  const input = botInput(m, 0, DT);
  ok(!input.kick, 'el bot no patea un balón que está detrás de él', `kick=${input.kick}`);
  ok(m.humanSide === 1 && m.players[1].x > m.players[0].x, 'el humano puede jugar en el lado derecho');
}

// 19. El bot sigue jugando aunque vaya ganando y el humano se quede quieto.
{
  const m = createMatch();
  m.phase = 'play';
  m.botLevel = 3;
  m.humanSide = 0;
  m.score = [0, 2]; // el bot gana 2-0
  m.players[1].x = 12;
  m.ball.x = 4;
  m.ball.y = 0.3;
  m.ball.vx = 0;
  const x0 = m.players[1].x;
  for (let i = 0; i < Math.round(2 / DT); i++) step(m, [IDLE[0], botInput(m, 1, DT)], DT);
  ok(Math.abs(m.players[1].x - x0) > 1, 'el bot no se queda quieto aunque vaya ganando', `movimiento=${Math.abs(m.players[1].x - x0).toFixed(2)} m`);
}

// 19b. Legendario presiona si el humano carga quieto con el balón lejos.
{
  const m = createMatch();
  m.phase = 'play';
  m.botLevel = 3;
  m.humanSide = 0;
  m.players[0].x = 6.1;
  m.players[0].charging = true;
  m.ball.x = 7.25;
  m.ball.y = BALL.r;
  m.lastTouch = 0;
  m.mul[1].speed = BOT_SPEED[3]!;
  const x0 = m.players[1].x;
  for (let i = 0; i < Math.round(2 / DT); i++) {
    step(m, [{ ...NO_INPUT, kick: true }, botInput(m, 1, DT)], DT);
  }
  ok(m.players[1].x < x0 - 4, 'legendario presiona al rival quieto aunque cargue', `avance=${(x0 - m.players[1].x).toFixed(2)} m`);
}

// 20. La regla del gol completo: medio balón dentro no es gol.
{
  const m = createMatch();
  m.phase = 'play';
  m.ball.x = GOAL.lineLeft - BALL.r * 0.6; // asoma, pero no cruzó
  m.ball.y = 1.1;
  m.ball.vx = -2;
  step(m, IDLE, DT);
  ok(String(m.phase) === 'play' && m.score[1] === 0, 'un balón que solo asoma a la línea no es gol', `fase=${m.phase}`);

  m.ball.x = GOAL.lineLeft - BALL.r - 0.02; // ya cruzó entero
  m.ball.vx = -2;
  step(m, IDLE, DT);
  ok(String(m.phase) === 'goal' && m.score[1] === 1, 'el gol cuenta cuando el balón cruzó entero');
  ok(m.goals.length === 1 && m.goals[0]!.side === 1, 'el gol queda en el registro con su minuto');
}

// 21. El saque: el balón baja del techo, aterriza sin botar y los jugadores
//     esperan junto a su arco (no en el centro ni dentro de la red).
{
  const m = createMatch();
  ok(near(m.players[0].x, MATCH.spawnX, 0.01) && near(m.players[1].x, WORLD.width - MATCH.spawnX, 0.01), 'cada jugador espera en su lado, junto al arco', `p0=${m.players[0].x.toFixed(2)} p1=${m.players[1].x.toFixed(2)}`);
  ok(
    m.players[0].x > GOAL.lineLeft + 0.5 && m.players[1].x < GOAL.lineRight - 0.5,
    'ninguno arranca dentro de la portería',
    `p0=${m.players[0].x.toFixed(2)} p1=${m.players[1].x.toFixed(2)}`,
  );
  ok(m.ball.y > WORLD.ceiling - BALL.r - 0.001, 'el balón espera pegado al techo', `y=${m.ball.y.toFixed(2)}`);

  play(m, 0.35, () => IDLE);
  ok(m.ball.y < WORLD.ceiling - BALL.r - 0.3, 'el balón cae al empezar el partido', `y=${m.ball.y.toFixed(2)}`);

  play(m, 1.3, () => IDLE);
  ok(near(m.ball.y, BALL.r, 0.002) && Math.abs(m.ball.vy) < 0.2, 'aterriza en el césped y se queda quieto', `y=${m.ball.y.toFixed(3)} vy=${m.ball.vy.toFixed(2)}`);
  ok(String(m.phase) === 'play', 'el partido arranca cuando el balón toca el pasto', `fase=${m.phase}`);
  ok(m.stats.maxBallSpeed < 12, 'la caída no ensucia el récord de remate más fuerte', `max=${m.stats.maxBallSpeed.toFixed(1)} m/s`);

  // Con viento, el balón del saque igual tiene que caer en el centro: el viento
  // solo empuja con el balón en juego (si no, el saque se iba dos metros a un
  // lado y dejaba de ser parejo).
  const windy = createMatch();
  windy.windEnabled = true;
  windy.wind = 5;
  windy.windTarget = 5;
  windy.windTimer = 99;
  let wguard = 0;
  while (String(windy.phase) !== 'play' && wguard++ < 600) step(windy, IDLE, DT);
  ok(near(windy.ball.x, WORLD.width / 2, 0.05), 'el viento no desvía el saque', `x=${windy.ball.x.toFixed(2)}`);
  ok(String(windy.phase) === 'play', 'con viento el saque también arranca');

  // El bote normal sigue siendo corto: caer desde 4 m no puede devolver el globo.
  const drop = createMatch();
  drop.phase = 'play';
  drop.players[0].x = 0.9;
  drop.players[1].x = 17;
  drop.ball.x = 9;
  drop.ball.y = 4;
  drop.ball.vx = 0;
  drop.ball.vy = 0;
  let peak = 0;
  let landed = false;
  for (let i = 0; i < Math.round(6 / DT); i++) {
    step(drop, IDLE, DT);
    if (!landed && drop.ball.y <= BALL.r + 0.001) landed = true;
    if (landed) peak = Math.max(peak, drop.ball.y);
  }
  ok(peak - BALL.r < 1.1, 'tras caer desde 4 m el primer bote sube menos de 1,1 m', `bote=${(peak - BALL.r).toFixed(2)} m`);
}

// 22. Un balón lento contra el cuerpo no sale disparado.
{
  const m = createMatch();
  m.phase = 'play';
  m.players[0].x = 8;
  m.players[0].y = 0;
  m.players[1].x = 15;
  m.ball.x = 6.4;
  m.ball.y = 0.4;
  m.ball.vx = 6;
  m.ball.vy = 0;
  let maxOut = 0;
  for (let i = 0; i < Math.round(1.2 / DT); i++) {
    step(m, IDLE, DT);
    if (m.ball.x > 8) maxOut = Math.max(maxOut, m.ball.vx);
  }
  ok(maxOut < 8, 'el cuerpo amortigua: el balón no vuelve más rápido de lo que vino', `v=${maxOut.toFixed(1)} m/s`);
}

// 23. Al quedar eliminado, el cuadro se juega hasta tener campeón.
{
  const groups = buildGroups();
  playMatchday(groups, 3);
  const ko = buildKnockout(groups);
  const userTeam = ko.seeds[0]!;
  const mine = ko.rounds[0]!.find((m) => m.home === userTeam || m.away === userTeam)!;
  const rival = mine.home === userTeam ? mine.away! : mine.home!;
  recordKnockoutResult(ko, mine.id, 0, 3, () => 0.5);
  ok(mine.winner === rival, 'perder te deja fuera');
  finishKnockout(ko, () => 0.5);
  ok(!isAlive(ko, userTeam), 'el eliminado ya no tiene partidos');
  ok(ko.champion !== null, 'hay campeón aunque el jugador esté fuera', `campeón=${ko.champion}`);
  ok(ko.rounds[ko.rounds.length - 1]![0]!.winner === ko.champion, 'el campeón es el ganador de la final');
}

// 24. Goleadores derivados de los resultados.
{
  const groups = buildGroups();
  playMatchday(groups, 3);
  const ko = buildKnockout(groups);
  const rows = topScorers(groups, ko);
  const totals = tournamentTotals(groups, ko);
  ok(rows.length > 0, 'la tabla de goleadores no está vacía');
  ok(rows.every((r, i, a) => i === 0 || a[i - 1]!.goals >= r.goals), 'los goleadores van ordenados de más a menos');
  const goalsSum = rows.reduce((acc, r) => acc + r.goals, 0);
  const report = tournamentReport(groups, ko);
  // Los autogoles no se le suman a nadie como gol a favor: van aparte, y el
  // total del torneo sigue cuadrando.
  ok(
    goalsSum + report.ownTotal === totals.goals,
    'los goles de la tabla (más autogoles) cuadran con los del torneo',
    `tabla=${goalsSum} autogoles=${report.ownTotal} torneo=${totals.goals}`,
  );
  const a = topScorers(groups, ko);
  ok(a[0]!.name === rows[0]!.name && a[0]!.goals === rows[0]!.goals, 'la tabla es determinista entre llamadas');
}

// 25. El jugador puede entrar en el arco (portero) y despejar desde dentro.
{
  const m = createMatch();
  m.phase = 'play';
  m.players[1].x = 12;
  m.players[0].x = GOAL.lineRight - 0.5;
  const inGoal = { ...NO_INPUT, right: true };
  for (let i = 0; i < Math.round(1.1 / DT); i++) step(m, [IDLE[0], inGoal], DT);
  ok(m.players[0].x > GOAL.lineRight, 'el jugador puede cruzar la línea y meterse en el arco', `x=${m.players[0].x.toFixed(2)}`);

  const m2 = createMatch();
  m2.phase = 'play';
  m2.players[1].x = 12;
  m2.players[0].x = GOAL.lineLeft + 0.5;
  const inLeft = { ...NO_INPUT, left: true };
  for (let i = 0; i < Math.round(1.1 / DT); i++) step(m2, [inLeft, IDLE[1]], DT);
  ok(m2.players[0].x < GOAL.lineLeft, 'también en el arco izquierdo', `x=${m2.players[0].x.toFixed(2)}`);
}

// 26. El balón cruza entero y se queda dentro de la red (no rebota afuera).
{
  const m = createMatch();
  m.phase = 'play';
  m.players[0].x = 10;
  m.players[1].x = 16.2;
  m.ball.x = GOAL.lineLeft + 1.2;
  m.ball.y = 0.6;
  m.ball.vx = -16;
  let insideX = Number.NaN;
  for (let i = 0; i < Math.round(3 / DT); i++) {
    step(m, IDLE, DT);
    if (String(m.phase) === 'goal' && Number.isNaN(insideX)) insideX = m.ball.x;
  }
  ok(insideX < GOAL.lineLeft - BALL.r, 'el balón entra por completo antes del gol', `x=${insideX.toFixed(2)}`);
  ok(m.score[1] === 1, 'el gol se cuenta una sola vez', `marcador=${m.score.join('-')}`);
}

// 27. El cuerpo amortigua de verdad: un balón rápido no sale disparado.
{
  const m = createMatch();
  m.phase = 'play';
  m.players[0].x = 9;
  m.players[1].x = 17.5;
  m.ball.x = 6.5;
  m.ball.y = 0.5;
  m.ball.vx = 12;
  let hit = false;
  for (let i = 0; i < Math.round(0.9 / DT); i++) {
    const before = m.ball.vx;
    step(m, IDLE, DT);
    // el choque se nota en el cambio brusco de velocidad horizontal
    if (Math.abs(m.ball.vx - before) > 1.5) hit = true;
  }
  const speed = Math.hypot(m.ball.vx, m.ball.vy);
  ok(hit && speed < 3, 'el balón queda muerto tras tocar a un jugador', `v=${speed.toFixed(2)} m/s`);
  ok(m.ball.x < 9.1, 'el balón no atraviesa al jugador', `x=${m.ball.x.toFixed(2)}`);
}

// 28. Atajadas: el cuerpo parado en la línea suma una atajada.
{
  const m = createMatch();
  m.phase = 'play';
  m.players[0].x = GOAL.lineLeft + 0.55;
  m.players[1].x = 17.5;
  m.ball.x = GOAL.lineLeft + 3.2;
  m.ball.y = 0.32;
  m.ball.vx = -18;
  for (let i = 0; i < Math.round(1 / DT); i++) step(m, IDLE, DT);
  ok(m.stats.saves[1] === 0 && m.stats.saves[0] >= 1, 'la atajada se le cuenta al que la hizo', `atajadas=${m.stats.saves.join('/')}`);
}

// 29. El viento cambia de dirección y de fuerza durante el partido.
{
  const m = createMatch();
  m.phase = 'play';
  m.windEnabled = true;
  m.players[0].x = 4;
  m.players[1].x = 14;
  let sawLeft = false;
  let sawRight = false;
  let maxAbs = 0;
  for (let i = 0; i < Math.round(60 / DT); i++) {
    step(m, IDLE, DT);
    if (m.wind < -1.5) sawLeft = true;
    if (m.wind > 1.5) sawRight = true;
    maxAbs = Math.max(maxAbs, Math.abs(m.wind));
  }
  ok(sawLeft && sawRight, 'el viento sopla para los dos lados', `izq=${sawLeft} der=${sawRight}`);
  ok(maxAbs > 2.5, 'hay rachas fuertes, no una brisa fija', `máx=${maxAbs.toFixed(1)} m/s`);
}

// 30. Público enojado: caen botellas a la cancha.
{
  const m = createMatch();
  m.phase = 'play';
  m.fans = true;
  m.players[0].x = 4;
  m.players[1].x = 14;
  let bottles = 0;
  for (let i = 0; i < Math.round(20 / DT); i++) {
    step(m, IDLE, DT);
    bottles = Math.max(bottles, m.particles.filter((p) => p.kind === 'bottle').length);
  }
  ok(bottles >= 1, 'el público lanza objetos cuando está enojado', `botellas=${bottles}`);
}

// 31. Regresión de autogoles: el bot de legendario nunca se mete el balón.
{
  let own = 0;
  let rivalGoals = 0;
  for (let run = 0; run < 2; run++) {
    const m = createMatch();
    m.botLevel = 3;
    m.humanSide = 1; // el humano ataca el arco del bot
    m.phase = 'play';
    const shoot = (mm: Match): Input => {
      const me = mm.players[1]!;
      const b = mm.ball;
      const input: Input = { ...NO_INPUT };
      const target = b.x > me.x + 0.3 ? b.x : GOAL.lineLeft;
      if (target > me.x + 0.12) input.right = true;
      else if (target < me.x - 0.12) input.left = true;
      if (Math.abs(b.x - me.x) < 1.1 && b.y < 1.9 && me.kickCooldown <= 0) input.kick = true;
      return input;
    };
    for (let i = 0; i < Math.round(120 / DT); i++) step(m, [botInput(m, 0, DT), shoot(m)], DT);
    own += m.stats.ownGoals[0]!;
    rivalGoals += m.score[1]!;
  }
  ok(own === 0, 'legendario no se hace autogoles ni una vez', `autogoles=${own} goles rival=${rivalGoals}`);
}

// 32. Partido por el tercer puesto: lo juegan los perdedores de las semifinales.
{
  const groups = buildGroups();
  playMatchday(groups, 3);
  const ko = buildKnockout(groups);
  for (let r = 0; r < 4; r++) settleRound(ko, r, () => 0.5);
  const semis = ko.rounds[3]!;
  const losers = semis.map((m) => (m.winner === m.home ? m.away : m.home));
  ok(!!ko.third, 'existe el partido por el tercer puesto', `tercero=${ko.third ? ko.third.id : 'no'}`);
  ok(ko.third?.home === losers[0] && ko.third?.away === losers[1], 'lo juegan los que perdieron las semifinales', `${losers.join(' vs ')}`);
  finishKnockout(ko, () => 0.5);
  ok(!!ko.third?.winner, 'el tercer puesto se define aunque el humano esté fuera', `ganador=${ko.third?.winner ?? 'no'}`);
}

// 33. Autogoles: no suman a favor de nadie y sí a la cuenta del que los hace.
{
  const groups = buildGroups();
  playMatchday(groups, 3);
  const ko = buildKnockout(groups);
  const report = tournamentReport(groups, ko);
  const scorers = new Set(report.scorers.map((r) => `${r.teamId}:${r.name}`));
  const overlap = report.own.filter((r) => scorers.has(`${r.teamId}:${r.name}`)).length;
  ok(report.ownTotal > 0, 'el torneo registra autogoles', `autogoles=${report.ownTotal}`);
  ok(overlap === 0 || report.own.length > 0, 'los autogoles van en su propia tabla', `solapados=${overlap}`);
  ok(
    report.scorers.reduce((acc, r) => acc + r.goals, 0) + report.ownTotal === report.goals,
    'los goles cuadran contando los autogoles',
    `goleadores=${report.scorers.reduce((acc, r) => acc + r.goals, 0)} autogoles=${report.ownTotal} total=${report.goals}`,
  );
}

// 34. El reloj se detiene mientras se celebra el gol.
{
  const m = createMatch();
  m.phase = 'play';
  m.clock = 5;
  m.ball.x = GOAL.lineLeft - BALL.r - 0.05;
  m.ball.y = 0.3;
  m.ball.vx = -1;
  m.ball.vy = 0;
  step(m, IDLE, DT);
  const phase: string = m.phase;
  ok(phase === 'goal', 'el gol se registra al cruzar la línea', phase);
  const before = m.clock;
  play(m, 1.4, () => IDLE);
  ok(
    Math.abs(m.clock - before) < 0.02,
    'el reloj se detiene durante la celebración',
    `${before.toFixed(2)} → ${m.clock.toFixed(2)}`,
  );
}

// 35. El bot no se mete el balón en su arco ni cabeceando hacia atrás.
{
  let own = 0;
  let conceded = 0;
  for (let run = 0; run < 4; run++) {
    const m = createMatch();
    m.botLevel = 3;
    m.humanSide = 1;
    m.phase = 'play';
    const bot = m.players[0]!;
    bot.x = GOAL.lineLeft + 0.22;
    bot.y = 0;
    // Balón a la altura de la cabeza entrando de frente a la red.
    m.ball.x = bot.x + 1.05;
    m.ball.y = PLAYER.headY + 0.15;
    m.ball.vx = -12 - run;
    m.ball.vy = 0;
    for (let i = 0; i < Math.round(1.4 / DT); i++) step(m, [botInput(m, 0, DT), { ...NO_INPUT }], DT);
    own += m.stats.ownGoals[0]!;
    conceded += m.score[1]!;
  }
  ok(own === 0, 'el bot no se mete el balón de cabeza en su arco', `autogoles=${own}`);
  ok(conceded === 0, 'ese balón no acaba en gol en contra', `goles=${conceded}`);
}

// 36. El balón no se teletransporta al chocar con el cuerpo o la cabeza.
{
  const m = createMatch();
  m.botLevel = 3;
  m.humanSide = 1;
  m.phase = 'play';
  const bot = m.players[0]!;
  bot.x = GOAL.lineLeft + 1.1;
  bot.y = 0;
  let worst = 0;
  for (const aim of [-1, 1] as const) {
    const mm = createMatch();
    mm.botLevel = 3;
    mm.humanSide = 1;
    mm.phase = 'play';
    mm.players[0]!.x = GOAL.lineLeft + 1.1;
    mm.players[0]!.y = 0;
    mm.players[1]!.x = 14;
    mm.ball.x = GOAL.lineLeft + 2.2;
    mm.ball.y = PLAYER.headY;
    mm.ball.vx = 7 * aim;
    mm.ball.vy = 0;
    let prev = mm.ball.x;
    for (let i = 0; i < Math.round(0.8 / DT); i++) {
      step(mm, [botInput(mm, 0, DT), { ...NO_INPUT }], DT);
      worst = Math.max(worst, Math.abs(mm.ball.x - prev));
      prev = mm.ball.x;
    }
  }
  // A 42 m/s y 240 Hz el balón avanza 0,18 m por paso: cualquier salto mayor
  // es una recolocación artificial (el viejo "blindaje" lo cruzaba de lado).
  ok(worst < 0.4, 'el balón nunca salta al otro lado del jugador', `salto máximo=${worst.toFixed(2)} m`);
}

// 37. Autogol solo si lo pateó el que se lo come; un desvío es gol del rival.
{
  const deflection = createMatch();
  deflection.phase = 'play';
  deflection.players[0]!.x = 8;
  deflection.players[1]!.x = 14;
  deflection.ball.x = GOAL.lineLeft + 1.4;
  deflection.ball.y = 0.4;
  deflection.ball.vx = -9;
  deflection.lastTouch = 0; // la rozó un defensor…
  deflection.lastKick = -1; // …pero nadie la pateó: entró de rebote
  for (let i = 0; i < Math.round(0.5 / DT); i++) step(deflection, IDLE, DT);
  ok(deflection.score[1] === 1, 'el desvío cuenta como gol del atacante', `marcador=${deflection.score.join('-')}`);
  ok(deflection.stats.ownGoals[0] === 0, 'un desvío NO es autogol', `autogoles=${deflection.stats.ownGoals[0]}`);

  const kicked = createMatch();
  kicked.phase = 'play';
  kicked.players[0]!.x = GOAL.lineLeft + 3;
  kicked.ball.x = GOAL.lineLeft + 0.9;
  kicked.ball.y = 0.4;
  kicked.ball.vx = -9;
  kicked.lastTouch = 0;
  kicked.lastKick = 0; // la pateó el defensor hacia su arco
  for (let i = 0; i < Math.round(0.5 / DT); i++) step(kicked, IDLE, DT);
  ok(kicked.score[1] === 1 && kicked.stats.ownGoals[0] === 1, 'la patada a su propio arco sí es autogol', `marcador=${kicked.score.join('-')} autogoles=${kicked.stats.ownGoals[0]}`);
}

// 38. Con el tiempo cumplido no entra ningún gol más.
{
  const m = createMatch();
  m.phase = 'play';
  m.timeLimit = 45;
  m.clock = 44.99;
  m.players[0]!.x = 8;
  m.players[1]!.x = 12;
  m.ball.x = GOAL.lineLeft + 2.4;
  m.ball.y = 0.5;
  m.ball.vx = -14;
  for (let i = 0; i < Math.round(1.2 / DT); i++) step(m, IDLE, DT);
  ok(m.clock >= 45, 'el reloj llegó al final', `minuto=${m.clock.toFixed(1)}`);
  ok(m.score[0] === 0 && m.score[1] === 0, 'el gol después del final no cuenta', `marcador=${m.score.join('-')}`);
}

// 39. El balón sigue entrando hasta el fondo de la red.
{
  const m = createMatch();
  m.phase = 'play';
  m.players[0]!.x = 10;
  m.players[1]!.x = 16.2;
  m.ball.x = GOAL.lineLeft + 1;
  m.ball.y = 0.7;
  m.ball.vx = -16;
  for (let i = 0; i < Math.round(1.6 / DT); i++) step(m, IDLE, DT);
  const depth = GOAL.lineLeft - m.ball.x;
  ok(depth > GOAL.depth * 0.7, 'el balón llega al fondo de la red', `fondo=${depth.toFixed(2)} m de ${GOAL.depth}`);
}

// 40. Se puede saltar por encima del rival y quedar montado.
{
  const m = createMatch();
  m.phase = 'play';
  m.players[0]!.x = 9;
  m.players[0]!.y = 2.2;
  m.players[1]!.x = 9.05;
  m.players[1]!.y = 0;
  step(m, IDLE, DT);
  ok(Math.abs(m.players[0]!.x - m.players[1]!.x) < 0.3, 'uno puede quedar encima del otro', `dx=${Math.abs(m.players[0]!.x - m.players[1]!.x).toFixed(2)}`);
}

// 41. Al acercarse caminando el balón se aparta solo (no se queda pegado).
{
  const m = createMatch();
  m.phase = 'play';
  m.players[1]!.x = 15;
  m.players[0]!.x = 6;
  m.ball.x = 7.2;
  m.ball.y = BALL.r;
  m.ball.vx = 0;
  let moved = 0;
  // Camina hacia el balón (sin patear): el cuerpo debe empujarlo un poco.
  for (let i = 0; i < Math.round(1.2 / DT); i++) {
    step(m, [{ ...NO_INPUT, right: true }, { ...NO_INPUT }], DT);
    moved = Math.max(moved, m.ball.vx);
  }
  ok(moved > 0.25, 'el balón se aparta al acercarse el jugador', `v=${moved.toFixed(2)} m/s`);
}

// 42. Plantilla ampliable y arte atado al futbolista (no a la selección).
{
  const mexico = teamById('mexico');
  const quinones = mexico.roster.find((p) => p.name.includes('Quiñones'));
  ok(!!quinones, 'México trae a Julián Andrés Quiñones en la plantilla');
  ok(mexico.roster.length > 5, 'la plantilla admite más de cinco', `${mexico.roster.length}`);
  ok(!!quinones && tieneArte('mexico', quinones.name), 'su arte está declarado');
  ok(!tieneArte('mexico', 'Guillermo Ochoa'), 'el arte no se le pega a los demás');
  ok(!tieneArte('sudafrica', quinones?.name), 'el arte no se sale de su selección');
  ok(tieneArte('mexico', 'julian andres quinones'), 'el nombre se compara sin tildes');
  ok(!tieneArte('mexico'), 'sin futbolista no hay arte de selección');
  // Todos los equipos deben seguir teniendo portero: si un roster se edita a
  // mano y se pierde, el partido se queda sin arco rival.
  ok(TEAMS.every((t) => t.roster.some((p) => p.pos === 'POR')), 'las 48 selecciones conservan portero');
}

// 43. Botines: cada futbolista lleva los suyos y siempre los mismos.
{
  const a = guayoId('mexico', 'Julián Andrés Quiñones');
  ok(a === guayoId('mexico', 'julian andres quinones'), 'el botín no cambia con tildes ni mayúsculas');
  ok(a >= 0 && a < 6, 'el botín sale del catálogo de seis', `${a}`);
  const eq = new Set(TEAMS[0]!.roster.map((p) => guayoId(TEAMS[0]!.id, p.name)));
  ok(eq.size > 1, 'dentro de un equipo no van todos con el mismo par', `${eq.size} pares`);
  const pares = new Set(TEAMS.flatMap((t) => t.roster.map((p) => guayoId(t.id, p.name))));
  ok(pares.size === 6, 'los seis pares se reparten entre el plantel', `${pares.size} de 6`);
  const distintos = new Set(TEAMS.flatMap((t) => t.roster.map((p) => `${t.id}|${p.name}`)).map((k) => guayoId(k.split('|')[0], k.split('|')[1])));
  ok(distintos.size === 6, 'no todos los jugadores llevan el mismo par');
}

// 44. El catálogo de botines. La dirección a la que mira cada dibujo no se
// puede probar aquí (es arte, no código), pero sí que el catálogo tenga una
// entrada por par y que ninguna se repita: si eso se rompe, hay jugadores que
// se quedan sin botín y no salta ningún error en pantalla.
{
  ok(GUAYOS.length === 6, 'el catálogo declara los seis pares', `${GUAYOS.length}`);
  ok(new Set(GUAYOS.map((g) => g.src)).size === 6, 'cada par apunta a su propio archivo');
}

const total = passed + failures.length;
console.log(`\n  Vantaggio · motor\n  ${'─'.repeat(46)}`);
console.log(`  ${passed}/${total} pruebas pasaron`);
if (failures.length) {
  console.log('');
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log('');
  setExitCode(1);
} else {
  console.log('  ✓ física, goles, reinicio y determinismo\n');
}
