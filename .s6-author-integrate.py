from pathlib import Path

def replace(path, old, new, count=1):
    p=Path(path); text=p.read_text()
    if new in text: return
    actual=text.count(old)
    assert actual==count, f'{path}: expected {count} anchors, got {actual}: {old[:100]}'
    p.write_text(text.replace(old,new))

replace('src/soldier/contract.ts', "['light', 'medium'] as const", "['light', 'medium', 'heavy'] as const")
replace('src/character/v3/types.ts', '  | "medium_armor"\n', '  | "medium_armor"\n  | "heavy_armor"\n')
replace('src/character/v3/types.ts', '  | "medium_armor_skirt"\n', '  | "medium_armor_skirt"\n  | "heavy_armor_skirt"\n')
replace('src/character/v3/types.ts', '  "medium_armor",\n', '  "medium_armor",\n  "heavy_armor",\n')
replace('src/character/v3/types.ts', '  "medium_armor_skirt",\n', '  "medium_armor_skirt",\n  "heavy_armor_skirt",\n')
replace('src/character/wardrobe/patterns.ts', "|'medium-top'|'city-top'", "|'medium-top'|'heavy-top'|'city-top'")
replace('src/character/wardrobe/patterns.ts', "|'medium-skirt'|'city-trousers'", "|'medium-skirt'|'heavy-skirt'|'city-trousers'")
replace('src/character/wardrobe/patterns.ts', "  medium_armor:{", "  heavy_armor:{id:'heavy-armor-top-v1',asset:'heavy-top',hem:1.020},\n  medium_armor:{")
replace('src/character/wardrobe/patterns.ts', "  medium_armor_skirt:{", "  heavy_armor_skirt:{id:'heavy-armor-skirt-v1',asset:'heavy-skirt',hem:.095},\n  medium_armor_skirt:{")
replace('src/character/wardrobe/assets/tops.ts', "import { makeMediumArmorTop }", "import { makeHeavyArmorTop } from './military/heavy-top';\nimport { makeMediumArmorTop }")
replace('src/character/wardrobe/assets/tops.ts', "  if(pattern.asset==='medium-top')", "  if(pattern.asset==='heavy-top')return makeHeavyArmorTop(recipe);\n  if(pattern.asset==='medium-top')")
replace('src/character/wardrobe/assets/trousers.ts', "import { makeMediumArmorSkirt }", "import { makeHeavyArmorSkirt } from './military/heavy-skirt';\nimport { makeMediumArmorSkirt }")
replace('src/character/wardrobe/assets/trousers.ts', "  if(pattern.asset==='medium-skirt')", "  if(pattern.asset==='heavy-skirt')return makeHeavyArmorSkirt(recipe);\n  if(pattern.asset==='medium-skirt')")
replace('src/character/wardrobe/catalog.ts', "  top:[{id:'medium_armor'", "  top:[{id:'heavy_armor',name:'重甲厚壳札甲'},{id:'medium_armor'")
replace('src/character/wardrobe/catalog.ts', "  bottom:[{id:'medium_armor_skirt'", "  bottom:[{id:'heavy_armor_skirt',name:'重甲宽幅甲裙与裤装'},{id:'medium_armor_skirt'")
replace('src/App.tsx', "import { applyPalaceGuard,", "import { SOLDIER_ARMOR_CLASS_IDS } from './soldier/contract';\nimport { SOLDIER_ARMOR_NAMES, identifyArmorClass, applySoldierArmorClass } from './soldier/armor';\nimport { applySoldierStyle, applyPalaceGuard,")
anchor="  const slots:Record<string,string>={};"
replace('src/App.tsx',anchor,"  if(['palace','frontier','city'].includes(qs.get('soldier')??'')&&qs.has('armorClass'))r=applySoldierArmorClass(r,enumQuery('armorClass',SOLDIER_ARMOR_CLASS_IDS,identifyArmorClass(r)??'medium'));\n"+anchor)
replace('src/App.tsx',"  const soldierHelmet=identifySoldierHelmet(recipe.slots.headwear);", "  const soldierHelmet=identifySoldierHelmet(recipe.slots.headwear);\n  const armorClass=identifyArmorClass(recipe);")
for title,style in [('Palace','palace'),('Frontier','frontier'),('City','city')]:
    old=f"onClick={{()=>edit(r=>apply{title}Guard(r,identifySoldierHelmet(r.slots.headwear)?.identity??'soldier'))}}"
    new=f"onClick={{()=>edit(r=>applySoldierStyle(r,'{style}'))}}"
    replace('src/App.tsx',old,new)
