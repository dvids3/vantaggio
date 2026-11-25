// Captura de pantalla del partido para revisar el cabezón.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.env.URL ?? 'http://127.0.0.1:5199';
const out = 'docs/capturas';
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(url, { waitUntil: 'networkidle' });

// menú → dificultad → leyenda → sorteo real → equipo → jugar
await page.getByText('Nuevo campeonato', { exact: true }).click();
await page.getByText('Legendario', { exact: false }).first().click();
await page.getByText('Siguiente', { exact: true }).click();
await page.getByText('Sorteo real', { exact: false }).first().click();

// pantalla de equipo: "Jugar" solo avanza a la fase de grupos
await page.getByText('Jugar', { exact: true }).first().click();
await page.waitForSelector('.screen.groups', { timeout: 8000 });
await page.waitForTimeout(300);

// grupos: "Siguiente" lleva a las opciones previas al partido
await page.getByText('Siguiente', { exact: true }).last().click();
await page.waitForSelector('.screen.options', { timeout: 8000 });
await page.waitForTimeout(300);

// opciones: "Jugar" arranca el partido
await page.getByText('Jugar', { exact: true }).last().click();

await page.waitForSelector('.screen.match canvas.stage', { timeout: 8000 });
await page.waitForTimeout(1600);

const shot = async (name) => {
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 88 });
};

await shot('v-partido-idle');

// primer plano de la cara
await page.screenshot({ path: `${out}/_zoom-cara.png`, clip: { x: 470, y: 560, width: 380, height: 320 } });

// correr a la derecha
await page.keyboard.down('KeyD');
await page.waitForTimeout(520);
await shot('v-partido-corre');
await page.keyboard.up('KeyD');

// saltar
await page.keyboard.down('KeyW');
await page.waitForTimeout(180);
await page.keyboard.up('KeyW');
await page.waitForTimeout(120);
await shot('v-partido-salto');

// patear (mantener para cargar)
await page.keyboard.down('Space');
await page.waitForTimeout(420);
await shot('v-partido-patea');
await page.keyboard.up('Space');

console.log('errores:', errors.length ? errors : 'ninguno');
await browser.close();
