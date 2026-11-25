// Captura un partido forzando México (el único equipo con cabeza dibujada) para
// revisar cómo cae la cabeza de arte sobre el cuerpo nuevo.
import { chromium } from 'playwright';

const url = process.env.URL ?? 'http://127.0.0.1:5173';
const out = process.env.OUT ?? 'docs/capturas/mexico';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.getByText('Nuevo campeonato', { exact: true }).click();
await page.waitForTimeout(250);
await page.getByText('Normal', { exact: false }).first().click();
await page.waitForTimeout(250);
await page.getByText('Siguiente', { exact: true }).click();
await page.waitForTimeout(250);
await page.getByText('Sorteo real', { exact: false }).first().click();
await page.waitForTimeout(500);

for (let i = 0; i < 80; i++) {
  const name = (await page.locator('.team-name').first().textContent())?.trim();
  if (name && /^M[eé]xico$/i.test(name)) break;
  await page.getByLabel('Selección siguiente').click();
  await page.waitForTimeout(80);
}
console.log('equipo:', (await page.locator('.team-name').first().textContent())?.trim());
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}-equipo.jpg`, type: 'jpeg', quality: 90 });

await page.getByText('Jugar', { exact: true }).first().click();
await page.waitForTimeout(700);
await page.getByText('Siguiente', { exact: true }).last().click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}-antesala.jpg`, type: 'jpeg', quality: 90 });
await page.getByRole('button', { name: /jugar/i }).last().click();
await page.waitForTimeout(1800);
await page.screenshot({ path: `${out}.jpg`, type: 'jpeg', quality: 90 });
console.log('errores:', errors.length ? errors : 'ninguno');
await browser.close();