anchor='<div className="display-grid" role="group" aria-label="军人身份">'
new='<div className="display-grid" style={{gridTemplateColumns:\'repeat(3, minmax(0, 1fr))\'}} role="group" aria-label="甲装等级">{SOLDIER_ARMOR_CLASS_IDS.map(id=><button key={id} data-testid={\'soldier-armor-\'+id} disabled={!soldierHelmet} aria-pressed={armorClass===id} className={armorClass===id?\'active\':\'\'} onClick={()=>edit(r=>applySoldierArmorClass(r,id))}>{SOLDIER_ARMOR_NAMES[id]}</button>)}</div>'+anchor
replace('src/App.tsx',anchor,new)
replace('src/App.tsx','先选驻地整套，再切普通士兵／队长。身份只换当前军盔，混搭衣裤与染色保持；切驻地保留身份。各部件可独立选择，长枪仍是原动作试衣。','甲装等级只换上甲与下装；驻地切换保留已选等级和身份，只换头盔与配色。普通／队长只换头盔。混搭不强行归类，配方仍只保存实际部件。')
replace('scripts/check-soldier.ts',"assert.deepEqual(SOLDIER_ARMOR_CLASS_IDS, ['light', 'medium']);", "assert.deepEqual(SOLDIER_ARMOR_CLASS_IDS, ['light', 'medium', 'heavy']);")
replace('scripts/check-soldier-assets.ts',"import { SOLDIER_HELMETS }", "import { SOLDIER_ARMOR_CLASS_IDS } from '../src/soldier/contract';\nimport { SOLDIER_ARMOR_SLOTS } from '../src/soldier/armor';\nimport { applySoldierLook } from '../src/soldier/looks';\nimport { assertHeavyArmorSkirt, assertHeavyArmorTop } from './check-soldier-heavy';\nimport { SOLDIER_HELMETS, SOLDIER_IDENTITY_IDS }")
old="const variants=[...styles,...styles.map(style=>({...style,id:style.id+'-captain',apply:(r:Recipe)=>style.apply(r,'captain'),slots:{...style.slots,headwear:SOLDIER_HELMETS[style.id].captain},budgets:{...style.budgets,helmet:captainBudgets[style.id]}}))];"
new="""const armorBudgets={light:{top:340,bottom:260},medium:{top:386,bottom:308},heavy:{top:432,bottom:328}};
// 三等级 × 三驻地 × 两身份；原六种组合仍完整保留，新增组合使用同一检查链。
const variants=styles.flatMap(style=>SOLDIER_ARMOR_CLASS_IDS.flatMap(armorClass=>SOLDIER_IDENTITY_IDS.map(identity=>({
  ...style,id:style.id+'-'+armorClass+'-'+identity,
  apply:(r:Recipe)=>applySoldierLook(r,style.id,identity,armorClass),
  slots:{...style.slots,...SOLDIER_ARMOR_SLOTS[armorClass],headwear:SOLDIER_HELMETS[style.id][identity]},
  budgets:{...style.budgets,...armorBudgets[armorClass],helmet:identity==='captain'?captainBudgets[style.id]:style.budgets.helmet},
  skirt:armorClass==='heavy'?assertHeavyArmorSkirt:armorClass==='medium'?assertMediumArmorSkirt:assertCityTrousers,
}))));"""
replace('scripts/check-soldier-assets.ts',old,new)
replace('scripts/check-soldier-assets.ts',"  style.skirt(makeTrousers(recipe)!);", "  style.skirt(makeTrousers(recipe)!);\n  if(recipe.slots.top==='heavy_armor')assertHeavyArmorTop(makeTop(recipe)!);")
# 原三驻地截图仍保留城市轻甲；切驻地不再偷偷重置等级，需要显式选轻甲。
anchor="  await page.getByTestId('soldier-city').click();await sync();\n  assert.equal((await recipe()).slots.top,'city_guard_brigandine');"
replace('scripts/check-soldier-browser.mjs',anchor,"  await page.getByTestId('soldier-city').click();await sync();\n  assert.equal((await recipe()).slots.top,'medium_armor');\n  await page.getByTestId('soldier-armor-light').click();await sync();\n  assert.equal((await recipe()).slots.top,'city_guard_brigandine');")
anchor="  const cityFrame=capture?await page.locator('canvas').screenshot():null;\n  await page.getByRole('button',{name:'撤销',exact:true}).click();"
replace('scripts/check-soldier-browser.mjs',anchor,"  const cityFrame=capture?await page.locator('canvas').screenshot():null;\n  await page.getByRole('button',{name:'撤销',exact:true}).click();await sync();assert.equal((await recipe()).slots.top,'medium_armor');\n  await page.getByRole('button',{name:'撤销',exact:true}).click();")
print('S6 integration applied with exact, idempotent source anchors')
