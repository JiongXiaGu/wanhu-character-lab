import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const id='attendant_fitted_long_robe',reference='narrow_long_robe';
const dir=join('review','garment-focus','top-'+id);
mkdirSync(dir,{recursive:true});
const sourceSHA=process.env.REVIEW_HEAD_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const env={...process.env,REVIEW_HEAD_SHA:sourceSHA};
const checks=[];
function run(label,args){
  const result=spawnSync(process.execPath,args,{stdio:'inherit',env});
  const status=result.status??1;checks.push({label,status,error:result.error?.message});return status;
}
// 数值失败仍截同一候选的真实图；退出码保留，不能以生成图片代替数值通过。
run('C4 static contracts',['node_modules/tsx/dist/cli.mjs','scripts/check-c4-robe.ts']);
run('C4 complete motion matrix',['node_modules/tsx/dist/cli.mjs','scripts/check-c4-motion.ts']);
run('Existing garment-focus matrix',['scripts/review-garment-focus.mjs','--slot','top','--garment',id,'--reference',reference]);
const base=process.env.REVIEW_URL||'http://127.0.0.1:4198';
const log=createWriteStream(join(dir,'c4-extra-server.log'));
const errors=[],records=[],images=[];let server,browser;
try{
  const report=JSON.parse(readFileSync(join(dir,'report.json'),'utf8'));
  const motion=JSON.parse(readFileSync(join(dir,'c4-motion.json'),'utf8'));
  assert.equal(report.sourceSHA,sourceSHA);assert.equal(motion.testedSha,sourceSHA);
  assert.equal(report.garment,id);assert.equal(motion.id,id);
  assert(report.passed,'基础图矩阵必须先生成成功');
  if(!process.env.REVIEW_URL){
    server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4198','--strictPort'],{stdio:['ignore','pipe','pipe']});
    server.stdout.pipe(log,{end:false});server.stderr.pipe(log,{end:false});
    server.on('error',e=>errors.push(String(e)));
  }
  let ready=false;
  for(let i=0;i<150;i++){
    if(server&&server.exitCode!==null)throw Error('C4 preview exited');
    try{if((await fetch(base)).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,200));
  }
  assert(ready,'C4 preview not ready');
  browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1680,height:1050},deviceScaleFactor:1});
  page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  async function load({bodyType,top=id,bottom='work_pants',view='free',clip,time,phase}={}){
    const q=new URLSearchParams({review:'1',paused:'1',bodyType,view,display:'clay',top,bottom,shoes:'cloth_shoes',headwear:'none',back:'none',leftHand:'none',rightHand:'none'});
    if(clip){const source=JSON.parse(readFileSync(`public/mixamo/${clip}.json`,'utf8'));phase=time===undefined?phase:time/source.duration;assert(phase>=0&&phase<=1);q.set('motion',clip);q.set('phase',String(phase));}else q.set('pose','bind');
    await page.goto(base+'/?'+q);await page.waitForFunction(()=>!!window.__WANHU_REVIEW__&&!!window.__WANHU_RECIPE__);
    if(clip){await page.waitForFunction(id=>window.__WANHU_REVIEW__.getStatus().motion?.id===id,clip);await page.evaluate(p=>window.__WANHU_REVIEW__.seek(p),phase);await page.waitForFunction(p=>Math.abs(window.__WANHU_REVIEW__.getStatus().phase-p)<.002,phase);}
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const state=await page.evaluate(()=>({recipe:window.__WANHU_RECIPE__(),stats:window.__WANHU_REVIEW__.stats,status:window.__WANHU_REVIEW__.getStatus(),camera:window.__WANHU_REVIEW__.cameraState()}));
    assert.equal(state.recipe.slots.top,top);assert.equal(state.recipe.bodyType,bodyType);assert.equal(state.recipe.slots.bottom,bottom);
    assert.equal(state.recipe.version,5);assert.equal(Object.keys(state.recipe).length,6);assert.equal(Object.keys(state.recipe.slots).length,7);assert.equal(state.stats.bones,20);
    assert(!state.status.loading&&!state.status.loadError);assert.equal(await page.locator('canvas').count(),1);
    return {...state,view,display:'clay',motion:clip||'bind',requestedPhase:phase??0,requestedTime:time};
  }
  async function shot(file,state,evidence){
    const bytes=await page.locator('canvas').screenshot({path:join(dir,file)});assert(bytes.length>8000,'C4 empty canvas');
    images.push(file);records.push({file,...state,evidence});
  }
  const score=f=>f.hard*100000+f.warning;
  for(const bodyType of ['male','female']){
    // 原矩阵已有目标 free 素模；补 C1 同机位三分之四原图，并验证相机完全相同。
    const referenceState=await load({bodyType,top:reference});
    const targetRecord=report.records.find(r=>r.file===`${bodyType}-clay-free.png`);assert(targetRecord);
    assert.deepEqual(JSON.parse(JSON.stringify(referenceState.camera)),targetRecord.camera,'与 JSON 保存的相机逐项精确比较（仅规范 -0 的编码，不增加容差）');
    await shot(`${bodyType}-${reference}-clay-free.png`,referenceState,{kind:'same-camera-reference'});
    for(const clip of ['start-walking','jogging','pilot-switches','shooting-arrow','snatch']){
      const found=motion.visualFrames.filter(f=>f.bodyType===bodyType&&f.clip===clip);assert(found.length,'完整检测缺少对应动作诊断');
      const worst=found.reduce((a,b)=>score(b)>score(a)?b:a);
      const views=clip==='pilot-switches'?['side','back']:clip==='shooting-arrow'?['front','free']:['free','side'];
      for(const view of views)await shot(`${bodyType}-${clip}-worst-${view}.png`,await load({bodyType,bottom:worst.bottom,view,clip,time:worst.time}),{kind:'numeric-worst',...worst});
    }
    // 早期坐姿会暴露后片与开衩，而不只是较安全的 0.5 相位。
    await shot(`${bodyType}-sitting-early-slit.png`,await load({bodyType,view:'free',clip:'pilot-switches',time:1/30}),{kind:'fixed-slit-phase'});
    for(const bottom of ['work_wrap','long_skirt']){
      const found=motion.visualFrames.filter(f=>f.bodyType===bodyType&&f.bottom===bottom&&f.clip==='jogging');assert.equal(found.length,1);
      await shot(`${bodyType}-${bottom}-jogging-layer.png`,await load({bodyType,bottom,clip:'jogging',time:found[0].time}),{kind:'layer-warning-replay',...found[0]});
    }
  }
  assert.equal(records.length,28);assert.deepEqual(errors,[]);
  const passed=checks.every(c=>c.status===0);
  writeFileSync(join(dir,'c4-review.json'),JSON.stringify({passed,sourceSHA,id,reference,checks,baseReport:'report.json',baseRaw:report.records.length,extraRaw:records.length,images,records,errors,visualApproval:false,note:'真实生产 WebGL；脚本通过不等于实际审图。数字失败保留原退出码。'},null,2));
  console.log('C4_VISUAL',JSON.stringify({passed,sourceSHA,baseRaw:report.records.length,extraRaw:records.length}));
  if(!passed)process.exitCode=1;
}catch(error){
  writeFileSync(join(dir,'c4-review.json'),JSON.stringify({passed:false,sourceSHA,id,checks,images,records,errors,error:String(error?.stack||error),visualApproval:false},null,2));console.error(error);process.exitCode=1;
}finally{await browser?.close();server?.kill('SIGTERM');log.end();}
