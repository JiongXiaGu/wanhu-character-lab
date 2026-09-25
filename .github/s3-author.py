from pathlib import Path
import subprocess

BASE='5a165dee042059bb7616d3b6eae3f709ee0c142c'
changed=[]
def edit(path, edits=(), prepend='', append=''):
    p=Path(path)
    original=subprocess.check_output(['git','show',BASE+':'+path]).decode()
    assert p.read_text()==original, path+' diverged from verified base'
    text=original
    for old,new,count in edits:
        assert text.count(old)==count, (path,old,text.count(old),count)
        text=text.replace(old,new)
    p.write_text(prepend+text+append)
    changed.append(path)
def add(path,text):
    p=Path(path);assert not p.exists(),path
    p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text);changed.append(path)

edit('src/character/v3/types.ts',[
 ('  | "frontier_guard_helmet"','  | "frontier_guard_helmet"\n  | "city_guard_helmet"',1),
 ('  "frontier_guard_helmet",','  "frontier_guard_helmet",\n  "city_guard_helmet",',1),
 ('  | "frontier_lamellar_armor"','  | "frontier_lamellar_armor"\n  | "city_guard_brigandine"',1),
 ('  "frontier_lamellar_armor",','  "frontier_lamellar_armor",\n  "city_guard_brigandine",',1),
 ('  | "frontier_armor_skirt"','  | "frontier_armor_skirt"\n  | "city_guard_trousers"',1),
 ('  "frontier_armor_skirt",','  "frontier_armor_skirt",\n  "city_guard_trousers",',1),
])
edit('src/character/wardrobe/patterns.ts',[
 ("|'frontier-top'","|'frontier-top'|'city-top'",1),
 ("|'frontier-skirt'","|'frontier-skirt'|'city-trousers'",1),
 ("  frontier_lamellar_armor:{id:'frontier-heavy-top-v1',asset:'frontier-top',hem:1.035},","  frontier_lamellar_armor:{id:'frontier-heavy-top-v1',asset:'frontier-top',hem:1.035},\n  city_guard_brigandine:{id:'city-short-brigandine-v1',asset:'city-top',hem:1.060},",1),
 ("  frontier_armor_skirt:{id:'frontier-waist-skirt-v1',asset:'frontier-skirt',hem:.095},","  frontier_armor_skirt:{id:'frontier-waist-skirt-v1',asset:'frontier-skirt',hem:.095},\n  city_guard_trousers:{id:'city-patrol-trousers-v1',asset:'city-trousers',hem:.095},",1),
])
edit('src/character/wardrobe/assets/tops.ts',[("  if(pattern.asset==='frontier-top')return makeFrontierTop(recipe);","  if(pattern.asset==='frontier-top')return makeFrontierTop(recipe);\n  if(pattern.asset==='city-top')return makeCityTop(recipe);",1)],prepend="import { makeCityTop } from './military/city-top';\n")
edit('src/character/wardrobe/assets/trousers.ts',[("  if(pattern.asset==='frontier-skirt')return makeFrontierSkirt(recipe);","  if(pattern.asset==='frontier-skirt')return makeFrontierSkirt(recipe);\n  if(pattern.asset==='city-trousers')return makeCityTrousers(recipe);",1)],prepend="import { makeCityTrousers } from './military/city-trousers';\n")
edit('src/character/wardrobe/adornments.ts',[
 ("  if(id==='frontier_guard_helmet'){addFrontierHelmet(target,recipe);return true;}","  if(id==='frontier_guard_helmet'){addFrontierHelmet(target,recipe);return true;}\n  if(id==='city_guard_helmet'){addCityHelmet(target,recipe);return true;}",1),
 ("'palace_guard_helmet','frontier_guard_helmet','guard_helmet'","'palace_guard_helmet','frontier_guard_helmet','city_guard_helmet','guard_helmet'",1),
],prepend="import { addCityHelmet } from './city-equipment';\n")
edit('src/character/v3/outfit.ts',[( '"palace_guard_armor", "frontier_lamellar_armor"','"palace_guard_armor", "frontier_lamellar_armor", "city_guard_brigandine"',1)])
edit('src/character/wardrobe/catalog.ts',[
 ("{id:'frontier_guard_helmet',name:'边军护颈盔'},","{id:'frontier_guard_helmet',name:'边军护颈盔'},{id:'city_guard_helmet',name:'城军低檐盔'},",1),
 ("{id:'frontier_lamellar_armor',name:'边军厚札甲'},","{id:'frontier_lamellar_armor',name:'边军厚札甲'},{id:'city_guard_brigandine',name:'城军布面短甲'},",1),
 ("{id:'frontier_armor_skirt',name:'边军长甲裙与裤装'},","{id:'frontier_armor_skirt',name:'边军长甲裙与裤装'},{id:'city_guard_trousers',name:'城军束腿军裤'},",1),
])
edit('src/soldier/looks.ts',[( '只有已制作真实资产的宫卫与边军进入显式试衣入口','只有已制作真实资产的三套军装进入显式试衣入口',1)],append='''
/** 城市整套复用原七槽位和保存链路，不向配方写入身份、职业或军阶。 */
export const CITY_GUARD_SLOTS:Readonly<CharacterSlots>={headwear:'city_guard_helmet',top:'city_guard_brigandine',bottom:'city_guard_trousers',shoes:'military_boots',back:'none',leftHand:'none',rightHand:'military_spear'};
export function applyCityGuard(recipe:Recipe):Recipe {
  return createRecipe({...recipe,slots:{...CITY_GUARD_SLOTS},dyes:{...SOLDIER_STYLE_CONTRACT.city.palette}});
}
export function isCityGuard(recipe:Recipe):boolean {
  return (Object.keys(CITY_GUARD_SLOTS) as (keyof CharacterSlots)[]).every(k=>recipe.slots[k]===CITY_GUARD_SLOTS[k]);
}
''')
edit('src/App.tsx',[
 ('applyFrontierGuard, isFrontierGuard }','applyFrontierGuard, isFrontierGuard, applyCityGuard, isCityGuard }',1),
 ("  if(qs.get('soldier')==='frontier')r=applyFrontierGuard(r);","  if(qs.get('soldier')==='frontier')r=applyFrontierGuard(r);\n  if(qs.get('soldier')==='city')r=applyCityGuard(r);",1),
 ("isFrontierGuard(recipe)?'边疆戍卒 · 长枪':currentLook", "isFrontierGuard(recipe)?'边疆戍卒 · 长枪':isCityGuard(recipe)?'城市守军 · 长枪':currentLook",1),
 ('<span>宫卫 / 边军</span>','<span>宫卫 / 边军 / 城军</span>',1),
 ('onClick={()=>edit(applyFrontierGuard)}>边疆戍卒 · 长枪</button>','onClick={()=>edit(applyFrontierGuard)}>边疆戍卒 · 长枪</button><button className={\'clear-equipment \'+(isCityGuard(recipe)?\'active\':\'\')} data-testid="soldier-city" aria-pressed={isCityGuard(recipe)} onClick={()=>edit(applyCityGuard)}>城市守军 · 长枪</button>',1),
])
edit('scripts/check-lightwear.ts',[
 ('PalaceHelmet|FrontierHelmet|Helmet','PalaceHelmet|FrontierHelmet|CityHelmet|Helmet',1),
 ('palace_guard_helmet:126,frontier_guard_helmet:112,','palace_guard_helmet:126,frontier_guard_helmet:112,city_guard_helmet:144,',1),
 ("const baseCapPrefix=(id:HeadwearId)=>id==='frontier_guard_helmet'", "const baseCapPrefix=(id:HeadwearId)=>id==='city_guard_helmet'?'CityHelmet.Shell.Base':id==='frontier_guard_helmet'",1),
 ("['palace_guard_helmet','frontier_guard_helmet','guard_helmet'","['palace_guard_helmet','frontier_guard_helmet','city_guard_helmet','guard_helmet'",1),
 ("const prefix=id==='frontier_guard_helmet'?", "const prefix=id==='city_guard_helmet'?'CityHelmet.Shell':id==='frontier_guard_helmet'?",1),
])
edit('scripts/check-deformation.ts',[
 ("bottom==='frontier_armor_skirt'?'FrontierLiner':'Pants'","bottom==='frontier_armor_skirt'?'FrontierLiner':bottom==='city_guard_trousers'?'CityPants':'Pants'",1),
 ("else if(bottom==='frontier_armor_skirt')assertFrontierSkirt(p);else assert.equal", "else if(bottom==='frontier_armor_skirt')assertFrontierSkirt(p);else if(bottom==='city_guard_trousers')assertCityTrousers(p);else assert.equal",1),
 ('independentTrousersTriangles:{work_pants:240,','independentTrousersTriangles:{city_guard_trousers:260,work_pants:240,',1),
],prepend="import { assertCityTrousers } from './check-soldier-city';\n")
city_checks='''
// S3：三套同机位轮廓和城市独立军裤，保留所有原宫卫/边军故障反例。
for(const bodyType of BODY_TYPES){
  const palace=makeCharacter(applyPalaceGuard(createRecipe({bodyType}))).surface;
  const frontier=makeCharacter(applyFrontierGuard(createRecipe({bodyType}))).surface;
  const city=makeCharacter(applyCityGuard(createRecipe({bodyType}))).surface;
  silhouettes.push({bodyType,style:'city',...assertCitySilhouette(palace,frontier,city)});
  for(const mutate of [
    (c:Cage)=>{for(const v of c.vertices)if(v.id.startsWith('Top.Shoulder.'))v.p[0]*=1.2;},
    (c:Cage)=>{for(const v of c.vertices)if(v.id.startsWith('Top.Chest.'))v.p[2]*=1.5;},
    (c:Cage)=>{for(const v of c.vertices)if(v.id.startsWith('CityHelmet.'))v.p[1]+=.2;},
    (c:Cage)=>{for(const v of c.vertices)if(v.id.startsWith('CityHelmet.Neck.OuterLow.'))v.p[1]-=.15;},
    (c:Cage)=>{for(const v of c.vertices)if(v.id.startsWith('Top.BeltTop.'))v.p[1]-=.025;},
    (c:Cage)=>{for(const v of c.vertices)if(v.id.startsWith('Top.Hem.'))v.p[1]-=.08;},
  ]){const c=cloneCage(city);mutate(c);assert.throws(()=>assertCitySilhouette(palace,frontier,c));negativeCases++;}
}
const cityRecipe=applyCityGuard(createRecipe()),cityPants=makeTrousers(cityRecipe)!;
for(const mutate of [
  (p:typeof cityPants)=>{p.mesh.faces.pop();},
  (p:typeof cityPants)=>{p.mesh.faces[0].v.reverse();},
  (p:typeof cityPants)=>{p.mesh.vertices[0].p[0]=NaN;},
  (p:typeof cityPants)=>{p.mesh.vertices[0].w[2]=NaN;},
  (p:typeof cityPants)=>{p.mesh.vertices[0].w[1]=B.LeftThigh;},
  (p:typeof cityPants)=>{p.mesh.vertices.find(v=>v.id==='CityPants.BeltLow.0')!.p[1]-=.1;},
  (p:typeof cityPants)=>{p.mesh.vertices.find(v=>v.id==='CityPants.Right.Calf.2')!.p[0]+=.1;},
]){const p=structuredClone(cityPants);mutate(p);assert.throws(()=>assertCityTrousers(p));negativeCases++;}
const cityHelmet=subset(makeCharacter(cityRecipe).surface,'CityHelmet.');
for(const mutate of [(c:Cage)=>{c.faces.pop();},(c:Cage)=>{c.vertices[0].w=[B.Neck,B.Neck,1];},(c:Cage)=>{c.vertices[0].p[0]=NaN;}]){const c=cloneCage(cityHelmet);mutate(c);assert.throws(()=>closedRigid(c,B.Head,144));negativeCases++;}

'''
edit('scripts/check-soldier-assets.ts',[
 ("import {applyPalaceGuard,PALACE_GUARD_SLOTS,applyFrontierGuard,FRONTIER_GUARD_SLOTS}","import {applyPalaceGuard,PALACE_GUARD_SLOTS,applyFrontierGuard,FRONTIER_GUARD_SLOTS,applyCityGuard,CITY_GUARD_SLOTS}",1),
 ("  {id:'frontier',apply:applyFrontierGuard,slots:FRONTIER_GUARD_SLOTS,budgets:{...budgets,bottom:308,helmet:112},helmet:'FrontierHelmet.',skirt:assertFrontierSkirt},", "  {id:'frontier',apply:applyFrontierGuard,slots:FRONTIER_GUARD_SLOTS,budgets:{...budgets,bottom:308,helmet:112},helmet:'FrontierHelmet.',skirt:assertFrontierSkirt},\n  {id:'city',apply:applyCityGuard,slots:CITY_GUARD_SLOTS,budgets:{...budgets,top:340,bottom:260,helmet:144},helmet:'CityHelmet.',skirt:assertCityTrousers},",1),
 ("headwear:'city_guard_helmet'","headwear:'city_guard_missing_helmet'",1),
 ("if(process.argv.includes('--motion')){",city_checks+"if(process.argv.includes('--motion')){",1),
],prepend="import { assertCityTrousers,assertCitySilhouette } from './check-soldier-city';\n")
triple='''
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
'''
edit('scripts/check-soldier-browser.mjs',[
 ("    {id:'frontier',helmet:'frontier_guard_helmet',top:'frontier_lamellar_armor',bottom:'frontier_armor_skirt'},","    {id:'frontier',helmet:'frontier_guard_helmet',top:'frontier_lamellar_armor',bottom:'frontier_armor_skirt'},\n    {id:'city',helmet:'city_guard_helmet',top:'city_guard_brigandine',bottom:'city_guard_trousers'},",1),
 ("assert(!ids.some(x=>x.startsWith('city_guard_')));", "const key={'头饰':'helmet','上衣':'top','下装':'bottom'}[label];if(key)for(const real of styles)assert(ids.includes(real[key]),'三套都必须有真实可选部件');",1),
 ('no city placeholders; body/hair identity preserved','three real authored styles; body/hair identity preserved',1),
 ('  assert.deepEqual(errors,[]);writeFileSync',triple+'  assert.deepEqual(errors,[]);writeFileSync',1),
])

