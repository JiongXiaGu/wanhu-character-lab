import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,createWriteStream} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';

// 默认仅交互检查；--screenshots 显式生成四张关键图，不代表用户视觉认可。
const capture=process.argv.includes('--screenshots');
const output=capture?'review/back-equipment':join(tmpdir(),'wanhu-back-checks');mkdirSync(output,{recursive:true});
const base=process.env.REVIEW_URL||'http://127.0.0.1:4192';
const sourceSHA=process.env.REVIEW_HEAD_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const errors=[],checks=[],images=[];let server,browser;
const log=createWriteStream(join(output,'server.log'));
try{
  if(!process.env.REVIEW_URL){server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4192','--strictPort'],{stdio:['ignore','pipe','pipe']});server.stdout.pipe(log,{end:false});server.stderr.pipe(log,{end:false});}
  let ready=false;for(let i=0;i<150;i++){if(server&&server.exitCode!==null)throw new Error('Vite stopped');try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready);
  browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1680,height:1050},deviceScaleFactor:1});page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const recipe=()=>page.evaluate(()=>window.__WANHU_RECIPE__());
  const state=()=>page.evaluate(()=>({stats:window.__WANHU_REVIEW__.stats,status:window.__WANHU_REVIEW__.getStatus(),geometry:window.__WANHU_REVIEW__.geometryId()}));
  async function changed(back){await page.waitForFunction(id=>window.__WANHU_RECIPE__?.().slots.back===id,back);await page.waitForTimeout(120);assert.equal((await state()).stats.bones,20);assert.equal(await page.locator('canvas').count(),1);}
  await page.goto(`${base}/?review=1&paused=1&pose=bind&back=bamboo_basket&top=work_vest&bottom=short_trousers&view=three`);
  await page.waitForFunction(()=>!!window.__WANHU_REVIEW__&&!!window.__WANHU_RECIPE__);
  assert.deepEqual(await page.getByLabel('背部',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(n=>n.value)),['none','bamboo_basket','firewood_bundle','book_case','archer_quiver']);
  for(const back of ['bamboo_basket','firewood_bundle','book_case']){
    await page.getByLabel('背部',{exact:true}).selectOption(back);await changed(back);
    const saved=await recipe();await page.getByRole('button',{name:'保存装扮',exact:true}).click();
    await page.getByRole('button',{name:'清空随身装备',exact:true}).click();await changed('none');
    await page.getByRole('button',{name:'撤销',exact:true}).click();await changed(back);
    await page.getByLabel('背部',{exact:true}).selectOption('none');await page.getByRole('button',{name:'恢复装扮',exact:true}).click();await changed(back);assert.deepEqual(await recipe(),saved);
    const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'导出配方',exact:true}).click();const file=await downloaded;
    const stream=await file.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const bytes=Buffer.concat(chunks);assert.deepEqual(JSON.parse(bytes.toString()),saved);
    await page.getByLabel('背部',{exact:true}).selectOption('none');await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:'back.json',mimeType:'application/json',buffer:bytes});await changed(back);
    if(capture){await page.getByLabel('背部',{exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(250);const name=`${back}-three-views.png`;await page.screenshot({path:join(output,name)});images.push(name);}
  }
  checks.push('three real back assets; none and old quiver retained; V5 save/restore, undo and file roundtrip; one canvas and 20 bones');
  const before=await recipe();await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...before,slots:{...before.slots,back:'bad_back'}}))});await page.waitForTimeout(150);assert.deepEqual(await recipe(),before);
  await page.getByLabel('锁定背部',{exact:true}).check();await page.getByRole('button',{name:'随机人物',exact:true}).click();assert.equal((await recipe()).slots.back,'book_case');
  await page.getByTestId('body-type-female').click();await page.waitForFunction(()=>window.__WANHU_RECIPE__().bodyType==='female');assert.equal((await recipe()).slots.back,'book_case');
  await page.getByLabel('背部',{exact:true}).selectOption('archer_quiver');await changed('archer_quiver');await page.getByLabel('背部',{exact:true}).selectOption('none');await changed('none');
  checks.push('invalid import leaves recipe unchanged; random back lock and gender keep selection; legacy quiver/none still usable');
  await page.goto(`${base}/?review=1&paused=1&motion=jogging&back=bamboo_basket&bodyType=female&top=short_work_jacket&bottom=work_pants&view=back`);
  await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().motion?.ready);await page.evaluate(()=>window.__WANHU_REVIEW__.seek(.375));
  const phase=(await state()).status.phase;
  for(const back of ['firewood_bundle','book_case','bamboo_basket']){await page.getByLabel('背部',{exact:true}).selectOption(back);await changed(back);await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().motion?.ready);assert(Math.abs((await state()).status.phase-phase)<1e-6);}
  await page.getByTestId('body-type-male').click();await page.waitForFunction(()=>window.__WANHU_RECIPE__().bodyType==='male'&&window.__WANHU_REVIEW__?.getStatus().motion?.ready);assert(Math.abs((await state()).status.phase-phase)<1e-6);
  await page.getByTestId('body-type-female').click();await page.waitForFunction(()=>window.__WANHU_RECIPE__().bodyType==='female'&&window.__WANHU_REVIEW__?.getStatus().motion?.ready);
  if(capture){await page.getByLabel('背部',{exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(250);const name='female-basket-jogging.png';await page.screenshot({path:join(output,name)});images.push(name);}
  checks.push('real FBX jogging remains paused at same phase through all back assets and gender changes');
  const riderRecipe=await recipe();await page.getByRole('button',{name:'保存装扮',exact:true}).click();
  await page.goto(`${base}/?lab=riding&mount=horse_chestnut&saddle=travel&paused=1&clip=Rider_Walk`);await page.waitForFunction(()=>!!window.__RIDING_REVIEW__);
  await page.getByTestId('riding-restore').click();
  await page.waitForFunction(()=>window.__RIDING_REVIEW__.recipe().slots.back==='bamboo_basket');
  const riding=()=>page.evaluate(()=>({recipe:window.__RIDING_REVIEW__.recipe(),ids:window.__RIDING_REVIEW__.geometryIds(),finite:window.__RIDING_REVIEW__.matricesFinite()}));
  assert.equal((await riding()).recipe.slots.back,'bamboo_basket');const riderId=(await riding()).ids.rider;
  for(const mount of ['donkey_gray','camel_bactrian','cattle_yellow','yak_black','buffalo_water','horse_chestnut']){await page.getByTestId('mount-horse').selectOption(mount);await page.waitForFunction(id=>window.__RIDING_REVIEW__.mountId()===id,mount);const s=await riding();assert(s.finite);assert.equal(s.ids.rider,riderId);assert.equal(s.recipe.slots.back,'bamboo_basket');}
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('wanhu.character.wardrobe.v5'))),riderRecipe);
  checks.push('saved back gear reused by all six mounts without rebuilding rider or overwriting character save');
  assert.deepEqual(errors,[]);writeFileSync(join(output,'report.json'),JSON.stringify({result:'passed',sourceSHA,checks,images,errors,visualApproval:false},null,2));console.log(JSON.stringify({result:'passed',sourceSHA,checks,images}));
}catch(error){writeFileSync(join(output,'report.json'),JSON.stringify({result:'failed',sourceSHA,checks,images,errors,error:String(error?.stack||error)},null,2));console.error(error);process.exitCode=1;}
finally{await browser?.close();server?.kill('SIGTERM');log.end();}
