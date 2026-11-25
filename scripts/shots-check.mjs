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

await page.waitForTimeout(700);
await shot('c-menu');

await page.getByText('Nuevo campeonato', { exact: true }).click();
await page.waitForTimeout(350);
await page.getByText('Normal', { exact: false }).first().click();
await page.getByText('Siguiente', { exact: true }).click();
await page.waitForTimeout(300);
await page.getByText('Sorteo real', { exact: false }).first().click();
await page.waitForTimeout(500);
await shot('c-equipo');

await page.getByText('Jugar', { exact: true }).first().click();
await page.waitForSelector('.screen.groups', { timeout: 8000 });
await page.waitForTimeout(300);
await page.getByText('Siguiente', { exact: true }).last().click();
await page.waitForSelector('.screen.options', { timeout: 8000 });
await page.waitForTimeout(600);
await shot('c-opciones');

// primer plano del retrato
const face = await page.locator('.player-face').boundingBox();
if (face) {
  await page.screenshot({
    path: `${out}/c-retrato.png`,
    clip: { x: face.x - 16, y: face.y - 16, width: face.width + 32, height: face.height + 60 },
  });
}

await page.getByText('Jugar', { exact: true }).last().click();
await page.waitForSelector('.screen.match canvas.stage', { timeout: 8000 });
await page.waitForTimeout(1800);
await shot('c-partido');
await page.screenshot({ path: `${out}/c-zoom-cara.png`, clip: { x: 430, y: 540, width: 460, height: 360 } });

// pausa
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await shot('c-pausa');

console.log('errores:', errors.length ? errors : 'ninguno');
await browser.close();
