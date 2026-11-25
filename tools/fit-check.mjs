import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1270, height: 825 }, deviceScaleFactor: 1.5 });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
const rows = [];
const snap = async (name) => {
  const m = await page.evaluate(() => {
    const scr = document.querySelector('.screen');
    const foot = scr?.querySelector(':scope > .screen-foot');
    const r = foot?.getBoundingClientRect();
    return {
      vh: innerHeight,
      vw: innerWidth,
      scrollH: scr ? scr.scrollHeight : 0,
      clientH: scr ? scr.clientHeight : 0,
      footBottom: r ? Math.round(r.bottom) : null,
      docW: document.documentElement.scrollWidth,
    };
  });
  rows.push({ name, ...m, cut: m.footBottom !== null && m.footBottom > m.vh + 1, hOverflow: m.docW > m.vw + 1 });
};
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await snap('menu');
const click = async (n) => { await page.getByRole('button', { name: n, exact: true }).first().click(); await page.waitForTimeout(350); };
await click('Nuevo campeonato');
await snap('dificultad');
await click('Siguiente');
await snap('sorteo');
await page.getByRole('button', { name: /Sorteo real/ }).click();
await page.waitForTimeout(350);
await snap('equipo');
await click('Jugar');
await snap('grupos');
await click('Siguiente');
await snap('antesala');
await page.getByRole('button', { name: 'Atrás', exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Estadísticas', exact: true }).click();
await page.waitForTimeout(500);
await snap('estadisticas');
await page.getByRole('button', { name: 'Atrás', exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Atrás', exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Trofeos/ }).click();
await page.waitForTimeout(500);
await snap('trofeos');
await browser.close();
console.table(rows);
console.log(problems.length ? problems.join('\n') : 'sin errores');
