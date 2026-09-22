import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

// 桌面交互契约检查，不截图、不做AI美术评判，也不扩展旧视觉矩阵。
const output = process.env.RIDING_CHECK_DIR || join(tmpdir(), 'wanhu-riding-checks'); mkdirSync(output, { recursive: true });
const port = Number(process.env.RIDING_REVIEW_PORT || 4178);
assert(Number.isInteger(port) && port > 0 && port < 65536, 'invalid review port');
const base = process.env.RIDING_REVIEW_URL || `http://127.0.0.1:${port}`;
const sourceSHA = process.env.REVIEW_HEAD_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
let server, browser;
const log = createWriteStream(join(output, 'browser-server.log'));
const errors = [], checks = [];
const near = (a, b, epsilon = 1e-6) => assert(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
try {
  if (!process.env.RIDING_REVIEW_URL) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false });
  }
  let ready = false;
  for (let attempt = 0; attempt < 225; attempt++) {
    if (server && server.exitCode !== null) throw new Error(`Vite exited with ${server.exitCode}; see browser-server.log`);
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert(ready, 'review server did not start');
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.setDefaultTimeout(30000);
  const state = () => page.evaluate(() => {
    const r = window.__RIDING_REVIEW__;
    return { status: r.getStatus(), stats: r.stats(), recipe: r.recipe(), ids: r.geometryIds(), camera: r.cameraState(), finite: r.matricesFinite() };
  });
  const sync = data => { assert(data.finite); near(data.status.horsePhase, data.status.riderPhase, 1e-9); };
  const upload = value => page.getByLabel('导入骑手配方', { exact: true }).setInputFiles({ name: 'rider-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await page.goto(`${base}/?lab=riding&review&paused=1&clip=Rider_Walk&phase=.375`);
  await page.waitForFunction(() => window.__RIDING_REVIEW__?.stats().rider.bones === 20);
  const first = await state(); sync(first); near(first.status.phase, .375);
  assert.equal(first.stats.horse.bones, 25); assert.equal(first.stats.horse.triangles, 1524);
  assert.equal(await page.locator('canvas').count(), 1); assert(await page.getByLabel('骑乘循环播放', { exact: true }).isChecked());
  assert.equal(await page.getByTestId('workspace-animal').getAttribute('aria-current'), 'page');
  assert.equal(await page.getByTestId('animal-mode-riding').getAttribute('aria-current'), 'page');
  checks.push('one scene, two preserved rigs, default looping, shared paused phase');
  await page.getByTestId('riding-next').click(); let current = await state(); near(current.status.time, .375 * 1.2 + 1 / 30); sync(current);
  await page.getByTestId('riding-previous').click(); near((await state()).status.phase, .375);
  await page.getByTestId('riding-view-left').click(); current = await state(); near(current.status.phase, .375); assert.deepEqual(current.ids, first.ids);
  await page.getByTestId('riding-projection').click(); near((await state()).status.phase, .375);
  await page.getByLabel('骑手骨架', { exact: true }).check(); await page.getByLabel('坐骑骨架', { exact: true }).check(); await page.getByLabel('骑乘挂点', { exact: true }).check();
  checks.push('frame stepping, camera/projection/inspect controls do not reset pose or rebuild meshes');
  await page.getByTestId('riding-body-female').click();
  await page.waitForFunction(() => window.__RIDING_REVIEW__.recipe().bodyType === 'female');
  current = await state(); near(current.status.phase, .375); sync(current); assert.equal(current.ids.horse, first.ids.horse); assert.notEqual(current.ids.rider, first.ids.rider);
  await page.getByTestId('riding-slot-top').selectOption('work_vest');
  await page.getByTestId('riding-slot-bottom').selectOption('short_trousers');
  current = await state(); near(current.status.phase, .375); assert.equal(current.recipe.slots.top, 'work_vest'); assert.equal(current.ids.horse, first.ids.horse);
  const saved = current.recipe;
  await page.evaluate(recipe => localStorage.setItem('wanhu.character.wardrobe.v5', JSON.stringify(recipe)), saved);
  await page.getByTestId('riding-default').click(); await page.getByTestId('riding-restore').click();
  current = await state(); assert.deepEqual(current.recipe, saved); near(current.status.phase, .375);
  await upload({ ...saved, version: 4 });
  await page.locator('.riding-notice.is-error').waitFor(); assert.deepEqual((await state()).recipe, saved);
  await upload({ ...saved, slots: { ...saved.slots, bottom: 'short_skirt' } });
  await page.locator('.riding-notice.is-error').waitFor(); assert.deepEqual((await state()).recipe, saved);
  const imported = { ...saved, bodyType: 'male', hairColor: '#563a25', slots: { ...saved.slots, top: 'cross_jacket', headwear: 'cloth_wrap' } };
  await upload(imported); await page.waitForFunction(() => window.__RIDING_REVIEW__.recipe().bodyType === 'male');
  current = await state(); assert.deepEqual(current.recipe, imported); near(current.status.phase, .375); sync(current);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('wanhu.character.wardrobe.v5'))), saved);
  checks.push('gender/wardrobe changes preserve horse and phase; strict V5 restore/import rejects old versions and retired assets; saved recipe is not overwritten');
  await page.getByTestId('riding-slot-bottom').selectOption('long_skirt');
  assert(await page.getByTestId('riding-skirt-warning').isVisible()); assert.equal((await state()).recipe.slots.bottom, 'long_skirt');
  await page.getByTestId('riding-body-female').click(); assert.equal((await state()).recipe.slots.bottom, 'long_skirt');
  checks.push('continuous skirt remains selectable with explicit experimental boundary; no silent substitution');
  await page.getByTestId('riding-default').click();
  for (const clip of ['Rider_Idle', 'Rider_Walk', 'Rider_Run']) {
    const before = (await state()).ids;
    await page.getByTestId(clip).click(); await page.getByTestId('riding-play').click();
    await page.evaluate(() => window.__RIDING_REVIEW__.seek(.4));
    current = await state(); assert.equal(current.status.clip, clip); sync(current); assert.deepEqual(current.ids, before);
  }
  await page.getByLabel('骑乘循环播放', { exact: true }).uncheck();
  await page.evaluate(() => window.__RIDING_REVIEW__.seek(.97));
  await page.getByTestId('riding-play').click(); await page.waitForFunction(() => window.__RIDING_REVIEW__.getStatus().finished);
  current = await state(); near(current.status.phase, 1); sync(current);
  await page.waitForTimeout(150); near((await state()).status.phase, 1);
  await page.getByLabel('骑乘循环播放', { exact: true }).check(); await page.getByLabel('骑乘速度', { exact: true }).selectOption('2');
  await page.getByTestId('riding-replay').click(); await page.waitForTimeout(500);
  current = await state(); assert(!current.status.finished); assert(current.status.time > 0 && current.status.time < current.status.duration); sync(current);
  await page.getByTestId('riding-pose').click(); current = await state(); near(current.status.duration, 0); near(current.status.phase, 0);
  assert(await page.getByTestId('riding-play').isDisabled()); sync(current);
  checks.push('three real clips reuse geometry; single-shot endpoint hold, loop, speed, replay and static riding pose');
  await page.getByTestId('animal-mode-horse').click(); await page.waitForFunction(() => !!window.__HORSE_REVIEW__);
  for (const clip of ['Horse_Idle', 'Horse_Walk', 'Horse_Run', 'Horse_Eat']) assert(await page.getByTestId(clip).isVisible());
  assert.equal(await page.getByTestId('animal-mode-horse').getAttribute('aria-current'), 'page');
  await page.getByTestId('workspace-character').click(); await page.waitForFunction(() => !!window.__WANHU_REVIEW__);
  assert.equal(await page.evaluate(() => window.__WANHU_REVIEW__.stats.bones), 20);
  assert(await page.getByLabel('人物动画循环播放', { exact: true }).isChecked());
  await page.getByTestId('workspace-animal').click(); await page.waitForFunction(() => !!window.__HORSE_REVIEW__);
  await page.getByTestId('animal-mode-riding').click(); await page.waitForFunction(() => !!window.__RIDING_REVIEW__); sync(await state());
  checks.push('horse and character workspaces still load, all four horse clips retained, riding entry round-trip works');
  assert.deepEqual(errors, [], 'browser errors');
  const report = { result: 'passed', sourceSHA, viewport: { width: 1600, height: 1000 }, screenshots: 0, checks, errors, boundary: 'Browser interaction checks only; visual approval remains with the user.' };
  writeFileSync(join(output, 'browser-checks.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  writeFileSync(join(output, 'browser-checks.json'), JSON.stringify({ result: 'failed', sourceSHA, screenshots: 0, checks, errors, failure: String(error?.stack || error) }, null, 2));
  console.error(error); process.exitCode = 1;
} finally {
  await browser?.close(); server?.kill('SIGTERM'); log.end();
}
