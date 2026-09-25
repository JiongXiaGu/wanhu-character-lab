from pathlib import Path

def patch(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    assert text.count(old) == count, (path, old[:100], text.count(old), count)
    p.write_text(text.replace(old, new))

def prepend_section(path, text):
    p = Path(path)
    s = p.read_text()
    first, rest = s.split('\n', 1)
    p.write_text(first + '\n\n' + text.strip() + '\n' + rest)

if 'palace_captain_helmet' in Path('src/character/v3/types.ts').read_text():
    print('S4 registration already applied; no repeated transformation.')
    raise SystemExit(0)

p = 'src/character/v3/types.ts'
for style in ['palace', 'frontier', 'city']:
    patch(p, f'  | "{style}_guard_helmet"', f'  | "{style}_guard_helmet"\n  | "{style}_captain_helmet"')
    patch(p, f'  "{style}_guard_helmet",', f'  "{style}_guard_helmet",\n  "{style}_captain_helmet",')

p = 'src/character/wardrobe/adornments.ts'
patch(p, "import { addCityHelmet } from './city-equipment';", "import { addPalaceCaptainHelmet, addFrontierCaptainHelmet, addCityCaptainHelmet } from './captain-equipment';\nimport { addCityHelmet } from './city-equipment';")
for style, name in [('palace', 'Palace'), ('frontier', 'Frontier'), ('city', 'City')]:
    old = f"  if(id==='{style}_guard_helmet'){{add{name}Helmet(target,recipe);return true;}}"
    patch(p, old, old + f"\n  if(id==='{style}_captain_helmet'){{add{name}CaptainHelmet(target,recipe);return true;}}")
patch(p, "const concealed=['palace_guard_helmet','frontier_guard_helmet','city_guard_helmet',", "const concealed=['palace_captain_helmet','frontier_captain_helmet','city_captain_helmet','palace_guard_helmet','frontier_guard_helmet','city_guard_helmet',")

p = 'src/character/wardrobe/catalog.ts'
for style, ordinary, captain in [('palace','宫卫红缨盔','宫卫队长宽缨盔'),('frontier','边军护颈盔','边军队长短缨盔'),('city','城军低檐盔','城军队长横冠盔')]:
    old = f"{{id:'{style}_guard_helmet',name:'{ordinary}'}}"
    patch(p, old, old + f",{{id:'{style}_captain_helmet',name:'{captain}'}}")

p = 'src/soldier/looks.ts'
patch(p, "import { SOLDIER_STYLE_CONTRACT } from './contract';", "import { SOLDIER_STYLE_CONTRACT } from './contract';\nimport { SOLDIER_HELMETS, type SoldierIdentity } from './identities';")
for style, name in [('palace','Palace'),('frontier','Frontier'),('city','City')]:
    upper = style.upper()
    patch(p, f'export function apply{name}Guard(recipe:Recipe):Recipe {{', f"export function apply{name}Guard(recipe:Recipe,identity:SoldierIdentity='soldier'):Recipe {{")
    patch(p, f'slots:{{...{upper}_GUARD_SLOTS}},dyes:', f'slots:{{...{upper}_GUARD_SLOTS,headwear:SOLDIER_HELMETS.{style}[identity]}},dyes:')
    patch(p, f'.every(k=>recipe.slots[k]==={upper}_GUARD_SLOTS[k]);', f".every(k=>k==='headwear'?(recipe.slots.headwear===SOLDIER_HELMETS.{style}.soldier||recipe.slots.headwear===SOLDIER_HELMETS.{style}.captain):recipe.slots[k]==={upper}_GUARD_SLOTS[k]);")

p = 'src/App.tsx'
s = Path(p).read_text()
Path(p).write_text("import { SOLDIER_IDENTITY_IDS, SOLDIER_IDENTITY_NAMES, identifySoldierHelmet, applySoldierIdentity } from './soldier/identities';\n" + s)
for style, name in [('palace','Palace'),('frontier','Frontier'),('city','City')]:
    patch(p, f"if(qs.get('soldier')==='{style}')r=apply{name}Guard(r);", f"if(qs.get('soldier')==='{style}')r=apply{name}Guard(r,enumQuery('soldierRole',SOLDIER_IDENTITY_IDS,'soldier'));")
    patch(p, f'onClick={{()=>edit(apply{name}Guard)}}', f"onClick={{()=>edit(r=>apply{name}Guard(r,identifySoldierHelmet(r.slots.headwear)?.identity??'soldier'))}}")
patch(p, '  const currentLook=WARDROBE_LOOKS.find(l=>sameAppearance(recipe,applyLook(recipe,l.id)));', '  const currentLook=WARDROBE_LOOKS.find(l=>sameAppearance(recipe,applyLook(recipe,l.id)));\n  const soldierHelmet=identifySoldierHelmet(recipe.slots.headwear);')
for label in ['皇宫禁卫', '边疆戍卒', '城市守军']:
    patch(p, f"'{label} · 长枪'", f"`{label} · ${{SOLDIER_IDENTITY_NAMES[soldierHelmet?.identity??'soldier']}} · 长枪`")
old = '<h2>军人试衣</h2><span>宫卫 / 边军 / 城军</span></div>'
new = old + '''<div className="display-grid" role="group" aria-label="军人身份">{SOLDIER_IDENTITY_IDS.map(identity=><button key={identity} data-testid={'soldier-identity-'+identity} disabled={!soldierHelmet} aria-pressed={soldierHelmet?.identity===identity} className={soldierHelmet?.identity===identity?'active':''} onClick={()=>edit(r=>applySoldierIdentity(r,identity))}>{SOLDIER_IDENTITY_NAMES[identity]}</button>)}</div>'''
patch(p, old, new)
patch(p, '整套应用，保留当前性别与发式。各部件可独立混搭；长枪随右手，不代表已制作持枪战斗动作。', '先选驻地整套，再切普通士兵／队长。身份只换当前军盔，混搭衣裤与染色保持；切驻地保留身份。各部件可独立选择，长枪仍是原动作试衣。')

p = 'scripts/check-lightwear.ts'
patch(p, 'palace_guard_helmet:126,frontier_guard_helmet:112,city_guard_helmet:144,', 'palace_guard_helmet:126,frontier_guard_helmet:112,city_guard_helmet:144,palace_captain_helmet:126,frontier_captain_helmet:126,city_captain_helmet:164,')
for style in ['palace', 'frontier', 'city']:
    # 仅两个已存在的帽底/主壳分派；新盔复用同一真实壳，不放宽检测算法。
    patch(p, f"id==='{style}_guard_helmet'?", f"(id==='{style}_guard_helmet'||id==='{style}_captain_helmet')?", 2)
patch(p, "['palace_guard_helmet','frontier_guard_helmet','city_guard_helmet','guard_helmet','cloth_wrap','scholar_cap']", "['palace_guard_helmet','frontier_guard_helmet','city_guard_helmet','palace_captain_helmet','frontier_captain_helmet','city_captain_helmet','guard_helmet','cloth_wrap','scholar_cap']", 2)

p = 'scripts/check-soldier.ts'
Path(p).write_text("import './check-soldier-identities';\n" + Path(p).read_text())
p = 'scripts/check-soldier-assets.ts'
Path(p).write_text("import { SOLDIER_HELMETS } from '../src/soldier/identities';\n" + Path(p).read_text())
old = 'const rows:unknown[]=[],silhouettes:unknown[]=[];let negativeCases=0,poses=0;'
new = '''// S4 只扩展头盔组合；原三套轮廓/服饰及全部故障反例继续保留。
const captainBudgets={palace:126,frontier:126,city:164};
const variants=[...styles,...styles.map(style=>({...style,id:style.id+'-captain',apply:(r:Recipe)=>style.apply(r,'captain'),slots:{...style.slots,headwear:SOLDIER_HELMETS[style.id].captain},budgets:{...style.budgets,helmet:captainBudgets[style.id]}}))];
''' + old
patch(p, old, new)
patch(p, 'for(const style of styles)for(const bodyType of BODY_TYPES)for(const hairStyle of HAIR_STYLE_IDS){', 'for(const style of variants)for(const bodyType of BODY_TYPES)for(const hairStyle of HAIR_STYLE_IDS){')
patch(p, '  for(const style of styles)for(const bodyType of BODY_TYPES){', '  for(const style of variants)for(const bodyType of BODY_TYPES){')
old = "if(process.argv.includes('--motion')){"
new = '''// 新三顶队长盔也必须实际拒绝开口、反面、错误骨骼、非数及重复面。
for(const style of styles){
  const helmet=subset(makeCharacter(style.apply(createRecipe(),'captain')).surface,style.helmet);
  for(const mutate of [(c:Cage)=>{c.faces.pop();},(c:Cage)=>{c.faces[0].v.reverse();},(c:Cage)=>{c.vertices[0].w=[B.Neck,B.Neck,1];},(c:Cage)=>{c.vertices[0].p[0]=NaN;},(c:Cage)=>{c.faces.push({...c.faces[0]});}]){
    const broken=cloneCage(helmet);mutate(broken);assert.throws(()=>closedRigid(broken,B.Head,captainBudgets[style.id]));negativeCases++;
  }
}
''' + old
patch(p, old, new)

p = 'scripts/check-soldier-browser.mjs'
Path(p).write_text("import { checkSoldierIdentities } from './check-soldier-identities-browser.mjs';\n" + Path(p).read_text())
patch(p, '  assert.deepEqual(errors,[]);writeFileSync', '  await checkSoldierIdentities({page,browser,base,capture,dir,recipe,state,sync,motionReady,seek,shot,checks,images,styles});\n  assert.deepEqual(errors,[]);writeFileSync')

intro = '''## S4：普通士兵／队长，只换头盔

三种驻地均支持普通士兵与队长两个试衣身份。队长只替换独立 headwear 资产，不增加上衣、裤装、鞋靴、武器、背旗或多级军阶。共同边界与使用入口见《普通士兵与队长》，原 SoldierRoleId 仍表示规划兵种；S4 不把身份写进 Recipe V5。

原军人试衣增加两态按钮，状态从实际军盔派生，撤销／保存恢复／导入后同步；先选驻地，切身份保留全部混搭与染色，切驻地整套保留普通／队长选择。新头盔仍是自由混搭资产。正式检查、实际看图、用户美术认可分别记录在本轮 PR；不得把资产注册或截图生成写成已完成视觉验收。保留所有并行动物、动捕与人物修改；合并前重新读取 main，禁止强推。
'''
prepend_section('Documentation/工作交接.md', intro)
prepend_section('AGENTS.md', '''## S4：军人两态身份边界

用户授权本轮为三种驻地 × 普通士兵／队长，身份差异只能是独立头盔。复用 SoldierIdentity 两态试衣选择；现有 SoldierRoleId 仍是规划兵种，不能重定义。Recipe 仍精确六字段／七槽位／20骨，实际头盔是唯一保存来源，不加 role/rank 或独立身份存储。普通军盔、衣甲、裤裙、军靴与武器作者代码不变；原全源键／中点、穿插和故障回归不得缩减。新头盔进入原头饰封闭／发式检查，无新豁免。

原军人试衣增加身份按钮与 soldierRole 查询；状态从真实 headwear 反推。切身份仅换盔，混搭与染色保持；切驻地仍应用原整套并保留身份。具体所有权、入口与验证集中在《普通士兵与队长》。先通过正式检查和真实截图审查再正常合并，用户美术认可单独等待，不扩展后续兵种。
''')
prepend_section('README.md', '''## S4：三种驻地 × 普通士兵／队长

人物工坊右侧「军人试衣」先选皇宫／边疆／城市，再点击「普通士兵／队长」。身份只替换头盔，不重置混搭衣裤、武器或染色；切换驻地整套会保留当前身份。三顶队长盔也能从「头饰」单独选用。

队长示例：`?soldier=palace&soldierRole=captain&pose=bind&paused=1&view=free`；换为 `soldier=frontier` 或 `soldier=city` 检查另外两套。`soldierRole=soldier` 或省略为普通；`view=overview` 为经营俯视。显式 `headwear=` 最后覆盖，非法身份回退普通。没有独立军人页面、rank 系统或 Recipe 字段。

宫卫宽短缨、边军后掠短缨、城市低横冠沿用原盔壳；上衣、下装、鞋和武器完全共用。详见[普通士兵与队长](Documentation/普通士兵与队长.md)。本轮精确受测 SHA、Actions 与实际看图记录见对应 PR，用户美术认可单独验收。
''')
patch('README.md', 'S4未开始。', 'S4身份扩展见上方说明。')
p = 'Documentation/军人与甲胄工作流.md'
patch(p, 'S4 扩展尚未开始。', 'S4 普通士兵／队长的头盔识别见[普通士兵与队长](普通士兵与队长.md)。')
patch(p, '### S4：兵种与军阶扩展\n\n三套驻地风格稳定后再组合长枪、刀盾、弓手等兵种。军阶优先通过盔缨、腰扣和少量甲缘差异表达，不制造九套互不兼容的整身资产。', '''### S4：普通士兵／队长，两态头盔识别

只增加 palace_captain_helmet、frontier_captain_helmet、city_captain_helmet 三个独立头饰资产。身份只支持 soldier／captain，不增加队长衣裤、腰扣、鞋靴或武器。原驻地套装复用，切身份只替换 headwear；试衣状态由头盔反推，Recipe 不新增字段。原 SoldierRoleId 继续表示规划兵种，不能用它冒充身份。

设计服务于模拟经营高空视角、大量单位的低成本识别和资产数量控制。既要有顶部投影差异，也要检查正侧背与常用动作；不能只改颜色或增加正面小徽章。普通头盔、衣甲和原动作保持，详细作者职责及入口见《普通士兵与队长》。

### 后续兵种

刀盾、弓、弩等可留作未来独立任务；本轮不实现新兵种、新武器、背旗、披风、多级 rank、战斗或 ECS 军队玩法。''')
for path in ['Documentation/皇宫禁卫与长枪.md','Documentation/边疆戍卒与长枪.md','Documentation/城市守军与长枪.md']:
    prepend_section(path, '''## 两态身份入口

本文的基础资产与数字记录普通士兵。S4 新增队长头盔：在原 soldier 驻地入口加 `&soldierRole=captain`，或在原军人试衣点击队长；衣甲、裤裙、鞋靴和武器共用。普通／队长只通过 headwear 区分，详细契约见[普通士兵与队长](普通士兵与队长.md)。旧阶段中尚未开放身份的说明不覆盖本轮明确授权，后续兵种仍不在本轮实现。
''')
Path('Documentation/普通士兵与队长.md').write_text('''# 普通士兵与队长

## 目标与身份边界

三种驻地风格各提供普通士兵 soldier 与队长 captain 两种试衣／预设身份，只通过头盔表示。目的是在模拟经营经营俯视、大量单位与标准低模精度下，用少量资产获得清楚识别，不做历史官阶、多级军官或完整军队玩法。后续兵种可以独立扩展，本轮不做刀盾、弓弩、新武器、背旗和披风。

## 所有权与装配

`src/soldier/identities.ts` 拥有两态命名、驻地与头盔映射、根据真实头饰反推选择，以及只替换头饰的操作。已有 `SoldierRoleId` 仍表示 spearman 等规划兵种，不能混同身份。`looks.ts` 沿用原三套预设，第二参数只决定头盔；上衣、裤装、鞋靴和手持槽完全共用。

Recipe V5 仍精确六字段、七槽位。普通／队长不另存 role/rank，头盔 ID 是唯一保存来源；衣帽不会决定 Unity 正式军队的玩法身份。保存、恢复、撤销、文件往返、随机锁定、男女映射和 Actor 生命周期继续归原工坊负责。军装不进入居民默认随机池。

`captain-equipment.ts` 只拥有三顶队长盔。宫卫调用原盔工厂后拓宽短缨，不修改原宫卫资产；边军在原护颈盔上增加暗赤后掠短缨，城市在原低檐盔上增加低横冠。原三种盔壳、帽底、护颈、衣甲、军裤、甲裙、鞋与枪的作者文件不改。顶饰是闭合不透明几何，全部 Head 刚性权重，不增骨、透明片、布料、碰撞求解或第二 Renderer。

| 驻地 | 普通头盔 | 队长头盔 | 普通／队长三角形 |
|---|---|---|---|
| 皇宫 | palace_guard_helmet | palace_captain_helmet | 126／126 |
| 边疆 | frontier_guard_helmet | frontier_captain_helmet | 112／126 |
| 城市 | city_guard_helmet | city_captain_helmet | 144／164 |

三个新 ID 走原 headwear 下拉框及装配链路，可搭任意已有服装；不写死在整套模型中。帽底沿用相同安全接口，帽侧与帽顶不得增加发丝穿插豁免。取下恢复原发式。

## 使用与状态

先在原军人试衣选择驻地，再点击普通士兵／队长。身份切换只换当前军盔，保留混搭衣裤、鞋、背具、武器、染色、性别与发式。切驻地仍应用原完整预设并保留当前身份。当前非军盔时两个身份按钮禁用，不隐式把平民变成整套军人；单件军盔混搭时按当前盔所属驻地切换。

`?soldier=palace&soldierRole=captain&pose=bind&paused=1&view=free` 为宫卫队长，frontier/city 为其他驻地。省略 soldierRole 或 soldierRole=soldier 为普通，非法值回退普通。显式 headwear 等单件查询最后覆盖。没有 soldier 驻地参数时，身份查询不单独制造军装。view=overview 为经营俯视，view=three 为原正侧背三视图。

状态始终从 recipe.slots.headwear 反推，因此手选头饰、导入、撤销、恢复和换性别后不会留下与实际装备矛盾的身份。切换动作复用网格；换盔按原人物重建流程保留暂停相位，不修改 inverse bind。

## 检查职责

原 check:soldier 增加独立身份断言，验证三驻地×男女×三发式、只换头盔、非头盔网格完全一致、实际顶饰坐标及顶部投影差异、随机池隔离、文件协议和故障注入。原资产矩阵扩展为六套外观，队长盔也执行闭合、精确预算、颜色、刚性权重与故障反例；不替换原三种风格的全部轮廓与甲裙／军裤检查。

原 --motion 矩阵扩展六套×男女，仍读取全部真实动作源键和中点。原 lightwear 帽壳检查增加队长合法 ID，帽底例外仍对应原同一几何面，侧壳／帽顶贯穿、全下身、Snatch、deformation、骑乘和动物回归不缩减。

原军人浏览器检查追加两态按钮、跨驻地保留身份、混搭不重置、保存恢复撤销及文件往返、坏查询回退、男女与暂停换盔。显式 review:soldier 追加三组同机位普通／队长对比、三视图、经营俯视、男女坐姿／轻跑／射箭试衣、六套总览。拼图仅编排原 Canvas 的真实截图，不另绘人物，不用生成图片代替运行时。

自动数值通过、截图生成、AI 实际看图与用户美术认可分别记录在本轮 PR。有限离散采样不等于任意混搭、全时域零穿插，也不代表专用持枪、战斗动画或 Unity 大规模单位性能已经完成。
''')
print('S4 scoped source, regression and documentation changes applied.')
