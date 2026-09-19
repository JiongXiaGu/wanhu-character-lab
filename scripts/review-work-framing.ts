import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {workThreeViewHalfHeight} from '../src/character/actions/framing';
const output=process.env.ACTION_REVIEW_DIR??'review-actions';
for(const aspect of [.7,1,1.5,2.5,3])assert(workThreeViewHalfHeight(1.34,aspect,true)*aspect/3>=1.19);
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1800,height:1100}});const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await mkdir(output,{recursive:true});
  for(const action of ['push','pull']) {
    await page.goto(`http://127.0.0.1:4173/?review=1&paused=1&action=${action}&view=three&phase=.25`,{waitUntil:'networkidle'});
    await page.waitForFunction(id=>window.__WANHU_REVIEW__?.work===id,action);
    await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);
    await page.screenshot({path:`${output}/${action}-three-views.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);console.log('PASS: three-view work-prop framing checks; screenshots require visual inspection.');
}finally{await browser.close();}
