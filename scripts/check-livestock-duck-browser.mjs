import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

/** 复用同一个桌面浏览器，保留鸡原回归；只在显式审图时捕获鸭的关键证据。 */
export async function checkDuckBrowser(page, base, dir, screenshots, setPhase) {
  const animal='duck_domestic_brown', cases=[], images=[], comparisons=[], budgets=[['lod0',118,69],['lod1',60,36],['lod2',36,24]];
  const snap=()=>page.evaluate(()=>window.__LIVESTOCK_REVIEW__.snapshot());
  const pause=async()=>{if((await page.getByTestId('livestock-play').innerText()).includes('暂停'))await page.getByTestId('livestock-play').click();};
  const ready=async()=>{await page.waitForFunction(()=>!!window.__LIVESTOCK_REVIEW__);await page.waitForTimeout(220);};
  const image=async(name,full=true)=>{if(!screenshots)return;await page.evaluate(()=>window.scrollTo(0,0)); await page.screenshot({path:`review/livestock/${name}`,fullPage:full});images.push({name,...await snap()});};
  const wardrobe=await page.evaluate(()=>localStorage.getItem('wanhu.character.wardrobe.v5'));
  assert.deepEqual(await page.getByLabel('家畜种类',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(n=>n.value)),['chicken_brown',animal,'goose_domestic_white']);
  for(const [lod,triangles,logicalVertices] of budgets) {
    for(const [surface,motions] of [['land',['idle_land','walk','run','feed_land']],['water',['idle_water','swim','dabble']]]) {
      for(const motion of motions) {
        await page.goto(`${base}/?lab=livestock&animal=${animal}&surface=${surface}&lod=${lod}&clip=${motion}&phase=.5&paused=1&view=three`,{waitUntil:'networkidle'});await ready();
        const s=await snap(); assert.equal(s.animal,animal);assert.equal(s.surface,surface);assert.equal(s.waterClipped,surface==='water');assert.equal(s.motion,motion);assert.equal(s.triangles,triangles);assert.equal(s.logicalVertices,logicalVertices);assert.equal(s.phase,.5);assert.equal(s.playing,false);assert.equal(s.bones,8);
        assert.equal(await page.locator('.livestock-motions button').count(),surface==='land'?4:3);
        assert.equal(await page.getByTestId('livestock-motion-run').count(),surface==='land'?1:0);assert.equal(await page.locator('canvas').count(),1);
        await page.getByTestId('livestock-lod-lod0').click();await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().lod==='lod0');
        await page.getByTestId(`livestock-lod-${lod}`).click();await page.waitForFunction(id=>window.__LIVESTOCK_REVIEW__.snapshot().lod===id,lod);
        const after=await snap();assert.equal(after.geometryId,s.geometryId);assert.equal(after.rendererId,s.rendererId);assert.equal(after.phase,s.phase);assert.deepEqual(after.camera,s.camera);
        cases.push({lod,surface,motion,triangles,logicalVertices});
        if(lod==='lod0'&&['idle_land','run','swim','dabble'].includes(motion))await image(`duck-${motion}.png`);
        if(screenshots&&motion==='idle_land') {
          await page.evaluate(()=>window.scrollTo(0,0)); const box=await page.locator('.livestock-viewport canvas').boundingBox();assert(box);
          const clip={x:Math.round(box.x+(box.width-500)/2),y:Math.round(box.y+(box.height-460)/2),width:500,height:460};
          comparisons.push({lod,triangles,camera:s.camera,clip,png:await page.screenshot({clip})});
        }
      }
    }
  }
  // 水陆和种类切换使用当前Renderer，不写人物衣柜，也不让鸡继承水面动作。
  const before=await snap();
  await page.getByLabel('家畜种类',{exact:true}).selectOption('chicken_brown'); await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().animal==='chicken_brown');
  let s=await snap();assert.equal(s.surface,'land');assert.equal(s.motion,'idle');assert.equal(s.rendererId,before.rendererId);assert.equal(s.phase,before.phase);assert.deepEqual(s.camera,before.camera);assert.equal(await page.getByTestId('livestock-environment').count(),0);
  await page.getByLabel('家畜种类',{exact:true}).selectOption(animal);await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().animal==='duck_domestic_brown');
  await page.getByTestId('livestock-motion-run').click();await pause();await setPhase(.37);const running=await snap();
  await page.getByTestId('livestock-surface-water').click();await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().surface==='water');s=await snap();
  assert.equal(s.motion,'idle_water');assert.equal(s.geometryId,running.geometryId);assert.equal(s.rendererId,running.rendererId);assert(Math.abs(s.phase-running.phase)<1e-9);assert.deepEqual(s.camera,running.camera);assert.equal(s.waterLevel,.185);
  await page.getByLabel('显示水位线',{exact:true}).check();await page.getByTestId('livestock-view-left').click();await image('duck-waterline-side.png');await page.getByLabel('显示水位线',{exact:true}).uncheck();
  await page.getByTestId('livestock-motion-swim').click();await pause();await page.getByLabel('家畜循环播放',{exact:true}).uncheck();await setPhase(.99);await page.getByTestId('livestock-play').click();await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().finished);
  assert.equal((await snap()).phase,1);await page.getByLabel('家畜循环播放',{exact:true}).check();await setPhase(.5);
  const counts=[];await page.getByTestId('livestock-lod-auto').click();
  for(const count of [10,50,100,500]) {
    await page.getByTestId(`livestock-count-${count}`).click();await page.waitForFunction(n=>window.__LIVESTOCK_REVIEW__.snapshot().count===n,count);await page.waitForTimeout(350);
    s=await snap();assert.equal(s.surface,'water');assert(s.mixed);assert.equal(s.modelTriangles,s.triangles*count);assert(s.batches>0&&s.batches<=24);counts.push(s);
    if(count===100||count===500) await image(`duck-water-${count}.png`);
  }
  const beforeNav=await snap();await page.getByTestId('animal-mode-horse').click();await page.waitForFunction(()=>!!window.__MOUNT_REVIEW__);
  await page.getByTestId('animal-mode-livestock').click();await ready();s=await snap();
  for(const key of ['animal','surface','motion','count','phase','playing','seed','lod'])assert.equal(s[key],beforeNav[key]);assert.deepEqual(s.camera,beforeNav.camera);
  await page.getByLabel('家畜种类',{exact:true}).selectOption('chicken_brown');await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().animal==='chicken_brown');
  await page.getByLabel('家畜种类',{exact:true}).selectOption(animal);await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().animal==='duck_domestic_brown');await page.getByTestId('livestock-surface-water').click();await page.waitForTimeout(250);
  const warm=await snap();
  for(let i=0;i<5;i++){await page.getByTestId('livestock-surface-land').click();await page.getByTestId('livestock-surface-water').click();}await page.waitForTimeout(250);
  s=await snap();assert.equal(s.cachedPoses,warm.cachedPoses);assert.equal(s.geometries,warm.geometries);assert.equal(await page.locator('canvas').count(),1);
  for(const query of ['animal=chicken_brown&surface=water&clip=swim','animal=unknown&surface=water&clip=swim']) {
    await page.goto(`${base}/?lab=livestock&${query}&paused=1`,{waitUntil:'networkidle'});await ready();s=await snap();assert.equal(s.animal,'chicken_brown');assert.equal(s.surface,'land');assert.equal(s.motion,'idle');
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('wanhu.character.wardrobe.v5')),wardrobe);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(screenshots){
    assert.equal(comparisons.length,3);for(const c of comparisons){assert.deepEqual(c.camera,comparisons[0].camera);assert.deepEqual(c.clip,comparisons[0].clip);}
    const context=await page.context().browser().newContext({viewport:{width:1560,height:640},deviceScaleFactor:1});
    try {const sheet=await context.newPage();await sheet.setContent(`<!doctype html><html lang="zh"><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#19292c;color:#e7e3d8;font-family:'Noto Sans CJK SC',sans-serif}h1{margin:0 0 10px;font-size:24px;font-weight:500}p{font-size:13px;color:#abbfb6}.row{display:flex;gap:12px}.card{border:1px solid #53645c;border-radius:8px;overflow:hidden;flex:1;min-width:0}.card header{padding:13px;background:#243639;font-size:17px;color:#ddc49c}.card img{width:100%;display:block}</style><h1>褐羽家鸭 · 三档同角度对照</h1><p>连续的尾、身体、脖子、头与扁喙 · 相机、相位和裁切尺度一致</p><div class="row">${comparisons.map(c=>`<div class="card"><header>${c.lod.toUpperCase()} · ${c.triangles} tris</header><img src="data:image/png;base64,${c.png.toString('base64')}"></div>`).join('')}</div></html>`);await sheet.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await sheet.screenshot({path:'review/livestock/duck-lod-comparison.png',fullPage:true});}finally{await context.close();}
  }
  const result={result:'passed',sourceSHA:process.env.REVIEW_HEAD_SHA??'local',cases,counts,images,screenshots};writeFileSync(`${dir}/duck-browser.json`,JSON.stringify(result,null,2));console.log(`Duck desktop checks passed: ${cases.length} fixed LOD/motion cases, water crowds, species/surface lifecycle and single-shot playback.`);
}
