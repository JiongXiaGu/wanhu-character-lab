import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const dir = process.env.SOLDIER_BROWSER_DIR || '/tmp/wanhu-soldier-fitting';
mkdirSync(dir, { recursive: true });
const sourceSHA = process.env.REVIEW_HEAD_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const base = process.env.REVIEW_URL || 'http://127.0.0.1:4197';
const log = createWriteStream(join(dir, 's6-3-server.log'));
let server, browser;
const checks = [];
const errors = [];

function sameCamera(actual, expected) {
  if (typeof expected === 'number') {
    assert(Number.isFinite(actual) && Number.isFinite(expected));
    assert(Math.abs(actual - expected) < 1e-10, `Camera changed: ${actual} != ${expected}`);
  } else if (Array.isArray(expected)) {
    assert(Array.isArray(actual)); assert.equal(actual.length, expected.length);
    expected.forEach((value, index) => sameCamera(actual[index], value));
  } else if (expected && typeof expected === 'object') {
    assert(actual && typeof actual === 'object');
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
    for (const key of Object.keys(expected)) sameCamera(actual[key], expected[key]);
  } else assert.equal(actual, expected);
}
sameCamera({ position: [2.8 + 1e-12, 1, 4] }, { position: [2.8, 1, 4] });
assert.throws(() => sameCamera({ position: [2.8001, 1, 4] }, { position: [2.8, 1, 4] }));
assert.throws(() => sameCamera({ position: [Number.NaN, 1, 4] }, { position: [2.8, 1, 4] }));

const styles = {
  palace: { soldier: 'palace_guard_helmet', captain: 'palace_captain_helmet', defaultArmor: 'medium', dyes: { primary: '#713b38', secondary: '#34383a', accent: '#a07c49' } },
  frontier: { soldier: 'frontier_guard_helmet', captain: 'frontier_captain_helmet', defaultArmor: 'medium', dyes: { primary: '#41535a', secondary: '#4b4b47', accent: '#79504a' } },
  city: { soldier: 'city_guard_helmet', captain: 'city_captain_helmet', defaultArmor: 'light', dyes: { primary: '#44565b', secondary: '#505557', accent: '#887252' } },
};
const armor = {
  light: { top: 'city_guard_brigandine', bottom: 'city_guard_trousers' },
  medium: { top: 'medium_armor', bottom: 'medium_armor_skirt' },
  heavy: { top: 'heavy_armor', bottom: 'heavy_armor_skirt' },
};

