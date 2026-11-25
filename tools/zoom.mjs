import { chromium } from 'playwright';
const OUT = 'docs/capturas';
const JPG = { type: 'jpeg', quality: 86 };
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
const click = async (n) => { await page.getByRole('button', { name: n, exact: true }).first().click(); await page.waitForTimeout(400); };
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);
await click('Dos jugadores');
await click('Siguiente');
await click('Jugar');
await page.screenshot({ path: `${OUT}/y-antesala.jpg`, ...JPG, timeout: 60000 });
await click('Jugar');
await page.waitForTimeout(800);
const geo = await page.evaluate(() => {
  const m = window.vantaggio.match;
  const c = document.querySelector('canvas.stage');
  const r = c.getBoundingClientRect();
  const scale = Math.min(r.width / 18, r.height / 9.6);
  const originX = (r.width - 18 * scale) / 2;
  const groundY = r.height - Math.max(r.height * 0.26, 0.5 * scale);
  const px = (x) => originX + x * scale;
  return {
    p0: { left: px(m.players[0].x), top: groundY - 2.1 * scale },
    p1: { left: px(m.players[1].x) },
    scale,
    rect: { top: r.top, left: r.left },
  };
});
await page.screenshot({ path: `${OUT}/y-jugadores.jpg`, clip: {
  x: Math.max(0, geo.rect.left + geo.p0.left - 80),
  y: Math.max(0, geo.rect.top + geo.p0.top - 20),
  width: Math.max(360, geo.p1.left - geo.p0.left + 160),
  height: 290,
}, ...JPG, timeout: 60000 });
// entrar al arco
await page.keyboard.down('KeyA');
await page.waitForTimeout(3400);
await page.keyboard.up('KeyA');
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/y-porteria.jpg`, clip: { x: 0, y: 470, width: 620, height: 380 }, ...JPG, timeout: 60000 });
console.log(problems.length ? problems.join('\n') : 'ok');
await browser.close();
