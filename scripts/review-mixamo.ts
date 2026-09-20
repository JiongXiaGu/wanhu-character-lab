import {readFileSync} from 'node:fs';
import { chromium } from 'playwright';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { MIXAMO_CLIPS } from '../src/character/mixamo/catalog';

const REVIEW_IDS:string[] = JSON.parse(readFileSync('public/mixamo/inventory.json','utf8')).clips.map((c:{id:string})=>c.id);
assert.deepEqual([...REVIEW_IDS].sort(), MIXAMO_CLIPS.map(c=>c.id).sort());
const BODY_TYPES=['male','female'];let activeBodyType='male';
const directory='review-mixamo'; await mkdir(directory,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
const videos:string[]=[],playbackChecks:string[]=[]; let failure='';
const errors:string[]=[], records:{file:string;bodyType:string;id:string;view:string;phase:number}[]=[];
const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const base=process.env.REVIEW_URL??'http://127.0.0.1:4173';
async function open(id:string,extra:Record<string,string>={}){
  const query=new URLSearchParams({review:'1',paused:'1',mixamo:id,preset:'farmer',bodyType:activeBodyType,...extra});
  await page.goto(`${base}/?${query}`);await page.waitForFunction(()=>!!window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
  assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.locator('[role="alert"]').count(),0);
}
async function shot(id:string,view:string,phase:number){
  await page.evaluate(p=>window.__WANHU_REVIEW__!.seek(p),phase);await page.waitForTimeout(90);
  const actual=await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus().phase);
  assert(Math.abs(actual-phase)<1e-6,`${id}: paused seek ${phase} drifted to ${actual}`);
  const file=`${activeBodyType}-${id}-${view}-${Math.round(phase*1000).toString().padStart(4,'0')}.png`;
  await page.screenshot({path:`${directory}/${file}`});assert((await stat(`${directory}/${file}`)).size>10000);records.push({file,bodyType:activeBodyType,id,view,phase});
}
try{
 for(const bodyType of BODY_TYPES){
  activeBodyType=bodyType;
  for(const id of REVIEW_IDS){
    await open(id,{view:'front',compare:'1'});
    for(const phase of [0,.125,.25,.375,.5,.625,.75,.875,1])await shot(id,'compare',phase);
    await page.getByLabel('源骨架同步对照',{exact:true}).uncheck();
    for(const [view,label] of [['front','正面'],['side','侧面'],['back','背面']] as const){await page.getByRole('button',{name:label,exact:true}).click();await shot(id,view,.4);}
    await page.getByRole('button',{name:'结构布线',exact:true}).click();await shot(id,'cage',.4);
    const result=await page.evaluate(()=>window.__WANHU_EXPORT_MOTION__!());
    assert.equal((result as any).bones.length,20);assert.equal((result as any).clipId,id);
    console.log(`REVIEW ${id}: source/target timeline + front/side/back/cage + 20-bone export`);
  }
  // 实际播放/结束与循环检查保留，不再录制视频。
  for(const id of ['jogging','shooting-arrow']){
    const videoContext=await browser.newContext({viewport:{width:1600,height:1000},});
    const videoPage=await videoContext.newPage();
    try{
      videoPage.on('pageerror',e=>errors.push(e.message));
      await videoPage.goto(`${base}/?review=1&paused=1&bodyType=${activeBodyType}&mixamo=${id}&compare=1&view=side&preset=archer&headwear=none&leftHand=none&headAxes=1`);
      await videoPage.waitForFunction(()=>!!window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
      await videoPage.getByRole('button',{name:'播放',exact:true}).click();
      if(id==='shooting-arrow')await videoPage.waitForFunction(()=>window.__WANHU_REVIEW__!.getStatus().finished,undefined,{timeout:30000});
      else await videoPage.waitForFunction(()=>{const w=window as unknown as {__mixamoCycles?:{last:number;count:number}};const phase=window.__WANHU_REVIEW__!.getStatus().phase;const c=w.__mixamoCycles??={last:phase,count:0};if(phase<c.last-.5)c.count++;c.last=phase;return c.count>=2;},undefined,{timeout:30000,polling:100});
      const status=await videoPage.evaluate(()=>window.__WANHU_REVIEW__!.getStatus());
      if(id==='shooting-arrow'){assert(status.finished);assert.equal(status.phase,1);}else assert(status.phase>=0&&status.phase<1);
    }finally{await videoContext.close();playbackChecks.push(`${activeBodyType}/${id}`);}
  }
 }
  await open('shooting-arrow',{view:'side',compare:'1'});
  for(const phase of [.4,.5,.6,.7,.8])await shot('shooting-arrow','side-compare',phase);
  await open('shooting-arrow',{preset:'archer',headwear:'farmer_straw_hat',leftHand:'none',view:'front'});
  await page.evaluate(()=>window.__WANHU_REVIEW__!.seek(.45));
  for(const bottom of ['work_wrap','robe_skirt']){
    await page.getByLabel('下装',{exact:true}).selectOption(bottom);
    await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
    assert.equal(await page.getByLabel('头饰',{exact:true}).inputValue(),'farmer_straw_hat');
    assert(Math.abs((await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus().phase))-.45)<1e-6);
    await shot('shooting-arrow',`diy-${bottom}`, .45);
  }
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出目标骨架动画 JSON',exact:true}).click()]);
  await download.saveAs(`${directory}/reviewed-target-motion.json`);
  const geometryId=await page.evaluate(()=>window.__WANHU_REVIEW__!.geometryId());
  await page.getByTestId('mixamo-hip-hop').click();await page.getByTestId('mixamo-jogging').click();
  await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.id==='jogging');
  assert.equal(await page.evaluate(()=>window.__WANHU_REVIEW__!.geometryId()),geometryId,'switching FBX rebuilt the mesh');
  await page.getByRole('button',{name:'绑定姿态（静态）',exact:true}).click();await page.waitForTimeout(300);
  assert(!(await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus())).mixamo);
  const failContext=await browser.newContext();const failPage=await failContext.newPage();
  await failPage.route('**/mixamo/jogging.json',route=>route.fulfill({status:404,body:'missing'}));
  await failPage.goto(`${base}/?mixamo=jogging&review=1`);
  await failPage.waitForFunction(()=>!!window.__WANHU_REVIEW__?.getStatus().loadError);
  await failPage.unroute('**/mixamo/jogging.json');
  await failPage.getByRole('button',{name:'重试加载',exact:true}).click();
  await failPage.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.id==='jogging');
  await failPage.getByRole('button',{name:'绑定姿态（静态）',exact:true}).click();await failPage.waitForTimeout(200);
  assert.equal(await failPage.locator('canvas').count(),1);await failContext.close();
  for(const bodyType of BODY_TYPES)for(const id of ['jogging','shooting-arrow','catwalk','zombie-stand-up']){
    activeBodyType=bodyType;
    for(const phase of [.25,.6]){
      await open(id,{headwear:'none',compare:'1',view:'side',headAxes:'1'});
      await page.evaluate(p=>window.__WANHU_REVIEW__!.seek(p),phase);
      await page.evaluate(()=>window.__WANHU_REVIEW__!.focusHead());
      await shot(id,'head-side',phase);
    }
  }
  await page.setViewportSize({width:412,height:915});await open('jogging');await shot('jogging','mobile',.25);
  assert.deepEqual(errors,[]);
}catch(error){failure=String(error);throw error;}finally{
  const report={sourceSha:process.env.REVIEW_HEAD_SHA??'local',testedSha:process.env.GITHUB_SHA??'local',retargetVersion:'wanhu-mixamo-2',clips:REVIEW_IDS.length,bodyTypes:2,images:records.length,records,errors,failure,passed:!failure&&errors.length===0,continuousVideos:videos,playbackChecks};
  await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));
  await writeFile(`${directory}/index.html`,`<!doctype html><meta charset="utf-8"><title>Mixamo review</title><style>body{font:16px sans-serif;background:#18242a;color:#eee}section{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}img,video{width:100%}figure{margin:0}h2{grid-column:1/-1}</style><h1>Mixamo source / target review</h1><p>SHA ${report.sourceSha} · Passed ${report.passed}</p>${REVIEW_IDS.map(id=>`<h2>${id}</h2><section>${records.filter(r=>r.id===id).map(r=>`<figure><img loading="lazy" src="${r.file}"><figcaption>${r.bodyType} · ${r.view} · ${r.phase}</figcaption></figure>`).join('')}</section>`).join('')}<h2>Continuous playback</h2>${report.continuousVideos.map(f=>`<video controls loop src="${f}"></video>`).join('')}`);
  await context.close();await browser.close();
}
console.log(`PASS: ${REVIEW_IDS.length} clips; ${records.length} images; four record-free playback checks; interaction/export/error recovery.`);
