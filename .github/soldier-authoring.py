from pathlib import Path
import json

def patch(path,old,new):
    p=Path(path);s=p.read_text()
    assert old in s,(path,old)
    p.write_text(s.replace(old,new))

p=Path('src/character/wardrobe/assets/trousers.ts');s=p.read_text();start=s.index('  const c:Cage=');core=s[start:s.rfind('\n}')]
Path('src/character/wardrobe/assets/trouser-shell.ts').write_text("import { B, type Cage, type Recipe, type Weight } from '../../v3/types';\nimport { ring, bridge, vertex, face, orient } from '../../v3/cage';\nimport { KNEE, kneeWeights } from '../../v3/leg-deformation';\nimport { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';\n\n/** 有限的闭裆裤壳制作操作。原长裤坐标与权重不变；装甲只复用内衬，不决定外层轮廓。 */\nexport function makeTrouserShell(recipe:Recipe,pattern:{thigh:number;knee:number;calf:number;hem:number;trim:boolean}):GarmentPiece {\n  const id=recipe.slots.bottom;\n"+core+'\n}\n')
s=s[:start]+'  return makeTrouserShell(recipe,pattern);\n}\n'
s=s.replace('import { B, type Cage, type Recipe, type Weight }','import { type Recipe }').replace("import { ring, bridge, vertex, face, orient } from '../../v3/cage';\n",'').replace("import { KNEE, kneeWeights } from '../../v3/leg-deformation';\n",'').replace('import { GARMENT_GEOMETRY_VERSION, type GarmentPiece }','import { type GarmentPiece }')
s="import { makeTrouserShell } from './trouser-shell';\nimport { makePalaceSkirt } from './military/palace-skirt';\n"+s
s=s.replace("  if(pattern.asset!=='classic')","  if(pattern.asset==='palace-skirt')return makePalaceSkirt(recipe);\n  if(pattern.asset!=='classic')")
p.write_text(s)
for old,new in [
 ('  | "guard_helmet"','  | "palace_guard_helmet"\n  | "guard_helmet"'),
 ('  "guard_helmet",','  "palace_guard_helmet",\n  "guard_helmet",'),
 ('  | "farmer_tunic"','  | "palace_guard_armor"\n  | "farmer_tunic"'),
 ('  "farmer_tunic",','  "palace_guard_armor",\n  "farmer_tunic",'),
 ('  | "work_pants"','  | "palace_guard_skirt"\n  | "work_pants"'),
 ('  "work_pants", "work_wrap",','  "palace_guard_skirt",\n  "work_pants", "work_wrap",'),
 ('type ShoesId = "body" | "cloth_shoes"','type ShoesId = "body" | "cloth_shoes" | "military_boots"'),
 ('  "cloth_shoes",\n]','  "cloth_shoes",\n  "military_boots",\n]'),
 ('type RightHandId = "none" | "farmer_hoe" | "guard_sword"','type RightHandId = "none" | "farmer_hoe" | "guard_sword" | "military_spear"'),
 ('  "guard_sword",\n]','  "guard_sword",\n  "military_spear",\n]')]:patch('src/character/v3/types.ts',old,new)
patch('src/character/wardrobe/patterns.ts',"'work-shirt'|'cross-shirt'|'half-sleeve'|'work-vest'|'short-jacket'","'work-shirt'|'cross-shirt'|'half-sleeve'|'work-vest'|'short-jacket'|'palace-top'")
patch('src/character/wardrobe/patterns.ts',"'short-trousers'|'continuous-short-skirt'|'continuous-long-skirt'","'short-trousers'|'continuous-short-skirt'|'continuous-long-skirt'|'palace-skirt'")
patch('src/character/wardrobe/patterns.ts',"  work_vest:{","  palace_guard_armor:{id:'palace-top-v1',asset:'palace-top',hem:1.035},\n  work_vest:{")
patch('src/character/wardrobe/patterns.ts',"  short_trousers:{","  palace_guard_skirt:{id:'palace-tassets-v1',asset:'palace-skirt',hem:.095},\n  short_trousers:{")
patch('src/character/wardrobe/assets/tops.ts','import { makeWorkVest }',"import { makePalaceTop } from './military/palace-top';\nimport { makeWorkVest }")
patch('src/character/wardrobe/assets/tops.ts',"  if(pattern.asset==='work-vest')","  if(pattern.asset==='palace-top')return makePalaceTop(recipe);\n  if(pattern.asset==='work-vest')")
patch('src/character/wardrobe/assets/footwear.ts','import { B,',"import { makeMilitaryBoots } from './military/boots';\nimport { B,")
patch('src/character/wardrobe/assets/footwear.ts',"  if(id==='body')return;","  if(id==='body')return;\n  if(id==='military_boots')return makeMilitaryBoots(recipe);")
patch('src/character/wardrobe/adornments.ts','import { B,',"import { addPalaceHelmet } from './military-equipment';\nimport { B,")
patch('src/character/wardrobe/adornments.ts',"  if(!['cloth_wrap'","  if(id==='palace_guard_helmet'){addPalaceHelmet(target,recipe);return true;}\n  if(!['cloth_wrap'")
patch('src/character/wardrobe/adornments.ts',"['guard_helmet','cloth_wrap','scholar_cap']","['palace_guard_helmet','guard_helmet','cloth_wrap','scholar_cap']")
patch('src/character/v3/outfit.ts','import { addBackEquipment }',"import { addMilitarySpear } from '../wardrobe/military-equipment';\nimport { addBackEquipment }")
patch('src/character/v3/outfit.ts','function addRightHand(c: Cage, id: RightHandId) {',"function addRightHand(c: Cage, id: RightHandId, recipe:Recipe) {\n  if(id==='military_spear'){addMilitarySpear(c,recipe);return;}")
patch('src/character/v3/outfit.ts','addRightHand(c, recipe.slots.rightHand);','addRightHand(c, recipe.slots.rightHand, recipe);')
patch('src/character/v3/outfit.ts','"rough_tunic", "cross_jacket", "layered_vest"','"rough_tunic", "cross_jacket", "layered_vest", "palace_guard_armor"')
for old,new in [
 ("headwear:[{id:'none'","headwear:[{id:'palace_guard_helmet',name:'宫卫红缨盔'},{id:'none'"),
 ("top:[{id:'work_vest'","top:[{id:'palace_guard_armor',name:'宫卫札甲'},{id:'work_vest'"),
 ("bottom:[{id:'short_trousers'","bottom:[{id:'palace_guard_skirt',name:'宫卫甲裙与裤装'},{id:'short_trousers'"),
 ("shoes:[{id:'cloth_shoes',name:'布鞋'}]","shoes:[{id:'cloth_shoes',name:'布鞋'},{id:'military_boots',name:'短筒军靴'}]"),
 ("rightHand:[{id:'none'","rightHand:[{id:'military_spear',name:'军用长枪'},{id:'none'")]:patch('src/character/wardrobe/catalog.ts',old,new)
