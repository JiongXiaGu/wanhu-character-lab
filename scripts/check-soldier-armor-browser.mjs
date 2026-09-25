import assert from 'node:assert/strict';
import { join } from 'node:path';

/** 只操作原工坊控件和原 WebGL Canvas；合成页只排列捕获帧，不创建第二套人物或渲染器。 */
export async function checkSoldierArmor(ctx) {
  const { page, browser, base, capture, dir, recipe, state, sync, motionReady, seek, shot, checks, images } = ctx;
  const tiers = [
    { id: 'light', name: '轻甲 · Light', top: 'city_guard_brigandine', bottom: 'city_guard_trousers' },
    { id: 'medium', name: '中甲 · Medium', top: 'medium_armor', bottom: 'medium_armor_skirt' },
    { id: 'heavy', name: '重甲 · Heavy', top: 'heavy_armor', bottom: 'heavy_armor_skirt' },
  ];
  const camera = () => page.evaluate(() => window.__WANHU_REVIEW__.cameraState());
  async function open(query) {
    await page.goto(base + '/?' + query);
    await page.waitForFunction(() => !!window.__WANHU_REVIEW__ && !!window.__WANHU_RECIPE__);
    await sync();
  }
  async function tier(id) {
    const expected = tiers.find(t => t.id === id);
    await page.getByTestId('soldier-armor-' + id).click();
    await page.waitForFunction(top => window.__WANHU_RECIPE__().slots.top === top, expected.top);
    await sync();
    const r = await recipe(); assert.equal(r.slots.bottom, expected.bottom);
    for (const item of tiers) assert.equal(await page.getByTestId('soldier-armor-' + item.id).getAttribute('aria-pressed'), String(item.id === id));
  }
  async function frame(name, label) {
    await shot(name);
    return capture ? { name, label, bytes: await page.locator('canvas').screenshot() } : null;
  }
  async function sheet(name, title, panels, columns = 3) {
    if (!capture) return;
    const width = columns * 640, height = 70 + Math.ceil(panels.length / columns) * 650;
    const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await p.setContent(`<html><head><style>body{margin:0;background:#e5e1d8;color:#252723;font:22px sans-serif}h1{font-size:26px;height:70px;margin:0;padding:20px 24px;box-sizing:border-box}.grid{display:grid;grid-template-columns:repeat(${columns},640px)}figure{margin:12px}figcaption{text-align:center;height:40px;line-height:40px}img{display:block;width:616px;height:586px;object-fit:contain}</style></head><body><h1>${title}</h1><div class="grid">${panels.map(p => `<figure><figcaption>${p.label}</figcaption><img src="data:image/png;base64,${p.bytes.toString('base64')}"></figure>`).join('')}</div></body></html>`);
    await p.locator('img').evaluateAll(nodes => Promise.all(nodes.map(i => i.decode())));
    await p.screenshot({ path: join(dir, name) }); await p.close();
    images.push({ name, sources: panels.map(p => p.name), composition: 'Unchanged real WebGL captures, labels only; identical camera verified within tier comparisons.' });
  }
  const unchangedExceptArmor = (before, after) => assert.deepEqual({ ...after, slots: { ...after.slots, top: before.slots.top, bottom: before.slots.bottom } }, before);
  await open('review=1&pose=bind&paused=1&view=free&soldier=palace&bodyType=male&rightHand=none');
  for (const key of ['上衣', '下装']) {
    const available = await page.getByLabel(key, { exact: true }).locator('option').evaluateAll(n => n.map(o => o.value));
    assert(available.includes(key === '上衣' ? 'heavy_armor' : 'heavy_armor_skirt'));
  }
  // 核心对比：身体、头盔、发型、染色、姿态和相机完全相同，只换 top/bottom。
  for (const [view, label] of [['free', '自由'], ['overview', '经营俯视']]) {
    await page.getByRole('button', { name: label, exact: true }).click(); await sync();
    const fixedCamera = await camera(), fixedRecipe = await recipe(), panels = [];
    for (const item of tiers) {
      await tier(item.id); unchangedExceptArmor(fixedRecipe, await recipe());
      assert.deepEqual(await camera(), fixedCamera);
      panels.push(await frame(`armor-${item.id}-${view}.png`, item.name));
    }
    if (view === 'overview') assert(fixedCamera.position[1] > fixedCamera.target[1] + 3);
    await sheet(`armor-light-medium-heavy-${view}.png`, `同身体 / 同配色 / 同姿态 / 同机位 · ${label}`, panels);
  }
  checks.push('S6: Light/Medium/Heavy real same-camera bind and management-overview comparison; only top/bottom change; actual selected slots and three-state UI agree');
  const heavyViews = [];
  for (const [view, label] of [['front', '正面'], ['side', '侧面'], ['back', '背面']]) {
    await page.getByRole('button', { name: label, exact: true }).click(); await sync();
    heavyViews.push(await frame(`heavy-${view}.png`, '重甲 · ' + label));
  }
  await sheet('heavy-front-side-back.png', '共享 Heavy · 原正 / 侧 / 背相机', heavyViews);
  await page.getByRole('button', { name: '自由', exact: true }).click(); await sync();
  await shot('heavy-workbench.png', true);

  async function garmentSignature() {
    return page.evaluate(async () => {
      const { makeCharacter } = await import('/src/character/v3/outfit.ts');
      const c = makeCharacter(window.__WANHU_RECIPE__()).surface;
      const keep = id => id.startsWith('Top.') || id.startsWith('HeavyArmorSkirt.') || id.startsWith('HeavyArmorLiner.');
      return { vertices: c.vertices.filter(v => keep(v.id)), faces: c.faces.filter(f => f.v.every(i => keep(c.vertices[i].id))).map(f => ({ v: f.v.map(i => c.vertices[i].id), region: f.region, part: f.part })) };
    });
  }
  const heavyGeometry = await garmentSignature(), colorCamera = await camera(), colors = [];
  for (const style of ['palace', 'frontier', 'city']) {
    const before = await recipe();
    await page.getByTestId('soldier-' + style).click(); await sync();
    const after = await recipe();
    assert.deepEqual({ ...after.slots, headwear: before.slots.headwear }, before.slots);
    assert.deepEqual(await garmentSignature(), heavyGeometry); assert.deepEqual(await camera(), colorCamera);
    assert.equal(await page.getByTestId('soldier-armor-heavy').getAttribute('aria-pressed'), 'true');
    colors.push(await frame(`heavy-${style}-palette.png`, `同一 Heavy · ${style}`));
  }
  await sheet('heavy-shared-palettes.png', '同一重甲几何 · 三驻地配色与头盔', colors);
  checks.push('S6: exact heavy authored vertices/topology/weights equal across palace/frontier/city; changing style preserves armor/equipment and camera');

  const beforeIdentity = await recipe();
  await page.getByTestId('soldier-identity-captain').click(); await sync();
  const saved = await recipe();
  assert.deepEqual({ ...saved, slots: { ...saved.slots, headwear: beforeIdentity.slots.headwear } }, beforeIdentity);
  await page.getByRole('button', { name: '保存装扮', exact: true }).click();
  await tier('light'); await page.getByRole('button', { name: '撤销', exact: true }).click(); await sync(); assert.deepEqual(await recipe(), saved);
  assert.equal(await page.getByTestId('soldier-armor-heavy').getAttribute('aria-pressed'), 'true');
  await tier('medium'); await page.getByRole('button', { name: '恢复装扮', exact: true }).click(); await sync(); assert.deepEqual(await recipe(), saved);
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: '导出配方', exact: true }).click();
  const stream = await (await downloading).createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks); assert.deepEqual(JSON.parse(bytes), saved); assert.equal(Object.keys(saved).length, 6); assert.equal(Object.keys(saved.slots).length, 7);
  await page.getByLabel('下装', { exact: true }).selectOption('work_pants'); await sync();
  for (const item of tiers) assert.equal(await page.getByTestId('soldier-armor-' + item.id).getAttribute('aria-pressed'), 'false');
  const mixed = await recipe(); await page.getByTestId('soldier-frontier').click(); await sync();
  assert.deepEqual({ ...(await recipe()).slots, headwear: mixed.slots.headwear }, mixed.slots, '驻地不得覆盖混搭下装');
  await page.getByLabel('导入配方文件', { exact: true }).setInputFiles({ name: 'heavy.json', mimeType: 'application/json', buffer: bytes });
  await page.waitForFunction(() => window.__WANHU_RECIPE__().slots.bottom === 'heavy_armor_skirt'); await sync(); assert.deepEqual(await recipe(), saved);
  assert.equal(await page.getByTestId('soldier-armor-heavy').getAttribute('aria-pressed'), 'true');
  for (const bad of [{ ...saved, armorClass: 'heavy' }, { ...saved, slots: { ...saved.slots, top: 'palace_guard_armor' } }]) {
    await page.getByLabel('导入配方文件', { exact: true }).setInputFiles({ name: 'invalid-heavy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
    await page.locator('.notice-error').waitFor({ state: 'visible' }); assert.deepEqual(await recipe(), saved);
    await page.getByRole('button', { name: '关闭提示', exact: true }).click();
  }
  checks.push('S6: heavy V5 save/restore/undo/export/import; derived armor state follows real slots and clears on mixing; captain switch only changes helmet; extra armor field and retired IDs rejected');

  const actionPanels = [];
  for (const bodyType of ['male', 'female']) {
    await open(`review=1&soldier=palace&armorClass=heavy&bodyType=${bodyType}&motion=jogging&paused=1&rightHand=none&view=free`);
    await motionReady('jogging'); await seek(.375);
    assert.equal((await recipe()).slots.top, 'heavy_armor');
    const geometry = (await state()).geometry;
    for (const [motion, phase, label] of [['jogging', .375, '慢跑'], ['pilot-switches', .5, '坐姿'], ['shooting-arrow', .5, '射箭']]) {
      await page.getByLabel('试衣动画', { exact: true }).selectOption(motion); await motionReady(motion); await seek(phase);
      assert.equal((await state()).geometry, geometry, '只切动作不得重建重甲几何');
      const pose = (await state()).status.phase;
      await page.getByTestId('soldier-identity-captain').click(); await motionReady(motion); assert(Math.abs((await state()).status.phase - pose) < 1e-6);
      await page.getByTestId('soldier-identity-soldier').click(); await motionReady(motion); assert(Math.abs((await state()).status.phase - pose) < 1e-6);
      actionPanels.push(await frame(`heavy-${bodyType}-${motion}.png`, `${bodyType === 'male' ? '男' : '女'} · ${label}`));
      // 正面补图用于检查腋下、坐姿腰胯和两腿出口，不改变原相机定义。
      await page.getByRole('button', { name: '正面', exact: true }).click(); await sync(); await shot(`heavy-${bodyType}-${motion}-front.png`);
      await page.getByRole('button', { name: '自由', exact: true }).click(); await sync();
      // 换头盔会重建外观；后续动作比较使用当前实际几何身份。
      if (motion !== 'shooting-arrow') break;
    }
    // 独立动作轮换保持同一重甲/头盔，不让上面的身份换装影响几何复用断言。
    const fixedGeometry = (await state()).geometry;
    for (const [motion, phase, label] of [['pilot-switches', .5, '坐姿'], ['shooting-arrow', .5, '射箭']]) {
      await page.getByLabel('试衣动画', { exact: true }).selectOption(motion); await motionReady(motion); await seek(phase);
      assert.equal((await state()).geometry, fixedGeometry);
      actionPanels.push(await frame(`heavy-${bodyType}-${motion}.png`, `${bodyType === 'male' ? '男' : '女'} · ${label}`));
      await page.getByRole('button', { name: '正面', exact: true }).click(); await sync(); await shot(`heavy-${bodyType}-${motion}-front.png`);
      await page.getByRole('button', { name: '自由', exact: true }).click(); await sync();
    }
    checks.push(`S6/${bodyType}: actual heavy jogging, Pilot Flips Switches sitting and shooting-arrow; front and free views; paused identity changes retain phase; motion changes reuse geometry`);
  }
  await sheet('heavy-male-female-actions.png', '共享重甲 · 男女动作试衣 / 原 WebGL Canvas', actionPanels, 3);
  await open('review=1&pose=bind&soldier=palace&armorClass=invalid'); assert.equal((await recipe()).slots.top, 'medium_armor');
  await open('review=1&pose=bind&soldier=palace&armorClass=heavy&top=work_vest');
  assert.equal((await recipe()).slots.top, 'work_vest'); assert.equal((await recipe()).slots.bottom, 'heavy_armor_skirt');
  for (const item of tiers) assert.equal(await page.getByTestId('soldier-armor-' + item.id).getAttribute('aria-pressed'), 'false');
  checks.push('S6: unknown armor query does not change default loadout; explicit slot query takes precedence over armor preset');
}
