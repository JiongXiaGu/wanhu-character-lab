import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {WORK_IDS,ACTIONS} from '../src/character/actions/catalog';
const root=process.env.REVIEW_URL??'http://127.0.0.1:4173',out=process.env.ACTION_REVIEW_DIR??'review-actions';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1080},deviceScaleFactor:1});
const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const records:{id:string;label:string;files:string[];status?:unknown}[]=[];
async function open(action:string,view='free',display='beauty',phase=.25) {
  await page.goto(`${root}/?review=1&paused=1&outfit=farmer&action=${action}&view=${view}&display=${display}&phase=${phase}`,{waitUntil:'networkidle'});
  await page.waitForFunction((id)=>window.__WANHU_REVIEW__?.work===id,action,{timeout:15000});
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(p=>window.__WANHU_REVIEW__!.seek(p),phase);await page.waitForTimeout(100);
  assert.equal(await page.locator('[role="alert"]').count(),0);
}
try {
  assert.deepEqual(Object.keys(ACTIONS).sort(),[...WORK_IDS].sort(),'存在可播放动作没有加入审查入口');
  for(const id of WORK_IDS){
    const def=ACTIONS[id],record:{id:string;label:string;files:string[];status?:unknown}={id,label:def.label,files:[]};await mkdir(`${out}/${id}`,{recursive:true});
    for(const [view,display]of [['front','beauty'],['side','beauty'],['back','beauty'],['free','cage']]) {
      await open(id,view,display,def.reviewPhase);
      const file=`${id}/${view}-${display}.png`;await page.screenshot({path:`${out}/${file}`,fullPage:true});record.files.push(file);
    }
    await open(id,'free','beauty',0);
    // 循环必须包含四分周期；单次动作覆盖起始/接触/恢复。
    const phases=def.loop?[0,.25,.5,.52,.75,.999]:[0,.2,.38,.52,.75,1];
    for(const phase of phases){
      await page.evaluate(p=>window.__WANHU_REVIEW__!.seek(p),phase);await page.waitForTimeout(100);
      const file=`${id}/frame-${Math.round(phase*100).toString().padStart(3,'0')}.png`;await page.locator('.stage').screenshot({path:`${out}/${file}`});record.files.push(file);
    }
    record.status=await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus());records.push(record);console.log('REVIEW',id,record.files.length,'screenshots');
  }
  // 实际 UI 播放与动作事件，不以截图生成成功冒充行为成功。
  await open('pick');await page.getByRole('button',{name:'重播动作',exact:true}).click();await page.getByLabel('速度',{exact:true}).selectOption('2');
  await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().finished===true,undefined,{timeout:12000});
  assert.equal(await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus().eventCount),2);
  assert.equal(await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus().phase),1);
  await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus().phase),1,'单次动作完成后循环了');assert.equal(await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus().eventCount),2,'结束后界面清空了动作事件');
  await page.getByRole('button',{name:'双手锄地',exact:true}).click();
  await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().eventCount!>=1,undefined,{timeout:10000});
  await page.getByLabel('暂停',{exact:true}).click();const count=await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus().eventCount);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus().eventCount),count);
  await page.getByLabel('动画进度',{exact:true}).evaluate(el=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,'0.52');el.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus().eventCount),0);
  await page.getByLabel('握点检查',{exact:true}).check();await page.screenshot({path:`${out}/contact-debug.png`,fullPage:true});
  await page.locator('.outfit').nth(2).click();await page.getByLabel('头饰',{exact:true}).selectOption('farmer_straw_hat');
  await page.getByRole('button',{name:'抱箱行走',exact:true}).click();await page.getByLabel('身高',{exact:true}).press('End');await page.getByLabel('体格',{exact:true}).press('End');
  assert.equal(await page.getByLabel('左手',{exact:true}).inputValue(),'archer_bow','劳动动作改坏原穿戴');
  await page.getByLabel('暂停',{exact:true}).click();await page.evaluate(()=>window.__WANHU_REVIEW__!.seek(.25));
  await page.screenshot({path:`${out}/diy-tall-carry.png`,fullPage:true});
  await page.getByRole('button',{name:'待机',exact:true}).click();await page.waitForFunction(()=>window.__WANHU_REVIEW__?.work==='none');
  assert.equal(await page.getByLabel('左手',{exact:true}).inputValue(),'archer_bow');assert.equal(await page.getByLabel('背部',{exact:true}).inputValue(),'archer_quiver');
  await page.setViewportSize({width:390,height:844});await open('push');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/mobile-push.png`,fullPage:true});
  assert.deepEqual(errors,[]);assert.equal(records.length,WORK_IDS.length);assert(records.every(r=>r.files.length===10));
  for(const id of WORK_IDS){const record=records.find(r=>r.id===id)!;for(const view of ['front-beauty','side-beauty','back-beauty','free-cage'])assert(record.files.includes(`${id}/${view}.png`));if(ACTIONS[id].loop)for(const phase of ['000','025','050','075'])assert(record.files.includes(`${id}/frame-${phase}.png`));}
  const report={pass:true,sha:process.env.GITHUB_SHA??'local',actions:records,errors,checks:['all catalog actions x 10 views/frames','0/25/50/75 loop coverage','real playback','one shot endpoint','semantic events retained after stop','seek no events','pause','DIY restored','body size endpoints','mobile']};
  await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  const html=`<!doctype html><html lang="zh"><meta charset="utf-8"><title>万户劳动动作审查</title><style>body{font:15px system-ui;background:#16252b;color:#deded0;max-width:1440px;margin:30px auto;padding:20px}section{border-top:1px solid #546164;margin-top:35px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}img{max-width:100%}a{color:#ddc6a0}h1{font-weight:500}</style><h1>第一轮劳动动作 · GitHub Actions 截图</h1><p>Commit: ${report.sha}。测试通过不等于美术自动通过；每项含正面、侧面、背面、布线与六个关键帧。</p>${records.map(r=>`<section><h2>${r.label} / ${r.id}</h2><div class="grid">${r.files.map(f=>`<figure><a href="${f}"><img loading="lazy" src="${f}"></a><figcaption>${f}</figcaption></figure>`).join('')}</div></section>`).join('')}</html>`;
  await writeFile(`${out}/index.html`,html);console.log('PASS: 9 action reviews and browser interactions. Human screenshot review required.');
} catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({error:String(e),errors,records},null,2));throw e;}finally{await browser.close();}
