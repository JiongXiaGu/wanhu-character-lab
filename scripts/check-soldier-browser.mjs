import { checkSoldierIdentities } from './check-soldier-identities-browser.mjs';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,createWriteStream} from 'node:fs';
import {join} from 'node:path';
import {chromium} from 'playwright';

// 正常交互与显式截图分别运行；每张图记录真实配方/动作，而不是军事动作承诺。
const capture=process.argv.includes('--screenshots'),dir=process.env.SOLDIER_BROWSER_DIR||(capture?'review/soldier':'/tmp/wanhu-soldier-browser');mkdirSync(dir,{recursive:true});
const sourceSHA=process.env.REVIEW_HEAD_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const base=process.env.REVIEW_URL||'http://127.0.0.1:4196',checks=[],images=[],errors=[];let server,browser;
const log=createWriteStream(join(dir,'server.log'));
try{
  if(!process.env.REVIEW_URL){server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4196','--strictPort'],{stdio:['ignore','pipe','pipe']});server.stdout.pipe(log,{end:false});server.stderr.pipe(log,{end:false});}
  let ready=false;for(let i=0;i<150;i++){if(server&&server.exitCode!==null)throw new Error('Vite stopped');try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready);
  browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1680,height:1050},deviceScaleFactor:1});page.setDefaultTimeout(45000);
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const recipe=()=>page.evaluate(()=>window.__WANHU_RECIPE__());
  const state=()=>page.evaluate(()=>({stats:window.__WANHU_REVIEW__.stats,status:window.__WANHU_REVIEW__.getStatus(),geometry:window.__WANHU_REVIEW__.geometryId()}));
  async function sync(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal((await state()).stats.bones,20);assert.equal(await page.locator('canvas').count(),1);}
  async function motionReady(id){await page.waitForFunction(id=>{const s=window.__WANHU_REVIEW__?.getStatus().motion;return s?.ready&&s.id===id;},id);await sync();}
  async function seek(value){
    // 切换动画会自动播放。先操作真实暂停按钮，再检查“暂停换装相位不变”。
    const pause=page.getByRole('button',{name:'暂停',exact:true});if(await pause.count())await pause.click();
    await page.evaluate(value=>window.__WANHU_REVIEW__.seek(value),value);await sync();
    assert(Math.abs((await state()).status.phase-value)<1e-6);
  }
  async function shot(name,full=false){await sync();if(!capture)return;await (full?page:page.locator('canvas')).screenshot({path:join(dir,name)});images.push({name,recipe:await recipe(),state:await state()});}
  const styles=[
    {id:'palace',helmet:'palace_guard_helmet',top:'palace_guard_armor',bottom:'palace_guard_skirt'},
    {id:'frontier',helmet:'frontier_guard_helmet',top:'frontier_lamellar_armor',bottom:'frontier_armor_skirt'},
    {id:'city',helmet:'city_guard_helmet',top:'city_guard_brigandine',bottom:'city_guard_trousers'},
  ];
  for(const style of styles){
  await page.goto(`${base}/?review=1&pose=bind&paused=1&view=free`);await page.waitForFunction(()=>!!window.__WANHU_REVIEW__&&!!window.__WANHU_RECIPE__);
  const before=await recipe();await page.getByTestId(`soldier-${style.id}`).click();await page.waitForFunction(top=>window.__WANHU_RECIPE__().slots.top===top,style.top);await sync();
  const saved=await recipe();assert.equal(saved.bodyType,before.bodyType);assert.equal(saved.hairStyle,before.hairStyle);assert.equal(saved.hairColor,before.hairColor);assert.equal(Object.keys(saved).length,6);assert.equal(Object.keys(saved.slots).length,7);assert.equal(saved.slots.rightHand,'military_spear');
  for(const [label,id] of [['头饰',style.helmet],['上衣',style.top],['下装',style.bottom],['鞋','military_boots'],['右手','military_spear']]){const ids=await page.getByLabel(label,{exact:true}).locator('option').evaluateAll(n=>n.map(x=>x.value));assert(ids.includes(id));const key={'头饰':'helmet','上衣':'top','下装':'bottom'}[label];if(key)for(const real of styles)assert(ids.includes(real[key]),'三套都必须有真实可选部件');}
  await page.getByRole('button',{name:'自由',exact:true}).click();await shot(`${style.id}-workbench.png`,true);await shot(`${style.id}-male-three-quarter.png`);
  await page.getByRole('button',{name:'正面',exact:true}).click();await shot(`${style.id}-skirt-front.png`);
  await page.getByRole('button',{name:'三视图',exact:true}).click();await shot(`${style.id}-three-views.png`);
  await page.getByRole('button',{name:'经营俯视',exact:true}).click();await sync();const cam=await page.evaluate(()=>window.__WANHU_REVIEW__.cameraState());assert(cam.position[1]>cam.target[1]+3);await shot(`${style.id}-overview.png`);
  checks.push(style.id+': '+ 'explicit real military suit and independent slot options; three real authored styles; body/hair identity preserved; shared canvas and 20 bones; overview camera');
  await page.getByRole('button',{name:'保存装扮',exact:true}).click();await page.getByRole('button',{name:'清空随身装备',exact:true}).click();assert.equal((await recipe()).slots.rightHand,'none');
  await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await recipe(),saved);
  await page.getByLabel('上衣',{exact:true}).selectOption('work_vest');await page.getByRole('button',{name:'恢复装扮',exact:true}).click();assert.deepEqual(await recipe(),saved);
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'导出配方',exact:true}).click();const stream=await(await downloading).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const bytes=Buffer.concat(chunks);assert.deepEqual(JSON.parse(bytes),saved);
  await page.getByLabel('上衣',{exact:true}).selectOption('work_vest');await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:`${style.id}.json`,mimeType:'application/json',buffer:bytes});await page.waitForFunction(top=>window.__WANHU_RECIPE__().slots.top===top,style.top);assert.deepEqual(await recipe(),saved);
  await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...saved,profession:'soldier'}))});await page.locator('.notice-error').waitFor({state:'visible'});assert.deepEqual(await recipe(),saved);
  // 先验收故意触发的错误及配方保持，再通过真实关闭按钮清理提示；不改DOM或隐藏运行时错误。
  await page.getByRole('button',{name:'关闭提示',exact:true}).click();await page.locator('.studio-notice').waitFor({state:'hidden'});assert.deepEqual(await recipe(),saved);
  await page.getByLabel('锁定上衣',{exact:true}).check();await page.getByRole('button',{name:'随机人物',exact:true}).click();assert.equal((await recipe()).slots.top,style.top);
  await page.getByTestId(`soldier-${style.id}`).click();await page.getByTestId('body-type-female').click();await page.waitForFunction(()=>window.__WANHU_RECIPE__().bodyType==='female');assert.equal((await recipe()).slots.headwear,style.helmet);
  // 随机成功提示同样通过用户入口关闭，避免覆盖接下来的女性资产截图。
  await page.getByRole('button',{name:'关闭提示',exact:true}).click();await page.locator('.studio-notice').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'自由',exact:true}).click();await shot(`${style.id}-female-three-quarter.png`);
  checks.push(style.id+': '+ 'V5 save/restore and file roundtrip; undo, strict invalid import and explicit notice dismissal, random slot lock and gender swap');
  await page.goto(`${base}/?review=1&soldier=${style.id}&motion=jogging&paused=1&bodyType=female&rightHand=none&view=free`);await motionReady('jogging');
  await seek(.375);const phase=(await state()).status.phase,geometry=(await state()).geometry;
  await page.getByLabel('试衣动画',{exact:true}).selectOption('pilot-switches');await motionReady('pilot-switches');assert.equal((await state()).geometry,geometry);
  await seek(.5);await shot(`${style.id}-seated-fitting.png`);
  await page.getByLabel('试衣动画',{exact:true}).selectOption('jogging');await motionReady('jogging');await seek(phase);
  await page.getByTestId('body-type-male').click();await page.waitForFunction(()=>window.__WANHU_RECIPE__().bodyType==='male');await motionReady('jogging');assert(Math.abs((await state()).status.phase-phase)<1e-6);
  await page.getByLabel('头饰',{exact:true}).selectOption('none');await motionReady('jogging');assert(Math.abs((await state()).status.phase-phase)<1e-6);await page.getByLabel('头饰',{exact:true}).selectOption(style.helmet);await motionReady('jogging');await shot(`${style.id}-jogging-fitting.png`);
  await page.getByRole('button',{name:'下一帧',exact:true}).click();await sync();assert((await state()).status.phase>phase);
  await page.getByLabel('人物动画循环播放',{exact:true}).uncheck();await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForTimeout(180);await page.getByRole('button',{name:'暂停',exact:true}).click();await sync();
  await page.getByLabel('试衣动画',{exact:true}).selectOption('shooting-arrow');await motionReady('shooting-arrow');await page.getByLabel('左手',{exact:true}).selectOption('archer_bow');await motionReady('shooting-arrow');await seek(.5);await shot(`${style.id}-archery-fitting.png`);
  checks.push(style.id+': '+ 'source motion switch reuses geometry; paused phase retained by gender and helmet changes; step, loop and playback controls; sitting, jogging and archery garment previews do not claim combat spear animation');
  await page.goto(`${base}/?review=1&pose=bind&soldier=${style.id}`);await page.waitForFunction(()=>!!window.__WANHU_RECIPE__);assert.equal((await recipe()).slots.rightHand,'military_spear');await page.getByTestId('look-plain-male').click();assert.equal((await recipe()).slots.top,'rough_tunic');
  }
  // 同一个运行时 Canvas、完全相同相机及绑定姿态顺序换装；对比图只拼接真实捕获帧。
  await page.goto(`${base}/?review=1&pose=bind&soldier=palace&paused=1&view=free`);
  await page.waitForFunction(()=>!!window.__WANHU_REVIEW__&&!!window.__WANHU_RECIPE__);await sync();
  const palaceCamera=await page.evaluate(()=>window.__WANHU_REVIEW__.cameraState());
  const palaceGeometry=(await state()).geometry;
  await shot('comparison-palace.png');
  const palaceFrame=capture?await page.locator('canvas').screenshot():null;
  await page.getByTestId('soldier-frontier').click();await sync();
  assert.equal((await recipe()).slots.top,'frontier_lamellar_armor');assert.notEqual((await state()).geometry,palaceGeometry);
  const frontierCamera=await page.evaluate(()=>window.__WANHU_REVIEW__.cameraState());assert.deepEqual(frontierCamera,palaceCamera);
  await shot('comparison-frontier.png');
  const frontierFrame=capture?await page.locator('canvas').screenshot():null;
  await page.getByRole('button',{name:'撤销',exact:true}).click();await sync();assert.equal((await recipe()).slots.top,'palace_guard_armor');
  await page.getByTestId('soldier-frontier').click();await sync();assert.equal((await recipe()).slots.headwear,'frontier_guard_helmet');
  checks.push('palace/frontier application and undo use the same canvas and exact camera; distinct geometry IDs; no identity/protocol changes');
  if(capture){
    const sheet=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
    await sheet.setContent(`<html><head><style>body{margin:0;background:#e5e1d8;font:24px sans-serif;color:#252723}.row{display:flex}figure{margin:20px;width:760px}figcaption{text-align:center;padding:12px}img{width:760px;height:875px;object-fit:contain}</style></head><body><div class="row"><figure><figcaption>皇宫禁卫 · Palace</figcaption><img src="data:image/png;base64,${palaceFrame.toString('base64')}"></figure><figure><figcaption>边疆戍卒 · Frontier</figcaption><img src="data:image/png;base64,${frontierFrame.toString('base64')}"></figure></div></body></html>`);
    await sheet.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
    await sheet.screenshot({path:join(dir,'palace-vs-frontier.png')});await sheet.close();
    images.push({name:'palace-vs-frontier.png',sources:['comparison-palace.png','comparison-frontier.png'],camera:palaceCamera,composition:'two captured WebGL frames; no second application renderer'});
  }

  // S3：沿用以上运行时与相机捕获第三套，原双套对比图保持。
  await page.getByTestId('soldier-city').click();await sync();
  assert.equal((await recipe()).slots.top,'city_guard_brigandine');
  assert.deepEqual(await page.evaluate(()=>window.__WANHU_REVIEW__.cameraState()),palaceCamera);
  await shot('comparison-city.png');
  const cityFrame=capture?await page.locator('canvas').screenshot():null;
  await page.getByRole('button',{name:'撤销',exact:true}).click();await sync();assert.equal((await recipe()).slots.top,'frontier_lamellar_armor');
  await page.getByTestId('soldier-palace').click();await sync();assert.equal((await recipe()).slots.top,'palace_guard_armor');
  checks.push('palace/frontier/city real three-way application and undo; identical camera, bind pose, shared runtime canvas and unchanged V5 identity');
  if(capture){
    const sheet=await browser.newPage({viewport:{width:2040,height:1000},deviceScaleFactor:1});
    const panels=[['皇宫禁卫 · Palace',palaceFrame],['边疆戍卒 · Frontier',frontierFrame],['城市守军 · City',cityFrame]];
    await sheet.setContent(`<html><head><style>body{margin:0;background:#e5e1d8;font:24px sans-serif;color:#252723}.row{display:flex}figure{margin:16px;width:648px}figcaption{text-align:center;padding:12px}img{width:648px;height:900px;object-fit:contain}</style></head><body><div class="row">${panels.map(([name,bytes])=>`<figure><figcaption>${name}</figcaption><img src="data:image/png;base64,${bytes.toString('base64')}"></figure>`).join('')}</div></body></html>`);
    await sheet.locator('img').evaluateAll(items=>Promise.all(items.map(i=>i.decode())));
    await sheet.screenshot({path:join(dir,'palace-frontier-city.png')});await sheet.close();
    images.push({name:'palace-frontier-city.png',sources:['comparison-palace.png','comparison-frontier.png','comparison-city.png'],camera:palaceCamera,composition:'three captured WebGL frames from the same application canvas; no new soldier renderer'});
  }
  await checkSoldierIdentities({page,browser,base,capture,dir,recipe,state,sync,motionReady,seek,shot,checks,images,styles});
  assert.deepEqual(errors,[]);writeFileSync(join(dir,'report.json'),JSON.stringify({passed:true,sourceSHA,checks,images,errors,visualApproval:false},null,2));console.log(JSON.stringify({passed:true,sourceSHA,checks,images:images.map(x=>x.name)}));
}catch(error){writeFileSync(join(dir,'report.json'),JSON.stringify({passed:false,sourceSHA,checks,images,errors,error:String(error?.stack||error)},null,2));console.error(error);process.exitCode=1;}
finally{await browser?.close();server?.kill('SIGTERM');log.end();}
