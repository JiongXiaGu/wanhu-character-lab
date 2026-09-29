import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

// 只接受明确部件 ID；不把未知 ID 静默回退成旧衣服。
const args = new Map();
for (let i=2;i<process.argv.length;i+=2) {
  const key=process.argv[i],value=process.argv[i+1];
  assert(['--slot','--garment','--reference'].includes(key)&&value&&!value.startsWith('--'),'用法：--slot top --garment ID --reference ID[,ID]');
  assert(!args.has(key),`重复参数 ${key}`);args.set(key,value);
}
const slot=args.get('--slot')||process.env.GARMENT_SLOT||'top';
const garment=args.get('--garment')||process.env.GARMENT_ID||'narrow_long_robe';
const references=(args.get('--reference')||process.env.GARMENT_REFERENCES||'ceremony_robe,cross_jacket').split(',').map(s=>s.trim());
assert(['headwear','top','bottom','shoes'].includes(slot),'只接受已有可穿戴槽位');
assert(/^[a-z][a-z0-9_]*$/.test(garment)&&!['body','none'].includes(garment),'必须指定一个正式资产 ID');
assert(references.length>=1&&references.length<=2&&new Set(references).size===references.length,'一至两个不重复对照');
assert(references.every(id=>/^[a-z][a-z0-9_]*$/.test(id)&&id!==garment),'对照 ID 无效');
const dir=join('review','garment-focus',`${slot}-${garment}`);
mkdirSync(dir,{recursive:true});
const sourceSHA=process.env.REVIEW_HEAD_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const base=process.env.REVIEW_URL||'http://127.0.0.1:4197';
const log=createWriteStream(join(dir,'server.log'));
const errors=[],images=[],records=[],bytesByName=new Map();
let server,browser;
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const motionCases=[
  ['start-walking',.40,'free','行走'],
  ['jogging',.25,'free','慢跑'],
  ['pilot-switches',.50,'side','坐姿拨动开关'],
  ['shooting-arrow',.50,'front','射箭'],
  ['snatch',.35,'free','Snatch 压力动作'],
];
async function waitReady(){
  for(let i=0;i<150;i++){
    if(server&&server.exitCode!==null)throw Error('Vite preview 已退出');
    try{if((await fetch(base)).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw Error('Vite preview 未就绪');
}
try {
  if(!process.env.REVIEW_URL){
    server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4197','--strictPort'],{stdio:['ignore','pipe','pipe']});
    server.stdout.pipe(log,{end:false});server.stderr.pipe(log,{end:false});
    server.on('error',e=>errors.push(String(e)));
  }
  await waitReady();
  browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1680,height:1050},deviceScaleFactor:1});
  page.setDefaultTimeout(45000);
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  async function load({bodyType='male',id=garment,view='front',display='beauty',bottom='work_pants',motion,phase=0}={}){
    const slots={top:'cross_jacket',bottom,shoes:'cloth_shoes',headwear:'none',back:'none',leftHand:'none',rightHand:'none',[slot]:id};
    const q=new URLSearchParams({review:'1',paused:'1',bodyType,view,display,...slots});
    if(motion){q.set('motion',motion);q.set('phase',String(phase));}else q.set('pose','bind');
    await page.goto(base+'/?'+q.toString());
    await page.waitForFunction(()=>!!window.__WANHU_REVIEW__&&!!window.__WANHU_RECIPE__);
    if(motion){
      await page.waitForFunction(id=>window.__WANHU_REVIEW__?.getStatus().motion?.id===id,motion);
      await page.evaluate(p=>window.__WANHU_REVIEW__.seek(p),phase);
      await page.waitForFunction(p=>Math.abs(window.__WANHU_REVIEW__.getStatus().phase-p)<.002,phase);
    }
    await frames(page);
    assert.equal(await page.locator('canvas').count(),1);
    const state=await page.evaluate(()=>({recipe:window.__WANHU_RECIPE__(),stats:window.__WANHU_REVIEW__.stats,status:window.__WANHU_REVIEW__.getStatus(),camera:window.__WANHU_REVIEW__.cameraState()}));
    assert.equal(state.recipe.slots[slot],id,'不能使用回退衣服冒充目标资产');
    assert.equal(state.recipe.bodyType,bodyType);assert.equal(state.stats.bones,20);
    assert.equal(state.recipe.version,5);assert.equal(Object.keys(state.recipe.slots).length,7);
    assert(!state.status.loading&&!state.status.loadError);
    if(!motion)assert(!state.status.motion,'静态截图不得误用默认慢跑');
    return {...state,display,view,motion:motion||'bind',requestedPhase:phase};
  }
  async function shot(name,state){
    await frames(page);
    const bytes=await page.locator('canvas').screenshot({path:join(dir,name)});
    assert(bytes.length>8000,'截图为空或异常小');
    images.push(name);records.push({file:name,...state});bytesByName.set(name,bytes);
  }
  async function sheet(name,title,items){
    const sheet=await browser.newPage({viewport:{width:items.length*620,height:900},deviceScaleFactor:1});
    const html=`<html lang="zh-CN"><head><style>body{margin:0;background:#e5e1d8;color:#252723;font:22px sans-serif}header{padding:18px 24px}h1{margin:0;font-size:26px}small{font-size:13px}.row{display:flex}figure{margin:8px;width:604px}figcaption{text-align:center;padding:8px}img{display:block;width:604px;height:770px;object-fit:contain}</style></head><body><header><h1>${title}</h1><small>${garment} · ${sourceSHA}</small></header><div class="row">${items.map(([file,label])=>`<figure><figcaption>${label}</figcaption><img src="data:image/png;base64,${bytesByName.get(file).toString('base64')}"></figure>`).join('')}</div></body></html>`;
    await sheet.setContent(html);await sheet.locator('img').evaluateAll(nodes=>Promise.all(nodes.map(i=>i.decode())));
    await sheet.screenshot({path:join(dir,name)});await sheet.close();images.push(name);
  }
  // 真正通过既有下拉切换一次，再切回；检查其它槽位和镜头不被重置。
  const initial=await load();
  const select=page.locator(`select:has(option[value="${garment}"])`);
  assert.equal(await select.count(),1,'目标必须出现在既有部件选择器');
  for(const id of references)assert.equal(await select.locator(`option[value="${id}"]`).count(),1,'对照必须属于同一槽位');
  let previous=await page.evaluate(()=>window.__WANHU_REVIEW__.geometryId());
  for(const id of [references[0],garment]){
    await select.selectOption(id);
    await page.waitForFunction(({slot,id,previous})=>window.__WANHU_RECIPE__().slots[slot]===id&&window.__WANHU_REVIEW__.geometryId()!==previous,{slot,id,previous});
    await frames(page);
    const next=await page.evaluate(()=>({recipe:window.__WANHU_RECIPE__(),camera:window.__WANHU_REVIEW__.cameraState(),geometry:window.__WANHU_REVIEW__.geometryId()}));
    for(const key of Object.keys(initial.recipe.slots))if(key!==slot)assert.equal(next.recipe.slots[key],initial.recipe.slots[key]);
    assert.deepEqual(next.camera,initial.camera);previous=next.geometry;
  }
  for(const bodyType of ['male','female']){
    for(const view of ['front','side','back','free'])await shot(`${bodyType}-beauty-${view}.png`,await load({bodyType,view}));
    for(const view of ['front','side']){
      const fixed=await load({bodyType,view,display:'clay'});
      await shot(`${bodyType}-clay-${view}.png`,fixed);
      for(const reference of references){
        const state=await load({bodyType,view,display:'clay',id:reference});
        assert.deepEqual(state.camera,fixed.camera,'同机位对比不能重新缩放/偏移');
        await shot(`${bodyType}-${reference}-clay-${view}.png`,state);
      }
      await sheet(`${bodyType}-clay-${view}-comparison.png`,`${bodyType==='male'?'男性':'女性'} · 同机位统一素模 · ${view==='front'?'正面':'侧面'}`,[[`${bodyType}-clay-${view}.png`,'目标资产'],...references.map(id=>[`${bodyType}-${id}-clay-${view}.png`,id])]);
    }
    // 与正侧面使用相同生产模型；后片与侧臀不能只靠正面证明成立。
    for(const view of ['back','free'])await shot(`${bodyType}-clay-${view}.png`,await load({bodyType,view,display:'clay'}));
    for(const [motion,phase,view]of motionCases)await shot(`${bodyType}-${motion}.png`,await load({bodyType,motion,phase,view}));
    // 深蹲源首帧曾经阻塞，不能只展示较安全的 .35 相位。
    if(garment==='narrow_long_robe') {
      await shot(`${bodyType}-snatch-start.png`,await load({bodyType,motion:'snatch',phase:0,view:'side',display:'clay'}));
      // 本轮实际失败峰值源时刻，不只截取安全姿态；仍使用生产动作与原相机。
      for(const [motion,time,view]of [['jogging',2.2,'free'],['snatch',2/30,'side']]) {
        const source=JSON.parse(readFileSync(`public/mixamo/${motion}.json`,'utf8'));
        assert(source.duration>=time&&source.duration>0,'压力截图必须落在真实源动作内');
        await shot(`${bodyType}-${motion}-pressure.png`,await load({bodyType,motion,phase:time/source.duration,view,display:'clay'}));
      }
      // 独立 bottom 的数学相交现改为 Warning，必须补同姿态截图确认是否真的从长袍外层露出。
      const jogging=JSON.parse(readFileSync('public/mixamo/jogging.json','utf8'));
      for(const [bottom,time]of [['work_wrap',2.2],['long_skirt',19/30]]) {
        assert(jogging.duration>=time,'分层下装压力截图必须落在真实 jogging 源动作内');
        await shot(`${bodyType}-${bottom}-jogging-layer.png`,await load({bodyType,bottom,motion:'jogging',phase:time/jogging.duration,view:'free',display:'clay'}));
      }
    }
    if(slot==='top')for(const bottom of ['work_wrap','long_skirt'])await shot(`${bodyType}-bottom-${bottom}.png`,await load({bodyType,bottom,view:'free'}));
    await sheet(`${bodyType}-views.png`,`${bodyType==='male'?'男性':'女性'} · ${garment}`,[[`${bodyType}-beauty-front.png`,'正面'],[`${bodyType}-beauty-free.png`,'三分之四']]);
    await sheet(`${bodyType}-walk-and-sit.png`,`${bodyType==='male'?'男性':'女性'} · 真实 FBX 动作`,[[`${bodyType}-start-walking.png`,'Start Walking · 0.40'],[`${bodyType}-pilot-switches.png`,'Pilot Flips Switches · 0.50']]);
  }
  const expectedRaw=2*(4+2*(1+references.length)+2+motionCases.length+(garment==='narrow_long_robe'?5:0)+(slot==='top'?2:0));
  assert.equal(records.length,expectedRaw,'最低矩阵不能漏图');
  assert.deepEqual(errors,[]);
  writeFileSync(join(dir,'report.json'),JSON.stringify({passed:true,sourceSHA,slot,garment,references,images,records,visualApproval:false,note:'Production WebGL screenshots; clay uses existing uniform material. Script success is not AI or user art approval.'},null,2));
  console.log('GARMENT_FOCUS_VISUAL',JSON.stringify({passed:true,sourceSHA,slot,garment,raw:records.length,images}));
}catch(error){
  writeFileSync(join(dir,'report.json'),JSON.stringify({passed:false,sourceSHA,slot,garment,references,images,records,errors,error:String(error?.stack||error),visualApproval:false},null,2));
  console.error(error);process.exitCode=1;
}finally{await browser?.close();server?.kill('SIGTERM');log.end();}
