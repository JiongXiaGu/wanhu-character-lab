import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { checkCamelBrowser } from './mount-camel-browser.mjs';
import { checkCattleBrowser } from './mount-cattle-browser.mjs';
import { checkYakBrowser } from './mount-yak-browser.mjs';
import { checkBuffaloBrowser } from './mount-buffalo-browser.mjs';

// 桌面交互检查，不自动生成视觉矩阵或代替用户判断灰驴美术。
const output = process.env.RIDING_CHECK_DIR || join(tmpdir(), 'wanhu-riding-checks'); mkdirSync(output, { recursive: true });
const port = Number(process.env.MOUNTS_REVIEW_PORT || 4180); assert(Number.isInteger(port) && port > 0 && port < 65536);
const base = process.env.MOUNTS_REVIEW_URL || `http://127.0.0.1:${port}`, sourceSHA = process.env.REVIEW_HEAD_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const errors = [], checks = [], log = createWriteStream(join(output, 'mounts-browser-server.log')); let server, browser;
const near = (a, b, e = 1e-6) => assert(Math.abs(a - b) < e, `${a} != ${b}`);
try {
  if (!process.env.MOUNTS_REVIEW_URL) { server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] }); server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false }); }
  let ready = false; for (let i = 0; i < 225; i++) { if (server && server.exitCode !== null) throw new Error('Vite stopped'); try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 200)); } assert(ready);
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 }); page.setDefaultTimeout(30000);
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const body = () => page.evaluate(() => { const r = window.__MOUNT_REVIEW__; return { id: r.mountId(), stats: r.stats, status: r.getStatus(), geometry: r.geometryId(), finite: r.matricesFinite() }; });
  const riding = () => page.evaluate(() => { const r = window.__RIDING_REVIEW__; return { id: r.mountId(), stats: r.stats(), status: r.getStatus(), recipe: r.recipe(), ids: r.geometryIds(), saddle: r.saddleState(), camera: r.cameraState(), finite: r.matricesFinite() }; });
  const valid = s => { assert(s.finite); near(s.status.horsePhase, s.status.riderPhase, 1e-9); assert(s.saddle.reinPositions.every(Number.isFinite)); };
  await page.goto(`${base}/?lab=mount&mount=donkey_gray&saddle=travel&clip=walk&paused=1&phase=.375`);
  await page.waitForFunction(() => window.__MOUNT_REVIEW__?.mountId() === 'donkey_gray'); const firstBody = await body(); near(firstBody.status.phase, .375); assert.equal(firstBody.stats.bones, 27); assert.equal(firstBody.status.duration, 1.4);
  assert.deepEqual(await page.getByTestId('mount-horse').locator('option').evaluateAll(nodes => nodes.map(n => n.value)), ['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow', 'yak_black', 'buffalo_water']);
  assert.equal(await page.locator('.mount-selector select').count(), 2);
  assert.deepEqual(await page.locator('.animal-mode-switcher a').allTextContents(), ['坐骑本体', '骑乘试衣', '家畜']);
  assert.equal(await page.locator('canvas').count(), 1); assert.equal(await page.getByTestId('mount-stage-name').innerText(), '灰驴');
  await page.getByTestId('mount-horse').selectOption('horse_chestnut'); let s = await body(); near(s.status.phase, .375); assert.equal(s.status.duration, 1.2); assert.equal(s.stats.bones, 25); assert.notEqual(s.geometry, firstBody.geometry); assert.equal(await page.getByTestId('mount-saddle').inputValue(), 'travel');
  await page.getByTestId('mount-horse').selectOption('donkey_gray'); near((await body()).status.phase, .375);
  await page.getByTestId('mount-saddle').selectOption('none');
  for (const id of ['Donkey_Idle', 'Donkey_Walk', 'Donkey_Run', 'Donkey_Eat']) { await page.getByTestId(id).click(); assert((await body()).finite); }
  await page.getByTestId('horse-play').click(); await page.evaluate(() => window.__MOUNT_REVIEW__.seek(.5)); const frozen = (await body()).status.phase;
  await page.getByTestId('mount-saddle').selectOption('travel'); near((await body()).status.phase, frozen);
  checks.push('six real species, two equipment fields, three animal sections; body motion semantics and phase survive switching; all four donkey clips work without saddle');
  await page.getByTestId('animal-mode-riding').click(); await page.waitForFunction(() => window.__RIDING_REVIEW__?.mountId() === 'donkey_gray');
  await page.getByTestId('riding-play').click(); await page.getByTestId('riding-view-left').click(); await page.evaluate(() => window.__RIDING_REVIEW__.seek(.375));
  const first = await riding(); valid(first); assert.equal(first.saddle.id, 'travel'); assert.equal(first.stats.rider.bones, 20); assert.equal(first.stats.horse.bones, 27);
  await page.getByTestId('mount-horse').selectOption('horse_chestnut'); let current = await riding(); valid(current); assert.equal(current.ids.rider, first.ids.rider); assert.notEqual(current.ids.horse, first.ids.horse); assert.deepEqual(current.recipe, first.recipe); near(current.status.phase, .375);
  const direction = c => c.position.map((v, i) => v - c.target[i]); direction(current.camera).forEach((v, i) => near(v, direction(first.camera)[i]));
  await page.getByTestId('mount-horse').selectOption('donkey_gray'); current = await riding(); near(current.status.phase, .375); assert.equal(current.ids.rider, first.ids.rider); assert.equal(current.status.duration, 4);
  const ids = current.ids, rein = current.saddle.reinGeometry;
  await page.getByTestId('mount-saddle').selectOption('simple'); current = await riding(); valid(current); assert.deepEqual(current.ids, ids); assert.equal(current.saddle.reinGeometry, rein);
  await page.getByTestId('riding-body-female').click(); await page.waitForFunction(() => window.__RIDING_REVIEW__.recipe().bodyType === 'female'); current = await riding(); valid(current); near(current.status.phase, .375); assert.equal(current.ids.horse, ids.horse); assert.notEqual(current.ids.rider, ids.rider);
  await page.getByTestId('riding-slot-top').selectOption('work_vest'); await page.getByTestId('riding-slot-bottom').selectOption('short_trousers'); current = await riding(); near(current.status.phase, .375);
  const original = current.recipe; await page.evaluate(r => localStorage.setItem('wanhu.character.wardrobe.v5', JSON.stringify(r)), original);
  checks.push('rider mesh survives species changes; gender and clothing preserve phase; saddle and rein geometry are species-specific; camera direction is preserved');
  await page.getByTestId('mount-saddle').selectOption('none'); const none = await riding(); assert(!none.saddle.riderVisible && !none.saddle.reinsVisible); assert(await page.getByTestId('riding-play').isDisabled());
  await page.getByTestId('mount-horse').selectOption('horse_chestnut'); current = await riding(); assert.equal(current.saddle.id, 'none'); near(current.status.phase, none.status.phase); assert.deepEqual(current.recipe, none.recipe);
  await page.getByTestId('mount-horse').selectOption('donkey_gray'); await page.getByTestId('mount-saddle').selectOption('travel'); current = await riding(); valid(current); near(current.status.phase, none.status.phase);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('wanhu.character.wardrobe.v5'))), original);
  for (const id of ['Rider_Idle', 'Rider_Walk', 'Rider_Run']) {
    await page.getByTestId(id).click(); await page.getByTestId('riding-play').click(); for (const phase of [0, .25, .5, .75, 1]) { await page.evaluate(p => window.__RIDING_REVIEW__.seek(p), phase); valid(await riding()); }
  }
  await page.getByLabel('骑乘循环播放', { exact: true }).uncheck(); await page.evaluate(() => window.__RIDING_REVIEW__.seek(.98)); await page.getByTestId('riding-play').click(); await page.waitForFunction(() => window.__RIDING_REVIEW__.getStatus().finished); near((await riding()).status.phase, 1);
  await page.getByLabel('骑乘循环播放', { exact: true }).check(); await page.getByTestId('riding-replay').click(); await page.waitForTimeout(250); current = await riding(); assert(!current.status.finished && current.status.phase > 0); valid(current);
  await page.getByTestId('riding-pose').click(); assert(await page.getByTestId('riding-play').isDisabled());
  checks.push('no saddle freezes across species changes without losing saved appearance; donkey rider clips, endpoint hold and replay use one clock');
  await page.getByTestId('animal-mode-horse').click(); await page.waitForFunction(() => window.__MOUNT_REVIEW__?.mountId() === 'donkey_gray'); assert.equal(await page.getByTestId('mount-saddle').inputValue(), 'travel');
  await page.goto(`${base}/?lab=horse&pose=bind&paused=1`); await page.waitForFunction(() => !!window.__HORSE_REVIEW__); assert.equal((await body()).id, 'horse_chestnut'); assert.equal((await body()).stats.triangles, 1524);
  await page.getByTestId('workspace-character').click(); await page.waitForFunction(() => !!window.__WANHU_REVIEW__); assert.equal(await page.evaluate(() => window.__WANHU_REVIEW__.stats.bones), 20);
  checks.push('body/riding round trip preserves species and saddle; legacy horse URL and original character workshop remain valid');
  await checkCamelBrowser(page, base, checks);
  await checkCattleBrowser(page, base, checks);
  await checkYakBrowser(page, base, checks);
  await checkBuffaloBrowser(page, base, checks);
  assert.deepEqual(errors, []); const report = { result: 'passed', sourceSHA, screenshots: 0, viewport: { width: 1600, height: 1000 }, checks, errors }; writeFileSync(join(output, 'mounts-browser-checks.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) { writeFileSync(join(output, 'mounts-browser-checks.json'), JSON.stringify({ result: 'failed', sourceSHA, screenshots: 0, checks, errors, error: String(error?.stack || error) }, null, 2)); console.error(error); process.exitCode = 1; }
finally { await browser?.close(); server?.kill('SIGTERM'); log.end(); }
