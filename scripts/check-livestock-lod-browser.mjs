import assert from 'node:assert/strict';

/** 在正式家畜页取图，模型、镜头和动画均走运行时路径；只在测试页排版真实截图。 */
export async function checkConnectedLodBrowser(page, base, screenshots) {
  const snapshots = [], images = { idle: [], peck: [] };
  const snap = () => page.evaluate(() => window.__LIVESTOCK_REVIEW__.snapshot());
  const budgets = [['lod0', 140], ['lod1', 56], ['lod2', 28]];
  for (const [motion, phase, view] of [['idle', .15, 'three'], ['peck', .45, 'left']]) {
    let camera, crop;
    for (const [lod, triangles] of budgets) {
      await page.goto(`${base}/?lab=livestock&count=1&paused=1&view=${view}&clip=${motion}&phase=${phase}&lod=${lod}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(([id, t]) => { const s = window.__LIVESTOCK_REVIEW__?.snapshot(); return s?.lod === id && s.triangles === t; }, [lod, triangles]);
      await page.waitForTimeout(220);
      const state = await snap();
      assert.equal(state.motion, motion); assert.equal(state.playing, false); assert(Math.abs(state.phase - phase) < 1e-8);
      if (camera) assert.deepEqual(state.camera, camera, 'LOD对照镜头/缩放不一致'); else camera = state.camera;
      const id = state.geometryId;
      // 固定LOD往返只换已创建资产，暂停时间与相机不变。
      for (const other of [lod === 'lod2' ? 'lod1' : 'lod2', lod]) {
        await page.getByTestId(`livestock-lod-${other}`).click();
        await page.waitForFunction(value => window.__LIVESTOCK_REVIEW__.snapshot().lod === value, other);
        const switched = await snap(); assert(Math.abs(switched.phase - phase) < 1e-8); assert.equal(switched.playing, false); assert.deepEqual(switched.camera, camera);
      }
      assert.equal((await snap()).geometryId, id, '固定档往返重建了几何');
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
      const box = await page.locator('[data-testid="livestock-viewport"] canvas').boundingBox(); assert(box);
      const width = Math.min(560, Math.floor(box.width)), height = Math.min(460, Math.floor(box.height));
      const clip = { x: Math.round(box.x + (box.width - width) / 2), y: Math.round(box.y + (box.height - height) / 2), width, height };
      if (crop) assert.deepEqual(clip, crop, '对照截图裁切尺度不一致'); else crop = clip;
      snapshots.push({ motion, phase, view, lod, triangles, camera, crop: clip });
      if (screenshots) images[motion].push(await page.screenshot({ clip }));
    }
  }
  if (screenshots) {
    const sheet = await page.context().newPage(); await sheet.setViewportSize({ width: 1600, height: 640 });
    try {
      for (const [motion, title, filename] of [['idle', '停驻 · 三档同角度对照', '05-chicken-lod-comparison.png'], ['peck', '啄食最低点 · 三档侧面对照', '06-chicken-lod-peck-comparison.png']]) {
        await sheet.setContent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
          *{box-sizing:border-box}body{margin:0;background:#19292c;color:#e7e3d8;font-family:'Noto Sans CJK SC','Noto Sans SC',sans-serif;padding:26px 24px}
          h1{font-size:24px;font-weight:500;margin:0 0 8px}p{font-size:12px;color:#aebcb8;margin:0 0 22px}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
          article{border:1px solid #526157;border-radius:8px;overflow:hidden;background:#23363a}header{padding:14px 16px;display:flex;justify-content:space-between;align-items:center}b{font-size:18px;font-weight:500;color:#dfc89f}span{font-size:12px;color:#c9cdbd}
          img{display:block;width:100%;height:auto}footer{font-size:12px;color:#aebcb8;margin-top:17px}
          </style></head><body><h1>${title}</h1><p>同一正式运行时 · 同相机、同相位、同一裁切尺度 · LOD0 保持原样</p><div class="row">${budgets.map(([lod, triangles], i) => `<article><header><b>${lod.toUpperCase()}</b><span>${triangles} tris · ${i === 0 ? '原版基准' : i === 1 ? '保留脖子，删眼睛与肉垂' : '连续头颈，取消头部附件'}</span></header><img src="data:image/png;base64,${images[motion][i].toString('base64')}" alt="${lod}"></article>`).join('')}</div><footer>LOD1 / LOD2 的头、颈、身体由共用顶点和连接面组成，不依赖独立小壳碰巧重叠。</footer></body></html>`);
        await sheet.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
        await sheet.screenshot({ path: `review/livestock/${filename}`, fullPage: true });
      }
    } finally { await sheet.close(); }
  }
  return snapshots;
}
