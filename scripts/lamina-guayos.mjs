// Lámina de los seis pares de guayos tal como llegan al juego (WebP recortado).
// Uso: node scripts/lamina-guayos.mjs   (con `npm run dev` levantado)
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL_BASE = process.env.URL ?? 'http://127.0.0.1:5173';
const SALIDA = process.env.OUT ?? 'docs/capturas/w1-guayos.png';

const PARES = [
  ['adidas1', 'Adidas · blanco y rojo'],
  ['adidas2', 'Adidas · negro y rosa'],
  ['nike1', 'Nike · verde agua'],
  ['nike2', 'Nike · blanco y rosa'],
  ['puma1', 'Puma · negro y lila'],
  ['puma2', 'Puma · verde neón'],
];

const html = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;background:#12100e;color:#f4efe4;font-family:-apple-system,system-ui,sans-serif}
  .wrap{display:grid;grid-template-columns:repeat(3,380px);gap:26px 30px;padding:38px 44px 30px}
  .par{background:radial-gradient(120% 100% at 50% 0%,#221d18,#15120f);border:1px solid #2e2720;border-radius:16px;padding:10px 12px 8px}
  .par img{width:100%;display:block;filter:drop-shadow(0 8px 10px rgba(0,0,0,.55))}
  .par span{display:block;margin-top:4px;font-size:13px;letter-spacing:.02em;color:#cfc3ad;text-align:center}
</style>
<div class="wrap">${PARES.map(([id, nombre]) => `
  <div class="par"><img src="/arte/guayos/${id}.webp" alt="${nombre}"><span>${nombre}</span></div>`).join('')}
</div>`;

await mkdir('docs/capturas', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 620 }, deviceScaleFactor: 2 });
await page.goto(URL_BASE + '/_lamina.html').catch(() => {});
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const alto = await page.evaluate(() => document.body.scrollHeight);
await page.setViewportSize({ width: 1300, height: alto });
await page.locator('.wrap').screenshot({ path: SALIDA });
console.log(`listo ${SALIDA} (1300x${alto})`);
await browser.close();
