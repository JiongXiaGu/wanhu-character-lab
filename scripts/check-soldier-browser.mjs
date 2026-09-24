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
  async function shot(name,full=false){await sync();if(!capture)return;await (full?page:page.locator('canvas')).screenshot({path:join(dir,name)});images.push({name,recipe:await recipe(),state:await state()});}
  await page.goto(`${base}/?review=1&pose=bind&paused=1&view=free`);await page.waitForFunction(()=>!!window.__WANHU_REVIEW__&&!!window.__WANHU_RECIPE__);
  const before=await recipe();await page.getByTestId('soldier-palace').click();await page.waitForFunction(()=>window.__WANHU_RECIPE__().slots.top==='palace_guard_armor');await sync();
  const saved=await recipe();assert.equal(saved.bodyType,before.bodyType);assert.equal(saved.hairStyle,before.hairStyle);assert.equal(saved.hairColor,before.hairColor);assert.equal(Object.keys(saved).length,6);assert.equal(Object.keys(saved.slots).length,7);assert.equal(saved.slots.rightHand,'military_spear');
  for(const [label,id] of [['头饰','palace_guard_helmet'],['上衣','palace_guard_armor'],['下装','palace_guard_skirt'],['鞋','military_boots'],['右手','military_spear']]){const ids=await page.getByLabel(label,{exact:true}).locator('option').evaluateAll(n=>n.map(x=>x.value));assert(ids.includes(id));assert(!ids.some(x=>x.startsWith('frontier_')||x.startsWith('city_guard_')));}
  await page.getByRole('button',{name:'自由',exact:true}).click();await shot('palace-workbench.png',true);await shot('palace-male-three-quarter.png');
  await page.getByRole('button',{name:'三视图',exact:true}).click();await shot('palace-three-views.png');
  await page.getByRole('button',{name:'经营俯视',exact:true}).click();await sync();const cam=await page.evaluate(()=>window.__WANHU_REVIEW__.cameraState());assert(cam.position[1]>cam.target[1]+3);await shot('palace-overview.png');
  checks.push('explicit real palace suit and independent slot options; no frontier/city placeholders; body/hair identity preserved; shared canvas and 20 bones; overview camera');
  await page.getByRole('button',{name:'保存装扮',exact:true}).click();await page.getByRole('button',{name:'清空随身装备',exact:true}).click();assert.equal((await recipe()).slots.rightHand,'none');
  await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await recipe(),saved);
  await page.getByLabel('上衣',{exact:true}).selectOption('work_vest');await page.getByRole('button',{name:'恢复装扮',exact:true}).click();assert.deepEqual(await recipe(),saved);
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'导出配方',exact:true}).click();const stream=await(await downloading).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const bytes=Buffer.concat(chunks);assert.deepEqual(JSON.parse(bytes),saved);
  await page.getByLabel('上衣',{exact:true}).selectOption('work_vest');await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:'palace.json',mimeType:'application/json',buffer:bytes});assert.deepEqual(await recipe(),saved);
  await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...saved,profession:'soldier'}))});assert.deepEqual(await recipe(),saved);
  await page.getByLabel('锁定上衣',{exact:true}).check();await page.getByRole('button',{name:'随机人物',exact:true}).click();assert.equal((await recipe()).slots.top,'palace_guard_armor');
  await page.getByTestId('soldier-palace').click();await page.getByTestId('body-type-female').click();await page.waitForFunction(()=>window.__WANHU_RECIPE__().bodyType==='female');assert.equal((await recipe()).slots.headwear,'palace_guard_helmet');
  await page.getByRole('button',{name:'自由',exact:true}).click();await shot('palace-female-three-quarter.png');
  checks.push('V5 save/restore and file roundtrip; undo, strict invalid import, random slot lock and gender swap');
  await page.goto(`${base}/?review=1&soldier=palace&motion=jogging&paused=1&bodyType=female&rightHand=none&view=free`);await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().motion?.ready);
  await page.evaluate(()=>window.__WANHU_REVIEW__.seek(.375));await sync();const phase=(await state()).status.phase,geometry=(await state()).geometry;
  await page.getByLabel('试衣动画',{exact:true}).selectOption('pilot-switches');await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().motion?.ready);assert.equal((await state()).geometry,geometry);
  await page.evaluate(()=>window.__WANHU_REVIEW__.seek(.5));await shot('palace-seated-fitting.png');
  await page.getByLabel('试衣动画',{exact:true}).selectOption('jogging');await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().motion?.ready);await page.evaluate(()=>window.__WANHU_REVIEW__.seek(phase));
  await page.getByTestId('body-type-male').click();await page.waitForFunction(()=>window.__WANHU_RECIPE__().bodyType==='male'&&window.__WANHU_REVIEW__?.getStatus().motion?.ready);assert(Math.abs((await state()).status.phase-phase)<1e-6);
  await page.getByLabel('头饰',{exact:true}).selectOption('none');await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().motion?.ready);assert(Math.abs((await state()).status.phase-phase)<1e-6);await page.getByLabel('头饰',{exact:true}).selectOption('palace_guard_helmet');await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().motion?.ready);await shot('palace-jogging-fitting.png');
  await page.getByRole('button',{name:'下一帧',exact:true}).click();await sync();assert((await state()).status.phase>phase);
  await page.getByLabel('人物动画循环播放',{exact:true}).uncheck();await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForTimeout(180);await page.getByRole('button',{name:'暂停',exact:true}).click();await sync();
  await page.getByLabel('试衣动画',{exact:true}).selectOption('shooting-arrow');await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().motion?.ready);await page.getByLabel('左手',{exact:true}).selectOption('archer_bow');await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().motion?.ready);await page.evaluate(()=>window.__WANHU_REVIEW__.seek(.5));await shot('palace-archery-fitting.png');
  checks.push('source motion switch reuses geometry; paused phase retained by gender and helmet changes; step, loop and playback controls; sitting, jogging and archery garment previews do not claim combat spear animation');
  await page.goto(`${base}/?review=1&pose=bind&soldier=palace`);await page.waitForFunction(()=>!!window.__WANHU_RECIPE__);assert.equal((await recipe()).slots.rightHand,'military_spear');await page.getByTestId('look-plain-male').click();assert.equal((await recipe()).slots.top,'rough_tunic');
  assert.deepEqual(errors,[]);writeFileSync(join(dir,'report.json'),JSON.stringify({passed:true,sourceSHA,checks,images,errors,visualApproval:false},null,2));console.log(JSON.stringify({passed:true,sourceSHA,checks,images:images.map(x=>x.name)}));
}catch(error){writeFileSync(join(dir,'report.json'),JSON.stringify({passed:false,sourceSHA,checks,images,errors,error:String(error?.stack||error)},null,2));console.error(error);process.exitCode=1;}
finally{await browser?.close();server?.kill('SIGTERM');log.end();}
