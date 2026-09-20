import{readFileSync as read,writeFileSync as write}from'node:fs';
function patch(path,a,b){const s=read(path,'utf8');if(!s.includes(a))throw Error(path+' missing '+a.slice(0,80));write(path,s.replace(a,b));}
const view='src/scene/CharacterViewport.tsx';
patch(view,'r.restart=options.restart;','const keepCamera=lodChanged&&r.builtRecipe===options.recipe;\n    r.restart=options.restart;');
patch(view,'applyDisplay(r,options);applyCamera(r,options);r.resize();','applyDisplay(r,options);if(!keepCamera)applyCamera(r,options);r.resize();');
patch(view,'r.mixamo.seek(r.desiredPhase);applyDisplay(r,latest.current);applyCamera(r,latest.current);r.resize();','r.mixamo.seek(r.desiredPhase);applyDisplay(r,latest.current);if(!keepCamera)applyCamera(r,latest.current);r.resize();');
const registry='scripts/lib/register-mixamo.ts';
patch(registry,'const rules:',`const names:Record<string,[string,string]>={\n 'Breakdance Freeze Var 2':['倒立定格 2','压力测试'],'Chicken Dance':['小鸡舞','压力测试'],'Headspin Start':['头旋起势','压力测试'],\n 'Hip Hop Dancing':['街舞','压力测试'],'Hip Hop Dancing (1)':['街舞变体 1','压力测试'],'Hip Hop Dancing (2)':['街舞变体 2','压力测试'],\n 'Jumping Down':['向下跳落','压力测试'],'Locking Hip Hop Dance':['锁舞组合','压力测试'],'Northern Soul Spin Combo':['旋转舞步组合','压力测试'],\n 'Snatch':['抓举（搬举压力测试）','劳动'],'Standing Aim Idle 01':['站姿瞄准 01','战斗'],'Start Walking':['起步行走','移动'],'Wave Hip Hop Dance':['波浪街舞','压力测试']\n};\nconst rules:`);
patch(registry,"const category=rules.find(([pattern])=>pattern.test(file))?.[1]??'其他';","const category=names[file]?.[1]??rules.find(([pattern])=>pattern.test(file))?.[1]??'其他';");
patch(registry,'label:old?.[1]??`${category} · ${file}`','label:names[file]?.[0]??old?.[1]??`${category} · ${file}`');
const cat='src/character/wardrobe/catalog.ts';
for(const[a,b]of[['交叠褶裙','褶纹分裳'],["name:'长裳'","name:'长式分裳'"],['交叠裙摆','裤式分裳'],['舒展袖形','收束袖形'],['长裳垂线','分裳垂线']])patch(cat,a,b);
patch('scripts/review-tailoring-v2.ts',"assert((await page.evaluate(()=>window.__WANHU_REVIEW__!.getStatus().phase))>.5);","await page.waitForFunction(()=>window.__WANHU_REVIEW__!.getStatus().phase>.5);");
patch('scripts/review-tailoring-v2.ts',"for(const id of ['pilot-switches','shooting-arrow','jogging'])","for(const id of ['pilot-switches','shooting-arrow','jogging','snatch'])");
patch('scripts/review-tailoring-v2.ts',"try{await p.goto(base+","try{p.on('pageerror',e=>errors.push(e.message));await p.goto(base+");
patch('scripts/review-tailoring-v2.ts',"await page.screenshot({path:dir+'/workbench.png'});","await page.screenshot({path:dir+'/workbench.png'});");
// 对真实录屏按全时间范围提取帧序列，不用一张截图替代动画观感。
const compose='scripts/compose-tailoring-v2.py';let s=read(compose,'utf8');s+='\nimport subprocess\nfor video in meta["videos"]:\n    stem=Path(video).stem\n    frames=root/(stem+"-frames");frames.mkdir(exist_ok=True)\n    subprocess.run(["ffmpeg","-v","error","-i",str(root/video),"-vf","fps=3,scale=720:-1",str(frames/"%04d.jpg")],check=True)\n    paths=sorted(frames.glob("*.jpg"))\n    for offset in range(0,len(paths),24):\n        sheet([str(p.relative_to(root)) for p in paths[offset:offset+24]],stem+"-timeline-"+str(offset//24)+".jpg",4)\n';write(compose,s);
console.log('V2 labels, camera preservation, lifting coverage and video timelines updated.');
