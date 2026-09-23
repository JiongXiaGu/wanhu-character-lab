import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const screenshots = process.argv.includes('--screenshots');
const base = 'http://127.0.0.1:4187', dir = process.env.LIVESTOCK_CHECK_DIR ?? '/tmp/wanhu-livestock-checks';
mkdirSync(dir, { recursive: true }); if (screenshots) mkdirSync('review/livestock', { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4187', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', value => { serverLog += value; }); server.stderr.on('data', value => { serverLog += value; });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); if (i === 99) throw new Error(`Vite未启动：${serverLog}`); }
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', error => errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const snap = () => page.evaluate(() => window.__LIVESTOCK_REVIEW__.snapshot());
  const ready = async () => { await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__?.snapshot().triangles === 140); await page.waitForTimeout(250); };
  const setPhase = async value => { await page.getByLabel('家畜动画相位', { exact: true }).evaluate((input, phase) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, String(phase)); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }, value); await page.waitForTimeout(250); };
  await page.goto(`${base}/?lab=livestock&paused=1`, { waitUntil: 'networkidle' }); await ready();
  const initial = await snap(); assert.equal(initial.count, 1); assert.equal(initial.bones, 8); assert.equal(initial.playing, false);
  assert.equal(await page.locator('.animal-mode-switcher a').count(), 3);
  assert.equal(await page.locator('canvas').count(), 1);
  const geometryId = initial.geometryId;
  for (const motion of ['idle', 'walk', 'run', 'peck']) {
    await page.getByTestId(`livestock-motion-${motion}`).click(); await page.waitForTimeout(220);
    await page.getByTestId('livestock-play').click(); await setPhase(.45);
    const result = await snap(); assert.equal(result.motion, motion); assert.equal(result.geometryId, geometryId); assert(Math.abs(result.phase - .45) < .003, `seek失败：${JSON.stringify(result)}`);
    const phase = result.phase; await page.waitForTimeout(220); assert.equal((await snap()).phase, phase);
  }
  await page.getByLabel('家畜循环播放').uncheck(); await setPhase(.99); await page.getByTestId('livestock-play').click();
  await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().finished); assert.equal((await snap()).phase, 1);
  await page.getByLabel('家畜循环播放').check();
  await page.getByTestId('livestock-motion-idle').click(); await page.getByTestId('livestock-play').click(); await setPhase(.15);
  if (screenshots) { await page.screenshot({ path: 'review/livestock/01-chicken-single.png', fullPage: true }); }
  await page.getByTestId('livestock-motion-peck').click(); await page.getByTestId('livestock-play').click(); await setPhase(.45); await page.getByTestId('livestock-view-left').click();
  if (screenshots) await page.screenshot({ path: 'review/livestock/02-chicken-peck.png', fullPage: true });
  const counts = [];
  for (const count of [10, 50, 100, 500]) {
    await page.getByTestId(`livestock-count-${count}`).click(); await page.waitForFunction(n => window.__LIVESTOCK_REVIEW__?.snapshot().count === n, count); await page.waitForTimeout(400);
    const result = await snap(); assert.equal(result.modelTriangles, 140 * count); assert(result.batches > 0 && result.batches <= 32); assert.equal(result.geometryId, geometryId); counts.push({ count, modelTriangles: result.modelTriangles, batches: result.batches });
    if (screenshots && (count === 100 || count === 500)) await page.screenshot({ path: `review/livestock/0${count === 100 ? 3 : 4}-chicken-${count}.png`, fullPage: true });
  }
  const beforeSeed = (await snap()).seed; await page.getByTestId('livestock-reshuffle').click(); await page.waitForTimeout(200); assert.notEqual((await snap()).seed, beforeSeed);
  await page.getByLabel('家畜日常混合').uncheck(); await page.getByTestId('livestock-motion-walk').click(); await page.waitForTimeout(200); assert.equal((await snap()).mixed, false);
  await page.getByTestId('livestock-play').click(); await setPhase(.37);
  const beforeNav = await snap();
  await page.getByTestId('animal-mode-horse').click(); await page.waitForURL('**lab=mount**'); await page.getByTestId('animal-mode-livestock').click(); await ready();
  const resumed = await snap(); assert.equal(resumed.count, 500); assert.equal(resumed.motion, 'walk'); assert.equal(resumed.playing, false); assert(Math.abs(resumed.phase - beforeNav.phase) < .003); assert.deepEqual(resumed.camera, beforeNav.camera);
  await page.getByTestId('livestock-count-1').click(); await page.locator('.livestock-inspection summary').click(); await page.getByLabel('家畜骨架', { exact: true }).check(); await page.getByRole('button', { name: '线框', exact: true }).click(); await page.waitForTimeout(200);
  assert.equal(await page.locator('canvas').count(), 1);
  await page.evaluate(() => sessionStorage.setItem('wanhu.livestock.preview.v1', '{invalid'));
  await page.goto(`${base}/?lab=livestock&preview=resume&count=NaN&clip=unknown&view=unknown&phase=Infinity&paused=1`, { waitUntil: 'networkidle' }); await ready();
  assert.equal((await snap()).count, 1); assert.equal((await snap()).motion, 'idle'); assert.equal((await snap()).phase, 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '桌面横向溢出');
  assert.deepEqual(errors, []);
  const result = { sha: process.env.REVIEW_HEAD_SHA ?? 'local', result: 'passed', viewport: '1600x1000', counts, screenshots, errors };
  writeFileSync(`${dir}/browser.json`, JSON.stringify(result, null, 2));
  if (screenshots) writeFileSync('review/livestock/evidence.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  writeFileSync(`${dir}/browser-failure.txt`, `${error.stack ?? error}\n${serverLog}`); throw error;
} finally { await browser?.close(); server.kill('SIGTERM'); }
