import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {MIXAMO_CLIPS} from '../src/character/mixamo/catalog';
const dir='review-tailoring-v2';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});const page=await context.newPage(),errors:string[]=[],shots:any[]=[],videos:string[]=[],playbackChecks:string[]=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const base=process.env.REVIEW_URL??'http://127.0.0.1:4173';
const priority=[...new Set(['pilot-switches','shooting-arrow','jogging',...MIXAMO_CLIPS.filter(c=>c.category==='劳动').slice(0,3).map(c=>c.id)])];
async function open(params:Record<string,string>){await page.goto(base+'/?'+new URLSearchParams({review:'1',paused:'1',headwear:'none',leftHand:'none',rightHand:'none',back:'none',...params}));await page.waitForFunction(()=>!!window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);assert.equal(await page.locator('[role=alert]').count(),0);}
async function shot(name:string,phase:number,metadata:Record<string,unknown>={}){await page.evaluate(p=>window.__WANHU_REVIEW__!.seek(p),phase);await page.waitForTimeout(80);await page.getByTestId('viewport').screenshot({path:`${dir}/${name}.png`});shots.push({file:name+'.png',phase,...metadata});}
let failure='';
try{
 // 每个文件都由独立清单参与实际浏览器加载；不是只增加按钮或复用旧十一条。
 const inventory=JSON.parse(readFileSync('public/mixamo/inventory.json','utf8'));assert.equal(MIXAMO_CLIPS.length,inventory.prepared);
 for(const clip of MIXAMO_CLIPS){await open({bodyType:'female',look:'town-female',mixamo:clip.id,view:'front'});await shot('library-'+clip.id,.5,{clip:clip.id,kind:'library'});}
 for(const bodyType of ['male','female'])for(const look of ['plain-female','town-female','ceremony-female']){
  for(const view of ['front','side','back']){await open({bodyType,look,mixamo:'pilot-switches',view});for(const phase of [0,.25,.5,.75,1])await shot(`${bodyType}-${look}-standard-pilot-${view}-${phase}`,phase,{bodyType,look,view,clip:'pilot-switches'});}
 }
 for(const bodyType of ['male','female'])for(const id of priority.filter(id=>id!=='pilot-switches')){
  await open({bodyType,look:'ceremony-female',mixamo:id,view:'side'});for(let k=0;k<=16;k++)await shot(`${bodyType}-${id}-sequence-${k}`,k/16,{bodyType,clip:id,kind:'sequence'});
 }
 for(const bodyType of ['male','female']){await open({bodyType,look:'town-female',mixamo:'pilot-switches',view:'front',display:'clay'});await shot(`clay-${bodyType}-standard`, .5,{bodyType,kind:'clay'});}
 // 交互检查：搜索、收藏、筛选空结果、快捷坐姿及固定基模换装时序保持。
 await open({bodyType:'female',look:'town-female',mixamo:'pilot-switches',view:'front'});
 await page.getByLabel('搜索动画',{exact:true}).fill('劳动');assert.equal(await page.getByTestId('mixamo-snatch').count(),1);
 await page.getByLabel('搜索动画',{exact:true}).fill('Pilot');assert.equal(await page.getByRole('listitem').count(),1);
 await page.getByLabel('收藏 Pilot Flips Switches',{exact:true}).click();await page.getByLabel('搜索动画',{exact:true}).fill('no-such-motion-xyz');assert.equal(await page.getByRole('listitem').count(),0);await page.getByLabel('搜索动画',{exact:true}).fill('');
 await page.evaluate(()=>window.__WANHU_REVIEW__!.seek(.5));
 assert.equal(await page.getByLabel('身高',{exact:true}).count(),0);
 assert.equal(await page.getByLabel('体格',{exact:true}).count(),0);
 assert.equal(await page.locator('[data-testid^="lod-"]').count(),0);
 for(const bottom of ['loose_trousers','robe_skirt']){
   await page.getByLabel('下装',{exact:true}).selectOption(bottom);
   await page.waitForFunction(()=>!!window.__WANHU_REVIEW__!.getStatus().mixamo?.ready);
   assert(Math.abs((await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus().phase))-.5)<1e-5);
   const recipe=await page.evaluate(()=>window.__WANHU_RECIPE__!());
   assert.equal(recipe.version,5);assert.equal(recipe.bodyType,'female');assert.equal(recipe.slots.bottom,bottom);
 }
 await page.screenshot({path:dir+'/workbench.png'});shots.push({file:'workbench.png',kind:'ui'});
 await page.getByRole('button',{name:'下一帧',exact:true}).click();await page.waitForFunction(()=>window.__WANHU_REVIEW__!.getStatus().phase>.5);
 await page.setViewportSize({width:430,height:932});await page.screenshot({path:dir+'/mobile.png',fullPage:true});shots.push({file:'mobile.png',kind:'ui'});
 // 保留真实播放完成/循环检查，但不录制视频。
 for(const bodyType of ['male','female'])for(const id of ['pilot-switches','shooting-arrow','jogging','snatch']){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},});const p=await ctx.newPage();
  try{p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/?'+new URLSearchParams({review:'1',paused:'1',bodyType,mixamo:id,look:'ceremony-female',view:'side',headwear:'none'}));await p.waitForFunction(()=>!!window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);assert(await p.getByRole('checkbox',{name:'人物动画循环播放',exact:true}).isChecked(),'人物动画默认循环未启用');if(id!=='jogging')await p.getByRole('checkbox',{name:'人物动画循环播放',exact:true}).uncheck();await p.getByRole('button',{name:'播放',exact:true}).click();
   if(id==='jogging')await p.waitForFunction(()=>{const w=window as any;const phase=w.__WANHU_REVIEW__.getStatus().phase;if(w.__lastPhase!==undefined&&phase<w.__lastPhase-.5)w.__loops=(w.__loops??0)+1;w.__lastPhase=phase;return w.__loops>=2;},undefined,{timeout:90000,polling:100});
   else await p.waitForFunction(()=>window.__WANHU_REVIEW__!.getStatus().finished,undefined,{timeout:120000});
  }finally{await ctx.close();playbackChecks.push(`${bodyType}/${id}`);}
 }
 assert.deepEqual(errors,[]);
 assert.equal(shots.length,MIXAMO_CLIPS.length+90+2*priority.filter(id=>id!=='pilot-switches').length*17+2+2);
 assert.equal(playbackChecks.length,8);
}catch(error){failure=String(error);throw error;}finally{await context.close();await browser.close();await writeFile(dir+'/visual.json',JSON.stringify({testedSha:process.env.REVIEW_HEAD_SHA,priority,shots,videos,playbackChecks,errors,failure,passed:!failure&&!errors.length,generated:true,manuallyReviewed:false},null,2));}
console.log(`V2 visual artifacts: ${shots.length} screenshots, ${videos.length} videos; manual review still required.`);
