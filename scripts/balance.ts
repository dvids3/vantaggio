/**
 * Medidor de equilibrio: distintos estilos de humano contra cada dificultad.
 *
 *   node --experimental-strip-types scripts/balance.ts
 *
 * No es una prueba (no falla): es la balanza para afinar el bot.
 */
import { createMatch, step } from '../src/sim/world.ts';
import { BOT_SPEED, botInput } from '../src/sim/bot.ts';
import { NO_INPUT } from '../src/sim/types.ts';
import type { Input, Match } from '../src/sim/types.ts';

const DT = 1 / 120;
const SECONDS = 90;

type Style = 'naive' | 'chip' | 'close' | 'spam';

function attacker(kind: Style): (m: Match) => Input {
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
      const want = kind === 'chip' ? 0.3 : kind === 'close' ? 0.16 : kind === 'spam' ? 0.82 : 0.5;
      if (hold >= want) {
        input.kick = false;
        hold = 0;
        if (kind === 'chip' || kind === 'close') input.up = true;
        if (kind === 'close') input.up = false;
        if (kind === 'close') input.down = true;
      }
    }
    return input;
  };
}

function run(level: number, kind: Style): { me: number; bot: number } {
  const m = createMatch();
  m.botLevel = level;
  m.mul[1].speed = BOT_SPEED[level]!;
  const human = attacker(kind);
  const steps = Math.round(SECONDS / DT);
  for (let i = 0; i < steps; i++) step(m, [human(m), botInput(m, 1, DT)], DT);
  return { me: m.score[0], bot: m.score[1] };
}

const styles: Style[] = ['naive', 'chip', 'close', 'spam'];
const names = ['fácil', 'normal', 'difícil', 'legendario'];
console.log(`\n  ${SECONDS}s por partida · goles del humano / goles del bot\n`);
console.log('  nivel       ' + styles.map((s) => s.padStart(12)).join(''));
for (let level = 0; level < 4; level++) {
  const cells = styles.map((s) => {
    const r = run(level, s);
    return `${r.me}/${r.bot}`.padStart(12);
  });
  console.log('  ' + names[level]!.padEnd(12) + cells.join(''));
}
console.log('');
