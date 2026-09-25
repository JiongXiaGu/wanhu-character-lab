import { checkCatBrowser } from './check-livestock-cat-browser.mjs';
import { checkLivestockSleepBrowser } from './check-livestock-sleep-browser.mjs';
import { checkDogBrowser } from './check-livestock-dog-browser.mjs';
import { checkPigBrowser } from './check-livestock-pig-browser.mjs';
import { checkGooseBrowser } from './check-livestock-goose-browser.mjs';
import { checkDuckBrowser } from './check-livestock-duck-browser.mjs';
import './check-livestock-lod-browser.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const screenshots = process.argv.includes('--screenshots');
const base = 'http://127.0.0.1:4187', dir = process.env.LIVESTOCK_CHECK_DIR ?? '/tmp/wanhu-livestock-checks';
mkdirSync(dir, { recursive: true }); if (screenshots) mkdirSync('review/livestock', { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4187', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', value => { serverLog += value; }); server.stderr.on('data', value => { serverLog += value; });
let browser, page;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); if (i === 99) throw new Error(`Vite未启动：${serverLog}`); }
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', error => errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const snap = () => page.evaluate(() => window.__LIVESTOCK_REVIEW__.snapshot());
  const ready = async () => { await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__?.snapshot().bones === 8); await page.waitForTimeout(250); };
  const setPhase = async value => {
    const slider = page.getByLabel('家畜动画相位', { exact: true });
    await slider.scrollIntoViewIfNeeded(); const box = await slider.boundingBox(); assert(box);
    await slider.click({ position: { x: 8 + (box.width - 16) * value, y: box.height / 2 } });
    // 等待每次真实输入被时钟和受控控件共同确认，不用固定延时猜测React/软件WebGL是否已经处理。
    await page.waitForFunction(() => {
      const state = window.__LIVESTOCK_REVIEW__.snapshot(), input = document.querySelector('input[aria-label="家畜动画相位"]');
      return !state.playing && Math.abs(Number(input.value) - state.phase) < .0005;
    });
    for (let i = 0; i < 120; i++) {
      const actual = Number(await slider.inputValue()); if (Math.abs(actual - value) < .0005) break;
      const direction = actual < value ? 1 : -1, next = Number((actual + direction * .001).toFixed(3));
      await slider.press(direction > 0 ? 'ArrowRight' : 'ArrowLeft');
      await page.waitForFunction(expected => {
        const state = window.__LIVESTOCK_REVIEW__.snapshot(), input = document.querySelector('input[aria-label="家畜动画相位"]');
        return Math.abs(state.phase - expected) < .0005 && Math.abs(Number(input.value) - expected) < .0005;
      }, next);
    }
    await page.waitForFunction(target => Math.abs(window.__LIVESTOCK_REVIEW__.snapshot().phase - target) < .001, value);
  };
  await page.goto(`${base}/?lab=livestock&paused=1`, { waitUntil: 'networkidle' }); await ready();
  const initial = await snap(); assert.equal(initial.count, 1); assert.equal(initial.bones, 8); assert.equal(initial.playing, false); assert.equal(initial.lod, 'lod0'); assert.equal(initial.triangles, 132);
  assert.equal(await page.locator('.animal-mode-switcher a').count(), 3); assert.equal(await page.locator('canvas').count(), 1);
  for (const [lod, tris] of [['lod0', 132], ['lod1', 72], ['lod2', 36]]) {
    await page.getByTestId(`livestock-lod-${lod}`).click(); await page.waitForFunction(([id, count]) => { const s = window.__LIVESTOCK_REVIEW__.snapshot(); return s.lod === id && s.triangles === count; }, [lod, tris]);
    assert.equal((await snap()).modelTriangles, tris);
  }
  await page.getByTestId('livestock-lod-auto').click(); await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().lod === 'lod0');
  const geometryId = (await snap()).geometryId;
  for (const motion of ['idle', 'walk', 'run', 'peck', 'sleep']) {
    await page.getByTestId(`livestock-motion-${motion}`).click(); await page.waitForTimeout(220); await page.getByTestId('livestock-play').click(); await setPhase(.45);
    const result = await snap(); assert.equal(result.motion, motion); assert.equal(result.geometryId, geometryId); assert(Math.abs(result.phase - .45) < .003, `seek失败：${JSON.stringify(result)}`);
    const phase = result.phase; await page.waitForTimeout(220); assert.equal((await snap()).phase, phase);
  }
  await page.getByLabel('家畜循环播放').uncheck(); await setPhase(.99); await page.getByTestId('livestock-play').click();
  await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().finished); assert.equal((await snap()).phase, 1); await page.getByLabel('家畜循环播放').check();
  await page.getByTestId('livestock-motion-idle').click(); await page.getByTestId('livestock-play').click(); await setPhase(.15);
  if (screenshots) await page.screenshot({ path: 'review/livestock/01-chicken-single.png', fullPage: true });
  await page.getByTestId('livestock-motion-peck').click(); await page.getByTestId('livestock-play').click(); await setPhase(.45); await page.getByTestId('livestock-view-left').click();
  if (screenshots) await page.screenshot({ path: 'review/livestock/02-chicken-peck.png', fullPage: true });
  const expected = { 10: ['lod1', 72], 50: ['lod2', 36], 100: ['lod2', 36], 500: ['lod2', 36] }, counts = [];
  for (const count of [10, 50, 100, 500]) {
    await page.getByTestId(`livestock-count-${count}`).click(); await page.waitForFunction(n => window.__LIVESTOCK_REVIEW__?.snapshot().count === n, count); await page.waitForTimeout(500);
    const result = await snap(), [lod, tris] = expected[count]; assert.equal(result.lod, lod); assert.equal(result.triangles, tris); assert.equal(result.modelTriangles, tris * count);
    assert(result.batches > 0 && result.batches <= 32); counts.push({ count, lod, triangles: result.triangles, modelTriangles: result.modelTriangles, batches: result.batches });
    if (screenshots && (count === 100 || count === 500)) await page.screenshot({ path: `review/livestock/0${count === 100 ? 3 : 4}-chicken-${count}.png`, fullPage: true });
  }
  const beforeSeed = (await snap()).seed; await page.getByTestId('livestock-reshuffle').click(); await page.waitForFunction(seed => window.__LIVESTOCK_REVIEW__?.snapshot().seed !== seed, beforeSeed); assert.notEqual((await snap()).seed, beforeSeed);
  await page.getByLabel('家畜日常混合').uncheck(); await page.getByTestId('livestock-motion-walk').click(); await page.waitForTimeout(200); assert.equal((await snap()).mixed, false);
  await page.getByTestId('livestock-play').click(); await setPhase(.37);
  const beforeNav = await snap(); await page.getByTestId('animal-mode-horse').click(); await page.waitForURL(url => url.searchParams.get('lab') === 'mount'); await page.waitForFunction(() => !!window.__MOUNT_REVIEW__);
  await page.getByTestId('animal-mode-livestock').click(); await ready();
  const resumed = await snap(); assert.equal(resumed.count, 500); assert.equal(resumed.motion, 'walk'); assert.equal(resumed.playing, false); assert.equal(resumed.lod, beforeNav.lod); assert(Math.abs(resumed.phase - beforeNav.phase) < .003);
  for (const axis of ['position', 'target']) resumed.camera[axis].forEach((value, i) => assert(Math.abs(value - beforeNav.camera[axis][i]) < 1e-8)); assert(Math.abs(resumed.camera.zoom - beforeNav.camera.zoom) < 1e-8);
  await page.getByTestId('livestock-count-1').click(); await page.getByTestId('livestock-lod-lod2').click(); await page.locator('.livestock-inspection summary').click(); await page.getByLabel('家畜骨架', { exact: true }).check(); await page.getByRole('button', { name: '线框', exact: true }).click(); await page.waitForTimeout(200);
  assert.equal((await snap()).lod, 'lod2'); assert.equal((await snap()).triangles, 36); assert.equal(await page.locator('canvas').count(), 1);
  await page.evaluate(() => sessionStorage.setItem('wanhu.livestock.preview.v1', '{invalid'));
  await page.goto(`${base}/?lab=livestock&preview=resume&count=NaN&clip=unknown&view=unknown&lod=unknown&phase=Infinity&paused=1`, { waitUntil: 'networkidle' }); await ready();
  assert.equal((await snap()).count, 1); assert.equal((await snap()).motion, 'idle'); assert.equal((await snap()).phase, 0); assert.equal((await snap()).lod, 'lod0');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '桌面横向溢出'); assert.deepEqual(errors, []);
  await checkCatBrowser(page, base, dir, screenshots, setPhase);
  await checkLivestockSleepBrowser(page, base, dir, screenshots, setPhase);
  await checkDuckBrowser(page, base, dir, screenshots, setPhase);
  await checkGooseBrowser(page, base, dir, screenshots, setPhase);
  await checkPigBrowser(page, base, dir, screenshots, setPhase);
  await checkDogBrowser(page, base, dir, screenshots, setPhase);
  assert.deepEqual(errors, []);
  const result = { sha: process.env.REVIEW_HEAD_SHA ?? 'local', result: 'passed', viewport: '1600x1000', lods: { lod0: 132, lod1: 72, lod2: 36 }, counts, screenshots, errors };
  writeFileSync(`${dir}/browser.json`, JSON.stringify(result, null, 2)); if (screenshots) writeFileSync('review/livestock/evidence.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (screenshots && page && !page.isClosed()) await page.screenshot({ path: 'review/livestock/failure.png', fullPage: true }).catch(() => {});
  writeFileSync(`${dir}/browser-failure.txt`, `${error.stack ?? error}\n${serverLog}`); throw error;
} finally { await browser?.close(); server.kill('SIGTERM'); }
