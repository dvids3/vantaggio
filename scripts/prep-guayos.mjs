/**
 * Prepara los guayos del usuario para el juego.
 *
 * Los SVG de `~/Downloads/guayos` traen los DOS zapatos en el mismo archivo
 * (uno mirando a cada lado) y pesan entre 1 y 5 MB: imposible mandarlos al
 * navegador. Este script abre cada archivo, se queda con el zapato de ARRIBA,
 * recorta el espacio transparente que lo rodea y guarda un WebP de 420 px de
 * ancho con transparencia.
 *
 * El zapato de arriba NO mira siempre al mismo lado: en tres de los seis
 * archivos venía dibujado hacia la derecha. Por eso el script mide, en el
 * recorte, de qué lado quedó el talón (la caña alta) y lo informa al final.
 * Esa medida es la que decide el `espejo` de cada entrada en `arte.ts`.
 *
 * El resultado queda en `public/arte/guayos/<nombre>.webp`, que es lo que
 * carga `arte.ts`. Se corre una sola vez:
 *
 *   node scripts/prep-guayos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';

const ORIGEN = path.join(os.homedir(), 'Downloads', 'guayos');
const DESTINO = 'public/arte/guayos';
const ANCHO = 420;
const CALIDAD = 0.94;

const EQUIVALENCIAS = {
  guayosAdidas1: 'adidas1',
  guayosAdidas2: 'adidas2',
  guayosNike1: 'nike1',
  guayosNike2: 'nike2',
  guayosPuma1: 'puma1',
  guayosPuma2: 'puma2',
};

const EXE = '.pw-browsers/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell';

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage();
fs.mkdirSync(DESTINO, { recursive: true });

const archivos = fs.readdirSync(ORIGEN).filter((f) => f.endsWith('.svg'));

for (const archivo of archivos) {
  const clave = EQUIVALENCIAS[path.basename(archivo, '.svg')];
  if (!clave) {
    console.log(`  ? ${archivo}: sin nombre destino, se omite`);
    continue;
  }
  const b64 = fs.readFileSync(path.join(ORIGEN, archivo)).toString('base64');
  const res = await page.evaluate(async ({ b64, ancho, calidad }) => {
    const img = new Image();
    img.src = `data:image/svg+xml;base64,${b64}`;
    await img.decode();

    // 1. Se dibuja el archivo completo en un lienzo grande.
    const L = 2048;
    const cv = document.createElement('canvas');
    cv.width = L;
    cv.height = L;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, L, L);

    // 2. Caja del zapato de arriba: píxeles no transparentes por encima de la
    //    mitad del archivo (el segundo zapato vive en la mitad de abajo).
    const d = ctx.getImageData(0, 0, L, L).data;
    let x0 = L, y0 = L, x1 = -1, y1 = -1;
    for (let y = 0; y < L / 2; y++) {
      for (let x = 0; x < L; x++) {
        if (d[(y * L + x) * 4 + 3] > 12) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;

    const pad = 10;
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(L - 1, x1 + pad);
    y1 = Math.min(L - 1, y1 + pad);

    // 3. Recorte escalado a `ancho` px conservando la proporción.
    const w0 = x1 - x0 + 1;
    const h0 = y1 - y0 + 1;
    const w = ancho;
    const h = Math.round((h0 / w0) * ancho);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(cv, x0, y0, w0, h0, 0, 0, w, h);

    // 4. ¿Para dónde quedó mirando? El talón es la caña alta; la punta, el
    //    extremo bajo. Se busca la columna más alta del recorte: si cae en la
    //    mitad izquierda, el talón está a la izquierda y la punta mira a la
    //    derecha (que es como lo dibuja el juego: no hay que espejar).
    const px = o.getImageData(0, 0, w, h).data;
    let alto = 0;
    let talon = 0;
    for (let x = 0; x < w; x++) {
      let y0col = h;
      let y1col = -1;
      for (let y = 0; y < h; y++) {
        if (px[(y * w + x) * 4 + 3] > 12) {
          if (y < y0col) y0col = y;
          if (y > y1col) y1col = y;
        }
      }
      const e = y1col < 0 ? 0 : y1col - y0col + 1;
      if (e > alto) {
        alto = e;
        talon = x;
      }
    }
    const espejo = talon > w / 2;
    return { data: out.toDataURL('image/webp', calidad), w, h, w0, h0, espejo, talon: talon / w };
  }, { b64, ancho: ANCHO, calidad: CALIDAD });

  if (!res) {
    console.log(`  ✗ ${archivo}: no se encontró el zapato`);
    continue;
  }
  const buf = Buffer.from(res.data.split(',')[1], 'base64');
  const destino = path.join(DESTINO, `${clave}.webp`);
  fs.writeFileSync(destino, buf);
  console.log(
    `  ✓ ${clave}.webp  ${res.w}x${res.h}  ${(buf.length / 1024).toFixed(0)} KB  (recorte ${res.w0}x${res.h0})  ` +
      `talón al ${Math.round(res.talon * 100)}% → espejo: ${res.espejo}`,
  );
}

await browser.close();
