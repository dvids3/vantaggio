import { chromium } from 'playwright';
const outDir = 'docs/capturas';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const problems = [];
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`[console] ${m.text()}`); });
page.on('requestfailed', (r) => problems.push(`[reqfail] ${r.url()} :: ${r.failure()?.errorText}`));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/v-menu.jpg`, type: 'jpeg', quality: 82 });

await page.getByRole('button', { name: 'Nuevo campeonato', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}/v-sorteo.jpg`, type: 'jpeg', quality: 82 });

await page.getByRole('button', { name: /Sorteo real/ }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/v-equipo.jpg`, type: 'jpeg', quality: 82 });

await page.getByRole('button', { name: 'Jugar', exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/v-grupos.jpg`, type: 'jpeg', quality: 82 });

await browser.close();
console.log('shots done');
if (problems.length) { console.log('PROBLEMS:\n' + problems.join('\n')); process.exitCode = 1; } else { console.log('sin errores'); }
