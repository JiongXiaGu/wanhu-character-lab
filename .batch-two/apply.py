from pathlib import Path
import json

def put(path, text):
    p=Path(path); p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text.strip()+'\n', encoding='utf-8')

def replace(path, before, after):
    p=Path(path); text=p.read_text(encoding='utf-8')
    if text.count(before)!=1: raise RuntimeError(f'Expected one source anchor in {path}: {before[:100]!r}; got {text.count(before)}')
    p.write_text(text.replace(before,after), encoding='utf-8')

# 只扩充款式枚举，不改变 Recipe V5、骨骼、人体、FBX 或历史资产。
replace('src/character/v3/types.ts','  | "ceremony_robe";','  | "ceremony_robe"\n  | "work_vest"\n  | "short_work_jacket";')
replace('src/character/v3/types.ts','  | "robe_skirt";','  | "robe_skirt"\n  | "short_trousers"\n  | "short_skirt";')
replace('src/character/v3/types.ts','  "rough_tunic", "cross_jacket", "layered_vest", "ceremony_robe",','  "rough_tunic", "cross_jacket", "layered_vest", "ceremony_robe",\n  "work_vest", "short_work_jacket",')
replace('src/character/v3/types.ts','  "loose_trousers", "work_wrap", "pleated_skirt", "robe_skirt",','  "loose_trousers", "work_wrap", "pleated_skirt", "robe_skirt",\n  "short_trousers", "short_skirt",')
replace('src/character/wardrobe/patterns.ts',"asset:'work-shirt'|'cross-shirt'|'half-sleeve'","asset:'work-shirt'|'cross-shirt'|'half-sleeve'|'work-vest'|'short-jacket'")
replace('src/character/wardrobe/patterns.ts',"asset:'straight-cloth'|'bound-action'","asset:'straight-cloth'|'bound-action'|'short-trousers'|'short-skirt'")
replace('src/character/wardrobe/patterns.ts',"  farmer_tunic:{id:","  work_vest:{id:'sleeveless-work-v1',asset:'work-vest',hem:1.045},\n  short_work_jacket:{id:'summer-short-jacket-v1',asset:'short-jacket',hem:1.025},\n  farmer_tunic:{id:")
replace('src/character/wardrobe/patterns.ts',"  work_pants:{id:","  short_trousers:{id:'knee-work-shorts-v1',asset:'short-trousers',hem:.507},\n  short_skirt:{id:'short-split-wrap-v1',asset:'short-skirt',hem:.511},\n  work_pants:{id:")
replace('src/character/wardrobe/patterns.ts',"wanhu-authored-patterns-v3","wanhu-authored-patterns-v4")
replace('src/character/wardrobe/assets/contract.ts',"wanhu-modular-garments-v5","wanhu-modular-garments-v6")
replace('src/character/wardrobe/assets/tops.ts',"import { makeWorkShirt }", "import { makeWorkVest } from './work-vest';\nimport { makeShortJacket } from './short-jacket';\nimport { makeWorkShirt }")
replace('src/character/wardrobe/assets/tops.ts',"  if(pattern.asset==='work-shirt')", "  if(pattern.asset==='work-vest')return makeWorkVest(recipe);\n  if(pattern.asset==='short-jacket')return makeShortJacket(recipe);\n  if(pattern.asset==='work-shirt')")
replace('src/character/wardrobe/assets/trousers.ts',"import { straightClothRows", "import { makeShortBottom } from './short-bottoms';\nimport { straightClothRows")
replace('src/character/wardrobe/assets/trousers.ts',"  const authored=pattern.asset!=='classic';", "  if(pattern.asset==='short-trousers'||pattern.asset==='short-skirt')return makeShortBottom(recipe);\n  const authored=pattern.asset!=='classic';")

