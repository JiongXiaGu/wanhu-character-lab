import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

/** 睡眠专项只扩充既有浏览器检查，不创建新页面、Renderer或永久流程。 */
export async function checkLivestockSleepBrowser(page, base, dir, screenshots, setPhase) {
  const species = [
    ['chicken_brown', '鸡', 8, [132, 72, 36]],
    ['duck_domestic_brown', '鸭', 8, [118, 60, 36]],
    ['goose_domestic_white', '鹅', 7, [154, 82, 44]],
    ['pig_domestic_black', '黑色家猪', 9, [216, 138, 82]],
    ['dog_rural_yellow', '中国田园犬', 9, [274, 142, 78]],
    ['cat_rural_orange', '橘色田园猫', 9, [262, 146, 86]],
  ];
  const snap = () => page.evaluate(() => window.__LIVESTOCK_REVIEW__.snapshot());
  const ready = id => page.waitForFunction(animal => window.__LIVESTOCK_REVIEW__?.snapshot().animal === animal, id);
  const pause = async () => {
    if ((await snap()).playing) await page.getByTestId('livestock-play').click();
    await page.waitForFunction(() => !window.__LIVESTOCK_REVIEW__.snapshot().playing);
  };
  const selectSleep = async () => {
    await page.getByTestId('livestock-motion-sleep').click();
    // 重选同一个sleep也会重新播放。只等motion会命中上一帧的暂停快照，
    // 导致pause漏点按钮；必须等本次点击的播放状态实际进入场景后再暂停。
    await page.waitForFunction(() => {
      const s = window.__LIVESTOCK_REVIEW__.snapshot();
      return s.motion === 'sleep' && !s.mixed && s.playing && !s.finished;
    });
    await pause(); await setPhase(.5);
  };
  const images = [], cases = [], counts = [], strips = [], controls = [], switches = [];
  const wardrobe = await page.evaluate(() => localStorage.getItem('wanhu.character.wardrobe.v5'));
  const shot = async name => {
    if (!screenshots) return;
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(100);
    await page.screenshot({ path: `review/livestock/${name}`, fullPage: true }); images.push({ name, ...await snap() });
  };
  for (const [animal, label, bones, budgets] of species) {
    const comparisons = [];
    await page.goto(`${base}/?lab=livestock&animal=${animal}&surface=land&lod=lod0&clip=sleep&phase=.5&paused=1&view=three`, { waitUntil: 'networkidle' }); await ready(animal);
    const initial = await snap(); assert.equal(initial.motion, 'sleep'); assert.equal(initial.playing, false); assert.equal(initial.surface, 'land');
    assert.equal(await page.getByTestId('livestock-motion-sleep').locator('strong').textContent(), '睡觉');
    for (let i = 0; i < 3; i++) {
      const lod = `lod${i}`;
      await page.getByTestId(`livestock-lod-${lod}`).click();
      await page.waitForFunction(id => window.__LIVESTOCK_REVIEW__.snapshot().lod === id, lod);
      const s = await snap(); assert.equal(s.bones, bones); assert.equal(s.triangles, budgets[i]); assert.equal(s.motion, 'sleep');
      assert.equal(s.rendererId, initial.rendererId); assert.equal(s.phase, initial.phase); assert.deepEqual(s.camera, initial.camera);
      cases.push({ animal, lod, motion: s.motion, triangles: s.triangles, bones });
      if (screenshots) {
        await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(100);
        const box = await page.locator('.livestock-viewport canvas').boundingBox(); assert(box);
        const width = Math.min(560, Math.floor(box.width)), height = Math.min(600, Math.floor(box.height));
        const clip = { x: Math.round(box.x + (box.width - width) / 2), y: Math.round(box.y + (box.height - height) / 2), width, height };
        comparisons.push({ lod, triangles: s.triangles, camera: s.camera, clip, png: await page.screenshot({ clip }) });
      }
    }
    await page.getByTestId('livestock-lod-lod0').click(); await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().lod === 'lod0');
    assert.equal((await snap()).geometryId, initial.geometryId);
    await shot(`${animal}-sleep-three.png`);
    if (bones === 9) {
      // 使用既有页签相机恢复做真正正侧视，不改正式机位预设，也不新增审图Renderer。
      await page.evaluate(id => sessionStorage.setItem('wanhu.livestock.preview.v1', JSON.stringify({ version: 1, animal: id, count: 1, surface: 'land', motion: 'sleep', playing: false, loop: true, lod: 'lod0', phase: .5, seed: 731, view: 'left', camera: { position: [-3, .22, 0], target: [0, .22, 0], zoom: 1 } })), animal);
      await page.goto(`${base}/?lab=livestock&preview=resume`, { waitUntil: 'networkidle' }); await ready(animal);
      const side = await snap(); assert.equal(side.motion, 'sleep'); assert.equal(side.lod, 'lod0');
      assert(Math.abs(side.camera.position[1] - side.camera.target[1]) < 1e-8 && Math.abs(side.camera.position[2] - side.camera.target[2]) < 1e-8);
    } else await page.getByTestId('livestock-view-left').click();
    await shot(`${animal}-sleep-side.png`);
    if (screenshots) strips.push({ animal, label, comparisons });
    // 睡眠与旧动作双向切换，不遗留混合池或上一动作的Pose。
    const beforeAction = await snap();
    const idle = animal === 'duck_domestic_brown' || animal === 'goose_domestic_white' ? 'idle_land' : 'idle';
    await page.getByTestId(`livestock-motion-${idle}`).click();
    await page.waitForFunction(id => { const s = window.__LIVESTOCK_REVIEW__.snapshot(); return s.motion === id && s.playing; }, idle);
    await selectSleep(); const afterAction = await snap();
    assert.equal(afterAction.geometryId, beforeAction.geometryId); assert.equal(afterAction.rendererId, beforeAction.rendererId);
    // 暂停、定位、逐帧、继续播放、跨过循环端点和单次末帧均通过真实控件完成。
    await setPhase(.25); const frozen = await snap(); await page.waitForTimeout(200); assert.equal((await snap()).phase, frozen.phase);
    await page.getByLabel('家畜下一帧', { exact: true }).click();
    await page.waitForFunction(p => window.__LIVESTOCK_REVIEW__.snapshot().phase > p, frozen.phase);
    await page.getByLabel('家畜上一帧', { exact: true }).click();
    await page.waitForFunction(p => Math.abs(window.__LIVESTOCK_REVIEW__.snapshot().phase - p) < .001, frozen.phase);
    await page.getByTestId('livestock-play').click();
    await page.waitForFunction(p => window.__LIVESTOCK_REVIEW__.snapshot().phase > p + .01, frozen.phase); await pause();
    await page.getByLabel('家畜循环播放', { exact: true }).uncheck(); await setPhase(.99);
    await page.getByTestId('livestock-play').click(); await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().finished);
    assert.equal((await snap()).phase, 1); assert.equal((await snap()).motion, 'sleep');
    await page.waitForTimeout(100); assert.equal((await snap()).phase, 1); assert.equal((await snap()).playing, false);
    await page.getByLabel('家畜循环播放', { exact: true }).check(); await setPhase(.99);
    await page.getByTestId('livestock-play').click();
    await page.waitForFunction(() => { const s = window.__LIVESTOCK_REVIEW__.snapshot(); return s.playing && s.phase < .2; });
    await pause(); await setPhase(.5);
    controls.push({ animal, sleepToIdleAndBack: true, pauseResume: true, nextPreviousFrame: true, seek: true, loopBoundary: true, lastFrameHold: true });
    await page.getByTestId('livestock-lod-auto').click();
    for (const count of [1, 10, 50, 100, 500]) {
      await page.getByTestId(`livestock-count-${count}`).click(); await page.waitForFunction(n => window.__LIVESTOCK_REVIEW__.snapshot().count === n, count);
      await selectSleep(); const s = await snap();
      assert.equal(s.count, count); assert.equal(s.motion, 'sleep'); assert.equal(s.mixed, false); assert.equal(s.modelTriangles, s.triangles * count);
      assert(s.batches > 0 && s.batches <= 8); counts.push({ animal, count, lod: s.lod, modelTriangles: s.modelTriangles, batches: s.batches, cachedPoses: s.cachedPoses });
      if (count === 100) { await page.getByTestId('livestock-view-farm').click(); await shot(`${animal}-sleep-100.png`); }
    }
    for (let i = 0; i < 3; i++) {
      await page.getByTestId(`livestock-lod-lod${i}`).click(); await page.waitForFunction(lod => window.__LIVESTOCK_REVIEW__.snapshot().lod === lod, `lod${i}`);
      const s = await snap(); assert.equal(s.count, 500); assert.equal(s.motion, 'sleep'); assert.equal(s.modelTriangles, 500 * budgets[i]); assert(s.batches <= 8);
    }
    const beforeWarm = await snap();
    // GPU几何统计在首次绘制时才登记；先显示待测帧，再重复同一组真实控件输入检查平台期。
    // CPU姿态缓存从首次访问LOD即完整创建，因此两轮都不允许继续增加。
    for (const phase of [.1, .4, .7]) await setPhase(phase);
    const warm = await snap(); assert.equal(warm.cachedPoses, beforeWarm.cachedPoses);
    for (const phase of [.1, .4, .7]) await setPhase(phase);
    const stable = await snap(); assert.equal(stable.cachedPoses, warm.cachedPoses); assert.equal(stable.geometries, warm.geometries); assert.equal(stable.rendererId, warm.rendererId);
    // 显式睡眠的栏目往返恢复，不应回到日常混合。
    const beforeNav = await snap(); await page.getByTestId('animal-mode-horse').click(); await page.waitForFunction(() => !!window.__MOUNT_REVIEW__);
    await page.getByTestId('animal-mode-livestock').click(); await ready(animal); const restored = await snap();
    for (const key of ['animal', 'surface', 'motion', 'count', 'mixed', 'playing', 'seed', 'lod']) assert.equal(restored[key], beforeNav[key]);
    assert(Math.abs(restored.phase - beforeNav.phase) < 1e-6); assert.deepEqual(restored.camera, beforeNav.camera);
    if (animal === 'duck_domestic_brown' || animal === 'goose_domestic_white') {
      await page.getByTestId('livestock-surface-water').click();
      await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().surface === 'water');
      assert.equal((await snap()).motion, 'idle_water'); assert.equal(await page.getByTestId('livestock-motion-sleep').count(), 0);
      await page.goto(`${base}/?lab=livestock&animal=${animal}&surface=water&clip=sleep&paused=1`, { waitUntil: 'networkidle' }); await ready(animal);
      assert.equal((await snap()).motion, 'idle_water'); assert.equal(await page.getByTestId('livestock-motion-sleep').count(), 0);
    }
  }
  // 六种家畜保留共同sleep语义，使用各自真实骨架；猪→狗→猪往返不能复用错误Pose。
  await page.goto(`${base}/?lab=livestock&animal=chicken_brown&clip=sleep&paused=1&phase=.37`, { waitUntil: 'networkidle' }); await ready('chicken_brown');
  const renderer = (await snap()).rendererId;
  for (const [animal] of species) {
    await page.getByLabel('家畜种类', { exact: true }).selectOption(animal); await ready(animal);
    const s = await snap(); assert.equal(s.motion, 'sleep'); assert.equal(s.rendererId, renderer); assert(Math.abs(s.phase - .37) < 1e-6);
  }
  await page.getByTestId('livestock-count-100').click(); await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().count === 100);
  await selectSleep(); await page.getByTestId('livestock-lod-lod1').click(); await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().lod === 'lod1');
  const warmSpecies = new Map();
  for (let round = 0; round < 3; round++) for (const animal of ['pig_domestic_black', 'dog_rural_yellow', 'pig_domestic_black', 'cat_rural_orange', 'dog_rural_yellow', 'cat_rural_orange', 'pig_domestic_black']) {
    await page.getByLabel('家畜种类', { exact: true }).selectOption(animal); await ready(animal); await page.waitForTimeout(100);
    const s = await snap(); assert.equal(s.motion, 'sleep'); assert.equal(s.mixed, false); assert.equal(s.count, 100); assert.equal(s.rendererId, renderer); assert.equal(s.bones, 9);
    assert(Math.abs(s.phase - .5) < 1e-6); assert.equal(s.triangles, ({ pig_domestic_black: 138, dog_rural_yellow: 142, cat_rural_orange: 146 })[animal]); assert.equal(await page.locator('canvas').count(), 1);
    if (warmSpecies.has(animal)) { const warm = warmSpecies.get(animal); assert.equal(s.cachedPoses, warm.cachedPoses); assert.equal(s.geometries, warm.geometries); }
    warmSpecies.set(animal, s); switches.push({ round, animal, rendererId: s.rendererId, cachedPoses: s.cachedPoses, geometries: s.geometries });
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('wanhu.character.wardrobe.v5')), wardrobe);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (screenshots) {
    const context = await page.context().browser().newContext({ viewport: { width: 1740, height: 790 }, deviceScaleFactor: 1 });
    try {
      const sheet = await context.newPage();
      for (const strip of strips) {
        for (const c of strip.comparisons) { assert.deepEqual(c.camera, strip.comparisons[0].camera); assert.deepEqual(c.clip, strip.comparisons[0].clip); }
        await sheet.setContent(`<!doctype html><html lang="zh"><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#19292c;color:#e7e3d8;font-family:'Noto Sans CJK SC',sans-serif}h1{font-size:24px;font-weight:500;margin:0 0 12px}p{font-size:14px}.row{display:flex;gap:12px}.card{flex:1;min-width:0;border:1px solid #53645c}.card header{padding:14px;background:#243639}.card img{width:100%;display:block}</style><h1>${strip.label} · 陆地睡眠三档对照</h1><p>真实 WebGL · 同相机、同相位、同裁切尺度 · 沿用原骨架与作者网格</p><div class="row">${strip.comparisons.map(c => `<div class="card"><header>${c.lod.toUpperCase()} · ${c.triangles} tris</header><img src="data:image/png;base64,${c.png.toString('base64')}"></div>`).join('')}</div></html>`);
        await sheet.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
        const name = `${strip.animal}-sleep-lods.png`; await sheet.screenshot({ path: `review/livestock/${name}`, fullPage: true }); images.push({ name });
      }
    } finally { await context.close(); }
  }
  const report = { result: 'passed', sourceSHA: process.env.REVIEW_HEAD_SHA ?? 'local', cases, counts, controls, switches, images, screenshots };
  writeFileSync(`${dir}/livestock-sleep-browser.json`, JSON.stringify(report, null, 2));
  console.log(`Livestock sleep desktop checks passed: ${cases.length} LOD cases, ${counts.length} crowd cases, playback, water exclusion and lifecycle.`);
}
