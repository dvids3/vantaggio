import { chromium } from 'playwright';
const OUT = 'docs/capturas';
const JPG = { type: 'jpeg', quality: 84 };
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const click = async (n) => { await page.getByRole('button', { name: n, exact: true }).first().click(); await wait(400); };

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await wait(1200);
await click('Nuevo campeonato');
await click('Siguiente');
await page.getByRole('button', { name: /Sorteo real/ }).click();
await wait(400);
await click('Jugar');

const playQuick = async (hg, ag) => {
  await click('Siguiente');
  await click('Jugar');
  await wait(1200);
  await page.evaluate(([h, a]) => {
    const m = window.vantaggio.match;
    if (m) { m.score[0] = h; m.score[1] = a; m.clock = 89.7; }
  }, [hg, ag]);
  await page.waitForFunction(() => !!document.querySelector('.screen.result'), null, { timeout: 90000 });
  await wait(700);
  const back = page.getByRole('button', { name: 'Volver al grupo', exact: true });
  if (await back.count()) await back.first().click();
  else await page.getByRole('button', { name: 'Ir a eliminatorias', exact: true }).first().click();
  await wait(500);
};

await playQuick(2, 1);
await playQuick(1, 1);
await page.screenshot({ path: `${OUT}/y-grupos.jpg`, ...JPG, timeout: 60000 });
await playQuick(3, 0);
await page.screenshot({ path: `${OUT}/y-eliminatorias.jpg`, ...JPG, timeout: 60000 });
await click('Jugar');
await click('Jugar');
await wait(2400);
await page.screenshot({ path: `${OUT}/y-partido-ko.jpg`, ...JPG, timeout: 60000 });
await page.screenshot({ path: `${OUT}/y-cinta.jpg`, clip: { x: 0, y: 500, width: 1440, height: 200 }, ...JPG, timeout: 60000 });
await page.screenshot({ path: `${OUT}/y-cambio.jpg`, clip: { x: 980, y: 830, width: 460, height: 66 }, ...JPG, timeout: 60000 });
console.log('ok', JSON.stringify(problems));
await browser.close();
