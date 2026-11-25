import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.env.URL ?? 'http://127.0.0.1:5173';
const out = 'docs/capturas';
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(url, { waitUntil: 'networkidle' });
const shot = async (name) => page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 90 });

await page.waitForTimeout(2500);
await shot('d-menu');

await page.getByText('Nuevo campeonato', { exact: true }).click();
await page.waitForTimeout(350);
await page.getByText('Normal', { exact: false }).first().click();
await page.getByText('Siguiente', { exact: true }).click();
await page.waitForTimeout(300);
await page.getByText('Sorteo real', { exact: false }).first().click();
await page.waitForTimeout(600);
await shot('d-equipo');

await page.getByText('Jugar', { exact: true }).first().click();
await page.waitForSelector('.screen.groups', { timeout: 8000 });
await page.waitForTimeout(300);
await page.getByText('Siguiente', { exact: true }).last().click();
await page.waitForSelector('.screen.options', { timeout: 8000 });
await page.waitForTimeout(700);
await shot('d-opciones');

const face = await page.locator('.player-face').boundingBox();
if (face) {
  await page.screenshot({
    path: `${out}/d-retrato.png`,
    clip: { x: face.x - 10, y: face.y - 10, width: face.width + 20, height: face.height + 46 },
  });
}

await page.getByText('Jugar', { exact: true }).last().click();
await page.waitForSelector('.screen.match canvas.stage', { timeout: 8000 });
await page.waitForTimeout(1500);
await shot('d-partido');

// Los dos cabezones, en grande.
await page.screenshot({ path: `${out}/d-cabezones.png`, clip: { x: 980, y: 470, width: 320, height: 250 } });

// Uno solo, más cerca: elijo el lado donde está el jugador del usuario.
await page.screenshot({ path: `${out}/d-cara1.png`, clip: { x: 1080, y: 490, width: 150, height: 150 } });

console.log('errores:', errors.length ? errors : 'ninguno');
await browser.close();