put('src/character/wardrobe/assets/work-vest.ts',r'''
import { type Recipe } from '../../v3/types';
import { sewTorso, sewSleeve, finishTop, solidBand, torsoWaist, torsoRib, torsoChest, torsoNeck, type TorsoRow } from './top-seams';
import type { GarmentPiece } from './contract';

/** 无袖对襟短褂：宽肩带和袖窿本身是边界，没有假装成背心的内层长袖。 */
export function makeWorkVest(recipe:Recipe):GarmentPiece {
  const {primary,secondary,accent}=recipe.dyes;
  const rows:readonly TorsoRow[]=[
    ['Hem',1.045,.176,.108,[-.022,-.009,.009,.022],torsoWaist],
    ['HemFacing',1.068,.174,.109,[-.022,-.009,.009,.022],torsoWaist],
    ['Rib',1.18,.192,.120,[-.025,-.010,.010,.025],torsoRib],
    ['Chest',1.30,.214,.124,[-.036,-.020,.020,.036],torsoChest],
    ['Shoulder',1.402,.222,.111,[-.050,-.030,.030,.050],torsoChest],
    ['Neck',1.455,.070,.061,[-.035,-.019,.019,.035],torsoNeck],
  ];
  // 中央布片与两侧包边共享索引；没有额外悬浮门襟。
  const placket=[primary,accent,secondary,accent,primary,primary];
  const torso=sewTorso(rows,[solidBand(accent),placket,placket,placket,placket]);
  // 不生成袖筒，仅声明真实袖窿；保留源人体完整肩臂皮肤。
  const cuffs={RightCuff:sewSleeve(torso,1,[]),LeftCuff:sewSleeve(torso,-1,[])};
  const piece=finishTop(recipe,torso,cuffs,false);
  piece.covers=['torso'];
  return piece;
}
''')
put('src/character/wardrobe/assets/short-jacket.ts',r'''
import { B, type Recipe } from '../../v3/types';
import { sewTorso, sewSleeve, finishTop, solidBand, torsoWaist, torsoRib, torsoChest, torsoNeck, armBones, type TorsoRow } from './top-seams';
import type { GarmentPiece } from './contract';

/** 宽松短袖短打：直落短衣身、偏侧搭襟和上臂袖口，区别于及肘劳作短衣。 */
export function makeShortJacket(recipe:Recipe):GarmentPiece {
  const {primary,secondary,accent}=recipe.dyes;
  const rows:readonly TorsoRow[]=[
    ['Hem',1.025,.191,.117,[-.091,-.076,-.061,-.046],torsoWaist],
    ['HemFacing',1.049,.191,.117,[-.091,-.076,-.061,-.046],torsoWaist],
    ['Rib',1.18,.204,.126,[-.076,-.061,-.046,-.031],torsoRib],
    ['Chest',1.30,.225,.132,[-.052,-.037,-.022,-.007],torsoChest],
    ['Shoulder',1.409,.232,.115,[-.038,-.023,-.008,.007],torsoChest],
    ['Neck',1.455,.071,.063,[-.024,-.012,.012,.024],torsoNeck],
  ];
  const front=[primary,accent,secondary,accent,primary,primary];
  const torso=sewTorso(rows,[solidBand(accent),front,front,front,front]);
  const cuffs:Record<string,number[]>={};
  for(const side of [1,-1] as const){
    const [upper]=armBones(side);
    cuffs[(side===1?'Right':'Left')+'Cuff']=sewSleeve(torso,side,[
      ['ShortSleeve',.262,1.286,0,.085,.079,[B.Chest,upper,.12],primary],
      ['ShortCuffFacing',.305,1.223,0,.080,.075,[upper,upper,1],secondary],
      ['ShortCuff',.316,1.207,0,.080,.075,[upper,upper,1],accent],
    ]);
  }
  const piece=finishTop(recipe,torso,cuffs,false);
  // 袖口位于上臂中段，不能整块隐藏 upperArm；原皮肤在衣袖内连续保留。
  piece.covers=['torso'];
  return piece;
}
''')
put('src/character/wardrobe/assets/short-bottoms.ts',r'''
import { B, type Cage, type Recipe, type Vec3, type Weight } from '../../v3/types';
import { ring, bridge, face, vertex, orient } from '../../v3/cage';
import { kneeWeights } from '../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

/**
 * 短裤与短下裳各有制作轮廓。两者保留有限宽裆底；短下裳是有中间行走开衩的
 * A 字分片裙裤，不是连续布料裙。无需独立内衬槽位或每帧补偿。
 */
export function makeShortBottom(recipe:Recipe):GarmentPiece {
  const id=recipe.slots.bottom;
  if(id!=='short_trousers'&&id!=='short_skirt')throw new Error('未知短下装：'+id);
  const skirt=id==='short_skirt', c:Cage={vertices:[],faces:[],anchors:{}};
  const {primary,secondary,accent}=recipe.dyes;
  const profile:[number,number][]=[[-.45,.9],[.5,.9],[1,0],[.5,-.9],[-.45,-.9],[-.88,-.52],[-1,0],[-.88,.52]];
  const roots:number[][]=[],openings:Record<string,number[]>={};
  for(const side of [1,-1]){
    const name=side===1?'Right':'Left',thigh=side===1?B.RightThigh:B.LeftThigh,shin=side===1?B.RightShin:B.LeftShin;
    const directed=side===1?profile:profile.map(([x,z])=>[-x,-z] as [number,number]);
    const root=ring(c,`Shorts.${name}.Root`,[side*.101,.94,0],[1,0,0],[0,0,1],directed,.09,.094,[B.Hips,thigh,.55]);
    for(const k of [5,6,7]){c.vertices[root[k]].p[1]=k===6?.855:.882;c.vertices[root[k]].w=[B.Hips,thigh,k===6?.35:.5];}
    roots.push(root);let prev=root;
    const rows:readonly [string,number,number,number][] = skirt ? [
      ['PleatHigh',.805,.108,.110],['Flare',.650,.146,.124],
      ['HemFacing',.542,.165,.136],['Hem',.511,.165,.136],
    ] : [
      ['Thigh',.805,.098,.092],['CuffFacing',.550,.087,.081],['Cuff',.507,.087,.081],
    ];
    for(let r=0;r<rows.length;r++){
      const [label,y,width,depth]=rows[r];
      const w:Weight=r===0?[B.Hips,thigh,.28]:[thigh,shin,1];
      const next=ring(c,`Shorts.${name}.${label}`,[side*.101,y,0],[1,0,0],[0,0,1],directed,width,depth,w);
      if(skirt){
        // 扇形前后衣片向外展开，内侧开衩不横跨另一条腿；不是整条裤腿等比放大。
        const x=[.014,.101+.5*width,.101+width,.101+.5*width,.014,.006,.003,.006];
        const z=[.92*depth,.98*depth,0,-.98*depth,-.92*depth,-.52*depth,0,.52*depth];
        for(let k=0;k<8;k++)c.vertices[next[k]].p=[side*x[k],y,side*z[k]] as Vec3;
      }
      if(r>0)for(const vi of next)c.vertices[vi].w=kneeWeights(c.vertices[vi].p,thigh,shin);
      if(skirt&&r<rows.length-1){
        // 褶面色区在自身衣片上；不叠放会与腿互相穿插的装饰薄片。
        for(let k=0;k<8;k++)face(c,[prev[k],prev[(k+1)%8],next[(k+1)%8],next[k]],'thigh',[0,3].includes(k)?primary:secondary);
      }else bridge(c,prev,next,'thigh',r===rows.length-1?accent:secondary);
      prev=next;
    }
    openings[name+'Cuff']=prev;
  }
  const [rightRoot,leftRoot]=roots;
  const r=[rightRoot[4],rightRoot[5],rightRoot[6],rightRoot[7],rightRoot[0]],l=[leftRoot[0],leftRoot[7],leftRoot[6],leftRoot[5],leftRoot[4]];
  for(let i=0;i<4;i++)face(c,[r[i],r[i+1],l[i+1],l[i]],'pelvis',secondary);
  const perimeter=[rightRoot[0],rightRoot[1],rightRoot[2],rightRoot[3],rightRoot[4],leftRoot[0],leftRoot[1],leftRoot[2],leftRoot[3],leftRoot[4]];
  const waist=perimeter.map((vi,i)=>{const p=c.vertices[vi].p;return vertex(c,`Shorts.Waist.${i}`,[p[0]*.79,1.075,p[2]*.97],[B.Hips,B.Spine,.35]);});
  const band=perimeter.map((vi,i)=>{const p=c.vertices[vi].p;return vertex(c,`Shorts.WaistFacing.${i}`,[p[0]*.84,1.047,p[2]*.98],[B.Hips,B.Spine,.35]);});
  bridge(c,waist,band,'pelvis',primary);bridge(c,band,perimeter,'pelvis',secondary);
  openings.waist=waist;orient(c);c.anchors={...openings};
  // 源皮肤 shin 从 KneeUpper=.529 开始；.507/.511 的短下摆与之有固定遮挡重叠。
  return{id,slot:'bottom',version:GARMENT_GEOMETRY_VERSION,mesh:c,covers:['pelvis','thigh'],openings};
}
''')
put('src/character/wardrobe/headwear-fit.ts',r'''
import type { Cage, HeadwearId } from '../v3/types';

/** 固定制作留量，不按发型拟合、压发或读取动画。簪饰不是帽壳，保持其插簪位置。 */
export const HEADWEAR_CLEARANCE:Partial<Record<HeadwearId,readonly [number,number,number]>>={
  guard_helmet:[1.30,1.16,1.30],
  cloth_wrap:[1.22,1.18,1.24],
  scholar_cap:[1.20,1.08,1.22],
  farmer_straw_hat:[1.12,1.10,1.12],
  archer_headband:[1.16,1.00,1.16],
};
export const HEADWEAR_GEOMETRY_VERSION='wanhu-headwear-clearance-v2';
export function applyHeadwearClearance(c:Cage,firstVertex:number,id:HeadwearId):void {
  const scale=HEADWEAR_CLEARANCE[id];if(!scale)return;
  const originY=1.690,originZ=-.006;
  for(let i=firstVertex;i<c.vertices.length;i++){
    const p=c.vertices[i].p;
    c.vertices[i].p=[p[0]*scale[0],originY+(p[1]-originY)*scale[1],originZ+(p[2]-originZ)*scale[2]];
  }
}
''')
replace('src/character/v3/outfit.ts','import { addWardrobeHeadwear, finishHair }', 'import { applyHeadwearClearance } from "../wardrobe/headwear-fit";\nimport { addWardrobeHeadwear, finishHair }')
replace('src/character/v3/outfit.ts','function headwear(c: Cage, id: HeadwearId, recipe: Recipe) {', 'function headwear(c: Cage, id: HeadwearId, recipe: Recipe) {\n  const first=c.vertices.length;\n  buildHeadwear(c,id,recipe);\n  applyHeadwearClearance(c,first,id);\n}\nfunction buildHeadwear(c: Cage, id: HeadwearId, recipe: Recipe) {')

