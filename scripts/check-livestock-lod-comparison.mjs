import assert from 'node:assert/strict';

/** 从正式家畜页取图；三档相机、相位和裁切必须一致，测试页仅排版真实WebGL截图。 */
export async function captureLodComparison(page, base) {
  const snapshots = [], images = { idle: [], peck: [] };
  const budgets = [['lod0', 140, 100], ['lod1', 72, 46], ['lod2', 36, 26]];
  for (const [motion, phase, view] of [['idle', .15, 'three'], ['peck', .45, 'left']]) {
    let camera, crop;
    for (const [lod, triangles, logicalVertices] of budgets) {
      await page.goto(`${base}/?lab=livestock&count=1&paused=1&view=${view}&clip=${motion}&phase=${phase}&lod=${lod}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(id => window.__LIVESTOCK_REVIEW__?.snapshot().lod === id, lod);
      await page.waitForTimeout(200);
      const state = await page.evaluate(() => window.__LIVESTOCK_REVIEW__.snapshot());
      assert.equal(state.triangles, triangles); assert.equal(state.logicalVertices, logicalVertices);
      assert.equal(state.motion, motion); assert.equal(state.playing, false); assert(Math.abs(state.phase - phase) < 1e-8);
      if (camera) assert.deepEqual(state.camera, camera, '三档对照的镜头/缩放不一致'); else camera = state.camera;
      await page.evaluate(() => window.scrollTo(0, 0));
      const box = await page.locator('.livestock-viewport canvas').boundingBox(); assert(box);
      const width = Math.min(560, Math.floor(box.width)), height = Math.min(460, Math.floor(box.height));
      const clip = { x: Math.round(box.x + (box.width - width) / 2), y: Math.round(box.y + (box.height - height) / 2), width, height };
      if (crop) assert.deepEqual(clip, crop, '三档对照的裁切尺度不一致'); else crop = clip;
      snapshots.push({ motion, phase, view, lod, triangles, logicalVertices, camera, crop: clip });
      images[motion].push(await page.screenshot({ clip }));
    }
  }
  // browser.newPage()拥有的快捷上下文只能有一页；拼版显式拥有并释放独立上下文。
  const browser = page.context().browser(); assert(browser, '截图浏览器已关闭');
  const context = await browser.newContext({ viewport: { width: 1600, height: 640 }, deviceScaleFactor: 1 });
  try {
    const sheet = await context.newPage();
    for (const [motion, title, filename] of [['idle', '停驻 · 三档同角度对照', '09-lod-comparison.png'], ['peck', '啄食最低点 · 三档侧面对照', '10-lod-peck-comparison.png']]) {
      await sheet.setContent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
        *{box-sizing:border-box}body{margin:0;background:#19292c;color:#e7e3d8;font-family:'Noto Sans CJK SC','Noto Sans SC',sans-serif;padding:26px 24px}
        h1{font-size:24px;font-weight:500;margin:0 0 8px}p{font-size:12px;color:#aebcb8;margin:0 0 22px}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        article{border:1px solid #526157;border-radius:8px;overflow:hidden;background:#23363a}header{padding:14px 16px;display:flex;justify-content:space-between;align-items:center}b{font-size:18px;font-weight:500;color:#dfc89f}span{font-size:12px;color:#c9cdbd}
        img{display:block;width:100%;height:auto}footer{font-size:12px;color:#aebcb8;margin-top:17px}
        </style></head><body><h1>${title}</h1><p>同一正式运行时 · 同相机、同相位、同一裁切尺度 · LOD0 保持原样</p><div class="row">${budgets.map(([lod, triangles], i) => `<article><header><b>${lod.toUpperCase()}</b><span>${triangles} tris · ${i === 0 ? '原版基准' : i === 1 ? '连续头颈，简化头部细节' : '连续主体，无头部附件'}</span></header><img src="data:image/png;base64,${images[motion][i].toString('base64')}" alt="${lod}"></article>`).join('')}</div><footer>低档的身体、脖子、头与喙是一个共用接口顶点的闭合主体，不是悬空小块。</footer></body></html>`);
      await sheet.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
      await sheet.screenshot({ path: `review/livestock/${filename}`, fullPage: true });
    }
  } finally { await context.close(); }
  return snapshots;
}
