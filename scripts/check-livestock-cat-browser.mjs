import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

/** 使用正式家畜工作台；不新增猫页面或测试Renderer。 */
export async function checkCatBrowser(page, base, dir, screenshots, setPhase) {
  const animal = 'cat_rural_orange', budgets = [['lod0', 262, 151], ['lod1', 146, 93], ['lod2', 86, 59]];
  const motions = ['idle', 'walk', 'run', 'sniff', 'groom', 'sleep'], cases = [], counts = [], switches = [], images = [], comparisons = [];
  const snap = () => page.evaluate(() => window.__LIVESTOCK_REVIEW__.snapshot());
  const ready = () => page.waitForFunction(id => window.__LIVESTOCK_REVIEW__?.snapshot().animal === id, animal);
  // 不依赖截图产生的隐式延迟；两种执行入口都等待真正场景帧。
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const pause = async () => {
    if ((await snap()).playing) { await page.getByTestId('livestock-play').click(); await page.waitForFunction(() => !window.__LIVESTOCK_REVIEW__.snapshot().playing); }
  };
  const cameraEqual = (a, b) => {
    for (const key of ['position', 'target']) a[key].forEach((v, i) => assert(Number.isFinite(v) && Math.abs(v - b[key][i]) < 1e-10));
    assert(Math.abs(a.zoom - b.zoom) < 1e-10);
  };
  const shot = async name => {
    await frame(); if (!screenshots) return;
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `review/livestock/${name}`, fullPage: true }); images.push({ name, ...await snap() });
  };
  const motion = async id => {
    await page.getByTestId(`livestock-motion-${id}`).click();
    await page.waitForFunction(id => { const s = window.__LIVESTOCK_REVIEW__.snapshot(); return s.motion === id && s.playing && s.time > .02; }, id);
    await pause(); await setPhase(.5); await frame();
  };
  const wardrobe = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.includes('character'))));
  const stored = await page.evaluate(() => sessionStorage.getItem('wanhu.livestock.preview.v1'));
  await page.goto(`${base}/?lab=livestock&animal=${animal}&clip=idle&paused=1&lod=lod0&phase=.5&view=three`, { waitUntil: 'networkidle' }); await ready(); await frame();
  assert.deepEqual(await page.getByLabel('家畜种类', { exact: true }).locator('option').evaluateAll(nodes => nodes.map(n => n.value)), ['chicken_brown', 'duck_domestic_brown', 'goose_domestic_white', 'pig_domestic_black', 'dog_rural_yellow', animal]);
  assert.deepEqual(await page.locator('.livestock-motions button strong').evaluateAll(nodes => nodes.map(n => n.textContent)), ['停驻', '行走', '奔跑', '闻地', '理毛', '睡觉']);
  assert.equal(await page.getByTestId('livestock-environment').count(), 0);
  const initial = await snap(); assert.equal(initial.bones, 9); assert.equal(initial.waterClipped, false); assert.equal(await page.locator('canvas').count(), 1);
  for (const [lod, triangles, logicalVertices] of budgets) {
    await page.getByTestId(`livestock-lod-${lod}`).click(); await page.waitForFunction(lod => window.__LIVESTOCK_REVIEW__.snapshot().lod === lod, lod); await frame();
    const state = await snap(); assert.equal(state.triangles, triangles); assert.equal(state.logicalVertices, logicalVertices); assert.equal(state.rendererId, initial.rendererId);
    for (const id of motions) {
      await motion(id); const before = await snap();
      assert.equal(before.motion, id); assert.equal(before.bones, 9); assert.equal(before.geometryId, state.geometryId); assert.equal(before.surface, 'land'); assert.equal(before.playing, false);
      await page.waitForTimeout(80); assert.equal((await snap()).phase, before.phase);
      await page.getByLabel('家畜下一帧', { exact: true }).click(); await page.waitForFunction(p => window.__LIVESTOCK_REVIEW__.snapshot().phase > p, before.phase);
      await page.getByLabel('家畜上一帧', { exact: true }).click(); await page.waitForFunction(p => Math.abs(window.__LIVESTOCK_REVIEW__.snapshot().phase - p) < .001, before.phase);
      await page.getByLabel('家畜循环播放', { exact: true }).uncheck(); await setPhase(.99); await page.getByTestId('livestock-play').click(); await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().finished);
      assert.equal((await snap()).phase, 1); await frame(); assert.equal((await snap()).phase, 1);
      await page.getByLabel('家畜循环播放', { exact: true }).check(); await setPhase(.99); await page.getByTestId('livestock-play').click();
      await page.waitForFunction(() => { const s = window.__LIVESTOCK_REVIEW__.snapshot(); return s.playing && s.phase < .2; }); await pause(); await setPhase(.5);
      cases.push({ lod, motion: id, triangles, logicalVertices, pauseResumeSeekStepLoopEnd: true });
      if (lod === 'lod0') {
        await page.getByTestId('livestock-view-three').click(); await shot(`cat-${id}-three.png`);
        if (['walk', 'run', 'sniff', 'groom', 'sleep'].includes(id)) { await page.getByTestId('livestock-view-left').click(); await shot(`cat-${id}-left.png`); }
      }
      if (screenshots && ['idle', 'sleep'].includes(id)) {
        await page.getByTestId('livestock-view-three').click(); await frame(); await page.evaluate(() => window.scrollTo(0, 0));
        const box = await page.locator('.livestock-viewport canvas').boundingBox(); assert(box);
        const width = Math.min(620, Math.floor(box.width)), height = Math.min(580, Math.floor(box.height));
        const clip = { x: Math.round(box.x + (box.width - width) / 2), y: Math.round(box.y + (box.height - height) / 2), width, height };
        comparisons.push({ lod, motion: id, triangles, camera: (await snap()).camera, clip, png: await page.screenshot({ clip }) });
      }
    }
  }
  // 严格水平侧视只使用既有相机临时状态，不改正式相机预设或动物光照。
  await page.evaluate(id => sessionStorage.setItem('wanhu.livestock.preview.v1', JSON.stringify({ version: 1, animal: id, count: 1, surface: 'land', motion: 'idle', playing: false, loop: true, lod: 'lod0', phase: .5, seed: 731, view: 'left', camera: { position: [-2, .25, 0], target: [0, .25, 0], zoom: 1 } })), animal);
  await page.goto(`${base}/?lab=livestock&preview=resume`, { waitUntil: 'networkidle' }); await ready(); await frame();
  let s = await snap(); assert(Math.abs(s.camera.position[1] - s.camera.target[1]) < 1e-8); assert(Math.abs(s.camera.position[2] - s.camera.target[2]) < 1e-8); await shot('cat-side.png');
  await motion('sleep'); await shot('cat-sleep-side.png');
  await page.getByTestId('livestock-view-front').click(); await shot('cat-sleep-front.png');
  await motion('idle'); await shot('cat-front.png');
  await page.getByTestId('livestock-view-farm').click(); await shot('cat-farm-single.png');
  const beforeSwitch = await snap();
  for (const id of ['pig_domestic_black', animal, 'dog_rural_yellow', animal, 'duck_domestic_brown', 'goose_domestic_white', 'chicken_brown', animal]) {
    await page.getByLabel('家畜种类', { exact: true }).selectOption(id); await page.waitForFunction(id => window.__LIVESTOCK_REVIEW__.snapshot().animal === id, id); await frame(); s = await snap();
    assert.equal(s.rendererId, beforeSwitch.rendererId); assert(Math.abs(s.phase - beforeSwitch.phase) < 1e-12); assert.equal(await page.locator('canvas').count(), 1);
    switches.push({ animal: id, motion: s.motion, bones: s.bones });
  }
  await motion('groom');
  await page.getByLabel('家畜种类', { exact: true }).selectOption('dog_rural_yellow'); await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().animal === 'dog_rural_yellow');
  assert.equal((await snap()).motion, 'idle');
  await page.getByTestId('livestock-motion-bark').click(); await pause();
  await page.getByLabel('家畜种类', { exact: true }).selectOption(animal); await ready(); assert.equal((await snap()).motion, 'idle');
  await page.getByTestId('livestock-lod-auto').click(); await frame();
  for (const count of [1, 10, 50, 100, 500]) {
    await page.getByTestId(`livestock-count-${count}`).click(); await page.waitForFunction(n => window.__LIVESTOCK_REVIEW__.snapshot().count === n, count); await frame();
    s = await snap(); assert.equal(s.lod, s.pixelHeight >= 70 ? 'lod0' : s.pixelHeight >= 26 ? 'lod1' : 'lod2');
    assert.equal(s.modelTriangles, s.triangles * count); assert(s.batches > 0 && s.batches <= (count === 1 ? 1 : 32));
    if (count > 1) assert(s.mixed); counts.push({ ...s, case: 'daily' });
    if ([10, 100, 500].includes(count)) { await page.getByTestId('livestock-view-farm').click(); await shot(`cat-farm-${count}.png`); }
    if (count > 1) await page.getByLabel('家畜日常混合', { exact: true }).uncheck();
    await motion('sleep'); s = await snap(); assert.equal(s.mixed, false); assert(s.batches > 0 && s.batches <= 8); assert.equal(s.modelTriangles, s.triangles * count); counts.push({ ...s, case: 'sleep' });
    if ([10, 100, 500].includes(count)) await shot(`cat-sleep-${count}.png`);
    if (count > 1) await page.getByLabel('家畜日常混合', { exact: true }).check();
  }
  // 500只逐LOD强制切换，再重复热切换验证缓存和几何不增长。
  for (const [lod, triangles] of budgets) {
    await page.getByTestId(`livestock-lod-${lod}`).click(); await page.waitForFunction(id => window.__LIVESTOCK_REVIEW__.snapshot().lod === id, lod); await frame(); assert.equal((await snap()).modelTriangles, triangles * 500);
  }
  const warm = await snap();
  for (let i = 0; i < 3; i++) for (const [lod] of budgets) { await page.getByTestId(`livestock-lod-${lod}`).click(); await page.waitForFunction(id => window.__LIVESTOCK_REVIEW__.snapshot().lod === id, lod); await frame(); }
  s = await snap(); for (const key of ['rendererId', 'cachedPoses', 'geometries']) assert.equal(s[key], warm[key]);
  const seed = s.seed; await page.getByTestId('livestock-reshuffle').click(); await page.waitForFunction(seed => window.__LIVESTOCK_REVIEW__.snapshot().seed !== seed, seed);
  await page.getByLabel('家畜日常混合', { exact: true }).uncheck(); await motion('sleep'); await frame();
  const beforeNav = await snap(); await page.getByTestId('animal-mode-horse').click(); await page.waitForFunction(() => !!window.__MOUNT_REVIEW__);
  await page.getByTestId('animal-mode-livestock').click(); await ready(); await frame(); s = await snap();
  for (const key of ['animal', 'surface', 'motion', 'count', 'playing', 'loop', 'seed', 'lod', 'mixed']) assert.equal(s[key], beforeNav[key]);
  assert(Math.abs(s.phase - beforeNav.phase) < 1e-12); cameraEqual(s.camera, beforeNav.camera);
  for (const query of ['surface=water&clip=swim', 'surface=invalid&clip=bark&lod=missing&phase=Infinity&count=9999']) {
    await page.goto(`${base}/?lab=livestock&animal=${animal}&${query}&paused=1`, { waitUntil: 'networkidle' }); await ready(); s = await snap();
    for (const [key, value] of Object.entries({ motion: 'idle', surface: 'land', phase: 0, count: 1, bones: 9, lod: 'lod0' })) assert.equal(s[key], value);
  }
  assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.includes('character')))), wardrobe);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(value => value === null ? sessionStorage.removeItem('wanhu.livestock.preview.v1') : sessionStorage.setItem('wanhu.livestock.preview.v1', value), stored);
  if (screenshots) for (const id of ['idle', 'sleep']) {
    const rows = comparisons.filter(c => c.motion === id); assert.equal(rows.length, 3);
    for (const c of rows) { cameraEqual(c.camera, rows[0].camera); assert.deepEqual(c.clip, rows[0].clip); }
    const context = await page.context().browser().newContext({ viewport: { width: 1940, height: 750 }, deviceScaleFactor: 1 });
    try {
      const sheet = await context.newPage();
      await sheet.setContent(`<!doctype html><html lang="zh"><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#19292c;color:#e7e3d8;font-family:'Noto Sans CJK SC',sans-serif}h1{font-size:26px;font-weight:500;margin:0 0 10px}p{font-size:15px;color:#abbfb6}.row{display:flex;gap:12px}.card{flex:1;min-width:0;border:1px solid #53645c;border-radius:8px;overflow:hidden}.card header{padding:14px;background:#243639;color:#ddc49c}.card img{width:100%;display:block}</style><h1>橘色田园猫 · ${id === 'sleep' ? '睡觉' : '停驻'} · 三档作者LOD</h1><p>真实WebGL · 同相机、同相位、同裁切尺度 · 不代表用户最终美术认可</p><div class="row">${rows.map(c => `<div class="card"><header>${c.lod.toUpperCase()} · ${c.triangles} tris</header><img src="data:image/png;base64,${c.png.toString('base64')}"></div>`).join('')}</div></html>`);
      await sheet.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
      await sheet.screenshot({ path: `review/livestock/cat-${id === 'sleep' ? 'sleep-' : ''}lods.png`, fullPage: true });
    } finally { await context.close(); }
  }
  const result = { result: 'passed', sourceSHA: process.env.REVIEW_HEAD_SHA ?? 'local', animal, cases, counts, switches, images, screenshots, comparedLods: comparisons.map(({ png, ...row }) => row), wardrobeUnchanged: true, lifecycleStable: true };
  writeFileSync(`${dir}/cat-browser.json`, JSON.stringify(result, null, 2));
  console.log(`Cat desktop checks passed: ${cases.length} action/LOD cases, ${counts.length} daily/sleep crowd cases through 500, loop/end/seek/step, species and workspace lifecycle.`);
}
