import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.REVIEW_URL||'http://127.0.0.1:5178';
const directory=process.env.REVIEW_OUTPUT||'review/fairy';
mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],shots=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const frames=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 async function open(name,{motion,phase=0,view='front',bodyType='female'}={}){
  const q=new URLSearchParams({review:'1',paused:'1',look:'fairy-pink',bodyType,view});
  if(motion){q.set('motion',motion);q.set('phase',String(phase));}else q.set('pose','bind');
  await page.goto(base+'/?'+q);
  await page.waitForFunction(()=>window.__WANHU_REVIEW__&&window.__WANHU_RECIPE__);
  if(motion){await page.waitForFunction(id=>window.__WANHU_REVIEW__.getStatus().motion?.id===id,motion);await page.evaluate(p=>window.__WANHU_REVIEW__.seek(p),phase);await page.waitForFunction(p=>Math.abs(window.__WANHU_REVIEW__.getStatus().phase-p)<.002,phase);}
  await frames();assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.locator('vite-error-overlay').count(),0);
  const state=await page.evaluate(()=>({recipe:window.__WANHU_RECIPE__(),stats:window.__WANHU_REVIEW__.stats,status:window.__WANHU_REVIEW__.getStatus(),camera:window.__WANHU_REVIEW__.cameraState()}));
  assert.equal(state.recipe.slots.top,'fairy_jacket');assert.equal(state.recipe.slots.bottom,'fairy_long_skirt');assert.equal(state.stats.bones,20);assert(!state.status.loading&&!state.status.loadError);
  await page.locator('canvas').screenshot({path:directory+'/'+name+'.png'});shots.push({file:name+'.png',state});
  return state;
 }
 await open('female-front');
 await page.getByTestId('look-town-female').click();await page.waitForFunction(()=>window.__WANHU_RECIPE__().slots.top==='cross_jacket');
 await page.getByTestId('look-fairy-pink').click();await page.waitForFunction(()=>window.__WANHU_RECIPE__().slots.top==='fairy_jacket');await frames();
 const original=await open('female-jogging',{motion:'jogging',phase:.5,view:'free'});
 const top=page.getByLabel('上衣',{exact:true});
 for(const id of ['cross_jacket','fairy_jacket']){
  await top.selectOption(id);await page.waitForFunction(id=>window.__WANHU_RECIPE__().slots.top===id,id);await frames();
  const state=await page.evaluate(()=>({recipe:window.__WANHU_RECIPE__(),status:window.__WANHU_REVIEW__.getStatus(),camera:window.__WANHU_REVIEW__.cameraState()}));
  assert.equal(state.recipe.slots.bottom,'fairy_long_skirt');assert.equal(state.status.motion.id,'jogging');assert(Math.abs(state.status.phase-.5)<.002);assert.deepEqual(state.camera,original.camera);
 }
 const bottom=page.getByLabel('下装',{exact:true});
 for(const id of ['long_skirt','fairy_long_skirt']){
  await bottom.selectOption(id);await page.waitForFunction(id=>window.__WANHU_RECIPE__().slots.bottom===id,id);await frames();
  assert.equal(await page.evaluate(()=>window.__WANHU_RECIPE__().slots.top),'fairy_jacket');
 }
 await open('female-arrow',{motion:'shooting-arrow',phase:.5,view:'free'});
 await open('female-squat',{motion:'snatch',phase:.02857,view:'side'});
 await open('male-reference',{bodyType:'male',view:'free'});
 assert.deepEqual(errors,[]);
 writeFileSync(directory+'/browser-check.json',JSON.stringify({passed:true,errors,shots,scope:'本机Playwright/WebGL加载、搭配、自由换装、暂停相位与相机保持；看图和用户主观验收另行记录。'},null,2));
 console.log('FAIRY_BROWSER_CHECK',JSON.stringify({passed:true,errors,images:shots.length,slotSwitches:4}));
}finally{await browser.close();}
