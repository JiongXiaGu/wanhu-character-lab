import assert from 'node:assert/strict';
import {mkdir,stat,writeFile,readFile} from 'node:fs/promises';
import {chromium,type Page} from 'playwright';
import {WARDROBE_LOOKS,parseRecipeFile} from '../src/character/wardrobe/catalog';
const dir='review-wardrobe',records:string[]=[],videos:string[]=[],playbackChecks:string[]=[],errors:string[]=[];
const base=process.env.REVIEW_URL??'http://127.0.0.1:4173';let failure='';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function open(params:Record<string,string>){await page.goto(`${base}/?${new URLSearchParams({review:'1',pose:'bind',paused:'1',...params})}`);await page.waitForFunction(()=>window.__WANHU_REVIEW__?.stats.bones===20);if(params.mixamo)await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);}
async function shot(name:string){await page.waitForTimeout(120);await page.screenshot({path:`${dir}/${name}.png`});assert((await stat(`${dir}/${name}.png`)).size>10000);records.push(`${name}.png`);}
async function recipe(p:Page=page){return p.evaluate(()=>window.__WANHU_RECIPE__!());}
try{
 // 每个搭配仍有17张：静态5、男女2、动作2×5；公共交互/小屏7张。
 // 原8搭配不得因目录扩充而消失，第二批新增2搭配使143增加到177。
 const lookIds=new Set(WARDROBE_LOOKS.map(look=>look.id));
 for(const family of ['plain','town','elegant','ceremony'])for(const body of ['male','female'])assert(lookIds.has(`${family}-${body}`),'原搭配被移除');
 assert.equal(lookIds.size,WARDROBE_LOOKS.length,'搭配ID重复');
 // 普通入口与诊断入口分开验收：试衣默认静态，而不是隐式程序待机。
 await page.goto(base);await page.waitForSelector('canvas');await page.waitForTimeout(300);assert.equal(await page.getByLabel('试衣动画',{exact:true}).inputValue(),'none');await shot('studio-default');
 for(const look of WARDROBE_LOOKS){
  await open({look:look.id,bodyType:look.suggestedBody});
  for(const [view,label]of[['front','正面'],['side','侧面'],['back','背面']]){await page.getByRole('button',{name:label,exact:true}).click();await shot(`${look.id}-${view}`);}
  await page.getByRole('button',{name:'素模',exact:true}).click();await page.getByRole('button',{name:'正面',exact:true}).click();await shot(`${look.id}-silhouette`);
  await page.getByRole('button',{name:'结构布线',exact:true}).click();await shot(`${look.id}-cage`);
  for(const bodyType of ['male','female']){await open({look:look.id,bodyType,view:'three'});await shot(`${look.id}-${bodyType}-standard`);}
  for(const mixamo of ['jogging','shooting-arrow']){
   await open({look:look.id,bodyType:look.suggestedBody,pose:'',mixamo,view:'three'});
   for(const phase of [0,.25,.5,.75,1]){await page.evaluate(p=>window.__WANHU_REVIEW__!.seek(p),phase);await shot(`${look.id}-${mixamo}-${Math.round(phase*100)}`);}
  }
  console.log('REVIEW wardrobe '+look.id);
 }
 // 默认 UI 截图不把诊断展开状态当作用户入口。
 await page.goto(`${base}/?bodyType=female&look=town-female`);await page.waitForSelector('canvas');await shot('studio-female');
 await open({look:'town-female',bodyType:'female',pose:'',mixamo:'shooting-arrow',phase:'.45'});
 let before=await recipe();
 await page.getByLabel('头饰',{exact:true}).selectOption('farmer_straw_hat');await page.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
 assert.equal((await recipe()).slots.top,before.slots.top);assert(Math.abs((await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus())).phase-.45)<1e-6);
 await page.getByLabel('锁定头饰',{exact:true}).check();await page.getByLabel('锁定染色',{exact:true}).check();
 before=await recipe();await page.getByLabel('搭配种子',{exact:true}).fill('123');await page.getByRole('button',{name:'随机搭配',exact:true}).click();
 let after=await recipe();assert.equal(after.slots.headwear,before.slots.headwear);assert.deepEqual(after.dyes,before.dyes);assert.equal(after.bodyType,before.bodyType);await shot('random-locked');
 await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await recipe(),before);
 await page.getByRole('button',{name:'保存装扮',exact:true}).click();await page.getByLabel('上衣',{exact:true}).selectOption('rough_tunic');await page.getByRole('button',{name:'恢复装扮',exact:true}).click();assert.deepEqual(await recipe(),before);
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出配方',exact:true}).click()]);
 await download.saveAs(`${dir}/reviewed-recipe.json`);const text=await readFile(`${dir}/reviewed-recipe.json`,'utf8');assert.deepEqual(parseRecipeFile(text),before);
 await page.getByLabel('下装',{exact:true}).selectOption('work_pants');await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:'saved.json',mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForFunction(r=>JSON.stringify(window.__WANHU_RECIPE__!())===r,JSON.stringify(before));
 await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await page.locator('.studio-notice.notice-error').waitFor();assert((await page.locator('.studio-notice.notice-error').textContent())?.includes('不是有效的 JSON 配方。'));assert.deepEqual(await recipe(),before);
 for(const invalid of [{...before,version:4},{...before,height:1.9},{...before,slots:{...before.slots,unknown:'x'}}]){
  await page.getByLabel('导入配方文件',{exact:true}).setInputFiles({name:'unsupported.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
  await page.locator('.studio-notice.notice-error').waitFor();assert.deepEqual(await recipe(),before);
 }
 assert.equal(await page.getByLabel('身高',{exact:true}).count(),0);assert.equal(await page.getByLabel('体格',{exact:true}).count(),0);
 assert.equal(await page.locator('[data-testid^="lod-"]').count(),0);
 await page.getByTestId('body-type-male').click();after=await recipe();assert.deepEqual(after.slots,before.slots);assert.equal(after.bodyType,'male');await shot('cross-body-diy');
 await page.getByRole('button',{name:`全部 ${WARDROBE_LOOKS.length} 款`,exact:true}).click();await page.getByTestId('look-ceremony-female').click();assert.equal((await recipe()).bodyType,'male','preset silently changed body');await shot('all-looks-unlocked');
 for(const bodyType of ['male','female'])for(const id of ['jogging','shooting-arrow']){
  const vc=await browser.newContext({viewport:{width:1600,height:1000},}),vp=await vc.newPage();
  try{
   vp.on('pageerror',e=>errors.push(e.message));await vp.goto(`${base}/?review=1&look=ceremony-${bodyType}&bodyType=${bodyType}&mixamo=${id}&view=side&paused=1`);await vp.waitForFunction(()=>window.__WANHU_REVIEW__?.getStatus().mixamo?.ready);
   await vp.getByRole('button',{name:'播放',exact:true}).click();
   await vp.waitForFunction(()=>{const s=window.__WANHU_REVIEW__!.getStatus();if(s.finished)return true;const w=window as unknown as {__cycles?:{phase:number;count:number}};const c=w.__cycles??={phase:s.phase,count:0};if(s.phase<c.phase-.5)c.count++;c.phase=s.phase;return c.count>=2;},undefined,{timeout:45000,polling:100});
  }finally{await vc.close();playbackChecks.push(`${bodyType}/${id}`);}
 }
 for(const bodyType of ['male','female']){await page.setViewportSize({width:412,height:915});await page.goto(`${base}/?bodyType=${bodyType}&look=town-${bodyType}`);await page.waitForSelector('canvas');await page.waitForTimeout(200);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot(`mobile-${bodyType}`);}
 assert.equal(records.length,WARDROBE_LOOKS.length*17+7);assert.equal(new Set(records).size,records.length,'截图文件名重复');assert.equal(playbackChecks.length,4);assert.deepEqual(errors,[]);
}catch(e){failure=String(e);throw e;}finally{
 const report={sourceSha:process.env.REVIEW_HEAD_SHA??'local',testedSha:process.env.GITHUB_SHA??'local',passed:!failure&&!errors.length,images:records.length,records,continuousVideos:videos,playbackChecks,errors,failure};
 await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));await writeFile(`${dir}/index.html`,`<!doctype html><meta charset="utf-8"><title>Wardrobe Review</title><style>body{font:16px sans-serif;background:#f3f0e8;color:#314039}main{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0}img,video{width:100%}</style><h1>Wardrobe review ${report.sourceSha}</h1><p>Passed ${report.passed} · ${report.failure}</p><main>${records.map(f=>`<figure><img loading="lazy" src="${f}"><figcaption>${f}</figcaption></figure>`).join('')}</main>${videos.map(f=>`<video controls src="${f}"></video>`).join('')}`);await context.close();await browser.close();
}
console.log('PASS wardrobe screenshots, record-free playback, presets, import/export, undo, storage, seeded locks, mobile.');