try {
  if (!process.env.REVIEW_URL) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4197', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false });
  }
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (server && server.exitCode !== null) throw new Error('Vite stopped');
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert(ready, 'S6-3 Vite did not become ready');
  browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(45000);
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  const recipe = () => page.evaluate(() => window.__WANHU_RECIPE__());
  const camera = () => page.evaluate(() => window.__WANHU_REVIEW__.cameraState());
  const status = () => page.evaluate(() => window.__WANHU_REVIEW__.getStatus());
  const sync = async () => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('canvas').count(), 1);
  };
  const open = async query => {
    await page.goto(base + '/?' + query);
    await page.waitForFunction(() => !!window.__WANHU_REVIEW__ && !!window.__WANHU_RECIPE__);
    await sync();
  };
  const waitMotion = async id => {
    await page.waitForFunction(id => {
      const motion = window.__WANHU_REVIEW__?.getStatus().motion;
      return motion?.ready && motion.id === id;
    }, id);
    await sync();
  };
  const clickArmor = async id => {
    await page.getByTestId('soldier-armor-' + id).click();
    await page.waitForFunction(top => window.__WANHU_RECIPE__().slots.top === top, armor[id].top);
    await sync();
    const r = await recipe();
    assert.equal(r.slots.bottom, armor[id].bottom);
    assert.equal(await page.getByTestId('soldier-armor-' + id).getAttribute('aria-pressed'), 'true');
  };

  // 首次从居民装进入驻地才应用默认整套；三个驻地分别验证默认等级。
  for (const [style, expected] of Object.entries(styles)) {
    await open('review=1&pose=bind&paused=1&view=free&bodyType=male&rightHand=none');
    const before = await recipe(), cam = await camera();
    await page.getByTestId('soldier-' + style).click(); await sync();
    const r = await recipe();
    assert.equal(r.slots.headwear, expected.soldier);
    assert.equal(r.slots.top, armor[expected.defaultArmor].top);
    assert.equal(r.slots.bottom, armor[expected.defaultArmor].bottom);
    assert.equal(r.slots.shoes, 'military_boots'); assert.equal(r.slots.rightHand, 'military_spear');
    assert.deepEqual(r.dyes, expected.dyes);
    assert.equal(r.bodyType, before.bodyType); assert.equal(r.hairStyle, before.hairStyle); assert.equal(r.hairColor, before.hairColor);
    sameCamera(await camera(), cam);
  }
  checks.push('fresh resident -> service style applies only that style default loadout, palette and soldier helmet');

  // 同一个真实工坊连续遍历 3×3×2；每一轴只改变自己的数据所有权。
  await open('review=1&pose=bind&paused=1&view=free&soldier=palace&armorClass=heavy&bodyType=male&rightHand=none');
  const matrixCamera = await camera();
  let axisCases = 0;
  for (const [style, expected] of Object.entries(styles)) {
    const beforeStyle = await recipe();
    await page.getByTestId('soldier-' + style).click(); await sync();
    const styled = await recipe();
    assert.equal(styled.slots.top, beforeStyle.slots.top); assert.equal(styled.slots.bottom, beforeStyle.slots.bottom);
    assert.deepEqual({ ...styled.slots, headwear: beforeStyle.slots.headwear }, beforeStyle.slots);
    assert.deepEqual(styled.dyes, expected.dyes);
    assert.deepEqual({ ...styled, slots: beforeStyle.slots, dyes: beforeStyle.dyes }, beforeStyle);
    sameCamera(await camera(), matrixCamera);
    for (const [armorClass, slots] of Object.entries(armor)) {
      const beforeArmor = await recipe();
      await clickArmor(armorClass);
      const armored = await recipe();
      assert.deepEqual({ ...armored.slots, top: beforeArmor.slots.top, bottom: beforeArmor.slots.bottom }, beforeArmor.slots);
      assert.deepEqual({ ...armored, slots: beforeArmor.slots }, beforeArmor);
      assert.equal(armored.slots.top, slots.top); assert.equal(armored.slots.bottom, slots.bottom);
      sameCamera(await camera(), matrixCamera);
      for (const identity of ['soldier', 'captain']) {
        const beforeIdentity = await recipe();
        await page.getByTestId('soldier-identity-' + identity).click(); await sync();
        const identified = await recipe();
        assert.equal(identified.slots.headwear, expected[identity]);
        assert.deepEqual({ ...identified.slots, headwear: beforeIdentity.slots.headwear }, beforeIdentity.slots);
        assert.deepEqual({ ...identified, slots: beforeIdentity.slots }, beforeIdentity);
        assert.equal(await page.getByTestId('soldier-' + style).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.getByTestId('soldier-armor-' + armorClass).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.getByTestId('soldier-identity-' + identity).getAttribute('aria-pressed'), 'true');
        sameCamera(await camera(), matrixCamera);
        axisCases++;
      }
    }
  }
  assert.equal(axisCases, 18);
  checks.push('18 combinations: 3 service styles × 3 armor classes × soldier/captain, with strict axis ownership and stable camera');

  // 自由混搭后不强行识别等级；换驻地保留混搭和随身装备，只更新 palette/headwear。
  await page.getByLabel('下装', { exact: true }).selectOption('work_pants'); await sync();
  for (const id of Object.keys(armor)) assert.equal(await page.getByTestId('soldier-armor-' + id).getAttribute('aria-pressed'), 'false');
  await page.getByLabel('背部', { exact: true }).selectOption('bamboo_basket');
  await page.getByLabel('右手', { exact: true }).selectOption('farmer_hoe'); await sync();
  const mixed = await recipe();
  await page.getByTestId('soldier-frontier').click(); await sync();
  const restyled = await recipe();
  assert.deepEqual({ ...restyled.slots, headwear: mixed.slots.headwear }, mixed.slots);
  assert.deepEqual(restyled.dyes, styles.frontier.dyes);
  assert.equal(restyled.slots.back, 'bamboo_basket'); assert.equal(restyled.slots.rightHand, 'farmer_hoe');
  checks.push('mixed top/bottom and equipment survive service-style changes; derived armor selection clears instead of inventing state');

  // Armor 不拥有染色；驻地拥有 palette。性别切换不重置三个轴。
  await clickArmor('heavy');
  await page.getByTestId('soldier-identity-captain').click(); await sync();
  await page.getByLabel('主布颜色').fill('#123456'); await sync();
  const customDye = await recipe();
  await clickArmor('light');
  assert.deepEqual((await recipe()).dyes, customDye.dyes, 'armor class must preserve dyes');
  await page.getByTestId('soldier-city').click(); await sync();
  assert.deepEqual((await recipe()).dyes, styles.city.dyes, 'service style owns palette');
  await clickArmor('heavy'); await page.getByTestId('soldier-identity-captain').click(); await sync();
  const beforeGender = await recipe();
  await page.getByTestId('body-type-female').click();
  await page.waitForFunction(() => window.__WANHU_RECIPE__().bodyType === 'female'); await sync();
  const female = await recipe();
  assert.deepEqual({ ...female, bodyType: beforeGender.bodyType }, beforeGender);
  assert.equal(await page.getByTestId('soldier-city').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByTestId('soldier-armor-heavy').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByTestId('soldier-identity-captain').getAttribute('aria-pressed'), 'true');
  checks.push('armor preserves custom dye; service style replaces palette; gender switch preserves style/armor/identity');

  // 撤销、浏览器保存/恢复与文件导入导出都以真实 Recipe 为来源。
  await page.getByTestId('body-type-male').click(); await page.waitForFunction(() => window.__WANHU_RECIPE__().bodyType === 'male'); await sync();
  const saved = await recipe();
  await page.getByRole('button', { name: '保存装扮', exact: true }).click();
  await clickArmor('medium');
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await sync(); assert.deepEqual(await recipe(), saved);
  await clickArmor('light');
  await page.getByRole('button', { name: '恢复装扮', exact: true }).click(); await sync(); assert.deepEqual(await recipe(), saved);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出配方', exact: true }).click();
  const download = await downloadEvent, stream = await download.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  assert.deepEqual(JSON.parse(bytes), saved); assert.equal(Object.keys(saved).length, 6); assert.equal(Object.keys(saved.slots).length, 7);
  await clickArmor('medium');
  await page.getByLabel('导入配方文件', { exact: true }).setInputFiles({ name: 's6-3-heavy.json', mimeType: 'application/json', buffer: bytes });
  await page.waitForFunction(() => window.__WANHU_RECIPE__().slots.top === 'heavy_armor'); await sync();
  assert.deepEqual(await recipe(), saved);
  checks.push('undo, browser save/restore and V5 export/import preserve all three derived fitting axes');

  // 暂停动作下切三轴及性别都保留实际相位；只加载一条真实 jogging，避免把 S6-3 做成动作矩阵。
  await open('review=1&soldier=palace&armorClass=heavy&soldierRole=soldier&bodyType=male&motion=jogging&paused=1&rightHand=none&view=free');
  await waitMotion('jogging');
  await page.evaluate(() => window.__WANHU_REVIEW__.seek(.375)); await sync();
  const phase = (await status()).phase; assert(Math.abs(phase - .375) < 1e-6);
  for (const action of [
    async () => page.getByTestId('soldier-identity-captain').click(),
    async () => page.getByTestId('soldier-city').click(),
    async () => page.getByTestId('soldier-armor-light').click(),
    async () => page.getByTestId('body-type-female').click(),
  ]) {
    await action(); await waitMotion('jogging');
    assert(Math.abs((await status()).phase - phase) < 1e-6, 'paused fitting change must retain phase');
  }
  checks.push('paused jogging phase survives identity, service style, armor class and gender changes');

  assert.deepEqual(errors, []);
  const report = { passed: true, stage: 'S6-3', sourceSHA, axisCases, checks, errors, screenshots: false, visualApproval: false, scope: 'Focused browser interaction only. Full soldier browser regression, complete source-key motion/intersections and WebGL visual approval remain later gates.' };
  writeFileSync(join(dir, 's6-3-fitting.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('S6-3 FITTING', JSON.stringify(report));
} catch (error) {
  writeFileSync(join(dir, 's6-3-fitting.json'), JSON.stringify({ passed: false, stage: 'S6-3', sourceSHA, checks, errors, error: String(error?.stack || error) }, null, 2) + '\n');
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close(); server?.kill('SIGTERM'); log.end();
}
