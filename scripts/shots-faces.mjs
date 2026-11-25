import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.URL ?? 'http://127.0.0.1:5173';
const out = 'docs/capturas';
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.getByText('Nuevo campeonato', { exact: true }).click();
await page.waitForTimeout(350);
await page.getByText('Normal', { exact: false }).first().click();
await page.getByText('Siguiente', { exact: true }).click();
await page.waitForTimeout(300);
await page.getByText('Sorteo real', { exact: false }).first().click();
await page.waitForTimeout(600);

const names = [];
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(250);
  const team = (await page.locator('.team-name').first().textContent()) ?? `t${i}`;
  const player = ((await page.locator('.player-name').first().textContent()) ?? '').replace(/\s*[A-Z]{3}\s*$/, '');
  names.push(`${team.trim()} · ${player.trim()}`);
  const face = await page.locator('.player-face').first().boundingBox();
  if (face) {
    const ring = await page.locator('.face-ring, .player-face').first().boundingBox();
    await page.screenshot({
      path: `${out}/f-${i}.png`,
      clip: {
        x: (ring?.x ?? face.x) - 6,
        y: (ring?.y ?? face.y) - 6,
        width: (ring?.width ?? face.width) + 12,
        height: (ring?.height ?? face.height) + 10,
      },
    });
  }
  await page.getByLabel('Selección siguiente').click();
}
console.log(names);

// Hoja de contacto
const html = `<!doctype html><html><body style="margin:0;background:#141810;font-family:system-ui;color:#f3f1e6">
<div style="display:flex;gap:12px;padding:16px">${names
  .map(
    (n, i) =>
      `<figure style="margin:0;text-align:center;width:230px"><img src="f-${i}.png" style="width:100%;border-radius:14px"/><figcaption style="font-size:14px;margin-top:8px;line-height:1.25">${n}</figcaption></figure>`,
  )
  .join('')}</div></body></html>`;
await writeFile(`${out}/f-sheet.html`, html);
const sheet = await browser.newPage({ viewport: { width: 1540, height: 380 }, deviceScaleFactor: 2 });
await sheet.goto(`file://${process.cwd()}/${out}/f-sheet.html`);
await sheet.waitForTimeout(400);
await sheet.screenshot({ path: `${out}/f-sheet.png` });

console.log('errores:', errors.length ? errors : 'ninguno');
await browser.close();
