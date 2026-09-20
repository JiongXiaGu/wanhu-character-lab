import {readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
/** 旧 ID 保留，已有链接/导出不会因文件扫描改名。 */
const curated:Record<string,[string,string,boolean,boolean]>={
 Jogging:['jogging','慢跑',true,true],'Shooting Arrow':['shooting-arrow','拉弓射箭',false,true],
 'Catwalk Walk Forward HighKnees':['catwalk','高抬腿行走',true,true],'Punching Bag':['punching-bag','连续拳击',true,true],
 'Zombie Stand Up':['zombie-stand-up','倒地起身',false,true],'Pilot Flips Switches':['pilot-switches','坐姿拨动开关',false,true],
 Swimming:['swimming','游泳',true,false],'Hip Hop Dancing':['hip-hop','街舞',false,true],
 Capoeira:['capoeira','卡波耶拉动作',false,true],Flair:['flair','Flair 动作',false,true],'Brutal Assassination':['assassination','近身攻击',false,true]
};
const names:Record<string,[string,string]>={
 'Breakdance Freeze Var 2':['倒立定格 2','压力测试'],'Chicken Dance':['小鸡舞','压力测试'],'Headspin Start':['头旋起势','压力测试'],
 'Hip Hop Dancing':['街舞','压力测试'],'Hip Hop Dancing (1)':['街舞变体 1','压力测试'],'Hip Hop Dancing (2)':['街舞变体 2','压力测试'],
 'Jumping Down':['向下跳落','压力测试'],'Locking Hip Hop Dance':['锁舞组合','压力测试'],'Northern Soul Spin Combo':['旋转舞步组合','压力测试'],
 'Snatch':['抓举（搬举压力测试）','劳动'],'Standing Aim Idle 01':['站姿瞄准 01','战斗'],'Start Walking':['起步行走','移动'],'Wave Hip Hop Dance':['波浪街舞','压力测试']
};
const rules:[RegExp,string,string][]=[
 [/pilot|sitting|sit |seated/i,'坐姿','坐姿'],[/pick|lift|carry|push|pull|shovel|dig|hammer|chop|sweep|rake|work|hoe|harvest|plant|water|axe|saw|clean/i,'劳动','劳动'],
 [/arrow|archer|bow/i,'射箭','射箭'],[/walk|jog|run|sprint|turn|strafe/i,'移动','移动'],[/idle|stand|look|talk|wave|clap|drink|eat|greet/i,'日常','日常'],
 [/punch|kick|fight|sword|attack|assassin|block|dodge|hit/i,'战斗','战斗'],[/swim|dance|flair|capoeira|flip|jump|crawl|climb/i,'压力测试','压力测试']
];
export function scanMotionFiles(root='动画参考',relative=''):string[]{
 return readdirSync(join(root,relative),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scanMotionFiles(root,join(relative,e.name)):/\.fbx$/i.test(e.name)?[join(relative,e.name).replaceAll('\\','/')]:[]).sort();
}
export function registerMixamo(){
 const files=scanMotionFiles(),used=new Set<string>();
 if(!files.length)throw new Error('动画参考目录中没有 FBX');
 const entries=files.map(filename=>{
  const file=filename.split('/').at(-1)!.replace(/\.fbx$/i,'').split('@').at(-1)!,old=curated[file];
  const category=names[file]?.[1]??rules.find(([pattern])=>pattern.test(file))?.[1]??'其他';
  let id=old?.[0]??file.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(!id||used.has(id))id=(id||'motion')+'-'+createHash('sha256').update(filename).digest('hex').slice(0,8);
  if(used.has(id))throw new Error('动作 ID 冲突：'+filename);used.add(id);
  return {id,label:names[file]?.[0]??old?.[1]??`${category} · ${file}`,file,filename,category,loop:old?.[2]??false,ground:old?.[3]??!/swim/i.test(file)};
 });
 // 排序不改变稳定 ID；重点先列出，新增动作在面板可通过分类和原文件名检索。
 entries.sort((a,b)=>Number(!curated[a.file])-Number(!curated[b.file])||a.filename.localeCompare(b.filename,'en'));
 writeFileSync('src/character/mixamo/catalog.generated.ts','/** 自动生成；勿手写。来源：动画参考/。 */\nexport const GENERATED_CLIPS='+JSON.stringify(entries,null,2)+';\n');
 return entries;
}