patch('src/App.tsx','import {AnimationBrowser}',"import { applyPalaceGuard, isPalaceGuard } from './soldier/looks';\nimport {AnimationBrowser}")
patch('src/App.tsx','  const slots:Record<string,string>={};',"  if(qs.get('soldier')==='palace')r=applyPalaceGuard(r);\n  const slots:Record<string,string>={};")
anchor='        <section className="spaced"><div className="section-title"><h2>染色</h2>'
patch('src/App.tsx',anchor,'        <section className="spaced" aria-label="军人试衣"><div className="section-title"><h2>军人试衣</h2><span>S1 / 宫卫</span></div><button className={\'clear-equipment \'+(isPalaceGuard(recipe)?\'active\':\'\')} data-testid="soldier-palace" aria-pressed={isPalaceGuard(recipe)} onClick={()=>edit(applyPalaceGuard)}>皇宫禁卫 · 长枪</button><p className="hint">整套应用，保留当前性别与发式。各部件可独立混搭；长枪随右手，不代表已制作持枪战斗动作。</p></section>\n'+anchor)
patch('src/App.tsx',"['back','背面'],['three','三视图']","['back','背面'],['overview','经营俯视'],['three','三视图']")
patch('src/App.tsx',"'side','back','top','three'","'side','back','top','overview','three'")
patch('src/App.tsx',"{currentLook?.name??'自定义装扮'}","{isPalaceGuard(recipe)?'皇宫禁卫 · 长枪':currentLook?.name??'自定义装扮'}")
patch('src/scene/CharacterViewport.tsx',"| 'top' | 'three'","| 'top' | 'overview' | 'three'")
patch('src/scene/CharacterViewport.tsx',"o.view==='top'?[0,5,.001]:[2.8,y+1.05,4.5]","o.view==='top'?[0,5,.001]:o.view==='overview'?[2.9,y+4.3,4.2]:[2.8,y+1.05,4.5]")
patch('scripts/check-deformation.ts','      assert.equal(triCount(p.mesh),240);',"      assert.equal(triCount(p.mesh),bottom==='palace_guard_skirt'?360:240);\n      if(bottom==='palace_guard_skirt')assert.equal(p.mesh.vertices.filter(v=>v.id.startsWith('PalaceTasset.')).length,72);")
patch('scripts/check-garment-assets.ts','TOP_IDS, BOTTOM_IDS, BODY_TYPES','TOP_IDS, BOTTOM_IDS, SHOES_IDS, BODY_TYPES')
patch('scripts/check-garment-assets.ts',"      createRecipe({bodyType,dyes,slots:{...emptySlots(),shoes:'cloth_shoes'}}),","      ...SHOES_IDS.filter(id=>id!=='body').map(shoes=>createRecipe({bodyType,dyes,slots:{...emptySlots(),shoes}})),")
patch('scripts/check-garment-assets.ts',"    assertGarmentPiece(makeFootwear(createRecipe({bodyType,slots:{shoes:'cloth_shoes'}}))!);checked++;","    for(const shoes of SHOES_IDS){const p=makeFootwear(createRecipe({bodyType,slots:{shoes}}));if(p){assertGarmentPiece(p);checked++;}}")
patch('scripts/check-lightwear.ts','/^(Helmet|WardrobeCap','/^(PalaceHelmet|Helmet|WardrobeCap')
patch('scripts/check-lightwear.ts','  farmer_straw_hat:24,','  palace_guard_helmet:126,farmer_straw_hat:24,')
patch('scripts/check-lightwear.ts',"const baseCapPrefix=(id:HeadwearId)=>id==='guard_helmet'","const baseCapPrefix=(id:HeadwearId)=>id==='palace_guard_helmet'?'PalaceHelmet.Shell.Base':id==='guard_helmet'")
patch('scripts/check-lightwear.ts',"if(['guard_helmet','cloth_wrap','scholar_cap'].includes(id))","if(['palace_guard_helmet','guard_helmet','cloth_wrap','scholar_cap'].includes(id))")
patch('scripts/check-lightwear.ts',"const prefix=id==='guard_helmet'?'Helmet':'WardrobeCap';","const prefix=id==='palace_guard_helmet'?'PalaceHelmet.Shell':id==='guard_helmet'?'Helmet':'WardrobeCap';")
patch('scripts/check-lightwear.ts',"for(const id of ['guard_helmet','cloth_wrap','scholar_cap'] as const)","for(const id of ['palace_guard_helmet','guard_helmet','cloth_wrap','scholar_cap'] as const)")
