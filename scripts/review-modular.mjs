import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const stage=process.env.REVIEW_STAGE??'after',root=process.env.REVIEW_OUTPUT??`review-modular/${stage}`,base=process.env.REVIEW_URL??'http://127.0.0.1:4173';
await mkdir(root,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1}),page=await context.newPage();
const errors=[],records=[];let failure='';
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function open(bodyType,top,bottom,clip,view,light=true,display='beauty'){
  const q=new URLSearchParams({review:'1',paused:'1',preset:'farmer',bodyType,top,bottom,headwear:'none',back:'none',leftHand:'none',rightHand:'none',view,display,...(clip==='bind'?{pose:'bind'}:{mixamo:clip})});
  await page.goto(base+'/?'+q);await page.waitForFunction(()=>window.__WANHU_REVIEW__?.stats.bones===20);
  if(clip!=='bind')await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
  if(light){
    const r=await page.evaluate(()=>window.__WANHU_RECIPE__());r.dyes={primary:'#d4c4a9',secondary:'#d5d2c5',accent:'#6f7b78'};
    await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:'light-review.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(r))});
    await page.waitForFunction(()=>window.__WANHU_RECIPE__().dyes.secondary==='#d5d2c5');
    if(clip!=='bind')await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
  }
  assert.equal(await page.locator('[role=alert]').count(),0);
}
async function shot(file,phase,meta={},close=false){
  await page.evaluate(p=>window.__WANHU_REVIEW__.seek(p),phase);
  if(close)await page.evaluate(()=>window.__WANHU_REVIEW__.focusHip());
  await page.waitForTimeout(150);
  const actual=await page.evaluate(()=>window.__WANHU_REVIEW__.getStatus().phase);
  if(meta.clip!=='bind')assert(Math.abs(actual-phase)<1e-6,'动作相位漂移');
  const camera=await page.evaluate(()=>window.__WANHU_REVIEW__.cameraState());
  const box=await page.getByTestId('viewport').boundingBox();
  await page.getByTestId('viewport').screenshot({path:`${root}/${file}.png`});
  records.push({file:file+'.png',phase,camera,viewport:{width:box.width,height:box.height},...meta});
}
try{
  for(const bodyType of ['male','female'])for(const fit of ['pants','short'])for(const clip of ['bind','pilot-switches','snatch'])for(const view of ['front','side','back']){
    const top=fit==='pants'?'body':'rough_tunic';
    await open(bodyType,top,'work_pants',clip,view);
    await shot(`${bodyType}-${fit}-${clip}-${view}`,clip==='bind'?0:clip==='snatch'?.05:.5,{bodyType,fit,clip,view,kind:'comparison'});
  }
  if(stage==='after'){
    for(const bodyType of ['male','female'])for(const top of ['rough_tunic','cross_jacket'])for(const bottom of ['work_pants','long_skirt']){
      await open(bodyType,top,bottom,'pilot-switches','three',false);
      await shot(`mix-${bodyType}-${top}-${bottom}`,.5,{bodyType,top,bottom,clip:'pilot-switches',kind:'mix'});
    }
    for(const bodyType of ['male','female'])for(const clip of ['pilot-switches','snatch'])for(const view of ['front','side','back'])for(const display of ['beauty','unlit','cage']){
      await open(bodyType,'body','work_pants',clip,view,true,display);
      await shot(`hip-${bodyType}-${clip}-${view}-${display}`,clip==='snatch'?.05:.5,{bodyType,clip,view,display,kind:'hip'},true);
    }
    for(const bodyType of ['male','female'])for(const view of ['front','back']){
      await open(bodyType,'rough_tunic','long_skirt','snatch',view);
      for(const phase of [0,.25,.5,.75,1])await shot(`squat-${bodyType}-${view}-${phase}`,phase,{bodyType,clip:'snatch',view,kind:'sequence'});
    }
  }
  assert.equal(records.filter(r=>r.kind==='comparison').length,36);
  assert.equal(records.length,stage==='after'?100:36);assert.deepEqual(errors,[]);
}catch(e){failure=String(e);throw e;}finally{
  await writeFile(root+'/report.json',JSON.stringify({stage,sourceSha:process.env.REVIEW_HEAD_SHA,records,errors,failure,passed:!failure&&!errors.length,manuallyReviewed:false,videoCapture:false},null,2));
  await context.close();await browser.close();
}
