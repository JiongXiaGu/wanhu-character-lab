import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

// 原马具交互回归；只把目录断言更新为M4实际种类，不减少原检查。
const output = process.env.RIDING_CHECK_DIR || join(tmpdir(), 'wanhu-riding-checks'); mkdirSync(output, { recursive: true });
const port = Number(process.env.SADDLE_REVIEW_PORT || 4179); assert(Number.isInteger(port) && port > 0 && port < 65536);
const base = process.env.SADDLE_REVIEW_URL || `http://127.0.0.1:${port}`;
const sourceSHA = process.env.REVIEW_HEAD_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const errors = [], checks = [], log = createWriteStream(join(output, 'saddles-browser-server.log')); let server, browser;
const near = (a, b, epsilon = 1e-6) => assert(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
try {
  if (!process.env.SADDLE_REVIEW_URL) { server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] }); server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false }); }
  let ready = false; for (let i = 0; i < 225; i++) { if (server && server.exitCode !== null) throw new Error(`Vite exited ${server.exitCode}`); try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 200)); } assert(ready, 'saddle review server unavailable');
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 }); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const state = () => page.evaluate(() => { const r = window.__RIDING_REVIEW__; return { status: r.getStatus(), ids: r.geometryIds(), camera: r.cameraState(), saddle: r.saddleState(), recipe: r.recipe() }; });
  const valid = data => { assert(data.saddle.reinPositions.every(Number.isFinite)); near(data.status.horsePhase, data.status.riderPhase, 1e-9); };
  await page.goto(`${base}/?lab=riding&paused=1&clip=Rider_Walk&phase=.375&saddle=simple`); await page.waitForFunction(() => window.__RIDING_REVIEW__?.saddleState().id === 'simple');
  const first = await state(); valid(first); assert(first.saddle.canRide && first.saddle.riderVisible && first.saddle.reinsVisible); near(first.status.phase, .375);
  assert.equal(await page.locator('.mount-selector select').count(), 2); assert.deepEqual(await page.getByTestId('mount-horse').locator('option').evaluateAll(nodes => nodes.map(n => n.value)), ['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow', 'yak_black', 'buffalo_water']);
  assert.equal(await page.getByTestId('mount-saddle').locator('option').count(), 3); assert.equal(await page.locator('.animal-mode-switcher a').count(), 2); assert.equal(await page.locator('canvas').count(), 1); checks.push('only species/saddle choices, two preview modes, one real WebGL scene');
  await page.getByLabel('骑手骨架', { exact: true }).check(); await page.getByTestId('mount-saddle').selectOption('travel'); let current = await state(); valid(current);
  assert.equal(current.saddle.id, 'travel'); assert(current.saddle.triangles > first.saddle.triangles); assert.deepEqual(current.ids, first.ids); assert.deepEqual(current.camera, first.camera); assert.deepEqual(current.recipe, first.recipe); assert.deepEqual(current.status, first.status); assert.equal(current.saddle.reinGeometry, first.saddle.reinGeometry); assert.notDeepEqual(current.saddle.seat, first.saddle.seat);
  checks.push('travel saddle switches complete geometry and seat, preserves actors, camera, recipe, paused phase and rein buffer');
  await page.getByTestId('mount-saddle').selectOption('none'); current = await state(); assert(!current.saddle.canRide && !current.saddle.riderVisible && !current.saddle.riderSkeletonVisible && !current.saddle.reinsVisible); assert.equal(current.saddle.triangles, 0);
  assert(await page.getByTestId('riding-no-saddle').isVisible()); assert(await page.getByTestId('riding-play').isDisabled()); assert(await page.getByTestId('Rider_Run').isDisabled()); await page.waitForTimeout(180); assert.deepEqual((await state()).status, first.status);
  await page.getByTestId('mount-saddle').selectOption('simple'); current = await state(); valid(current); assert(current.saddle.riderSkeletonVisible); assert.deepEqual(current.ids, first.ids); assert.deepEqual(current.status, first.status); assert.deepEqual(current.recipe, first.recipe);
  await page.getByLabel('显示缰绳', { exact: true }).uncheck(); assert(!(await state()).saddle.reinsVisible); await page.getByLabel('显示缰绳', { exact: true }).check(); assert((await state()).saddle.reinsVisible);
  checks.push('no saddle removes gear/rider/reins, freezes riding, disables controls; restoration keeps exact phase and inspection state');
  for (const gender of ['female', 'male']) { await page.getByTestId('riding-body-' + gender).click(); await page.waitForFunction(type => window.__RIDING_REVIEW__.recipe().bodyType === type, gender); current = await state(); valid(current); near(current.status.phase, .375); assert.equal(current.ids.horse, first.ids.horse); assert.equal(current.saddle.reinGeometry, first.saddle.reinGeometry); }
  for (const clip of ['Rider_Idle', 'Rider_Walk', 'Rider_Run']) { await page.getByTestId(clip).click(); await page.getByTestId('riding-play').click(); for (const phase of [0, .25, .5, .75, 1]) { await page.evaluate(p => window.__RIDING_REVIEW__.seek(p), phase); valid(await state()); } }
  await page.getByTestId('riding-pose').click(); await page.getByTestId('mount-saddle').selectOption('travel'); checks.push('both body types rebind grip anchors; three clips and static pose keep finite live rein buffers');
  await page.getByTestId('animal-mode-horse').click(); await page.waitForFunction(() => !!window.__HORSE_REVIEW__); assert.equal(await page.getByTestId('mount-saddle').inputValue(), 'travel');
  const horseId = await page.evaluate(() => window.__HORSE_REVIEW__.geometryId()); await page.getByTestId('horse-play').click(); await page.evaluate(() => window.__HORSE_REVIEW__.seek(.4)); await page.getByTestId('mount-saddle').selectOption('none'); near(await page.evaluate(() => window.__HORSE_REVIEW__.getStatus().phase), .4); assert.equal(await page.evaluate(() => window.__HORSE_REVIEW__.geometryId()), horseId);
  await page.getByTestId('Horse_Eat').click(); assert.equal(await page.evaluate(() => window.__HORSE_REVIEW__.getStatus().clip), 'Horse_Eat'); await page.getByTestId('mount-saddle').selectOption('travel'); await page.getByTestId('animal-mode-riding').click(); await page.waitForFunction(() => !!window.__RIDING_REVIEW__); assert.equal((await state()).saddle.id, 'travel'); assert((await state()).saddle.riderVisible);
  checks.push('saddle choice survives body/riding round trip; horse-only empty equipment keeps all four clips including Eat'); assert.deepEqual(errors, []);
  const report = { result: 'passed', sourceSHA, screenshots: 0, checks, errors, boundary: 'Real desktop browser and buffer checks, not visual acceptance.' }; writeFileSync(join(output, 'saddles-browser-checks.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) { writeFileSync(join(output, 'saddles-browser-checks.json'), JSON.stringify({ result: 'failed', sourceSHA, screenshots: 0, checks, errors, failure: String(error?.stack || error) }, null, 2)); console.error(error); process.exitCode = 1; }
finally { await browser?.close(); server?.kill('SIGTERM'); log.end(); }
