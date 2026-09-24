import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

/** 睡眠专项只扩充既有浏览器检查，不创建新页面、Renderer或永久流程。 */
export async function checkPoultrySleepBrowser(page, base, dir, screenshots, setPhase) {
  const species = [
    ['chicken_brown', '鸡', 8, [132, 72, 36]],
    ['duck_domestic_brown', '鸭', 8, [118, 60, 36]],
    ['goose_domestic_white', '鹅', 7, [154, 82, 44]],
  ];
  const snap = () => page.evaluate(() => window.__LIVESTOCK_REVIEW__.snapshot());
  const ready = id => page.waitForFunction(animal => window.__LIVESTOCK_REVIEW__?.snapshot().animal === animal, id);
  const pause = async () => {
    if ((await snap()).playing) await page.getByTestId('livestock-play').click();
    await page.waitForFunction(() => !window.__LIVESTOCK_REVIEW__.snapshot().playing);
  };
  const selectSleep = async () => {
    await page.getByTestId('livestock-motion-sleep').click();
    await page.waitForFunction(() => { const s = window.__LIVESTOCK_REVIEW__.snapshot(); return s.motion === 'sleep' && !s.mixed; });
    await pause(); await setPhase(.5);
  };
  const images = [], cases = [], counts = [], strips = [];
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
    assert.equal(await page.getByTestId('livestock-motion-sleep').textContent(), '睡觉');
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
    await page.getByTestId('livestock-view-left').click(); await shot(`${animal}-sleep-side.png`);
    if (screenshots) strips.push({ animal, label, comparisons });
    // 暂停、定位、继续播放和单次末帧保持均通过真实控件完成。
    await setPhase(.25); const frozen = await snap(); await page.waitForTimeout(200); assert.equal((await snap()).phase, frozen.phase);
    await page.getByTestId('livestock-play').click();
    await page.waitForFunction(p => window.__LIVESTOCK_REVIEW__.snapshot().phase > p + .01, frozen.phase); await pause();
    await page.getByLabel('家畜循环播放', { exact: true }).uncheck(); await setPhase(.99);
    await page.getByTestId('livestock-play').click(); await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().finished);
    assert.equal((await snap()).phase, 1); assert.equal((await snap()).motion, 'sleep');
    await page.getByLabel('家畜循环播放', { exact: true }).check(); await setPhase(.5);
    await page.getByTestId('livestock-lod-auto').click();
    for (const count of [1, 10, 50, 100, 500]) {
      await page.getByTestId(`livestock-count-${count}`).click(); await page.waitForFunction(n => window.__LIVESTOCK_REVIEW__.snapshot().count === n, count);
      await selectSleep(); const s = await snap();
      assert.equal(s.count, count); assert.equal(s.motion, 'sleep'); assert.equal(s.mixed, false); assert.equal(s.modelTriangles, s.triangles * count);
      assert(s.batches > 0 && s.batches <= 8); counts.push({ animal, count, lod: s.lod, modelTriangles: s.modelTriangles, batches: s.batches });
      if (count === 100) { await page.getByTestId('livestock-view-farm').click(); await shot(`${animal}-sleep-100.png`); }
    }
    const warm = await snap();
    for (const phase of [.1, .4, .7]) await setPhase(phase);
    const stable = await snap(); assert.equal(stable.cachedPoses, warm.cachedPoses); assert.equal(stable.geometries, warm.geometries); assert.equal(stable.rendererId, warm.rendererId);
    // 显式睡眠的栏目往返恢复，不应回到日常混合。
    const beforeNav = await snap(); await page.getByTestId('animal-mode-horse').click(); await page.waitForFunction(() => !!window.__MOUNT_REVIEW__);
    await page.getByTestId('animal-mode-livestock').click(); await ready(animal); const restored = await snap();
    for (const key of ['animal', 'surface', 'motion', 'count', 'mixed', 'playing', 'seed', 'lod']) assert.equal(restored[key], beforeNav[key]);
    assert(Math.abs(restored.phase - beforeNav.phase) < 1e-6); assert.deepEqual(restored.camera, beforeNav.camera);
    if (animal !== 'chicken_brown') {
      await page.getByTestId('livestock-surface-water').click();
      await page.waitForFunction(() => window.__LIVESTOCK_REVIEW__.snapshot().surface === 'water');
      assert.equal((await snap()).motion, 'idle_water'); assert.equal(await page.getByTestId('livestock-motion-sleep').count(), 0);
      await page.goto(`${base}/?lab=livestock&animal=${animal}&surface=water&clip=sleep&paused=1`, { waitUntil: 'networkidle' }); await ready(animal);
      assert.equal((await snap()).motion, 'idle_water'); assert.equal(await page.getByTestId('livestock-motion-sleep').count(), 0);
    }
  }
  // 相同睡眠语义可在三种家禽间保留；猪犬回退到自己的默认停驻。
  await page.goto(`${base}/?lab=livestock&animal=chicken_brown&clip=sleep&paused=1&phase=.37`, { waitUntil: 'networkidle' }); await ready('chicken_brown');
  const renderer = (await snap()).rendererId;
  for (const [animal] of species) {
    await page.getByLabel('家畜种类', { exact: true }).selectOption(animal); await ready(animal);
    const s = await snap(); assert.equal(s.motion, 'sleep'); assert.equal(s.rendererId, renderer); assert(Math.abs(s.phase - .37) < 1e-6);
  }
  for (const animal of ['pig_domestic_black', 'dog_rural_yellow']) {
    await page.getByLabel('家畜种类', { exact: true }).selectOption(animal); await ready(animal);
    assert.equal((await snap()).motion, 'idle'); assert.equal(await page.getByTestId('livestock-motion-sleep').count(), 0);
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
  const report = { result: 'passed', sourceSHA: process.env.REVIEW_HEAD_SHA ?? 'local', cases, counts, images, screenshots };
  writeFileSync(`${dir}/poultry-sleep-browser.json`, JSON.stringify(report, null, 2));
  console.log(`Poultry sleep desktop checks passed: ${cases.length} LOD cases, ${counts.length} crowd cases, playback, water exclusion and lifecycle.`);
}
