import assert from 'node:assert/strict';
import { join } from 'node:path';

/** 复用原军人浏览器、页面、运行时 Canvas 与时间控件；普通模式不截图。 */
export async function checkSoldierIdentities(ctx) {
  const { page, browser, base, capture, dir, recipe, state, sync, motionReady, seek, shot, checks, images, styles } = ctx;
  const names = { palace: '皇宫禁卫', frontier: '边疆戍卒', city: '城市守军' };
  const overview = [], roster = [], actions = [];
  const camera = () => page.evaluate(() => window.__WANHU_REVIEW__.cameraState());
  const frame = async (name, label) => {
    await shot(name);
    return capture ? { name, label, bytes: await page.locator('canvas').screenshot() } : null;
  };
  async function sheet(name, title, panels, columns = 2) {
    if (!capture) return;
    const width = columns === 2 ? 1560 : 1860, cell = width / columns;
    const height = 70 + Math.ceil(panels.length / columns) * 540;
    const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await p.setContent(`<html><head><style>body{margin:0;background:#e5e1d8;color:#252723;font:22px sans-serif}h1{font-size:26px;height:50px;margin:0;padding:20px 24px 0;box-sizing:border-box}.grid{display:grid;grid-template-columns:repeat(${columns},${cell}px)}figure{margin:12px}figcaption{text-align:center;height:38px;line-height:38px}img{display:block;width:100%;height:478px;object-fit:contain}</style></head><body><h1>${title}</h1><div class="grid">${panels.map(x => `<figure><figcaption>${x.label}</figcaption><img src="data:image/png;base64,${x.bytes.toString('base64')}"></figure>`).join('')}</div></body></html>`);
    await p.locator('img').evaluateAll(items => Promise.all(items.map(i => i.decode())));
    await p.screenshot({ path: join(dir, name) }); await p.close();
    images.push({ name, sources: panels.map(x => x.name), composition: 'Labeled layout of unchanged real WebGL captures from the original application canvas.' });
  }
  async function open(url) {
    await page.goto(base + '/?' + url);
    await page.waitForFunction(() => !!window.__WANHU_REVIEW__ && !!window.__WANHU_RECIPE__);
    await sync();
  }
  async function identity(value, expected) {
    await page.getByTestId('soldier-identity-' + value).click();
    await page.waitForFunction(h => window.__WANHU_RECIPE__().slots.headwear === h, expected);
    await sync();
    assert.equal(await page.getByTestId('soldier-identity-' + value).getAttribute('aria-pressed'), 'true');
  }

  for (const style of styles) {
    const captain = style.id + '_captain_helmet';
    await open(`review=1&pose=bind&paused=1&view=free&soldier=${style.id}`);
    assert.equal((await recipe()).slots.headwear, style.helmet);
    assert((await page.getByLabel('头饰', { exact: true }).locator('option').evaluateAll(x => x.map(o => o.value))).includes(captain));
    const original = await recipe(), originalCamera = await camera();
    const normal = await frame(`${style.id}-soldier-identity-free.png`, names[style.id] + ' · 普通士兵');
    await identity('captain', captain);
    const selected = await recipe();
    assert.deepEqual({ ...selected, slots: { ...selected.slots, headwear: original.slots.headwear } }, original);
    assert.deepEqual(await camera(), originalCamera);
    const leader = await frame(`${style.id}-captain-identity-free.png`, names[style.id] + ' · 队长');
    roster.push(normal, leader);
    await sheet(`${style.id}-soldier-vs-captain.png`, names[style.id] + ' · 同机位 / 仅头盔不同', [normal, leader]);
    if (style.id === 'palace') await shot('captain-workbench.png', true);

    // 多角度对比沿用原三视图，不另建人物模型或检查专用渲染器。
    await page.getByRole('button', { name: '三视图', exact: true }).click(); await sync();
    const capThree = await frame(`${style.id}-captain-three-views.png`, '队长 · 正 / 侧 / 背');
    const threeCamera = await camera();
    await identity('soldier', style.helmet);
    assert.deepEqual(await camera(), threeCamera);
    const normalThree = await frame(`${style.id}-soldier-three-views.png`, '普通士兵 · 正 / 侧 / 背');
    await sheet(`${style.id}-identity-three-views.png`, names[style.id] + ' · 多角度对比', [normalThree, capThree]);

    await page.getByRole('button', { name: '经营俯视', exact: true }).click(); await sync();
    const overheadCamera = await camera(); assert(overheadCamera.position[1] > overheadCamera.target[1] + 3);
    const normalTop = await frame(`${style.id}-soldier-identity-overview.png`, names[style.id] + ' · 普通');
    await identity('captain', captain); assert.deepEqual(await camera(), overheadCamera);
    const captainTop = await frame(`${style.id}-captain-identity-overview.png`, names[style.id] + ' · 队长');
    overview.push(normalTop, captainTop);
    await sheet(`${style.id}-identity-overview.png`, names[style.id] + ' · 经营俯视同机位', [normalTop, captainTop]);

    // 真实保存/撤销/恢复与严格文件往返：选择状态必须随头盔恢复，不保存独立 rank 字段。
    await page.getByRole('button', { name: '保存装扮', exact: true }).click();
    const saved = await recipe();
    await identity('soldier', style.helmet);
    await page.getByRole('button', { name: '撤销', exact: true }).click(); await sync();
    assert.deepEqual(await recipe(), saved);
    assert.equal(await page.getByTestId('soldier-identity-captain').getAttribute('aria-pressed'), 'true');
    await page.getByLabel('头饰', { exact: true }).selectOption('none'); await sync();
    assert(await page.getByTestId('soldier-identity-captain').isDisabled());
    await page.getByRole('button', { name: '恢复装扮', exact: true }).click(); await sync(); assert.deepEqual(await recipe(), saved);
    const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: '导出配方', exact: true }).click();
    const stream = await (await downloading).createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const bytes = Buffer.concat(chunks); assert.deepEqual(JSON.parse(bytes), saved);
    await identity('soldier', style.helmet);
    await page.getByLabel('导入配方文件', { exact: true }).setInputFiles({ name: 'captain.json', mimeType: 'application/json', buffer: bytes });
    await page.waitForFunction(h => window.__WANHU_RECIPE__().slots.headwear === h, captain); await sync(); assert.deepEqual(await recipe(), saved);
    assert.equal(await page.getByTestId('soldier-identity-captain').getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: '关闭提示', exact: true }).click();

    // 任意军盔/平民衣裤混搭时切身份不得重置其它槽位或自选染色。
    await page.getByLabel('上衣', { exact: true }).selectOption('work_vest');
    await page.getByLabel('下装', { exact: true }).selectOption('short_trousers');
    await page.getByLabel('右手', { exact: true }).selectOption('none'); await sync();
    const mixed = await recipe(); await identity('soldier', style.helmet);
    const mixedNormal = await recipe();
    assert.deepEqual({ ...mixedNormal, slots: { ...mixedNormal.slots, headwear: mixed.slots.headwear } }, mixed);
    await identity('captain', captain);
    for (const other of styles) {
      await page.getByTestId('soldier-' + other.id).click(); await sync();
      assert.equal((await recipe()).slots.headwear, other.id + '_captain_helmet', '切驻地保留当前队长选择');
    }
    checks.push(style.id + ': identity only changes helmet; three views and overview preserve camera; captain save/undo/restore/export/import; civilian mixing; style changes preserve identity');

    for (const bodyType of ['male', 'female']) {
      await open(`review=1&soldier=${style.id}&soldierRole=captain&bodyType=${bodyType}&motion=jogging&paused=1&rightHand=none&view=free`);
      await motionReady('jogging'); await seek(.375);
      const phase = (await state()).status.phase;
      await identity('soldier', style.helmet); await motionReady('jogging'); assert(Math.abs((await state()).status.phase - phase) < 1e-6);
      await identity('captain', captain); await motionReady('jogging'); assert(Math.abs((await state()).status.phase - phase) < 1e-6);
      await shot(`${style.id}-captain-${bodyType}-jogging.png`);
      const geometry = (await state()).geometry;
      await page.getByLabel('试衣动画', { exact: true }).selectOption('pilot-switches'); await motionReady('pilot-switches'); await seek(.5);
      assert.equal((await state()).geometry, geometry);
      const seated = await frame(`${style.id}-captain-${bodyType}-seated.png`, names[style.id] + ' · ' + (bodyType === 'male' ? '男' : '女') + '队长 / 坐姿');
      actions.push(seated);
      await page.getByLabel('试衣动画', { exact: true }).selectOption('shooting-arrow'); await motionReady('shooting-arrow'); await seek(.5);
      await shot(`${style.id}-captain-${bodyType}-archery.png`);
      checks.push(style.id + '/' + bodyType + ': captain query, paused identity swap, jogging/sitting/archery fitting, unchanged animation geometry and phase');
    }
    await open(`review=1&pose=bind&soldier=${style.id}&soldierRole=invalid`);
    assert.equal((await recipe()).slots.headwear, style.helmet, '非法身份查询回退普通士兵');
    await open(`review=1&pose=bind&soldier=${style.id}&soldierRole=captain&headwear=cloth_wrap`);
    assert.equal((await recipe()).slots.headwear, 'cloth_wrap', '显式单件参数优先于身份预设');
    assert(await page.getByTestId('soldier-identity-captain').isDisabled());
  }
  await sheet('soldier-captain-six-overview.png', '三种驻地 × 两种身份 · 原经营俯视 / 每组左普通右队长', overview, 2);
  await sheet('soldier-captain-six-roster.png', '三种驻地 × 两种身份 · 每组左普通右队长', roster, 2);
  await sheet('captain-action-fitting.png', '三种队长 · 男女坐姿试衣 / 原动作与原人物运行时', actions, 2);
}
