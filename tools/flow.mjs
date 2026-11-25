import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outDir = process.argv[3] ?? '/tmp/flow';
const width = Number(process.argv[4] ?? 1440);
const height = Number(process.argv[5] ?? 900);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
const problems = [];
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`[console] ${m.text()}`);
});

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const shots = [];
async function click(name) {
  await page.getByRole('button', { name, exact: true }).first().click();
  await page.waitForTimeout(450);
}
async function shot(name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  shots.push(name);
}

await shot('01-menu');
await click('Nuevo campeonato');
await shot('02-dificultad');
await click('Siguiente');
await shot('03-equipo');
await click('Jugar');
await shot('04-grupos');
await click('Siguiente');
await shot('05-opciones');
await click('Jugar');
await page.waitForTimeout(2500);
await shot('06-partido');

await browser.close();
console.log(shots.join(', '));
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
}
