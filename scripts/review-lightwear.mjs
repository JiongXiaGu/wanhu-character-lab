import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const stage=process.env.REVIEW_STAGE??'after',before=stage==='before',quick=process.argv.includes('--quick');
assert(/^[a-zA-Z0-9_-]+$/.test(stage));
const root=`review-wardrobe-batch/lightwear-${stage}`,base=process.env.REVIEW_URL??'http://127.0.0.1:4173';
const newMixes=[['work_vest','short_trousers'],['work_vest','true_short_skirt'],['short_work_jacket','short_trousers'],['short_work_jacket','true_short_skirt']];
const mixes=[...newMixes,['work_vest','work_pants'],['short_work_jacket','work_wrap'],['rough_tunic','short_trousers'],['cross_jacket','true_short_skirt']];
const headwear=['guard_helmet','cloth_wrap','scholar_cap','farmer_straw_hat','archer_headband'];
const priority=[['pilot-switches',.5],['snatch',.05],['jogging',.25],['shooting-arrow',.5],['start-walking',.5]];
const normal={primary:'#887560',secondary:'#567577',accent:'#d5be8f'},contrast={primary:'#fa1945',secondary:'#12cee7',accent:'#ffda16'};
const records=[],errors=[],swaps=[];let failure='',browser,context,page;
await mkdir(root,{recursive:true});
const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function ready(clip){
  await page.waitForFunction(()=>window.__WANHU_REVIEW__?.stats.bones===20&&!!window.__WANHU_RECIPE__);
  if(clip!=='bind')await page.waitForFunction(id=>{const s=window.__WANHU_REVIEW__.getStatus();return s.mixamo?.id===id&&s.mixamo.ready&&!s.loading;},clip);
  await settle();
}
async function open(bodyType,clip,view){
  const q=new URLSearchParams({review:'1',paused:'1',bodyType,top:'rough_tunic',bottom:'work_pants',shoes:'cloth_shoes',headwear:'none',back:'none',leftHand:'none',rightHand:'none',view,...(clip==='bind'?{pose:'bind'}:{mixamo:clip})});
  await page.goto(base+'/?'+q);await ready(clip);
}
async function wear(bodyType,top,bottom,clip,colors=normal,hat='none',hair='topknot'){
  const recipe=await page.evaluate(()=>window.__WANHU_RECIPE__());
  recipe.bodyType=bodyType;recipe.slots={...recipe.slots,top,bottom,headwear:hat};recipe.dyes=colors;recipe.hairStyle=hair;recipe.hairColor='#252925';
  await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:'lightwear-v5.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recipe))});
  await page.waitForFunction(expected=>JSON.stringify(window.__WANHU_RECIPE__())===expected,JSON.stringify(recipe));await ready(clip);
  assert.equal(await page.locator('[role=alert]').count(),0);
}
async function shot(meta,phase=0){
  await page.evaluate(p=>window.__WANHU_REVIEW__.seek(p),phase);await settle();
  const status=await page.evaluate(()=>window.__WANHU_REVIEW__.getStatus());assert(!status.loadError);if(meta.clip!=='bind')assert(Math.abs(status.phase-phase)<1e-6);
  const file=[meta.kind,meta.bodyType,meta.top,meta.bottom,meta.headwear??'none',meta.hairStyle??'default',meta.clip,meta.view,phase].join('-')+'.png';
  await page.getByTestId('viewport').screenshot({path:root+'/'+file});
  records.push({...meta,phase,file,recipe:await page.evaluate(()=>window.__WANHU_RECIPE__()),camera:await page.evaluate(()=>window.__WANHU_REVIEW__.cameraState()),stats:await page.evaluate(()=>window.__WANHU_REVIEW__.stats)});
}
try{
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
  context=await browser.newContext({viewport:{width:1600,height:1100},deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(!before)for(const bodyType of ['male','female'])for(const view of ['front','side','back','free']){
    await open(bodyType,'bind',view);
    for(const [top,bottom]of mixes){await wear(bodyType,top,bottom,'bind');await shot({kind:'static',bodyType,top,bottom,clip:'bind',view});}
  }
  // 每个帽饰检查三种发型的正侧面，另补一个背面。前后使用相同固定相机与服装。
  for(const bodyType of ['male','female'])for(const view of ['front','side','back']){
    await open(bodyType,'bind',view);await page.evaluate(()=>window.__WANHU_REVIEW__.focusHead());
    for(const hat of headwear)for(const hair of view==='back'?['topknot']:['topknot','low_bun','double_bun']){
      await wear(bodyType,'rough_tunic','work_pants','bind',normal,hat,hair);
      await shot({kind:'hat',bodyType,top:'rough_tunic',bottom:'work_pants',headwear:hat,hairStyle:hair,clip:'bind',view});
    }
  }
  if(!before&&!quick){
    for(const bodyType of ['male','female'])for(const [clip,phase]of priority)for(const view of ['front','side']){
      await open(bodyType,clip,view);
      for(const [top,bottom]of newMixes){await wear(bodyType,top,bottom,clip);await shot({kind:'motion',bodyType,top,bottom,clip,view},phase);}
    }
    for(const bodyType of ['male','female'])for(const clip of ['pilot-switches','snatch']){
      await open(bodyType,clip,'side');
      for(const [top,bottom]of [newMixes[0],newMixes[3]]){
        await wear(bodyType,top,bottom,clip);
        for(const phase of [0,.25,.75,1])await shot({kind:'sequence',bodyType,top,bottom,clip,view:'side'},phase);
      }
    }
    for(const bodyType of ['male','female'])for(const view of ['front','back']){
      await open(bodyType,'bind',view);
      for(const [top,bottom]of newMixes){await wear(bodyType,top,bottom,'bind',contrast);await shot({kind:'dye',bodyType,top,bottom,clip:'bind',view});}
    }
    for(const bodyType of ['male','female'])for(const top of ['work_vest','short_work_jacket'])for(const view of ['front','free']){
      await open(bodyType,'bind',view);await wear(bodyType,top,'true_short_skirt','bind');await page.evaluate(()=>window.__WANHU_REVIEW__.focusTorso());
      await shot({kind:'detail',bodyType,top,bottom:'true_short_skirt',clip:'bind',view});
    }
    await open('male','pilot-switches','free');
    await page.getByLabel('动画进度',{exact:true}).evaluate(input=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'0.42');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.waitForFunction(()=>Math.abs(window.__WANHU_REVIEW__.getStatus().phase-.42)<1e-6);
    for(const bodyType of ['male','female'])for(const [top,bottom]of newMixes){
      await page.getByTestId('body-type-'+bodyType).click();await page.getByLabel('上衣',{exact:true}).selectOption(top);await page.getByLabel('下装',{exact:true}).selectOption(bottom);await ready('pilot-switches');
      const r=await page.evaluate(()=>window.__WANHU_RECIPE__()),s=await page.evaluate(()=>window.__WANHU_REVIEW__.getStatus());
      assert.equal(r.slots.top,top);assert.equal(r.slots.bottom,bottom);assert.equal(r.bodyType,bodyType);assert(Math.abs(s.phase-.42)<1e-6);swaps.push({bodyType,top,bottom,phase:s.phase});
    }
    await open('female','bind','free');await wear('female','short_work_jacket','true_short_skirt','bind');await page.screenshot({path:root+'/workbench.png',fullPage:true});
  }
  assert.equal(records.length,before?70:quick?134:270);assert.equal(swaps.length,!before&&!quick?8:0);assert.deepEqual(errors,[]);
}catch(error){failure=String(error);throw error;}finally{
  await writeFile(root+'/report.json',JSON.stringify({sourceSha:process.env.REVIEW_HEAD_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),captureEnvironment:process.env.GITHUB_ACTIONS==='true'?'github-actions':'local-browser',stage,quick,records,swaps,errors,failure,passed:!failure&&!errors.length,manuallyReviewed:false,videoCapture:false},null,2));await context?.close();await browser?.close();
}
if(!before)execFileSync('python3',['scripts/compose-lightwear.py'],{stdio:'inherit'});
console.log(`PASS lightwear real browser: ${records.length} frames, ${swaps.length} phase-preserving swaps; manual review separate`);