replace('src/character/wardrobe/catalog.ts',"  top:[{id:'rough_tunic'", "  top:[{id:'work_vest',name:'干活背心'},{id:'short_work_jacket',name:'短打短褂'},{id:'rough_tunic'")
replace('src/character/wardrobe/catalog.ts',"  bottom:[{id:'loose_trousers'", "  bottom:[{id:'short_trousers',name:'及膝短裤'},{id:'short_skirt',name:'短下裳·分片裙裤'},{id:'loose_trousers'")
replace('src/character/wardrobe/catalog.ts',"export const WARDROBE_LOOKS: readonly LookDefinition[] = [", "export const WARDROBE_LOOKS: readonly LookDefinition[] = [\n  {id:'lightwork-male',name:'夏日劳作',family:'轻便',description:'无袖短褂 · 及膝短裤',suggestedBody:'male',slots:slots('work_vest','short_trousers','cloth_wrap'),dyes:{primary:'#8b7760',secondary:'#546e70',accent:'#d3ba88'},hairStyle:'topknot'},\n  {id:'lightwork-female',name:'轻装围裳',family:'轻便',description:'短袖短打 · A字分片短下裳',suggestedBody:'female',slots:slots('short_work_jacket','short_skirt'),dyes:{primary:'#a67568',secondary:'#526b68',accent:'#d5bc8f'},hairStyle:'low_bun'},")

