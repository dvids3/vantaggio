// Partido real: vista completa y recorte a escala de juego, para juzgar el
// muñeco donde de verdad se ve (no ampliado).
// Uso: node tools/w5-juego.mjs   (con `npm run dev` levantado)
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.env.URL ?? 'http://127.0.0.1:5173';
const OUT = 'docs/capturas';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.getByText('Nuevo campeonato', { exact: true }).click();
await page.getByText('Legendario', { exact: false }).first().click();
await page.getByText('Siguiente', { exact: true }).click();
await page.getByText('Sorteo real', { exact: false }).first().click();
for (let i = 0; i < 60; i++) {
  const nombre = (await page.locator('.team-name').first().textContent()) ?? '';
  const limpio = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (limpio === 'mexico') break;
  await page.getByLabel('Selección siguiente').click();
  await page.waitForTimeout(60);
}
await page.getByText('Jugar', { exact: true }).first().click();
await page.waitForSelector('.screen.groups', { timeout: 8000 });
await page.getByText('Siguiente', { exact: true }).last().click();
await page.waitForSelector('.screen.options', { timeout: 8000 });
await page.getByText('Jugar', { exact: true }).last().click();
await page.waitForSelector('.screen.match canvas.stage', { timeout: 8000 });
await page.waitForTimeout(1200);

// Correr un poco para que el muñeco no esté en pose de espera.
await page.keyboard.down('KeyD');
await page.waitForTimeout(450);
await page.keyboard.up('KeyD');
await page.waitForTimeout(250);

await page.screenshot({ path: `${OUT}/w5-partido.jpg`, type: 'jpeg', quality: 88 });

// Recorte alrededor del jugador a la escala en la que se ve la cámara.
const caja = await page.evaluate(() => {
  const r = window.vantaggio.renderer;
  const p = window.vantaggio.match.players[0];
  const x = r.sx(p.x);
  const y = r.sy(p.y);
  return { x: Math.max(0, x - 300), y: Math.max(0, y - 330), width: 600, height: 460 };
});
await page.screenshot({ path: `${OUT}/w5-juego.png`, clip: caja });

console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
