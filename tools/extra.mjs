import { chromium } from 'playwright';

const base = 'http://127.0.0.1:5173/';
const browser = await chromium.launch();

// escritorio: pausa y ajustes
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Ajustes' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/flow/08-ajustes.png' });
await page.getByRole('button', { name: 'Cerrar' }).click();
await page.getByRole('button', { name: 'Nuevo campeonato', exact: true }).click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: 'Jugar', exact: true }).click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: 'Jugar', exact: true }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Pausa' }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/flow/09-pausa.png' });
await page.close();

// móvil vertical
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await mob.goto(base, { waitUntil: 'networkidle' });
await mob.waitForTimeout(600);
await mob.screenshot({ path: '/tmp/flow/10-movil-menu.png' });
await mob.getByRole('button', { name: 'Nuevo campeonato', exact: true }).click();
await mob.waitForTimeout(300);
await mob.getByRole('button', { name: 'Siguiente', exact: true }).click();
await mob.waitForTimeout(300);
await mob.screenshot({ path: '/tmp/flow/11-movil-equipo.png' });
await mob.close();

await browser.close();
console.log('ok');