# 保留七款长裤完整的原膝部断言；新增无小腿裤管的两件短装走独立端口检查。
old="  for(const bottom of BOTTOM_IDS){if(bottom==='body')continue;const p=makeTrousers(createRecipe({bodyType,slots:{bottom}}))!;assertKnees(p.mesh,true);assert.equal(triCount(p.mesh),bottom==='loose_trousers'?272:bottom==='guard_pants'?304:220);}"
new="""  for(const bottom of BOTTOM_IDS){
    if(bottom==='body')continue;
    const p=makeTrousers(createRecipe({bodyType,slots:{bottom}}))!;
    if(bottom==='short_trousers'||bottom==='short_skirt'){
      assert.equal(triCount(p.mesh),bottom==='short_trousers'?144:176);
      assert.deepEqual(p.covers,['pelvis','thigh']);
      assert(p.mesh.vertices.every(v=>v.p[1]>=.5),'短装不能暗中恢复长裤管');
      for(const side of ['Right','Left'])assert.equal(p.openings[side+'Cuff'].length,8);
    }else{
      assertKnees(p.mesh,true);
      assert.equal(triCount(p.mesh),bottom==='loose_trousers'?272:bottom==='guard_pants'?304:220);
    }
  }"""
replace('scripts/check-deformation.ts',old,new)
replace('scripts/check-deformation.ts',"independentTrousersTriangles:{loose_trousers:272,guard_pants:304,other:220}","independentTrousersTriangles:{loose_trousers:272,guard_pants:304,short_trousers:144,short_skirt:176,other:220}")
replace('scripts/check-garment-assets.ts',"coverageCombinations:128","coverageCombinations:BODY_TYPES.length*TOP_IDS.length*BOTTOM_IDS.length")

p=Path('package.json'); package=json.loads(p.read_text()); package['scripts']['check:lightwear']='tsx scripts/check-lightwear.ts'; package['scripts']['check:mesh']+=' && npm run check:lightwear'; package['scripts']['review:lightwear']='node scripts/review-lightwear.mjs'; package['scripts']['review:wardrobe-batch']+=' && npm run review:lightwear'; p.write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n')

