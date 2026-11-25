import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? 'docs/capturas/shot.png';
const width = Number(process.argv[4] ?? 1440);
const height = Number(process.argv[5] ?? 900);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 2,
});

const problems = [];
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`[console] ${m.text()}`);
});

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.screenshot({ path: out });
await browser.close();

if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`ok -> ${out}`);
}
