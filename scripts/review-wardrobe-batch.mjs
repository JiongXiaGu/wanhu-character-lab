import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const stage=process.env.REVIEW_STAGE??'after',root=`review-wardrobe-batch/${stage}`;
assert(/^[a-zA-Z0-9_-]+$/.test(stage));
const before=stage==='before',quick=process.argv.includes('--quick'),base=process.env.REVIEW_URL??'http://127.0.0.1:4173';
const tops=['rough_tunic','cross_jacket','layered_vest'],bottoms=['loose_trousers','guard_pants'];
const priority=[['pilot-switches',.5],['snatch',.05],['jogging',.25],['shooting-arrow',.5],['start-walking',.5]];
const normal={primary:'#547a77',secondary:'#d8c9aa',accent:'#694e3a'},contrast={primary:'#ff2455',secondary:'#16c7ef',accent:'#f5de24'};
const records=[],errors=[],phaseChanges=[];let failure='',browser,context,page;
await mkdir(root,{recursive:true});
async function ready(clip){
  await page.waitForFunction(()=>window.__WANHU_REVIEW__?.stats.bones===20&&!!window.__WANHU_RECIPE__);
  if(clip!=='bind')await page.waitForFunction(id=>{const s=window.__WANHU_REVIEW__?.getStatus();return s?.mixamo?.id===id&&s.mixamo.ready&&!s.loading;},clip);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function open(bodyType,top,bottom,clip,view,colors=normal){
  const q=new URLSearchParams({review:'1',paused:'1',preset:'body',bodyType,top,bottom,shoes:'cloth_shoes',headwear:'none',back:'none',leftHand:'none',rightHand:'none',view,...(clip==='bind'?{pose:'bind'}:{mixamo:clip})});
  await page.goto(base+'/?'+q);await ready(clip);
  const recipe=await page.evaluate(()=>window.__WANHU_RECIPE__());recipe.dyes=colors;
  await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:'batch-v5.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recipe))});
  await page.waitForFunction(expected=>JSON.stringify(window.__WANHU_RECIPE__())===expected,JSON.stringify(recipe));await ready(clip);
  assert.equal(await page.locator('[role=alert]').count(),0);
}
async function shot(meta,phase=0,close=false){
  await page.evaluate(p=>window.__WANHU_REVIEW__.seek(p),phase);
  if(close)await page.evaluate(()=>window.__WANHU_REVIEW__.focusTorso());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const status=await page.evaluate(()=>window.__WANHU_REVIEW__.getStatus());
  assert(!status.loadError);if(meta.clip!=='bind')assert(Math.abs(status.phase-phase)<1e-6,'相位与请求不一致');
  const file=[meta.kind,meta.bodyType,meta.top,meta.bottom,meta.clip,meta.view,phase].join('-')+'.png';
  const box=await page.getByTestId('viewport').boundingBox();assert(box&&box.width>0&&box.height>0);
  await page.getByTestId('viewport').screenshot({path:root+'/'+file});
  records.push({...meta,phase,file,camera:await page.evaluate(()=>window.__WANHU_REVIEW__.cameraState()),stats:await page.evaluate(()=>window.__WANHU_REVIEW__.stats),viewport:{width:box.width,height:box.height}});
}
try{
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
  context=await browser.newContext({viewport:{width:1600,height:1100},deviceScaleFactor:1});page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  for(const bodyType of ['male','female'])for(const top of tops)for(const bottom of bottoms){
    for(const view of ['front','side','back','free']){await open(bodyType,top,bottom,'bind',view);await shot({kind:'static',bodyType,top,bottom,clip:'bind',view});}
    if(quick)continue;
    for(const [clip,phase]of priority)for(const view of ['front','side']){await open(bodyType,top,bottom,clip,view);await shot({kind:'motion',bodyType,top,bottom,clip,view},phase);}
    if(!before){
      for(const view of ['front','back']){await open(bodyType,top,bottom,'bind',view,contrast);await shot({kind:'dye',bodyType,top,bottom,clip:'bind',view});}
      await open(bodyType,top,bottom,'snatch','back');await shot({kind:'back-stress',bodyType,top,bottom,clip:'snatch',view:'back'},.05);
    }
  }
  if(!before&&!quick){
    for(const bodyType of ['male','female'])for(const top of ['cross_jacket','layered_vest'])for(const clip of ['pilot-switches','snatch','jogging','shooting-arrow']){
      const bottom=top==='cross_jacket'?'loose_trousers':'guard_pants';await open(bodyType,top,bottom,clip,'side');
      for(const phase of [0,.25,.5,.75,1])await shot({kind:'sequence',bodyType,top,bottom,clip,view:'side'},phase);
    }
    for(const bodyType of ['male','female'])for(const top of tops)for(const view of ['front','free']){
      await open(bodyType,top,'guard_pants','bind',view);await shot({kind:'detail',bodyType,top,bottom:'guard_pants',clip:'bind',view},0,true);
    }
    await open('male','rough_tunic','loose_trousers','pilot-switches','free');
    await page.getByLabel('动画进度',{exact:true}).evaluate(input=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'0.42');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.waitForFunction(()=>Math.abs(window.__WANHU_REVIEW__.getStatus().phase-.42)<1e-6);
    for(const bodyType of ['male','female'])for(const top of tops)for(const bottom of bottoms){
      await page.getByTestId('body-type-'+bodyType).click();await page.getByLabel('上衣',{exact:true}).selectOption(top);await page.getByLabel('下装',{exact:true}).selectOption(bottom);await ready('pilot-switches');
      const r=await page.evaluate(()=>window.__WANHU_RECIPE__()),s=await page.evaluate(()=>window.__WANHU_REVIEW__.getStatus());assert.equal(r.bodyType,bodyType);assert.equal(r.slots.top,top);assert.equal(r.slots.bottom,bottom);assert(Math.abs(s.phase-.42)<1e-6,'换装/男女切换丢失相位');phaseChanges.push({bodyType,top,bottom,phase:s.phase});
    }
    await open('female','layered_vest','guard_pants','bind','free');await page.screenshot({path:root+'/workbench.png',fullPage:true});
  }
  assert.equal(records.length,quick?48:before?168:296);assert.equal(phaseChanges.length,!before&&!quick?12:0);assert.deepEqual(errors,[]);
}catch(error){failure=String(error);throw error;}finally{
  await writeFile(root+'/report.json',JSON.stringify({sourceSha:process.env.REVIEW_HEAD_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),captureEnvironment:process.env.GITHUB_ACTIONS==='true'?'github-actions':'local-browser',serverUrl:base,stage,quick,records,phaseChanges,errors,failure,passed:!failure&&!errors.length,manuallyReviewed:false,videoCapture:false},null,2));await context?.close();await browser?.close();
}
console.log(`PASS first-batch real browser: ${records.length} frames, ${phaseChanges.length} phase-preserving swaps; manual image review separate`);
