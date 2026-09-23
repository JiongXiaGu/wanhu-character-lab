import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

/** 显式视觉任务追加俯视证据；不增加产品UI或替代原鸡鸭浏览器矩阵。 */
export async function capturePoultryWings(page, base, dir, screenshots) {
  if (!screenshots) return;
  mkdirSync('review/livestock', { recursive: true });
  const images=[], comparisons=[];
  const snapshot=()=>page.evaluate(()=>window.__LIVESTOCK_REVIEW__.snapshot());
  async function open(animal, motion, lod='lod0', count=1, surface='land', view='farm') {
    const query=new URLSearchParams({lab:'livestock',animal,clip:motion,lod,count:String(count),surface,view,phase:'.25',paused:'1',mixed:count===1?'0':'1'});
    await page.goto(`${base}/?${query}`,{waitUntil:'networkidle'});
    await page.waitForFunction(({animal,motion,count})=>{
      const s=window.__LIVESTOCK_REVIEW__?.snapshot();return s?.animal===animal&&s.motion===motion&&s.count===count&&!s.playing&&s.phase===.25;
    },{animal,motion,count});
    // 确认两次RAF后读取已渲染的帧，不截上一相位。
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const s=await snapshot();
    assert.equal(s.surface,surface);assert.equal(s.camera.zoom,1);
    assert.equal(s.modelTriangles,s.triangles*count);
    const d=s.camera.position.map((v,i)=>v-s.camera.target[i]);
    const elevation=Math.atan2(d[1],Math.hypot(d[0],d[2]))*180/Math.PI;
    if(view==='farm')assert(elevation>=45&&elevation<=70,`必须使用经营俯视：${elevation}`);
    if(lod!=='auto')assert.equal(s.lod,lod);
    return {...s,view,elevation};
  }
  async function image(name,state) {
    await page.locator('.livestock-viewport').screenshot({path:`review/livestock/${name}`});
    images.push({name,...state});
  }
  const species=[{id:'duck_domestic_brown',name:'褐羽家鸭',prefix:'duck',idle:'idle_land'}, {id:'chicken_brown',name:'褐羽母鸡',prefix:'chicken',idle:'idle'}];
  for(const animal of species) {
    const cells=[];
    for(const lod of ['lod0','lod1','lod2']) {
      const state=await open(animal.id,animal.idle,lod);
      await image(`wings-${animal.prefix}-${lod}-top.png`,state);
      const box=await page.locator('.livestock-viewport canvas').boundingBox();assert(box&&box.width>=500&&box.height>=460);
      const clip={x:Math.round(box.x+(box.width-500)/2),y:Math.round(box.y+(box.height-460)/2),width:500,height:460};
      cells.push({lod,state,clip,png:await page.screenshot({clip})});
    }
    for(const cell of cells) {
      assert.deepEqual(cell.state.camera,cells[0].state.camera);
      assert.equal(cell.state.phase,cells[0].state.phase);
      assert.equal(cell.state.view,cells[0].state.view);
      assert.deepEqual(cell.clip,cells[0].clip);
    }
    const context=await page.context().browser().newContext({viewport:{width:1560,height:620},deviceScaleFactor:1});
    const name=`wings-${animal.prefix}-lod-comparison.png`;
    try {
      const sheet=await context.newPage();
      await sheet.setContent(`<!doctype html><html lang="zh"><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#19292c;color:#e7e3d8;font-family:'Noto Sans CJK SC',sans-serif}h1{margin:0 0 8px;font-size:23px;font-weight:500}p{font-size:13px;color:#abbfb6}.row{display:flex;gap:10px}.card{border:1px solid #53645c;border-radius:8px;overflow:hidden;flex:1;min-width:0}.card header{padding:11px;background:#243639;font-size:16px;color:#ddc49c}.card img{width:100%;display:block}</style><h1>${animal.name} · 贴体片面翅 · 经营俯视三档对照</h1><p>同一相机 / phase 0.25 / zoom 1 / 500 × 460 等尺度裁切 · LOD0 每侧4 tris（含反向面），低档翼区并入主体</p><div class="row">${cells.map(c=>`<div class="card"><header>${c.lod.toUpperCase()} · ${c.state.triangles} tris</header><img src="data:image/png;base64,${c.png.toString('base64')}"></div>`).join('')}</div></html>`);
      await sheet.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
      await sheet.screenshot({path:`review/livestock/${name}`,fullPage:true});
    } finally {await context.close();}
    comparisons.push({name,cells:cells.map(({png,...cell})=>cell)});
    // 真侧视用于确认翅膀确实位于身体侧面，而不是通过俯视角度隐藏位置错误。
    await image(`wings-${animal.prefix}-side.png`,await open(animal.id,animal.idle,'lod0',1,'land','left'));
    await image(`wings-${animal.prefix}-run-top.png`,await open(animal.id,'run'));
    if(animal.prefix==='duck')await image('wings-duck-swim-top.png',await open(animal.id,'swim','lod0',1,'water'));
    // 自动LOD用于实际经营轮廓，固定LOD0额外检查100只翅片不会横向撑开。
    for(const lod of ['auto','lod0']) {
      const surface=animal.prefix==='duck'?'water':'land',motion=animal.prefix==='duck'?'idle_water':'idle';
      await image(`wings-${animal.prefix}-100-${lod}-top.png`,await open(animal.id,motion,lod,100,surface));
    }
  }
  const result={result:'passed',sourceSHA:process.env.REVIEW_HEAD_SHA??'local',viewport:'1600x1000',images,comparisons};
  writeFileSync(`${dir}/wings-browser.json`,JSON.stringify(result,null,2));
  writeFileSync('review/livestock/wings-evidence.json',JSON.stringify(result,null,2));
  console.log(`Poultry wing evidence: ${images.length} frames (including true side views) and ${comparisons.length} equal-camera LOD sheets.`);
}
