import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const dir = process.env.SOLDIER_BROWSER_DIR || 'review/soldier-heavy-fast';
mkdirSync(dir, { recursive: true });
const sourceSHA = process.env.REVIEW_HEAD_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const base = process.env.REVIEW_URL || 'http://127.0.0.1:4196';
const log = createWriteStream(join(dir, 'server.log'));
const images = [];
const errors = [];
let server, browser;

async function waitReady() {
  for (let i = 0; i < 150; i++) {
    if (server && server.exitCode !== null) throw new Error('Vite stopped');
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Vite did not become ready');
}

try {
  if (!process.env.REVIEW_URL) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4196', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.pipe(log, { end: false });
    server.stderr.pipe(log, { end: false });
  }
  await waitReady();
  browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(45000);
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  async function sync() {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('canvas').count(), 1);
    assert.equal((await page.evaluate(() => window.__WANHU_REVIEW__.stats)).bones, 20);
  }
  async function recipe() { return page.evaluate(() => window.__WANHU_RECIPE__()); }
  async function camera() { return page.evaluate(() => window.__WANHU_REVIEW__.cameraState()); }
  async function shot(name) {
    await sync();
    const bytes = await page.locator('canvas').screenshot({ path: join(dir, name) });
    images.push(name);
    return bytes;
  }

  await page.goto(base + '/?review=1&pose=bind&paused=1&soldier=palace&armorClass=heavy&bodyType=male&rightHand=none&view=front');
  await page.waitForFunction(() => !!window.__WANHU_REVIEW__ && !!window.__WANHU_RECIPE__);
  await sync();
  let r = await recipe();
  assert.equal(r.slots.top, 'heavy_armor');
  assert.equal(r.slots.bottom, 'heavy_armor_skirt');
  const fixedCamera = await camera();

  const heavyFront = await shot('heavy-front.png');
  await page.getByRole('button', { name: '侧面', exact: true }).click();
  await shot('heavy-side.png');
  await page.getByRole('button', { name: '背面', exact: true }).click();
  await shot('heavy-back.png');
  await page.getByRole('button', { name: '正面', exact: true }).click();
  await sync();
  assert.deepEqual(await camera(), fixedCamera);

  await page.getByTestId('soldier-armor-medium').click();
  await page.waitForFunction(() => window.__WANHU_RECIPE__().slots.top === 'medium_armor');
  await sync();
  r = await recipe();
  assert.equal(r.slots.bottom, 'medium_armor_skirt');
  assert.deepEqual(await camera(), fixedCamera);
  const mediumFront = await page.locator('canvas').screenshot();

  const sheet = await browser.newPage({ viewport: { width: 1320, height: 760 }, deviceScaleFactor: 1 });
  const html = '<html><head><style>body{margin:0;background:#e5e1d8;color:#252723;font:22px sans-serif}h1{margin:0;padding:18px 24px;font-size:26px}.row{display:flex}figure{margin:12px;width:636px}figcaption{text-align:center;padding:8px}img{display:block;width:636px;height:650px;object-fit:contain}</style></head><body><h1>Medium / Heavy · 同身体 / 同配色 / 同姿态 / 同机位</h1><div class="row"><figure><figcaption>Medium</figcaption><img src="data:image/png;base64,' + mediumFront.toString('base64') + '"></figure><figure><figcaption>Heavy</figcaption><img src="data:image/png;base64,' + heavyFront.toString('base64') + '"></figure></div></body></html>';
  await sheet.setContent(html);
  await sheet.locator('img').evaluateAll(nodes => Promise.all(nodes.map(i => i.decode())));
  await sheet.screenshot({ path: join(dir, 'medium-vs-heavy-front.png') });
  await sheet.close();
  images.push('medium-vs-heavy-front.png');

  assert.deepEqual(errors, []);
  writeFileSync(join(dir, 'report.json'), JSON.stringify({
    passed: true,
    sourceSHA,
    scope: 'S6 Heavy authoring visual fast lane only',
    images,
    visualApproval: false,
    note: 'Four focused real-WebGL evidence files only; no motion, save/import, full soldier browser or release regression claims.'
  }, null, 2));
  console.log('SOLDIER_HEAVY_FAST_VISUAL', JSON.stringify({ passed: true, sourceSHA, images }));
} catch (error) {
  writeFileSync(join(dir, 'report.json'), JSON.stringify({ passed: false, sourceSHA, images, errors, error: String(error?.stack || error), visualApproval: false }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill('SIGTERM');
  log.end();
}
