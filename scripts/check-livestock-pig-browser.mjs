import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

/** OrbitControls重复球坐标换算会产生机器舍入误差；这里只比较截图机位，不修改模型容差。 */
function assertSameReviewCamera(actual,expected) {
  for(const field of ['position','target']) {
    assert.equal(actual[field].length,3);assert.equal(expected[field].length,3);
    actual[field].forEach((value,i)=>{
      assert(Number.isFinite(value)&&Number.isFinite(expected[field][i]),'截图机位必须有限');
      assert(Math.abs(value-expected[field][i])<=1e-10,`截图${field}[${i}]不一致`);
    });
  }
  assert(Number.isFinite(actual.zoom)&&Number.isFinite(expected.zoom),'截图缩放必须有限');
  assert(Math.abs(actual.zoom-expected.zoom)<=1e-10,'截图缩放不一致');
}
const cameraFaultInjections=(()=>{
  const reference={position:[2.6960456261614674,1.7846534751787233,3.235254751393761],target:[0,.27486792452830183,0],zoom:1};
  const rounded=structuredClone(reference);rounded.position=[2.6960456261614687,1.7846534751787222,3.235254751393762];
  assertSameReviewCamera(rounded,reference);
  for(const change of [c=>{c.position[0]+=1e-6;},c=>{c.target[1]+=1e-6;},c=>{c.zoom+=1e-6;},c=>{c.position[0]=NaN;}]) {
    const broken=structuredClone(reference);change(broken);assert.throws(()=>assertSameReviewCamera(broken,reference));
  }
  return 4;
})();

