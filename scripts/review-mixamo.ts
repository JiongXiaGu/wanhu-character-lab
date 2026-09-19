import { chromium } from 'playwright';
import { mkdir, writeFile, stat, rename } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { MIXAMO_CLIPS } from '../src/character/mixamo/catalog';

// 独立矩阵必须与注册表一致，且逐项验证产物存在。
const REVIEW_IDS = ['jogging','shooting-arrow','catwalk','punching-bag','zombie-stand-up','pilot-switches','swimming','hip-hop','capoeira','flair','assassination'];
assert.deepEqual([...REVIEW_IDS].sort(), MIXAMO_CLIPS.map(c=>c.id).sort());
const directory='review-mixamo'; await mkdir(directory,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
const errors:string[]=[], records:{file:string;id:string;view:string;phase:number}[]=[];
const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const base=process.env.REVIEW_URL??'http://127.0.0.1:4173';
async function open(id:string,extra:Record<string,string>={}){
  const query=new URLSearchParams({review:'1',paused:'1',mixamo:id,outfit:'farmer',equipment:'0',...extra});
  await page.goto(`${base}/?${query}`);await page.waitForFunction(()=>!!window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
  assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.locator('[role="alert"]').count(),0);
}
async function shot(id:string,view:string,phase:number){
  await page.evaluate(p=>window.__WANHU_REVIEW__!.seek(p),phase);await page.waitForTimeout(90);
  const file=`${id}-${view}-${Math.round(phase*1000).toString().padStart(4,'0')}.png`;
  await page.screenshot({path:`${directory}/${file}`});assert((await stat(`${directory}/${file}`)).size>10000);records.push({file,id,view,phase});
}
try{
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
  // 真正播放，视频保留界面时间轴和同步源骨架。
  for(const id of ['jogging','shooting-arrow']){
    const videoContext=await browser.newContext({viewport:{width:1600,height:1000},recordVideo:{dir:directory,size:{width:1600,height:1000}}});
    const videoPage=await videoContext.newPage();videoPage.on('pageerror',e=>errors.push(e.message));
    await videoPage.goto(`${base}/?review=1&paused=1&mixamo=${id}&compare=1&view=${id==='jogging'?'side':'front'}&outfit=archer&headwear=farmer_straw_hat&leftHand=none`);
    await videoPage.waitForFunction(()=>!!window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
    await videoPage.getByRole('button',{name:'播放',exact:true}).click();
    await videoPage.waitForTimeout(id==='jogging'?6500:6200);
    const status=await videoPage.evaluate(()=>window.__WANHU_REVIEW__!.getStatus());
    if(id==='shooting-arrow'){assert(status.finished);assert.equal(status.phase,1);}else assert(status.phase>0&&status.phase<1);
    const video=videoPage.video()!;await videoContext.close();await rename(await video.path(),`${directory}/${id}-continuous.webm`);
  }
  await open('shooting-arrow',{outfit:'archer',headwear:'farmer_straw_hat',leftHand:'none',view:'front'});
  await page.evaluate(()=>window.__WANHU_REVIEW__!.seek(.45));
  for(const [height,build] of [[1.58,0],[1.92,1]]){
    await page.getByLabel('身高',{exact:true}).evaluate((element,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,String(value));element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));},height);
    await page.getByLabel('体格',{exact:true}).evaluate((element,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,String(value));element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));},build);
    await page.waitForFunction(()=>!!window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
    assert.equal(await page.getByLabel('头饰',{exact:true}).inputValue(),'farmer_straw_hat');
    await shot('shooting-arrow',`diy-${height}`, .45);
  }
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出目标骨架动画 JSON',exact:true}).click()]);
  await download.saveAs(`${directory}/reviewed-target-motion.json`);
  await page.getByTestId('mixamo-hip-hop').click();await page.getByTestId('mixamo-jogging').click();
  await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.id==='jogging');
  await page.getByRole('button',{name:'待机',exact:true}).click();await page.waitForTimeout(300);
  assert(!(await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus())).mixamo);
  // 独立 context 测试预期资源错误，避免污染正常页面的错误日志。
  const failContext=await browser.newContext();const failPage=await failContext.newPage();
  await failPage.route('**/mixamo/jogging.json',route=>route.fulfill({status:404,body:'missing'}));
  await failPage.goto(`${base}/?mixamo=jogging&review=1`);
  await failPage.waitForFunction(()=>!!window.__WANHU_REVIEW__?.getStatus().loadError);
  await failPage.getByRole('button',{name:'待机',exact:true}).click();await failPage.waitForTimeout(200);
  assert.equal(await failPage.locator('canvas').count(),1);await failContext.close();
  assert.deepEqual(errors,[]);
} finally {
  const report={sourceSha:process.env.REVIEW_HEAD_SHA??'local',clips:REVIEW_IDS.length,images:records.length,records,errors,continuousVideos:['jogging-continuous.webm','shooting-arrow-continuous.webm']};
  await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));
  await writeFile(`${directory}/index.html`,`<!doctype html><meta charset="utf-8"><title>Mixamo review</title><style>body{font:16px sans-serif;background:#18242a;color:#eee}section{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}img,video{width:100%}figure{margin:0}h2{grid-column:1/-1}</style><h1>Mixamo source / target review</h1><p>SHA ${report.sourceSha}</p>${REVIEW_IDS.map(id=>`<h2>${id}</h2><section>${records.filter(r=>r.id===id).map(r=>`<figure><img loading="lazy" src="${r.file}"><figcaption>${r.view} · ${r.phase}</figcaption></figure>`).join('')}</section>`).join('')}<h2>Continuous playback</h2>${report.continuousVideos.map(f=>`<video controls loop src="${f}"></video>`).join('')}`);
  await context.close();await browser.close();
}
console.log(`PASS: ${REVIEW_IDS.length} clips; ${records.length} images; two continuous videos; interaction/export/error recovery.`);
