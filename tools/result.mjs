import { chromium } from 'playwright';

const base = 'http://127.0.0.1:5173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Nuevo campeonato', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Jugar', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Jugar', exact: true }).click();
await page.waitForTimeout(1800);
await page.evaluate(() => {
  const m = window.vantaggio.match;
  if (m) {
    m.score[0] = 3;
    m.score[1] = 1;
    m.clock = 89.5;
  }
});
await page.waitForTimeout(2200);
await page.screenshot({ path: '/tmp/flow/07-resultado.png' });
await browser.close();
console.log('ok');
