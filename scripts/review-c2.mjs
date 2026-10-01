import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {chromium} from 'playwright';

// C2 修形专项：站姿为主，动作全数值采样、少量最坏相位实图。
const dir='review/c2',top='court_maid_short_jacket',bottom='court_maid_high_waist_skirt';
const sourceSHA=process.env.REVIEW_HEAD_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const base=process.env.REVIEW_URL||'http://127.0.0.1:4197',records=[],errors=[],bytes=new Map();
mkdirSync(dir,{recursive:true});let server,browser;
const frames=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
try {
  if(!process.env.REVIEW_URL)server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4197','--strictPort'],{stdio:'ignore'});
  for(let n=0;;n++){try{if((await fetch(base)).ok)break;}catch{}assert(n<150,'preview timeout');await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1680,height:1050},deviceScaleFactor:1});page.setDefaultTimeout(45000);
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  async function load(options={}) {
    const o={bodyType:'female',top,bottom,view:'front',display:'beauty',phase:0,...options};
    const slots={top:o.top,bottom:o.bottom,shoes:'cloth_shoes',headwear:'none',back:'none',leftHand:'none',rightHand:'none'};
    const q=new URLSearchParams({review:'1',paused:'1',bodyType:o.bodyType,view:o.view,display:o.display,...slots});
    if(o.clip){q.set('motion',o.clip);q.set('phase',String(o.phase));}else q.set('pose','bind');
    await page.goto(base+'/?'+q);await page.waitForFunction(()=>window.__WANHU_REVIEW__&&window.__WANHU_RECIPE__);
    if(o.clip){await page.waitForFunction(id=>window.__WANHU_REVIEW__.getStatus().motion?.id===id,o.clip);await page.evaluate(p=>window.__WANHU_REVIEW__.seek(p),o.phase);await page.waitForFunction(p=>Math.abs(window.__WANHU_REVIEW__.getStatus().phase-p)<.002,o.phase);}
    await frames(page);
    assert.equal(await page.locator('canvas').count(),1);assert(await page.locator('body').innerText());
    assert.equal(await page.locator('vite-error-overlay').count(),0);
    const state=await page.evaluate(()=>({recipe:window.__WANHU_RECIPE__(),stats:window.__WANHU_REVIEW__.stats,status:window.__WANHU_REVIEW__.getStatus(),camera:window.__WANHU_REVIEW__.cameraState()}));
    assert.deepEqual(state.recipe.slots,slots);assert.equal(state.recipe.bodyType,o.bodyType);assert.equal(state.stats.bones,20);assert.equal(state.recipe.version,5);assert.equal(Object.keys(state.recipe).length,6);
    assert(!state.status.loading&&!state.status.loadError);if(!o.clip)assert(!state.status.motion);
    return{...state,request:o};
  }
  async function shot(name,options){const state=await load(options);const data=await page.locator('canvas').screenshot({path:`${dir}/${name}.png`});assert(data.length>8000);bytes.set(name,data);records.push({file:`${name}.png`,...state});console.log('C2_SHOT',name);return state;}
  const initial=await load();
  for(const [slot,reference,target]of [['top','cross_jacket',top],['bottom','long_skirt',bottom]]) {
    const select=page.locator(`select:has(option[value="${target}"])`);assert.equal(await select.count(),1);
    for(const id of [reference,target]){await select.selectOption(id);await page.waitForFunction(({slot,id})=>window.__WANHU_RECIPE__().slots[slot]===id,{slot,id});await frames(page);const state=await page.evaluate(()=>({recipe:window.__WANHU_RECIPE__(),camera:window.__WANHU_REVIEW__.cameraState()}));for(const k of Object.keys(initial.recipe.slots))if(k!==slot)assert.equal(state.recipe.slots[k],initial.recipe.slots[k]);assert.deepEqual(state.camera,initial.camera);}
  }
  for(const bodyType of ['female','male'])for(const view of ['front','side','back','free'])await shot(`${bodyType}-set-${view}`,{bodyType,view});
  for(const view of ['front','side','back'])await shot(`female-jacket-only-${view}`,{bottom:'work_pants',view});
  for(const view of ['front','side']) {
    await shot(`female-skirt-only-${view}`,{top:'body',view});
    let camera;
    for(const id of [top,'short_work_jacket','cross_jacket']){const state=await shot(`compare-top-${id}-${view}`,{top:id,bottom:'work_pants',view,display:'clay'});if(camera)assert.deepEqual(state.camera,camera);camera=state.camera;}
    for(const id of [bottom,'long_skirt'])await shot(`compare-bottom-${id}-${view}`,{top:'body',bottom:id,view,display:'clay'});
  }
  await shot('compare-jacket-back',{bottom:'work_pants',view:'back',display:'clay'});
  for(const bodyType of ['female','male'])for(const [clip,phase,view] of [['start-walking',.4,'free'],['jogging',.25,'free'],['pilot-switches',.5,'side'],['shooting-arrow',.5,'free'],['snatch',.35,'side']])await shot(`${bodyType}-${clip}-${view}`,{bodyType,clip,phase,view});
  const reportPath=`${dir}/c2-motion.json`;
  const diagnostics=existsSync(reportPath)?JSON.parse(readFileSync(reportPath,'utf8')):null;
  if(!process.env.C2_PREVIEW_ONLY)assert(diagnostics,'正式图包必须附完整 C2 动作报告');
  // Hard 仍按每个组合的最严重相位全部截图；Warning 按性别/原因取真正最严重帧。
  // 只缩减重复截图，不减少数值采样，不选安全帧，不删除完整 observedFrames。
  const selected=new Map(),frameKey=f=>[f.bodyType,f.top,f.bottom,f.clip,f.time].join(':');
  if(diagnostics){
    assert.equal(diagnostics.testedSha,sourceSHA,'动作报告与图包 SHA 不一致');
    for(const f of diagnostics.visualFrames)if(f.hard)selected.set(frameKey(f),f);
    const worst=new Map();
    for(const f of diagnostics.observedFrames)for(const [reason,count]of Object.entries(f.reasons))if(reason!=='hard'){
      const key=f.bodyType+':'+reason,old=worst.get(key);if(!old||count>old.reasons[reason])worst.set(key,f);
    }
    for(const f of worst.values())selected.set(frameKey(f),f);
  }
  const diagnosticFrames=[...selected.values()];
  for(const [i,item]of diagnosticFrames.entries())for(const view of item.hard?['front','side','free']:['side'])await shot(`diagnostic-${String(i).padStart(3,'0')}-${view}`,{bodyType:item.bodyType,top:item.top,bottom:item.bottom,clip:item.clip,phase:item.phase,view});
  async function sheet(name,title,items){
    const p=await browser.newPage({viewport:{width:items.length*400,height:600},deviceScaleFactor:1});
    // 同一固定 Canvas 中央裁切，所有资产与机位同倍率；原始 Canvas 另存，不改变摄影机。
    await p.setContent(`<html><head><style>body{margin:0;background:#eeeae1;font:18px sans-serif}header{padding:14px}small{font-size:11px}.row{display:flex}figure{margin:0;width:400px}figcaption{text-align:center}.crop{height:500px;position:relative;overflow:hidden}img{position:absolute;width:1082px;height:618px;max-width:none;left:50%;top:-35px;transform:translateX(-50%)}</style></head><body><header>${title}<br><small>${sourceSHA} · real WebGL / identical image scale / original Canvas retained</small></header><div class="row">${items.map(([id,label])=>`<figure><figcaption>${label}</figcaption><div class="crop"><img src="data:image/png;base64,${bytes.get(id).toString('base64')}"></div></figure>`).join('')}</div></body></html>`);
    await p.locator('img').evaluateAll(list=>Promise.all(list.map(i=>i.decode())));await p.screenshot({path:`${dir}/${name}.png`});await p.close();
  }
  await sheet('female-set','C2 · 宫女短襦 + 高腰长裙',[['female-set-front','正面'],['female-set-side','侧面'],['female-set-back','背面'],['female-set-free','三分之四']]);
  await sheet('male-set','C2 · 男性自由混搭',[['male-set-front','正面'],['male-set-side','侧面'],['male-set-free','三分之四']]);
  await sheet('jacket-only','C2 · 独立短襦 + 普通下装',[['female-jacket-only-front','正面'],['female-jacket-only-side','侧面'],['female-jacket-only-back','背面']]);
  await sheet('top-front-comparison','同机位素模 · 正面结构对照',[[`compare-top-${top}-front`,'宫女短襦'],['compare-top-short_work_jacket-front','劳动短褂'],['compare-top-cross_jacket-front','交领常服']]);
  await sheet('top-side-comparison','同机位素模 · 侧面结构对照',[[`compare-top-${top}-side`,'宫女短襦'],['compare-top-short_work_jacket-side','劳动短褂'],['compare-top-cross_jacket-side','交领常服']]);
  assert.equal(errors.length,0,JSON.stringify(errors));
  writeFileSync(`${dir}/visual-report.json`,JSON.stringify({testedSha:sourceSHA,passed:true,records,rawImages:records.length,contactSheets:5,errors,diagnostics:!!diagnostics,diagnosticFrames,visualApproval:false},null,2));
  console.log('C2_BROWSER_VERIFIED',JSON.stringify({canvas:1,independentSelectors:true,bodyTypes:true,errors,rawImages:records.length}));
}finally{await browser?.close();server?.kill();}