# 制作规范以各批记录为准；几何版本变更不是配方升级。
for path in ['Documentation/服装生成架构.md','Documentation/运行时人物生成架构.md','Documentation/GPU骨骼动画迁移契约.md','Documentation/固定基模与换装V5.md','Documentation/GitHubActions截图验收规范.md']:
    p=Path(path); t=p.read_text(); p.write_text(t.replace('wanhu-modular-garments-v5','wanhu-modular-garments-v6'))
put('Documentation/轻便服饰与头饰安全留量.md',r'''
# 第二批：轻便服饰与头饰安全留量

## 范围与制作契约

从第一批交付 main `feebadf7451c53a2637c6cd828ba6d617f15a5ce` 接手。第一批常服保留，不再扩充同类长袖/长裤。

新增 work_vest（干活背心）、short_work_jacket（短打短褂）、short_trousers（及膝短裤）、short_skirt（短下裳·分片裙裤）。五类包覆头饰有固定外扩留量，簪饰不是帽壳，仍保持插簪关系。新增两套轻便推荐供快速体验，原有推荐保留。

Recipe仍V5、固定成年男女、20骨骼/每顶点最多双权重、单一精度和一套角色骨架不变。皮肤v3、固定绑定v1不修改。服装资源v6与Recipe V6无关。源FBX、参考模型和重定向不修改；PR #12 不合入。

## 上衣

背心是真正无袖的对襟短褂：宽肩带、实际袖窿、短腰线，没有假冒无袖的内层长袖。短打短褂是更宽松的直落短衣身、上臂中段短袖、偏侧搭襟；不是旧劳作短衣染色版。

两者只保证完整遮蔽torso。upperArm/forearm皮肤保持，不能因穿短袖把整条上臂隐藏。背心袖窿及短褂的局部袖筒覆盖原皮肤，原人体不被改写或动态切割。端口仍为腰、领及两袖窿/袖口。

## 下装

短裤露出膝附近和小腿。短下裳采用外侧展开的A字裙片、前后褶面和中间行走开衩；本批明确选择稳定的分片裙裤，不宣称连续软布裙。两者都是一个完整下装资产，有限宽裆底与腰臀保持，不增加内衬槽位。

短裤/短下裳只覆盖pelvis/thigh，保留shin/foot；下摆在男性制作坐标.507/.511米，与源KneeUpper=.529米开始的小腿表面有固定重叠。裙裤可分开随两腿运动，不采用横跨双腿的大硬裙壳或实时碰撞。女性沿用一次固定映射，男女都能穿。

短裤主色在腰口、secondary裤身、accent裤脚；短下裳主色另用于前后褶面，secondary侧片，accent下摆。上衣为primary主布、secondary搭襟/袖口、accent包边。染色不改拓扑和权重。

## 头饰

headwear-fit.ts只对新生成的帽饰顶点进行固定制作空间外扩，不读取发型或动画。轻盔横纵半径1.30倍、帽高1.16倍；包巾1.22/1.18/1.24；方冠1.20/1.08/1.22；草帽1.12/1.10/1.12；头巾1.16/1/1.16（顺序X/Y/Z）。允许偏夸张的轮廓，以稳定遮挡为先。

保留现有戴帽隐藏发髻、取帽恢复同一发型的规则，不增加每顶帽/每种发型适配表，不缩小或删除头皮。所有帽饰/头发保持Head刚性权重，绑定空间安全关系随同一骨骼运动。

## 验收与边界

原六条Actions、全部旧检查/源键与中点/压力动作保留。新增短装结构、完整露肤、三色不改网格、帽饰留量、不同剪影和V5往返检查。原七款长裤仍检查全部三圈膝部；新短装没有长裤膝下结构，独立验证下摆接口与裸露小腿。原贯穿循环自动覆盖新增下装，不降低阈值或排除新款。

截图使用真实网页，覆盖男女/新旧混搭、帽饰×三发型、正侧背、染色、领袖窿/下摆近景、坐姿/深蹲/慢跑/射箭/起步及多相位。自动生成不是人工美术签署；受测SHA、实际面数、运行结果和实际打开图片范围由本批交接追加，不预填成功。

保留膝肘硬折、简化手部、裙裤开衩和静态双权重边界；不追求连续软布裙或所有连续瞬间零接触。无儿童老人、连续体型、完整长袍/大裙摆、实时布料、全身IK、新骨架、通用Mesh导入或Unity正式运行时。
''')
print('SECOND_BATCH_CORE_AUTHORED')
