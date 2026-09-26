import { soldierHelmetFor, SOLDIER_IDENTITY_IDS } from '../src/soldier/identities';
import { SOLDIER_ARMOR_CLASS_IDS } from '../src/soldier/contract';
import {createHash} from 'node:crypto';
import { SOLDIER_ARMOR_SLOTS } from '../src/soldier/armor-classes';
import { HEAVY_ARMOR_BUDGET, assertHeavyArmorTop, assertHeavyArmorSkirt, checkHeavyArmor } from './check-soldier-heavy';
import { assertCityTrousers,assertCitySilhouette } from './check-soldier-city';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import * as T from 'three';
import {B,BODY_TYPES,HAIR_STYLE_IDS,createRecipe,type Cage,type Recipe,type Weight} from '../src/character/v3/types';
import {makeCharacter} from '../src/character/v3/outfit';
import {makeActor} from '../src/character/v3/rig';
import {makeJoints,shapeRigidPoint} from '../src/character/v3/body';
import {triCount,edgeKey,cloneCage,cross,sub} from '../src/character/v3/cage';
import {makeTop} from '../src/character/wardrobe/assets/tops';
import {makeTrousers} from '../src/character/wardrobe/assets/trousers';
import {makeFootwear} from '../src/character/wardrobe/assets/footwear';
import {assertGarmentPiece} from './check-garment-assets';
import {assertComponentWinding} from './check-components';
import {assertMediumArmorSkirt,assertSharedMediumArmor} from './check-soldier-medium';
import {parseRecipeFile,randomizeCharacter,SLOT_OPTIONS,WARDROBE_LOOKS} from '../src/character/wardrobe/catalog';
import {applyPalaceGuard,PALACE_GUARD_SLOTS,applyFrontierGuard,FRONTIER_GUARD_SLOTS,applyCityGuard,CITY_GUARD_SLOTS,applySoldierLoadout} from '../src/soldier/looks';
import {MILITARY_SPEAR_GRIP} from '../src/character/wardrobe/military-equipment';
import {MOTION_CLIPS,motionAssetDirectory} from '../src/character/motion/catalog';
import {retargetMotion} from '../src/character/motion/retarget';

