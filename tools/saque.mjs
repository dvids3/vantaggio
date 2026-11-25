import { chromium } from 'playwright';
const OUT = 'docs/capturas';
const JPG = { type: 'jpeg', quality: 86 };
const URL = process.env.URL ?? 'http://127.0.0.1:5174/';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const problems = [];
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`[console] ${m.text()}`); });
const wait = (ms) => page.waitForTimeout(ms);
const click = async (n) => { await page.getByRole('button', { name: n, exact: true }).first().click(); await wait(400); };
const dropAt = (lo, hi) =>
  page.waitForFunction(
    ([a, b]) => {
      const m = window.vantaggio?.match;
      return !!m && m.phase === 'kickoff' && m.ball.y < b && m.ball.y > a;
    },
    [lo, hi],
    { timeout: 15000 },
  );
const forceGoal = async () => {
  await page.evaluate(() => {
    const m = window.vantaggio.match;
    m.ball.x = 1.0;
    m.ball.y = 1.1;
    m.ball.vx = -3;
    m.ball.vy = 0;
  });
  await page.waitForFunction(() => window.vantaggio.match.phase === 'goal', null, { timeout: 5000 });
};

await page.goto(URL, { waitUntil: 'networkidle' });
await wait(1200);
await click('Nuevo campeonato');
await click('Siguiente');
await page.getByRole('button', { name: /Sorteo real/ }).click();
await wait(400);
await click('Jugar');
await click('Siguiente');
await click('Jugar');

// 1. El balón baja del techo, con cada jugador junto a su arco.
await dropAt(3.2, 6.2);
await page.screenshot({ path: `${OUT}/w-saque-caida.jpg`, ...JPG, timeout: 60000 });

// 2. Ya en juego: el balón en el punto central.
await page.waitForFunction(() => window.vantaggio?.match?.phase === 'play', null, { timeout: 8000 });
await page.screenshot({ path: `${OUT}/w-saque.jpg`, ...JPG, timeout: 60000 });
console.log('estado', JSON.stringify(await page.evaluate(() => {
  const m = window.vantaggio.match;
  return { phase: m.phase, p0: +m.players[0].x.toFixed(2), p1: +m.players[1].x.toFixed(2) };
})));

// 3. Tras un gol, el balón vuelve a bajar: cerca del pasto, con el haz apagándose.
await forceGoal();
await dropAt(1.0, 2.2);
await page.screenshot({ path: `${OUT}/w-tras-gol-bajo.jpg`, ...JPG, timeout: 60000 });

// 4. Y otra vez desde arriba, ya con el marcador movido.
await forceGoal();
await dropAt(3.6, 6.6);
await page.screenshot({ path: `${OUT}/w-tras-gol.jpg`, ...JPG, timeout: 60000 });

await browser.close();
console.log(problems.length ? `PROBLEMAS:\n${problems.join('\n')}` : 'sin errores');
