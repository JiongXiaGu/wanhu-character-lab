import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const stage=process.env.REVIEW_STAGE??'after';
const root=`review-deformation/${stage}`,base=process.env.REVIEW_URL??'http://127.0.0.1:4173';
await mkdir(root,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],records=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
let failure='';
async function capture(bodyType,fit,clip,view,display,phase){
  const query=new URLSearchParams({review:'1',paused:'1',preset:'body',bodyType,top:'body',bottom:fit==='skin'?'body':'loose_trousers',shoes:'body',headwear:'none',back:'none',leftHand:'none',rightHand:'none',view,display,...(clip==='bind'?{pose:'bind'}:{mixamo:clip})});
  await page.goto(`${base}/?${query}`);
  await page.waitForFunction(()=>window.__WANHU_REVIEW__?.stats.bones===20);
  if(clip!=='bind')await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
  const recipe=await page.evaluate(()=>window.__WANHU_RECIPE__());
  recipe.dyes={primary:'#d4c4a9',secondary:'#d5d2c5',accent:'#6f7b78'};
  await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:'review.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recipe))});
  await page.waitForFunction(()=>window.__WANHU_RECIPE__().dyes.secondary==='#d5d2c5');
  if(clip!=='bind')await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
  await page.evaluate(p=>window.__WANHU_REVIEW__.seek(p),phase);
  await page.waitForTimeout(100);
  const actual=await page.evaluate(()=>window.__WANHU_REVIEW__.getStatus().phase);
  if(clip!=='bind')assert(Math.abs(actual-phase)<1e-6);
  const camera=await page.evaluate(()=>window.__WANHU_REVIEW__.cameraState());
  const box=await page.getByTestId('viewport').boundingBox();
  const file=`${bodyType}-${fit}-${clip}-${view}-${display}-${phase}.png`;
  await page.getByTestId('viewport').screenshot({path:`${root}/${file}`});
  records.push({file,bodyType,fit,clip,view,display,phase,camera,viewport:{width:box.width,height:box.height}});
}
try{
  for(const bodyType of ['male','female'])for(const fit of ['skin','pants'])for(const [clip,phase]of [['bind',0],['pilot-switches',.5],['snatch',.05]])for(const view of ['front','side','back'])for(const display of ['beauty','cage'])await capture(bodyType,fit,clip,view,display,phase);
  for(const bodyType of ['male','female'])for(const fit of ['skin','pants'])for(const clip of ['pilot-switches','snatch','jogging'])for(const phase of [0,.25,.5,.75,1])await capture(bodyType,fit,clip,'side','unlit',phase);
  assert.equal(records.length,132);assert.deepEqual(errors,[]);
}catch(e){failure=String(e);throw e;}finally{
  await writeFile(root+'/report.json',JSON.stringify({sourceSha:process.env.REVIEW_HEAD_SHA,stage,records,errors,failure,passed:!failure&&!errors.length,manualApproval:false,videoCapture:false},null,2));
  await context.close();await browser.close();
}
