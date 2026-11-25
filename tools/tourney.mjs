import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Nuevo campeonato', exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Jugar', exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Jugar', exact: true }).click();
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const m = window.vantaggio.match;
  if (m) { m.score[0] = 2; m.score[1] = 0; m.clock = 89.6; }
});
await page.waitForTimeout(1800);
await page.getByRole('button', { name: 'Volver al grupo', exact: true }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/flow/15-grupos-jugado.png' });
const trophies = await page.evaluate(() => window.vantaggio.save.trophies);
console.log('trofeos:', JSON.stringify(trophies));
await browser.close();
console.log(problems.length ? problems.join('\n') : 'sin errores');