citydoc='''# 城市守军与长枪

## 用途与入口

S3 为原人物工坊增加“城市守军 · 长枪”，用于城门、街道、仓署与日常巡守的外观验证。三件真实资产为 `city_guard_helmet`、`city_guard_brigandine`、`city_guard_trousers`；复用原 `military_boots` 和 `military_spear`。右侧军人试衣和 `?soldier=city&pose=bind&paused=1&view=free` 都走同一入口，原三视图与经营俯视继续可用。

城市以低檐盔、窄肩浅胸、布面短甲、明显腰带和束腿军裤区别于宫卫高缨宽肩、边军厚胸长甲裙。主色来自原作者契约的青黑／灰铁／暗金褐，不依赖胸口小花纹或整套换色。城市下装是军裤，不延续前两套甲裙，也不恢复腿侧外挂板。

## 作者所有权

`city-equipment.ts` 独立拥有七排低盔壳、实体短檐和短后片，全部闭合并刚性随 Head。帽底沿用原作者接口规则，主头发与外壳的贯穿检查不放宽；摘盔恢复原发式。

`assets/military/city-top.ts` 独立拥有八排衣身、浅胸、窄肩、低领和七排内袖/护臂。腰带是衣壳的外扩色带，中央灰铁扣位与衣身共享顶点，不在普通衣服外叠相交甲壳。只复用有限的 top-seams 操作，不调用宫卫或边军作者工厂。

`assets/military/city-trousers.ts` 独立拥有十点腰头、裆部连接、两条完整裤管和收窄小腿；腰裆裤管是一张连通闭合壳。原 kneeWeights 提供膝前/膝后梯度，不新增裙骨、盔甲骨或碰撞求解。封闭接口仍由原下装分派处理，固定覆盖 pelvis/thigh/shin，军靴仍只覆盖 foot。

三件作者预算分别为头盔144、上甲340、军裤260三角形；加复用军靴120与长枪58，五件共922。数字由正式专项逐件验证，不是性能或美术通过结论。

## 数据与生命周期

整套应用只产生普通 Recipe V5 六字段，七槽位、固定成年男女、20骨和最多双权重保持。保存、恢复、撤销、文件往返、随机锁定、原动作播放器与镜头继续归原工坊负责。军装不进入默认居民随机池，不保存 soldierStyle、profession、rank 等玩法字段。

没有独立 soldier 页面、第二个 Renderer、第二套人物生成器或专用军人 Animator。切动作复用原网格；换装按原 Actor 生命周期重建和释放，不改 inverse bind。宫卫与边军的作者几何和短/长甲裙保持不变。

## 检查与看图

check:soldier 扩展到三套×男女×三种发式，验证预算、封闭拓扑、有限坐标、精确刚性/双骨权重、源身体保护、配方往返、随机池隔离和故障注入。check-soldier-city 另外验证军裤单一连通性、腰头、裆口与窄小腿，并从三套实际装配坐标断言盔高、短后片、短檐宽度、肩宽、胸厚、上甲长度和腰带厚度；不以作者参数或颜色当作轮廓证据。

原 deformation 的膝前/膝后梯度、全下装源关键帧与中点贯穿检测、Snatch压力片段、六种坐骑/骑乘/马具、原宫卫/边军故障反例不缩减。城市没有新增压力动作、裙底或军装豁免。每坐骑衣裤矩阵随现役 TOP_IDS×BOTTOM_IDS×男女自动增加，不能保持旧固定数量而漏检新资产。

普通浏览器检查不截图，覆盖三套整套/单件切换、男女、保存/恢复/撤销、严格文件导入导出、锁定、动作和相机。显式 review:soldier 保留原宫卫/边軍九张图及双套对比，追加城市工作台、男性、正面军裤、三视图、俯视、女性、坐姿、慢跑、射箭试衣，以及同一运行时Canvas/同机位/同绑定姿态的三套对比。对比图只拼接真实捕获帧。

精确受测SHA、正式三条Actions、实际打开的截图和合并记录以本轮PR为准。自动检查通过、截图生成、AI实际看图和用户最终美术认可必须分开记录；未完成检查或看图不合并。有限离散采样不等于任意混搭或全时域零碰撞。

## 不做范围

长枪仍随 RightHand，不新增专用站岗、刺击、双手握持或武器避身。射箭是抬臂试衣，不代表城市弓兵已经制作。S4兵种/军阶、战斗、编制、AI、实时布料和Unity正式士兵运行时未在本轮实现。
'''
add('Documentation/城市守军与长枪.md',citydoc)
intro='''## S3：城市守军

用户已明确授权继续 S3。城市真实低檐盔、布面短甲、束腿军裤沿原工坊和七槽位接入，复用军靴/长枪；共同规则见《军人与甲胄工作流》，作者职责与验收集中在《城市守军与长枪》。下方历史段落中“城市未开放/不提前开始S3”的旧阶段限制不阻止本轮授权，不能据此恢复空选项或扩大到S4。

必须保护宫卫/边军作者文件、短/长甲裙和原完整穿插算法，城市独立靠低檐、窄肩、浅胸、腰带与军裤轮廓区分。仍为V5六字段/七槽位/20骨/最多双权重；不加Renderer、职业字段、战斗或军装豁免。三套同机位WebGL对比、原完整回归、实际看图和用户认可分别记录；正式检查和看图不足不合并。合并前重读main，保留并行动物/动捕/人物修改，禁止强推；临时作者工具从最终树移除，最终仍只有原三条Actions。

'''
edit('AGENTS.md',prepend=intro)
edit('Documentation/工作交接.md',[( '# 工作交接\n','# 工作交接\n\n'+intro,1)])
edit('README.md',[( '# 万户 · 衣冠工坊V5与多坐骑\n','# 万户 · 衣冠工坊V5与多坐骑\n\n## S3：城市守军 · 长枪\n\n原人物工坊新增城市整套：低檐盔、窄肩布面短甲、外露腰带与束腿军裤，复用军靴和长枪。入口 `?soldier=city&pose=bind&paused=1&view=free`；三套在原右侧军人试衣中切换，存档仍为V5六字段/七槽位/20骨。详见[城市守军与长枪](Documentation/城市守军与长枪.md)。新增真实三套同机位对比，不以整套换色或额外页面冒充新风格。精确受测SHA、正式检查和实际看图见本轮PR，用户美术认可单独验收。下方S1/S2章节为对应阶段记录，其城市未开放限制由S3替代；S4未开始。\n',1)])
edit('Documentation/军人与甲胄工作流.md',[
 ('当前 S1 皇宫与 S2 边疆均已有真实作者资产及原工坊入口，分别见[皇宫禁卫与长枪](皇宫禁卫与长枪.md)与[边疆戍卒与长枪](边疆戍卒与长枪.md)。正式检查、实际看图和用户美术认可按对应 PR 分开记录；S3 城市与 S4 扩展尚未实现。', '当前 S1 皇宫、S2 边疆、S3 城市均有独立作者资产和原工坊入口，分别见[皇宫禁卫与长枪](皇宫禁卫与长枪.md)、[边疆戍卒与长枪](边疆戍卒与长枪.md)和[城市守军与长枪](城市守军与长枪.md)。正式检查、实际看图和用户美术认可按对应 PR 分开记录；未完成验收不合并，S4 扩展尚未开始。',1),
 ('最后制作更短、更日常的城市布面甲/暗甲体系，重点验证短甲、腰带和城市场景中的居民尺度兼容。','城市采用独立低檐盔、窄肩浅胸的布面短甲、外扩腰带和束腿军裤，复用军靴与长枪，不制作第三套甲裙。三件资产走原七槽位和试衣入口；实际轮廓断言、原完整动作/穿插与三套同机位对比共同验收，不能用作者文件存在代替完成。',1),
 ('当前同时检查 S1/S2 两套真实资产','当前同时检查 S1/S2/S3 三套真实资产',1),
 ('三类风格全部存在后，必须增加同机位三人对照','S3 追加同机位三人对照',1),
])
edit('src/character/wardrobe/assets/military/AGENTS.md',prepend='''## S3 城市作者边界

用户已授权城市低檐盔、布面短甲和束腿军裤，先读《城市守军与长枪》。独立city-top/city-trousers/city-equipment不调用宫卫、边军或居民服饰工厂，仅共享有限缝合与原膝权重。城市不是第三套甲裙，不恢复腿侧外挂板。下方未开放城市的文字仅对应旧阶段；不加S4占位、身份字段、骨骼或检测豁免。三套实际坐标轮廓与同机位截图共同验证，宫卫/边军几何不改。

''')
edit('Documentation/服装生成架构.md',append='''

S3 城市的 city-top/city-trousers/city-equipment 同样独立拥有几何与静态权重，分别制作短布面甲、连通军裤和低檐盔，不调用宫卫/边军/居民资产工厂。分派仍在原tops/trousers/adornments中，封闭接口与固定覆盖保持；具体结构和三套轮廓验收见《城市守军与长枪》。
''')
for path in ['src/character/wardrobe/assets/military/palace-top.ts','src/character/wardrobe/assets/military/palace-skirt.ts','src/character/wardrobe/assets/military/frontier-top.ts','src/character/wardrobe/assets/military/frontier-skirt.ts','src/character/wardrobe/military-equipment.ts','src/character/wardrobe/frontier-equipment.ts','scripts/check-tailoring-intersections.ts','scripts/garment-contact-scope.ts','src/character/v3/body.ts','src/character/v3/rig.ts']:
    assert Path(path).read_bytes()==subprocess.check_output(['git','show',BASE+':'+path]),path+' protected source changed'
subprocess.run(['git','add','--',*changed],check=True)
subprocess.run(['git','diff','--cached','--stat'],check=True)
print('S3 source integration staged. Formal checks and actual WebGL inspection are still required.')