const budgets={top:386,bottom:308,shoes:120,helmet:126,spear:58};
const styles=[
  {id:'palace',apply:applyPalaceGuard,slots:PALACE_GUARD_SLOTS,budgets,helmet:'PalaceHelmet.',skirt:assertMediumArmorSkirt},
  {id:'frontier',apply:applyFrontierGuard,slots:FRONTIER_GUARD_SLOTS,budgets:{...budgets,helmet:112},helmet:'FrontierHelmet.',skirt:assertMediumArmorSkirt},
  {id:'city',apply:applyCityGuard,slots:CITY_GUARD_SLOTS,budgets:{...budgets,top:340,bottom:260,helmet:144},helmet:'CityHelmet.',skirt:assertCityTrousers},
] as const;
const captainBudgets={palace:142,frontier:142,city:166};
const armorBudgets={light:{top:340,bottom:260},medium:{top:386,bottom:308},heavy:HEAVY_ARMOR_BUDGET};
// S6：完整三轴笛卡尔积，不以驻地默认搭配代替各等级真实资产与动画覆盖。
const variants=styles.flatMap(style=>SOLDIER_ARMOR_CLASS_IDS.flatMap(armorClass=>SOLDIER_IDENTITY_IDS.map(identity=>({
  ...style,id:`${style.id}-${armorClass}-${identity}`,armorClass,identity,
  apply:(r:Recipe)=>applySoldierLoadout(r,style.id,armorClass,identity),
  slots:{...style.slots,...SOLDIER_ARMOR_SLOTS[armorClass],headwear:soldierHelmetFor(style.id,identity,armorClass)},
  helmet:armorClass==='heavy'?`Heavy${style.id[0].toUpperCase()+style.id.slice(1)}Helmet.`:style.helmet,
  budgets:{...style.budgets,...armorBudgets[armorClass],helmet:armorClass==='heavy'?(identity==='captain'?218:188):identity==='captain'?captainBudgets[style.id]:style.budgets.helmet},
  skirt:armorClass==='heavy'?assertHeavyArmorSkirt:armorClass==='medium'?assertMediumArmorSkirt:assertCityTrousers,
}))));
assert.equal(variants.length,18);assert.equal(new Set(variants.map(v=>v.id)).size,18);
const motionArmor=process.env.SOLDIER_MOTION_ARMOR;
assert(motionArmor===undefined||(process.argv.includes('--motion')&&SOLDIER_ARMOR_CLASS_IDS.some(id=>id===motionArmor)), 'SOLDIER_MOTION_ARMOR must be light/medium/heavy and requires --motion');
const motionVariants=motionArmor?variants.filter(v=>v.armorClass===motionArmor):variants;
assert.equal(motionVariants.length,motionArmor?6:18);
const motionCases:{variant:string;bodyType:string;clip:string;samples:number;sampleDigest:string}[]=[];
const started=performance.now();
const rows:unknown[]=[],silhouettes:unknown[]=[];let negativeCases=0,poses=0;
function subset(c:Cage,prefix:string):Cage {
  const source=c.vertices.flatMap((v,i)=>v.id.startsWith(prefix)?[i]:[]),remap=new Map(source.map((v,i)=>[v,i]));
  return{vertices:source.map(i=>c.vertices[i]),faces:c.faces.filter(f=>f.v.every(i=>remap.has(i))).map(f=>({...f,v:f.v.map(i=>remap.get(i)!)})),anchors:{}};
}
function closedAuthored(c:Cage,count:number,expectedWeight:(id:string)=>Weight){
  assert.equal(triCount(c),count);assert(c.vertices.length>0);assert.equal(new Set(c.vertices.map(v=>v.id)).size,c.vertices.length);
  const edges=new Map<string,number>();
  for(const v of c.vertices){assert(v.p.every(Number.isFinite));assert.deepEqual(v.w,expectedWeight(v.id));}
  for(const f of c.faces){assert.equal(new Set(f.v).size,f.v.length);assert.match(f.color!,/^#[0-9a-f]{6}$/i);for(let i=1;i<f.v.length-1;i++)assert(Math.hypot(...cross(sub(c.vertices[f.v[i]].p,c.vertices[f.v[0]].p),sub(c.vertices[f.v[i+1]].p,c.vertices[f.v[0]].p)))>1e-10);f.v.forEach((a,i)=>{const e=edgeKey(a,f.v[(i+1)%f.v.length]);edges.set(e,(edges.get(e)??0)+1);});}
  for(const n of edges.values())assert.equal(n,2);assertComponentWinding(c);
}
function closedRigid(c:Cage,bone:number,count:number){closedAuthored(c,count,()=>[bone,bone,1]);}
function assertGrip(c:Cage,recipe:Recipe){
  const ring=c.vertices.filter(v=>v.id.startsWith('MilitarySpear.Shaft.1.'));assert.equal(ring.length,6);
  const expected=shapeRigidPoint(MILITARY_SPEAR_GRIP,B.RightHand,recipe,makeJoints(createRecipe()),makeJoints(recipe));
  const center=ring.reduce((p,v)=>p.add(new T.Vector3(...v.p)),new T.Vector3()).multiplyScalar(1/6);
  assert(center.distanceTo(new T.Vector3(...expected))<1e-7,'枪杆握点必须对应实际右手绑定空间');
}
for(const style of variants)for(const bodyType of BODY_TYPES)for(const hairStyle of HAIR_STYLE_IDS){
  const input=createRecipe({bodyType,hairStyle,hairColor:'#353331'}),snapshot=JSON.stringify(input),recipe=style.apply(input),d=makeCharacter(recipe);
  assert.equal(JSON.stringify(input),snapshot);assert.equal(recipe.bodyType,input.bodyType);assert.equal(recipe.hairStyle,input.hairStyle);assert.equal(recipe.hairColor,input.hairColor);
  assert.deepEqual(Object.keys(recipe).sort(),['version','bodyType','slots','dyes','hairStyle','hairColor'].sort());assert.deepEqual(parseRecipeFile(JSON.stringify(recipe)),recipe);assert.equal(d.joints.length,20);assert.deepEqual(d.joints,makeJoints(input));
  for(const key of Object.keys(style.slots) as (keyof typeof PALACE_GUARD_SLOTS)[])assert(SLOT_OPTIONS[key].some(o=>o.id===recipe.slots[key]));
  for(const [key,make] of [['top',makeTop],['bottom',makeTrousers],['shoes',makeFootwear]] as const){const p=make(recipe)!;assertGarmentPiece(p);assert.equal(triCount(p.mesh),style.budgets[key]);}
  if(style.armorClass==='heavy')assertHeavyArmorTop(makeTop(recipe)!);
  closedRigid(subset(d.surface,style.helmet),B.Head,style.budgets.helmet);closedRigid(subset(d.surface,'MilitarySpear.'),B.RightHand,budgets.spear);assertGrip(d.surface,recipe);
  style.skirt(makeTrousers(recipe)!);
  assert(!d.surface.vertices.some(v=>v.id.startsWith('CustomHair')),'盔内不能保留穿壳发髻');
  assert.deepEqual(d.body,makeCharacter(input).body,'军装不得修改固定皮肤');
  const changed=makeCharacter(createRecipe({...recipe,dyes:{primary:'#ad3344',secondary:'#416275',accent:'#dfb363'}}));
  assert.deepEqual(changed.surface.vertices,d.surface.vertices,'染色不得改变坐标、权重或拓扑');assert.notDeepEqual(changed.surface.faces.map(f=>f.color),d.surface.faces.map(f=>f.color));
  assert.equal(randomizeCharacter(recipe,126,['top','bottom','headwear','shoes','rightHand']).slots.top,style.slots.top);
  const actor=makeActor(d),position=actor.mesh.geometry.attributes.position,p=new T.Vector3(),bind=new T.Vector3();actor.update(0);actor.skeleton.update();
  for(let i=0;i<position.count;i++){actor.mesh.getVertexPosition(i,p);bind.fromBufferAttribute(position as T.BufferAttribute,i);assert(p.distanceTo(bind)<1e-5);}
  actor.dispose();rows.push({style:style.id,bodyType,hairStyle,totalTriangles:triCount(d.surface),logicalVertices:d.surface.vertices.length,budgets:style.budgets});
}
assert.equal(rows.length,18*BODY_TYPES.length*HAIR_STYLE_IDS.length);
const heavy=checkHeavyArmor();negativeCases+=heavy.negativeCases;silhouettes.push({style:'heavy-versus-medium',...heavy.silhouette});
// 同一 Heavy 在三种驻地及普通/队长中必须保持完全相同的几何和骨权重。
function heavySignature(c:Cage){
  const keep=(id:string)=>id.startsWith('Top.')||id.startsWith('HeavyArmorSkirt.')||id.startsWith('HeavyArmorLiner.');
  return {vertices:c.vertices.filter(v=>keep(v.id)),faces:c.faces.filter(f=>f.v.every(i=>keep(c.vertices[i].id))).map(f=>({v:f.v.map(i=>c.vertices[i].id),region:f.region,part:f.part}))};
}
for(const bodyType of BODY_TYPES){
  const reference=heavySignature(makeCharacter(applySoldierLoadout(createRecipe({bodyType}),'palace','heavy')).surface);
  for(const style of styles)for(const identity of SOLDIER_IDENTITY_IDS)assert.deepEqual(heavySignature(makeCharacter(applySoldierLoadout(createRecipe({bodyType}),style.id,'heavy',identity)).surface),reference);
  const broken=structuredClone(reference);broken.vertices[0].p[0]+=.01;assert.throws(()=>assert.deepEqual(broken,reference));negativeCases++;
}
assert(!WARDROBE_LOOKS.some(l=>l.slots.top==='medium_armor'),'军装不能混入默认居民灵感/随机池');
for(let seed=0;seed<64;seed++)assert.notEqual(randomizeCharacter(createRecipe(),seed).slots.top,'medium_armor');
const r=applyPalaceGuard(createRecipe()),spear=subset(makeCharacter(r).surface,'MilitarySpear.');
for(const mutate of [(c:Cage)=>{c.faces.pop();},(c:Cage)=>{c.faces[0].v.reverse();},(c:Cage)=>{c.vertices[0].w=[B.LeftHand,B.LeftHand,1];},(c:Cage)=>{c.vertices[0].p[0]=NaN;},(c:Cage)=>{c.faces.push({...c.faces[0]});}]){const c=cloneCage(spear);mutate(c);assert.throws(()=>closedRigid(c,B.RightHand,budgets.spear));negativeCases++;}
const detached=cloneCage(spear);for(const v of detached.vertices)v.p[0]+=.05;assert.throws(()=>assertGrip(detached,r));negativeCases++;
for(const retired of ['palace_guard_armor','frontier_lamellar_armor','palace_guard_skirt','frontier_armor_skirt']){
  const slots={...r.slots,[retired.includes('skirt')?'bottom':'top']:retired};assert.throws(()=>parseRecipeFile(JSON.stringify({...r,slots})));negativeCases++;
}
for(const value of [{...r,profession:'soldier'},{...r,slots:{...r.slots,headwear:'city_guard_missing_helmet'}},{...r,slots:{...r.slots,top:'guard_light_armor'}}]){assert.throws(()=>parseRecipeFile(JSON.stringify(value)));negativeCases++;}
for(const make of [makeTop,makeTrousers,makeFootwear]){const p=structuredClone(make(r)!);p.mesh.faces.pop();assert.throws(()=>assertGarmentPiece(p));negativeCases++;}
// 共享中甲下装保留原封闭、权重、长度和回收面对角线反例；不伪造两套驻地几何。
const mediumSkirt=makeTrousers(r)!;
for(const mutate of [
  (p:typeof mediumSkirt)=>{p.mesh.faces.pop();},
  (p:typeof mediumSkirt)=>{p.mesh.faces[0].v.reverse();},
  (p:typeof mediumSkirt)=>{p.mesh.vertices[0].p[0]=NaN;},
  (p:typeof mediumSkirt)=>{p.mesh.vertices[0].w[2]=NaN;},
  (p:typeof mediumSkirt)=>{p.mesh.vertices.find(v=>v.id==='MediumArmorSkirt.3.0')!.w[1]=B.LeftThigh;},
  (p:typeof mediumSkirt)=>{for(const v of p.mesh.vertices)if(v.id.startsWith('MediumArmorSkirt.0.'))v.p[1]-=.15;},
  (p:typeof mediumSkirt)=>{for(const v of p.mesh.vertices)if(v.id.startsWith('MediumArmorSkirt.5.'))v.p[1]=.78;},
  (p:typeof mediumSkirt)=>{p.mesh.vertices.find(v=>v.id==='MediumArmorSkirt.5.0')!.p[2]=.15;},
  (p:typeof mediumSkirt)=>{p.mesh.vertices.find(v=>v.id==='MediumArmorLiner.Right.Entry.0')!.p[1]=.70;},
  (p:typeof mediumSkirt)=>{const c=p.mesh;const f=c.faces.find(f=>f.v.some(i=>c.vertices[i].id==='MediumArmorLiner.Left.Entry.4')&&f.v.some(i=>c.vertices[i].id==='MediumArmorSkirt.5.0'))!;f.v.push(f.v.shift()!);},
]){const p=structuredClone(mediumSkirt);mutate(p);assert.throws(()=>assertMediumArmorSkirt(p));negativeCases++;}
for(const style of variants){
  assert(!WARDROBE_LOOKS.some(l=>l.slots.top===style.slots.top));
  for(let seed=0;seed<64;seed++)assert.notEqual(randomizeCharacter(createRecipe(),seed).slots.top,style.slots.top);
}
for(const bodyType of BODY_TYPES){
  const palace=makeCharacter(applyPalaceGuard(createRecipe({bodyType}))).surface;
  const frontier=makeCharacter(applyFrontierGuard(createRecipe({bodyType}))).surface;
  silhouettes.push({bodyType,style:'shared-medium',...assertSharedMediumArmor(palace,frontier)});
  const badTop=cloneCage(frontier);badTop.vertices.find(v=>v.id==='Top.Chest.0')!.p[2]+=.01;
  assert.throws(()=>assertSharedMediumArmor(palace,badTop));negativeCases++;
  const badBottom=cloneCage(frontier);badBottom.vertices.find(v=>v.id==='MediumArmorSkirt.3.0')!.p[0]+=.01;
  assert.throws(()=>assertSharedMediumArmor(palace,badBottom));negativeCases++;
}
const frontierRecipe=applyFrontierGuard(createRecipe());
const frontierHelmet=subset(makeCharacter(frontierRecipe).surface,'FrontierHelmet.');
for(const mutate of [(c:Cage)=>{c.faces.pop();},(c:Cage)=>{c.vertices[0].w=[B.Neck,B.Neck,1];},(c:Cage)=>{c.vertices[0].p[0]=NaN;}]){const c=cloneCage(frontierHelmet);mutate(c);assert.throws(()=>closedRigid(c,B.Head,112));negativeCases++;}

// S3 原三套同机位轮廓和城市军裤反例全部保留。
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

// 三顶队长盔继续拒绝开口、反面、错误骨骼、非数及重复面。
for(const style of styles){
  const helmet=subset(makeCharacter(style.apply(createRecipe(),'captain')).surface,style.helmet);
  for(const mutate of [(c:Cage)=>{c.faces.pop();},(c:Cage)=>{c.faces[0].v.reverse();},(c:Cage)=>{c.vertices[0].w=[B.Neck,B.Neck,1];},(c:Cage)=>{c.vertices[0].p[0]=NaN;},(c:Cage)=>{c.faces.push({...c.faces[0]});}]){
    const broken=cloneCage(helmet);mutate(broken);assert.throws(()=>closedRigid(broken,B.Head,captainBudgets[style.id]));negativeCases++;
  }
}
if(process.argv.includes('--motion')){
  for(const style of motionVariants)for(const bodyType of BODY_TYPES){
    const recipe=style.apply(createRecipe({bodyType})),actor=makeActor(makeCharacter(recipe)),geometry=actor.mesh.geometry,inverses=actor.skeleton.boneInverses.map(m=>m.toArray());
    const position=geometry.attributes.position,index=geometry.attributes.skinIndex,weight=geometry.attributes.skinWeight,p=new T.Vector3(),q=new T.Vector3();
    const gripBind=new T.Vector3(...shapeRigidPoint(MILITARY_SPEAR_GRIP,B.RightHand,recipe,makeJoints(createRecipe()),makeJoints(recipe)));
    const gripVertices=actor.data.surface.vertices.filter(v=>v.id.startsWith('MilitarySpear.Shaft.1.'));
    for(const def of MOTION_CLIPS){
      const source=JSON.parse(readFileSync(`public/${motionAssetDirectory(def.id)}/${def.id}.json`,'utf8')),bake=retargetMotion(actor.data,source);
      actor.resetBindPose();const action=actor.mixer.clipAction(bake.clip);action.setLoop(T.LoopOnce,1).play();action.paused=true;action.clampWhenFinished=true;
      const times=[...new Set<number>([0,source.duration,...source.times,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])].sort((a,b)=>a-b);
      motionCases.push({variant:style.id,bodyType,clip:def.id,samples:times.length,sampleDigest:createHash('sha256').update(JSON.stringify(times)).digest('hex')});
      for(const t of times){
        action.time=t;actor.update(0);actor.mesh.updateMatrixWorld(true);actor.skeleton.update();
        const right=new T.Matrix4().multiplyMatrices(actor.bones[B.RightHand].matrixWorld,actor.skeleton.boneInverses[B.RightHand]);
        const head=new T.Matrix4().multiplyMatrices(actor.bones[B.Head].matrixWorld,actor.skeleton.boneInverses[B.Head]);
        for(let i=0;i<position.count;i++){
          actor.mesh.getVertexPosition(i,p);assert(p.toArray().every(Number.isFinite));assert(p.length()<8);
          if(weight.getX(i)===1&&(index.getX(i)===B.RightHand||index.getX(i)===B.Head)){q.fromBufferAttribute(position as T.BufferAttribute,i).applyMatrix4(index.getX(i)===B.RightHand?right:head);assert(p.distanceTo(q)<1e-5);}
        }
        const center=gripVertices.reduce((sum,v)=>sum.add(new T.Vector3(...v.p).applyMatrix4(right)),new T.Vector3()).multiplyScalar(1/6);
        assert(center.distanceTo(gripBind.clone().applyMatrix4(right))<1e-5);
        assert.equal(actor.mesh.geometry,geometry);poses++;
      }
      actor.mixer.uncacheClip(bake.clip);
    }
    assert.deepEqual(actor.skeleton.boneInverses.map(m=>m.toArray()),inverses);actor.dispose();
  }
}
if(process.argv.includes('--motion')){
  assert.equal(motionCases.length,motionVariants.length*BODY_TYPES.length*MOTION_CLIPS.length);
  assert.equal(poses,motionCases.reduce((sum,c)=>sum+c.samples,0));
}
const report={passed:true,motionArmor:motionArmor??'all',motionCases,elapsedSeconds:(performance.now()-started)/1000,sourceSHA:process.env.REVIEW_HEAD_SHA??'local',rows,silhouettes,negativeCases,poses,motions:process.argv.includes('--motion')?MOTION_CLIPS.length:0,armorClasses:SOLDIER_ARMOR_CLASS_IDS,variantCount:variants.length,visualApproval:false,scope:'Actual closed assets, exact budgets, V5 identity, fixed bind, seed isolation; --motion samples all source keys and midpoints for skinning, rigid equipment and bind reuse. Lower-body intersections use the unchanged full tailoring test. No all-motion collision-free or combat-grip claim.'};
const dir=process.env.SOLDIER_CHECK_DIR??'review/soldier-numeric';mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/${poses?'motion':'assets'}.json`,JSON.stringify(report,null,2));console.log('SOLDIER_ASSETS',JSON.stringify({...report,rows:rows.length,motionCases:motionCases.length}));
