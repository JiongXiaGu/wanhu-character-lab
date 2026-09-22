import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, stat } from 'node:fs/promises';

// 人物矩阵与 FBX 动作矩阵分开：静态绑定不是一个程序动画。
// “基础搭配”已退役；这里使用裸模、日常、轻装和弓手装备四组模块化组合做回归。
const BODY_TYPES=['male','female']; let activeBodyType='male';
const VARIANTS={
  body:{top:'body',bottom:'body',shoes:'body',headwear:'none',back:'none',leftHand:'none',rightHand:'none'},
  daily:{top:'rough_tunic',bottom:'work_pants',shoes:'cloth_shoes',headwear:'none',back:'none',leftHand:'none',rightHand:'none'},
  light:{top:'work_vest',bottom:'short_trousers',shoes:'cloth_shoes',headwear:'cloth_wrap',back:'none',leftHand:'none',rightHand:'none'},
  archer:{top:'short_work_jacket',bottom:'work_wrap',shoes:'cloth_shoes',headwear:'archer_headband',back:'archer_quiver',leftHand:'archer_bow',rightHand:'none'},
};
const directory='review',records=[],errors=[];let failure='';
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});const page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const base=process.env.REVIEW_URL??'http://127.0.0.1:4173';
async function open(params){
  await page.goto(`${base}/?${new URLSearchParams({review:'1',paused:'1',bodyType:activeBodyType,...params})}`);
  await page.waitForFunction(()=>window.__WANHU_REVIEW__?.stats.bones===20);
  if(params.pose!=='bind')await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
  assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.locator('[role="alert"]').count(),0);
  assert.equal(await page.getByText('程序动作对照',{exact:true}).count(),0);
  assert.equal(await page.getByText('基础搭配',{exact:true}).count(),0);
}
async function openVariant(id,params={}){await open({...VARIANTS[id],...params});}
async function shot(file){
  file=activeBodyType+'-'+file;
  await page.waitForTimeout(90);await page.screenshot({path:`${directory}/${file}.png`});
  assert((await stat(`${directory}/${file}.png`)).size>10000);records.push(`${file}.png`);
}
try{
 for(const bodyType of BODY_TYPES){
  activeBodyType=bodyType;await page.setViewportSize({width:1600,height:1000});
  await open({});
  assert.equal((await page.evaluate(()=>window.__WANHU_REVIEW__.getStatus())).mixamo.id,'jogging','default must be an FBX');
  for(const [variant] of Object.entries(VARIANTS)){
    await openVariant(variant,{pose:'bind'});
    assert.equal((await page.evaluate(()=>window.__WANHU_REVIEW__.getStatus())).mixamo,undefined);
    assert(await page.getByRole('button',{name:'播放',exact:true}).isDisabled()||await page.getByRole('button',{name:'暂停',exact:true}).isDisabled());
    for(const [view,label] of [['front','正面'],['side','侧面'],['back','背面']]){
      await page.getByRole('button',{name:label,exact:true}).click();await shot(`${variant}-standard-bind-${view}`);
    }
    await page.getByRole('button',{name:'结构布线',exact:true}).click();await shot(`${variant}-standard-bind-cage`);
  }
  for(const [variant] of Object.entries(VARIANTS))for(const mixamo of ['jogging','shooting-arrow']){
    await openVariant(variant,{mixamo,view:'three',phase:'.6'});
    await shot(`${variant}-${mixamo}-three`);
    await page.getByRole('button',{name:'结构布线',exact:true}).click();await shot(`${variant}-${mixamo}-cage-three`);
  }
  await openVariant('archer',{mixamo:'shooting-arrow',phase:'.6',view:'side'});
  const phase=(await page.evaluate(()=>window.__WANHU_REVIEW__.getStatus())).phase;
  await page.getByLabel('头饰',{exact:true}).selectOption('farmer_straw_hat');
  await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
  assert.equal(await page.getByLabel('左手',{exact:true}).inputValue(),'archer_bow');
  assert.equal(await page.getByLabel('背部',{exact:true}).inputValue(),'archer_quiver');
  assert(Math.abs((await page.evaluate(()=>window.__WANHU_REVIEW__.getStatus())).phase-phase)<1e-6,'DIY lost paused phase');
  await shot('diy-straw-hat-archer');
  await page.getByRole('button',{name:'清空随身装备',exact:true}).click();
  await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
  assert.equal(await page.getByLabel('左手',{exact:true}).inputValue(),'none');await shot('diy-clear-equipment');
  for(const view of ['front','side']){
    await openVariant('daily',{pose:'bind',headwear:'none',view});
    await page.evaluate(()=>window.__WANHU_REVIEW__.focusHead());await shot('head-'+view);
  }
  await page.setViewportSize({width:412,height:915});await openVariant('daily',{pose:'bind'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile horizontal overflow');await shot('bind-mobile');
 }
  await page.setViewportSize({width:1600,height:1000});
  activeBodyType='male';
  await openVariant('archer',{mixamo:'shooting-arrow',phase:'.61',view:'side'});
  const before=await page.evaluate(()=>window.__WANHU_EXPORT_MOTION__());
  const oldGeometry=await page.evaluate(()=>window.__WANHU_REVIEW__.geometryId());
  await page.getByTestId('body-type-female').click();
  await page.waitForFunction(()=>window.__WANHU_EXPORT_MOTION__()?.bodyProfile.id==='female');
  const after=await page.evaluate(()=>window.__WANHU_EXPORT_MOTION__());
  assert.equal(after.bodyProfile.id,"female");
  assert.equal(await page.getByLabel('左手',{exact:true}).inputValue(),'archer_bow');
  assert.equal(await page.getByLabel('背部',{exact:true}).inputValue(),'archer_quiver');
  assert(Math.abs((await page.evaluate(()=>window.__WANHU_REVIEW__.getStatus())).phase-.61)<1e-6);
  assert.notEqual(await page.evaluate(()=>window.__WANHU_REVIEW__.geometryId()),oldGeometry);
  await shot('switch-preserves-diy-phase');
  assert.equal(records.length,75);assert.deepEqual(errors,[]);
}catch(error){failure=String(error);throw error;}finally{
  const report={sourceSha:process.env.REVIEW_HEAD_SHA??'local',testedSha:process.env.GITHUB_SHA??'local',passed:!failure&&!errors.length,
    bodyTypes:2,variants:Object.keys(VARIANTS).length*2,images:records.length,records,errors,failure};
  await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));
  await writeFile(`${directory}/index.html`,`<!doctype html><meta charset="utf-8"><title>Male / female model review</title><style>body{font:16px sans-serif;background:#18242a;color:#eee}main{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0}img{width:100%}</style><h1>Male / female bind / DIY / FBX model review</h1><p>SHA ${report.sourceSha} · Passed ${report.passed}</p><main>${records.map(file=>`<figure><img loading="lazy" src="${file}"><figcaption>${file}</figcaption></figure>`).join('')}</main>`);
  await context.close();await browser.close();
}
console.log(`PASS: 8 fixed male/female modular variants, ${records.length} screenshots, FBX default, static bind and DIY checks.`);
