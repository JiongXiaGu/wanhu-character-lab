import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

/** 复用现有桌面浏览器和时钟控件；截图只来自显式review，不新增常驻流程。 */
export async function checkGooseBrowser(page,base,dir,screenshots,setPhase) {
  const animal='goose_domestic_white',budgets=[['lod0',154,87],['lod1',82,47],['lod2',44,28]],cases=[],images=[],comparisons=[];
  const snap=()=>page.evaluate(()=>window.__LIVESTOCK_REVIEW__.snapshot());
  const ready=async()=>{await page.waitForFunction(id=>window.__LIVESTOCK_REVIEW__?.snapshot().animal===id,animal);};
  const pause=async()=>{if((await snap()).playing){await page.getByTestId('livestock-play').click();await page.waitForFunction(()=>!window.__LIVESTOCK_REVIEW__.snapshot().playing);}};
  const shot=async name=>{if(!screenshots)return;await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(100);await page.screenshot({path:`review/livestock/${name}`,fullPage:true});images.push({name,...await snap()});};
  const wardrobe=await page.evaluate(()=>localStorage.getItem('wanhu.character.wardrobe.v5'));
  assert.deepEqual(await page.getByLabel('家畜种类',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(n=>n.value)),['chicken_brown','duck_domestic_brown',animal]);
  for(const [lod,triangles,logicalVertices] of budgets) {
    await page.goto(`${base}/?lab=livestock&animal=${animal}&lod=${lod}&clip=idle_land&phase=.5&paused=1&view=three`,{waitUntil:'networkidle'});await ready();
    const initial=await snap();assert.equal(initial.bones,7);assert.equal(initial.triangles,triangles);assert.equal(initial.logicalVertices,logicalVertices);
    assert(initial.camera.target[1]>.24,'长颈物种必须适配单只构图');
    assert.equal(await page.locator('canvas').count(),1);
    if(lod==='lod0') {
      await shot('goose-three.png');await page.getByTestId('livestock-view-left').click();await shot('goose-side.png');
      await page.getByTestId('livestock-view-three').click();
      await page.waitForFunction(()=>{const c=window.__LIVESTOCK_REVIEW__.snapshot().camera;return c.position[0]>c.target[0]&&c.position[2]>c.target[2];});
    }
    if(screenshots) {
      await page.evaluate(()=>window.scrollTo(0,0));const box=await page.locator('.livestock-viewport canvas').boundingBox();assert(box);
      const width=Math.min(560,Math.floor(box.width)),height=Math.min(600,Math.floor(box.height));
      const clip={x:Math.round(box.x+(box.width-width)/2),y:Math.round(box.y+(box.height-height)/2),width,height};
      comparisons.push({lod,triangles,camera:(await snap()).camera,clip,png:await page.screenshot({clip})});
    }
    for(const [surface,motions] of [['land',['idle_land','walk','run','graze','threat']],['water',['idle_water','swim','feed_water']]]) {
      await page.getByTestId(`livestock-surface-${surface}`).click();await page.waitForFunction(s=>window.__LIVESTOCK_REVIEW__.snapshot().surface===s,surface);
      assert.equal(await page.locator('.livestock-motions button').count(),motions.length);
      for(const motion of motions) {
        await page.getByTestId(`livestock-motion-${motion}`).click();await page.waitForFunction(m=>window.__LIVESTOCK_REVIEW__.snapshot().motion===m,motion);
        await pause();await setPhase(.5);
        const s=await snap();assert.equal(s.motion,motion);assert.equal(s.bones,7);assert.equal(s.geometryId,initial.geometryId);assert.equal(s.rendererId,initial.rendererId);
        assert.equal(s.triangles,triangles);assert.equal(s.logicalVertices,logicalVertices);assert.equal(s.waterClipped,surface==='water');assert.equal(s.playing,false);assert(Math.abs(s.phase-.5)<.001);
        if(surface==='water')assert.equal(s.waterLevel,.235);
        cases.push({lod,surface,motion,triangles,logicalVertices});
        if(lod==='lod0'&&['walk','graze','threat','swim'].includes(motion)) {
          await page.getByTestId(`livestock-view-${motion==='swim'?'three':'left'}`).click();await shot(`goose-${motion}.png`);
        }
      }
    }
  }
  // 7骨与8骨之间真实切换，保留Renderer、相位、缩放和观察方向；目标高度允许按物种适配。
  const before=await snap();
  const direction=s=>s.camera.position.map((v,i)=>v-s.camera.target[i]);
  await page.getByLabel('家畜种类',{exact:true}).selectOption('duck_domestic_brown');await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().animal==='duck_domestic_brown');
  let s=await snap();assert.equal(s.bones,8);assert.equal(s.motion,'idle_water');assert.equal(s.surface,'water');assert.equal(s.rendererId,before.rendererId);assert.equal(s.phase,before.phase);assert.equal(s.camera.zoom,before.camera.zoom);
  direction(s).forEach((v,i)=>assert(Math.abs(v-direction(before)[i])<1e-8));
  await page.getByLabel('家畜种类',{exact:true}).selectOption('chicken_brown');await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().animal==='chicken_brown');
  s=await snap();assert.equal(s.surface,'land');assert.equal(s.motion,'idle');assert.equal(await page.getByTestId('livestock-environment').count(),0);
  await page.getByLabel('家畜种类',{exact:true}).selectOption(animal);await ready();s=await snap();assert.equal(s.surface,'land');assert.equal(s.motion,'idle_land');
  await page.getByTestId('livestock-motion-threat').click();await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().motion==='threat');await pause();
  await page.getByLabel('家畜循环播放',{exact:true}).uncheck();await setPhase(.99);await page.getByTestId('livestock-play').click();await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().finished);
  assert.equal((await snap()).phase,1);await page.getByLabel('家畜循环播放',{exact:true}).check();await setPhase(.5);
  const counts=[];
  for(const surface of ['land','water']) {
    await page.goto(`${base}/?lab=livestock&animal=${animal}&surface=${surface}&count=10&mixed=1&paused=1&view=farm`,{waitUntil:'networkidle'});await ready();
    for(const count of [10,50,100,500]) {
      await page.getByTestId(`livestock-count-${count}`).click();await page.waitForFunction(n=>window.__LIVESTOCK_REVIEW__.snapshot().count===n,count);await page.waitForTimeout(200);
      s=await snap();assert(s.mixed);assert.equal(s.modelTriangles,s.triangles*count);assert(s.batches>0&&s.batches<=24);assert.equal(s.bones,7);counts.push(s);
      if(count===100)await shot(`goose-${surface}-100.png`);
    }
  }
  const beforeNav=await snap();await page.getByTestId('animal-mode-horse').click();await page.waitForFunction(()=>!!window.__MOUNT_REVIEW__);
  await page.getByTestId('animal-mode-livestock').click();await ready();s=await snap();
  for(const key of ['animal','surface','motion','count','phase','playing','seed','lod'])assert.equal(s[key],beforeNav[key]);assert.deepEqual(s.camera,beforeNav.camera);
  // 真正依次完成水陆往返，不让React批处理把测试消成一次空操作。
  for(const surface of ['land','water']){await page.getByTestId(`livestock-surface-${surface}`).click();await page.waitForFunction(x=>window.__LIVESTOCK_REVIEW__.snapshot().surface===x,surface);}
  const warm=await snap();
  for(let i=0;i<4;i++)for(const surface of ['land','water']){await page.getByTestId(`livestock-surface-${surface}`).click();await page.waitForFunction(x=>window.__LIVESTOCK_REVIEW__.snapshot().surface===x,surface);}
  s=await snap();assert.equal(s.cachedPoses,warm.cachedPoses);assert.equal(s.geometries,warm.geometries);assert.equal(s.rendererId,warm.rendererId);
  for(const query of ['surface=water&clip=graze','surface=water&clip=unknown&lod=unknown&phase=Infinity']) {
    await page.goto(`${base}/?lab=livestock&animal=${animal}&${query}&paused=1`,{waitUntil:'networkidle'});await ready();s=await snap();assert.equal(s.motion,'idle_water');assert.equal(s.surface,'water');assert.equal(s.phase,0);
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('wanhu.character.wardrobe.v5')),wardrobe);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(screenshots) {
    assert.equal(comparisons.length,3);for(const c of comparisons){assert.deepEqual(c.camera,comparisons[0].camera);assert.deepEqual(c.clip,comparisons[0].clip);}
    const context=await page.context().browser().newContext({viewport:{width:1740,height:790},deviceScaleFactor:1});
    try {
      const sheet=await context.newPage();await sheet.setContent(`<!doctype html><html lang="zh"><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#19292c;color:#e7e3d8;font-family:'Noto Sans CJK SC',sans-serif}h1{font-size:24px;font-weight:500;margin:0 0 12px}p{font-size:14px;color:#abbfb6}.row{display:flex;gap:12px}.card{flex:1;min-width:0;border:1px solid #53645c;border-radius:8px;overflow:hidden}.card header{padding:14px;background:#243639;color:#ddc49c}.card img{width:100%;display:block}</style><h1>白色家鹅 · 三档同角度对照</h1><p>同相机、同相位、同裁切尺度 · 三档保留完整长颈 · 无翅膀</p><div class="row">${comparisons.map(c=>`<div class="card"><header>${c.lod.toUpperCase()} · ${c.triangles} tris</header><img src="data:image/png;base64,${c.png.toString('base64')}"></div>`).join('')}</div></html>`);
      await sheet.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await sheet.screenshot({path:'review/livestock/goose-lod-comparison.png',fullPage:true});
    } finally {await context.close();}
  }
  const result={result:'passed',sourceSHA:process.env.REVIEW_HEAD_SHA??'local',animal,bones:7,cases,counts,images,screenshots};writeFileSync(`${dir}/goose-browser.json`,JSON.stringify(result,null,2));
  console.log(`Goose desktop checks passed: ${cases.length} LOD/motion cases, water/land crowds, 7/8-bone switching, playback and lifecycle.`);
}