/** 使用正式家畜UI、真实WebGL和同一Renderer；不提供猪专属测试页面。 */
export async function checkPigBrowser(page,base,dir,screenshots,setPhase) {
  const animal='pig_domestic_black',budgets=[['lod0',248,144],['lod1',138,89],['lod2',82,57]];
  const cases=[],counts=[],images=[],comparisons=[],switches=[];
  const snap=()=>page.evaluate(()=>window.__LIVESTOCK_REVIEW__.snapshot());
  const ready=()=>page.waitForFunction(id=>window.__LIVESTOCK_REVIEW__?.snapshot().animal===id,animal);
  const pause=async()=>{if((await snap()).playing){await page.getByTestId('livestock-play').click();await page.waitForFunction(()=>!window.__LIVESTOCK_REVIEW__.snapshot().playing);}};
  const shot=async name=>{if(!screenshots)return;await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(150);await page.screenshot({path:`review/livestock/${name}`,fullPage:true});images.push({name,...await snap()});};
  const wardrobe=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.includes('character'))));
  assert.deepEqual(await page.getByLabel('家畜种类',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(n=>n.value)),['chicken_brown','duck_domestic_brown','goose_domestic_white',animal]);
  for(const [lod,triangles,logicalVertices] of budgets) {
    await page.goto(`${base}/?lab=livestock&animal=${animal}&lod=${lod}&clip=idle&phase=.5&paused=1&view=three`,{waitUntil:'networkidle'});await ready();
    const initial=await snap();assert.equal(initial.bones,9);assert.equal(initial.triangles,triangles);assert.equal(initial.logicalVertices,logicalVertices);
    assert.equal(initial.surface,'land');assert.equal(initial.waterClipped,false);assert.equal(await page.getByTestId('livestock-environment').count(),0);
    assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.locator('.livestock-motions button').count(),5);
    if(lod==='lod0') {
      await shot('pig-three.png');
      if(screenshots) {
        await page.getByTestId('livestock-view-front').click();await shot('pig-front.png');
        await page.getByTestId('livestock-view-farm').click();await shot('pig-farm-single.png');
        await page.getByTestId('livestock-view-three').click();
        await page.waitForFunction(()=>{const c=window.__LIVESTOCK_REVIEW__.snapshot().camera;const d=c.position.map((v,i)=>v-c.target[i]);return Math.abs(d[0]/d[2]-1.25/1.5)<1e-6;});
      }
    }
    if(screenshots) {
      await page.evaluate(()=>window.scrollTo(0,0));const box=await page.locator('.livestock-viewport canvas').boundingBox();assert(box);
      const width=Math.min(620,Math.floor(box.width)),height=Math.min(580,Math.floor(box.height));
      const clip={x:Math.round(box.x+(box.width-width)/2),y:Math.round(box.y+(box.height-height)/2),width,height};
      comparisons.push({lod,triangles,logicalVertices,camera:(await snap()).camera,clip,png:await page.screenshot({clip})});
    }
    for(const motion of ['idle','walk','run','root','sniff']) {
      await page.getByTestId(`livestock-motion-${motion}`).click();
      await page.waitForFunction(m=>{const s=window.__LIVESTOCK_REVIEW__.snapshot();return s.motion===m&&s.playing&&s.time>.02;},motion);
      await pause();await setPhase(.5);const s=await snap();
      for(const [key,value] of Object.entries({motion,bones:9,triangles,logicalVertices,playing:false,surface:'land'}))assert.equal(s[key],value);
      assert.equal(s.geometryId,initial.geometryId);assert.equal(s.rendererId,initial.rendererId);assert(Math.abs(s.phase-.5)<.001);
      await page.waitForTimeout(80);assert.equal((await snap()).phase,s.phase,'暂停后时钟不能推进');
      await page.getByLabel('家畜下一帧',{exact:true}).click();await page.waitForFunction(p=>window.__LIVESTOCK_REVIEW__.snapshot().phase>p,s.phase);
      await page.getByLabel('家畜上一帧',{exact:true}).click();await page.waitForFunction(p=>Math.abs(window.__LIVESTOCK_REVIEW__.snapshot().phase-p)<.001,s.phase);
      cases.push({lod,motion,triangles,logicalVertices,playingVerified:true,pauseSeekAndStep:true});
      if(lod==='lod0'&&['walk','run','sniff'].includes(motion)) {await page.getByTestId('livestock-view-left').click();await shot(`pig-${motion}.png`);}
    }
  }
  // 通过已存在的相机临时状态恢复严格正交侧视，不改正式相机预设或动物光照。
  const stored=await page.evaluate(()=>sessionStorage.getItem('wanhu.livestock.preview.v1'));
  await page.evaluate(id=>sessionStorage.setItem('wanhu.livestock.preview.v1',JSON.stringify({version:1,animal:id,count:1,surface:'land',motion:'idle',playing:false,loop:true,lod:'lod0',phase:.5,seed:731,view:'left',camera:{position:[-3,.30,0],target:[0,.30,0],zoom:1}})),animal);
  await page.goto(`${base}/?lab=livestock&preview=resume`,{waitUntil:'networkidle'});await ready();
  let s=await snap();assert(Math.abs(s.camera.position[1]-s.camera.target[1])<1e-8);assert(Math.abs(s.camera.position[2]-s.camera.target[2])<1e-8);
  await shot('pig-side.png');
  await page.getByTestId('livestock-motion-root').click();await pause();await setPhase(.5);await shot('pig-root.png');
  await page.getByTestId('livestock-view-three').click();await shot('pig-root-three.png');
  for(const view of ['front','left','farm','three']){await page.getByTestId(`livestock-view-${view}`).click();await page.waitForFunction(v=>document.querySelector(`[data-testid="livestock-view-${v}"]`)?.getAttribute('aria-pressed')==='true',view);}
  await page.getByLabel('家畜循环播放',{exact:true}).uncheck();await setPhase(.99);await page.getByTestId('livestock-play').click();await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().finished);
  assert.equal((await snap()).phase,1);await page.waitForTimeout(100);assert.equal((await snap()).phase,1);
  await page.getByLabel('家畜循环播放',{exact:true}).check();await setPhase(.99);await page.getByTestId('livestock-play').click();await page.waitForFunction(()=>{const s=window.__LIVESTOCK_REVIEW__.snapshot();return s.playing&&s.phase<.2;});await pause();await setPhase(.37);
  const before=await snap(),direction=s=>s.camera.position.map((v,i)=>v-s.camera.target[i]);
  for(const id of ['chicken_brown','duck_domestic_brown','goose_domestic_white',animal]) {
    await page.getByLabel('家畜种类',{exact:true}).selectOption(id);await page.waitForFunction(id=>window.__LIVESTOCK_REVIEW__.snapshot().animal===id,id);s=await snap();
    assert.equal(s.rendererId,before.rendererId);assert.equal(s.phase,before.phase);assert.equal(s.camera.zoom,before.camera.zoom);
    direction(s).forEach((v,i)=>assert(Math.abs(v-direction(before)[i])<1e-8));assert.equal(await page.locator('canvas').count(),1);switches.push({animal:id,bones:s.bones,rendererId:s.rendererId});
  }
  assert.equal((await snap()).surface,'land');assert.equal((await snap()).motion,'idle');
  await page.getByTestId('livestock-lod-auto').click();await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().lod==='lod0');
  for(const count of [1,10,50,100,500]) {
    await page.getByTestId(`livestock-count-${count}`).click();await page.waitForFunction(n=>window.__LIVESTOCK_REVIEW__.snapshot().count===n,count);await page.waitForTimeout(200);s=await snap();
    const expected=s.pixelHeight>=70?'lod0':s.pixelHeight>=26?'lod1':'lod2';assert.equal(s.lod,expected);
    assert.equal(s.modelTriangles,s.triangles*count);assert(s.batches>0&&s.batches<=(count===1?1:32));assert.equal(s.bones,9);
    if(count>1)assert(s.mixed);counts.push(s);
    if(count===100||count===500)await shot(`pig-farm-${count}.png`);
  }
  // 真正跨物种更换较大群体，验证视野缩放而非创建第二个Renderer。
  const herd=await snap();
  await page.getByLabel('家畜种类',{exact:true}).selectOption('goose_domestic_white');await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__.snapshot().animal==='goose_domestic_white');
  await page.getByLabel('家畜种类',{exact:true}).selectOption(animal);await ready();s=await snap();
  assert.equal(s.count,500);assert.equal(s.rendererId,herd.rendererId);assert.deepEqual(s.camera,herd.camera);assert.equal(s.lod,herd.lod);
  for(const [lod,tris] of budgets){await page.getByTestId(`livestock-lod-${lod}`).click();await page.waitForFunction(lod=>window.__LIVESTOCK_REVIEW__.snapshot().lod===lod,lod);assert.equal((await snap()).modelTriangles,tris*500);}
  const warm=await snap();
  for(let i=0;i<3;i++)for(const [lod] of budgets){await page.getByTestId(`livestock-lod-${lod}`).click();await page.waitForFunction(lod=>window.__LIVESTOCK_REVIEW__.snapshot().lod===lod,lod);}
  s=await snap();assert.equal(s.cachedPoses,warm.cachedPoses);assert.equal(s.geometries,warm.geometries);assert.equal(s.rendererId,warm.rendererId);
  const seed=s.seed;await page.getByTestId('livestock-reshuffle').click();await page.waitForFunction(n=>window.__LIVESTOCK_REVIEW__.snapshot().seed!==n,seed);
  const beforeNav=await snap();await page.getByTestId('animal-mode-horse').click();await page.waitForFunction(()=>!!window.__MOUNT_REVIEW__);
  await page.getByTestId('animal-mode-livestock').click();await ready();s=await snap();
  for(const key of ['animal','surface','count','motion','phase','playing','seed','lod'])assert.equal(s[key],beforeNav[key]);assert.deepEqual(s.camera,beforeNav.camera);
  for(const query of ['surface=water&clip=swim','surface=mud&clip=unknown&lod=unknown&phase=Infinity&count=9999']) {
    await page.goto(`${base}/?lab=livestock&animal=${animal}&${query}&paused=1`,{waitUntil:'networkidle'});await ready();s=await snap();
    assert.equal(s.motion,'idle');assert.equal(s.surface,'land');assert.equal(s.phase,0);assert.equal(s.count,1);assert.equal(s.bones,9);assert.equal(s.lod,'lod0');
  }
  await page.goto(`${base}/?lab=livestock&animal=missing_pig&clip=root&paused=1`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__LIVESTOCK_REVIEW__?.snapshot().animal==='chicken_brown');assert.equal((await snap()).motion,'idle');
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.includes('character')))),wardrobe);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(value=>value===null?sessionStorage.removeItem('wanhu.livestock.preview.v1'):sessionStorage.setItem('wanhu.livestock.preview.v1',value),stored);
  if(screenshots) {
    assert.equal(comparisons.length,3);for(const c of comparisons){assertSameReviewCamera(c.camera,comparisons[0].camera);assert.deepEqual(c.clip,comparisons[0].clip);}
    const context=await page.context().browser().newContext({viewport:{width:1940,height:750},deviceScaleFactor:1});
    try {
      const sheet=await context.newPage();await sheet.setContent(`<!doctype html><html lang="zh"><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#19292c;color:#e7e3d8;font-family:'Noto Sans CJK SC',sans-serif}h1{font-size:26px;font-weight:500;margin:0 0 10px}p{font-size:15px;color:#abbfb6}.row{display:flex;gap:12px}.card{flex:1;min-width:0;border:1px solid #53645c;border-radius:8px;overflow:hidden}.card header{padding:14px;background:#243639;color:#ddc49c}.card img{width:100%;display:block}</style><h1>黑色家猪 · 三档作者LOD</h1><p>同相机、同相位、同裁切尺度 · 真实WebGL截图 · 九骨共用五个陆地动作</p><div class="row">${comparisons.map(c=>`<div class="card"><header>${c.lod.toUpperCase()} · ${c.triangles} tris / ${c.logicalVertices} 逻辑点</header><img src="data:image/png;base64,${c.png.toString('base64')}"></div>`).join('')}</div></html>`);
      await sheet.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await sheet.screenshot({path:'review/livestock/pig-lod-comparison.png',fullPage:true});
    } finally {await context.close();}
  }
  const result={result:'passed',sourceSHA:process.env.REVIEW_HEAD_SHA??'local',animal,bones:9,cases,counts,switches,images,screenshots,cameraFaultInjections,wardrobeUnchanged:true};
  writeFileSync(`${dir}/pig-browser.json`,JSON.stringify(result,null,2));console.log(`Pig desktop checks passed: ${cases.length} LOD/motion cases, 1–500, 9/8/7-bone switching, playback, cache and lifecycle.`);
}
