// Comprobación de balance: goles por partido de 90 s según dificultad.
import { createMatch, step } from '../src/sim/world.ts';
import { botInput } from '../src/sim/bot.ts';

const DT = 1 / 60;
const N = 30;

for (const level of [0, 1, 2, 3]) {
  let goals = 0;
  let home = 0;
  let away = 0;
  for (let i = 0; i < N; i++) {
    const m = createMatch();
    m.botLevel = level;
    for (let t = 0; t < 90; t += DT) {
      step(m, [botInput(m, 0, DT), botInput(m, 1, DT)], DT);
    }
    goals += m.score[0] + m.score[1];
    home += m.score[0];
    away += m.score[1];
  }
  console.log(`nivel ${level}: ${(goals / N).toFixed(1)} goles/partido (local ${(home / N).toFixed(1)} · visita ${(away / N).toFixed(1)})`);
}
