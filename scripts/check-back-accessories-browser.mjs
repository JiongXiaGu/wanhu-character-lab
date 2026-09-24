import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

// 默认只验交互；--screenshots 才生成本轮关键图，不把截图生成等同于美术认可。
const capture = process.argv.includes('--screenshots');
const output = process.env.BACK_CHECK_DIR || join(tmpdir(), 'wanhu-back-checks');
const pictures = 'review/back-accessories';
mkdirSync(output, { recursive: true }); if (capture) mkdirSync(pictures, { recursive: true });
const port = 4193, base = `http://127.0.0.1:${port}`;
const sourceSHA = process.env.REVIEW_HEAD_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const log = createWriteStream(join(output, 'browser-server.log'));
const errors = [], checks = [], screenshots = [];
const ids = ['bamboo_basket', 'firewood_bundle', 'book_case'];
const added = { bamboo_basket: 300, firewood_bundle: 320, book_case: 324 };
let server, browser;
const near = (a, b) => assert(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
try {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false });
  let ready = false;
  for (let i = 0; i < 225; i++) {
    if (server.exitCode !== null) throw new Error('Vite exited before review');
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert(ready, 'Vite did not start');
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const state = () => page.evaluate(() => ({ recipe: window.__WANHU_RECIPE__(), status: window.__WANHU_REVIEW__.getStatus(), stats: window.__WANHU_REVIEW__.stats,
    geometry: window.__WANHU_REVIEW__.geometryId(), camera: window.__WANHU_REVIEW__.cameraState() }));
  const load = async query => {
    await page.goto(`${base}/?review=1&paused=1&${query}`);
    await page.waitForFunction(() => window.__WANHU_REVIEW__?.stats.bones === 20 && !window.__WANHU_REVIEW__.getStatus().loading);
    assert.equal(await page.locator('canvas').count(), 1);
    assert.equal(await page.locator('.error-panel, vite-error-overlay').count(), 0);
  };
  const equip = async id => {
    await page.getByLabel('背部', { exact: true }).selectOption(id);
    await page.waitForFunction(id => window.__WANHU_RECIPE__().slots.back === id, id);
    await page.waitForTimeout(60);
  };
  const picture = async (name, full = false) => {
    if (!capture) return;
    await page.waitForTimeout(400);
    const path = `${pictures}/${name}.png`;
    if (full) await page.screenshot({ path }); else await page.locator('canvas').screenshot({ path });
    screenshots.push(path);
  };
  await load('pose=bind&view=back&back=none');
  assert.deepEqual(await page.getByLabel('背部', { exact: true }).locator('option').evaluateAll(nodes => nodes.map(n => n.value)), ['none', 'archer_quiver', ...ids]);
  for (const body of ['male', 'female']) {
    await page.getByTestId(`body-type-${body}`).click(); await equip('none');
    const empty = await state();
    for (const id of ids) {
      await equip(id); const selected = await state();
      assert.equal(selected.recipe.bodyType, body); assert.equal(selected.stats.bones, 20);
      assert.equal(selected.stats.triangles - empty.stats.triangles, added[id]);
      assert.notEqual(selected.geometry, empty.geometry); assert.deepEqual(selected.camera, empty.camera);
    }
    await equip('archer_quiver'); assert.equal((await state()).stats.triangles - empty.stats.triangles, 78);
    await equip('none'); assert.equal((await state()).stats.triangles, empty.stats.triangles);
  }
  checks.push('five existing-slot choices, male/female, exact geometry budgets, camera held, old quiver and none restored');
  await equip('book_case'); await page.getByRole('button', { name: '保存装扮', exact: true }).click(); const saved = (await state()).recipe;
  await equip('none'); await page.getByRole('button', { name: '恢复装扮', exact: true }).click(); assert.deepEqual((await state()).recipe, saved);
  const downloadWait = page.waitForEvent('download'); await page.getByRole('button', { name: '导出配方', exact: true }).click();
  const stream = await (await downloadWait).createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk);
  assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()), saved);
  const upload = value => page.getByLabel('导入配方文件', { exact: true }).setInputFiles({ name: 'back-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await upload({ ...saved, slots: { ...saved.slots, back: 'bad_back_id' } }); await page.waitForTimeout(150); assert.deepEqual((await state()).recipe, saved);
  const imported = { ...saved, slots: { ...saved.slots, back: 'firewood_bundle' } };
  await upload(imported); await page.waitForFunction(() => window.__WANHU_RECIPE__().slots.back === 'firewood_bundle');
  assert.deepEqual((await state()).recipe, imported);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); assert.deepEqual((await state()).recipe, saved);
  await page.getByLabel('锁定背部', { exact: true }).check(); await page.getByRole('button', { name: '随机人物', exact: true }).click(); assert.equal((await state()).recipe.slots.back, 'book_case');
  checks.push('save/restore, actual download/import, unknown ID rejection, undo, random lock');
  for (const id of ['jogging', 'pilot-switches', 'shooting-arrow']) {
    const before = (await state()).geometry;
    await page.getByLabel('试衣动画', { exact: true }).selectOption(id);
    await page.waitForFunction(id => window.__WANHU_REVIEW__.getStatus().motion?.id === id && !window.__WANHU_REVIEW__.getStatus().loading, id);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await page.evaluate(() => window.__WANHU_REVIEW__.seek(.375));
    assert.equal((await state()).geometry, before);
    for (const back of ids) { await equip(back); near((await state()).status.phase, .375); }
    const currentBody = (await state()).recipe.bodyType;
    await page.getByTestId(`body-type-${currentBody === 'male' ? 'female' : 'male'}`).click(); near((await state()).status.phase, .375);
  }
  checks.push('three key external motions reuse mesh; back/body edits preserve paused phase');
  // 三件静态背面斜视、背带正面、竹篓经营俯视，以及女性坐姿，全为当前页面真实 WebGL。
  if (capture) {
    for (const id of ids) {
      await load(`pose=bind&view=back&bodyType=male&top=rough_tunic&back=${id}`);
      const rect = await page.locator('canvas').boundingBox();
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.mouse.down(); await page.mouse.move(rect.x + rect.width / 2 + 90, rect.y + rect.height / 2 + 35, { steps: 12 }); await page.mouse.up();
      await page.waitForTimeout(400); await page.evaluate(() => window.__WANHU_REVIEW__.focusTorso());
      await picture(id);
    }
    await load('pose=bind&view=front&bodyType=female&top=short_work_jacket&back=bamboo_basket');
    await page.evaluate(() => window.__WANHU_REVIEW__.focusTorso()); await picture('female-harness', true);
    await load('pose=bind&view=top&bodyType=male&back=bamboo_basket'); await picture('basket-top');
    await load('motion=pilot-switches&view=side&phase=.45&bodyType=female&back=book_case');
    await page.waitForFunction(() => window.__WANHU_REVIEW__.getStatus().motion?.id === 'pilot-switches'); await picture('female-seated');
  }
  await page.goto(`${base}/?lab=riding&review=1&paused=1&clip=Rider_Walk&phase=.375`);
  await page.waitForFunction(() => !!window.__RIDING_REVIEW__);
  const ridingBefore = await page.evaluate(() => window.__RIDING_REVIEW__.geometryIds());
  for (const back of ids) {
    const recipe = { ...saved, slots: { ...saved.slots, back } };
    await page.getByLabel('导入骑手配方', { exact: true }).setInputFiles({ name: 'rider-back.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(recipe)) });
    await page.waitForFunction(back => window.__RIDING_REVIEW__.recipe().slots.back === back, back);
    const r = await page.evaluate(() => ({ status: window.__RIDING_REVIEW__.getStatus(), ids: window.__RIDING_REVIEW__.geometryIds(), finite: window.__RIDING_REVIEW__.matricesFinite() }));
    assert(r.finite); assert.equal(r.ids.horse, ridingBefore.horse); near(r.status.phase, .375);
  }
  checks.push('all three V5 accessories import into existing riding preview without replacing the mount or phase');
  assert.deepEqual(errors, [], 'browser errors');
  const report = { passed: true, sourceSHA, checks, screenshots, errors, visualApproval: 'pending user review' };
  writeFileSync(join(output, 'browser-checks.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (capture && browser) { const pages = browser.contexts().flatMap(c => c.pages()); await pages[0]?.screenshot({ path: `${pictures}/failure.png` }).catch(() => {}); }
  writeFileSync(join(output, 'browser-checks.json'), JSON.stringify({ passed: false, sourceSHA, checks, screenshots, errors, failure: String(error?.stack || error) }, null, 2));
  console.error(error); process.exitCode = 1;
} finally { await browser?.close(); server?.kill('SIGTERM'); log.end(); }
