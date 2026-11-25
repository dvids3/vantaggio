// Retrato del jugador sobre un lienzo propio, con la cámara fija: así se puede
// mirar la silueta del cuerpo con detalle sin que se mueva el partido.
// Uso: node tools/cuerpo-limpio.mjs   (con `npm run dev` levantado)
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.env.URL ?? 'http://127.0.0.1:5173';
const OUT = 'docs/capturas';
const ESCALA = Number(process.env.ESCALA ?? 300);
const PREFIJO = process.env.PREFIJO ?? 'w4';
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
// elegir la selección girando el carrusel (México es la que trae cabeza dibujada)
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
await page.waitForTimeout(1800);

await page.evaluate(async ({ escala, patron, SIN_RIBETE, TRIM }) => {
  window.__patron = patron;
  globalThis.__sinRibete = SIN_RIBETE;
  window.__trim = TRIM;
  const mod = await import('/src/render/render.ts');
  const cv = document.createElement('canvas');
  cv.id = 'lienzo-limpio';
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999';
  document.body.append(cv);
  const r = new mod.Renderer(cv);
  const vivo = window.vantaggio.renderer;
  r.setLook(vivo.look);
  if (window.__trim) {
    for (const k of r.look.kits) {
      k.trim = window.__trim;
      k.socks = window.__trim;
    }
  }
  if (patron) {
    for (const k of r.look.kits) {
      k.pattern = patron;
      k.alt = '#f2f2ee';
    }
  }
  window.__limpio = { r, escala };
}, { escala: ESCALA, patron: process.env.KIT ?? null, SIN_RIBETE: process.env.SIN_RIBETE === '1', TRIM: process.env.TRIM ?? null });

/** Pinta un jugador centrado en `cx` y devuelve el recorte de la captura. */
const retratar = async (nombre, indice, opciones = {}) => {
  const caja = await page.evaluate(
    ({ indice, escala, cx, groundY, vx, runPhase, kick }) => {
      const { r } = window.__limpio;
      const m = window.vantaggio.match;
      const p = m.players[indice];
      const antes = { x: p.x, vx: p.vx, runPhase: p.runPhase, kickAnim: p.kickAnim };
      if (vx !== undefined) p.vx = vx;
      if (runPhase !== undefined) p.runPhase = runPhase;
      if (kick !== undefined) p.kickAnim = kick;
      r.view = { scale: escala, originX: cx - p.x * escala, groundY, w: 1440, h: 900 };
      r.draw(m, { time: 0, debug: false, fps: 60, bot: false, sound: false });
      p.x = antes.x;
      p.vx = antes.vx;
      p.runPhase = antes.runPhase;
      p.kickAnim = antes.kickAnim;
      return { x: cx - 300, y: groundY - 300, width: 640, height: 380 };
    },
    { indice, escala: ESCALA, cx: 700, groundY: 760, ...opciones },
  );
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/${nombre}.png`, clip: caja });
};

await retratar(`${PREFIJO}-quieto`, 0);
await retratar(`${PREFIJO}-rival`, 1);
await retratar(`${PREFIJO}-corre`, 0, { vx: 4, runPhase: 1.4 });
await retratar(`${PREFIJO}-patea`, 0, { vx: 0, runPhase: 0, kick: 0.12 });

console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
