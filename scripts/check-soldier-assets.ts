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
import {parseRecipeFile,randomizeCharacter,SLOT_OPTIONS,WARDROBE_LOOKS} from '../src/character/wardrobe/catalog';
import {applyPalaceGuard,PALACE_GUARD_SLOTS} from '../src/soldier/looks';
import {MILITARY_SPEAR_GRIP} from '../src/character/wardrobe/military-equipment';
import {MOTION_CLIPS,motionAssetDirectory} from '../src/character/motion/catalog';
import {retargetMotion} from '../src/character/motion/retarget';

const budgets={top:386,bottom:360,shoes:120,helmet:126,spear:58};
const rows:unknown[]=[];let negativeCases=0,poses=0;
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
function closedOuterTasset(c:Cage,side:'Right'|'Left'){
  // 只对两片外侧长甲验证明确的髋部过渡；盔、枪、前后短甲仍保持原刚性断言。
  const thigh=side==='Right'?B.RightThigh:B.LeftThigh,hipWeights=[.526,.28,.108];
  assert.equal(c.vertices.length,12);
  for(let row=0;row<3;row++)for(let point=0;point<4;point++)assert(c.vertices.some(v=>v.id===`PalaceTasset.${side}.Outer.${row}.${point}`));
  closedAuthored(c,20,id=>{
    const row=Number(id.split('.').at(-2));assert(Number.isInteger(row)&&row>=0&&row<3);
    return[B.Hips,thigh,hipWeights[row]];
  });
}
function assertGrip(c:Cage,recipe:Recipe){
  const ring=c.vertices.filter(v=>v.id.startsWith('MilitarySpear.Shaft.1.'));assert.equal(ring.length,6);
  const expected=shapeRigidPoint(MILITARY_SPEAR_GRIP,B.RightHand,recipe,makeJoints(createRecipe()),makeJoints(recipe));
  const center=ring.reduce((p,v)=>p.add(new T.Vector3(...v.p)),new T.Vector3()).multiplyScalar(1/6);
  assert(center.distanceTo(new T.Vector3(...expected))<1e-7,'枪杆握点必须对应实际右手绑定空间');
}
for(const bodyType of BODY_TYPES)for(const hairStyle of HAIR_STYLE_IDS){
  const input=createRecipe({bodyType,hairStyle,hairColor:'#353331'}),snapshot=JSON.stringify(input),recipe=applyPalaceGuard(input),d=makeCharacter(recipe);
  assert.equal(JSON.stringify(input),snapshot);assert.equal(recipe.bodyType,input.bodyType);assert.equal(recipe.hairStyle,input.hairStyle);assert.equal(recipe.hairColor,input.hairColor);
  assert.deepEqual(Object.keys(recipe).sort(),['version','bodyType','slots','dyes','hairStyle','hairColor'].sort());assert.deepEqual(parseRecipeFile(JSON.stringify(recipe)),recipe);assert.equal(d.joints.length,20);assert.deepEqual(d.joints,makeJoints(input));
  for(const key of Object.keys(PALACE_GUARD_SLOTS) as (keyof typeof PALACE_GUARD_SLOTS)[])assert(SLOT_OPTIONS[key].some(o=>o.id===recipe.slots[key]));
  for(const [key,make] of [['top',makeTop],['bottom',makeTrousers],['shoes',makeFootwear]] as const){const p=make(recipe)!;assertGarmentPiece(p);assert.equal(triCount(p.mesh),budgets[key]);}
  closedRigid(subset(d.surface,'PalaceHelmet.'),B.Head,budgets.helmet);closedRigid(subset(d.surface,'MilitarySpear.'),B.RightHand,budgets.spear);assertGrip(d.surface,recipe);
  const tassets=subset(d.surface,'PalaceTasset.');assert.equal(triCount(tassets),120);
  for(const side of ['Right','Left'] as const)for(const panel of ['Front','Outer','Back']){
    const part=subset(d.surface,`PalaceTasset.${side}.${panel}.`);
    if(panel==='Outer')closedOuterTasset(part,side);else closedRigid(part,side==='Right'?B.RightThigh:B.LeftThigh,20);
  }
  assert(!d.surface.vertices.some(v=>v.id.startsWith('CustomHair')),'盔内不能保留穿壳发髻');
  assert.deepEqual(d.body,makeCharacter(input).body,'军装不得修改固定皮肤');
  const changed=makeCharacter(createRecipe({...recipe,dyes:{primary:'#ad3344',secondary:'#416275',accent:'#dfb363'}}));
  assert.deepEqual(changed.surface.vertices,d.surface.vertices,'染色不得改变坐标、权重或拓扑');assert.notDeepEqual(changed.surface.faces.map(f=>f.color),d.surface.faces.map(f=>f.color));
  assert.equal(randomizeCharacter(recipe,126,['top','bottom','headwear','shoes','rightHand']).slots.top,'palace_guard_armor');
  const actor=makeActor(d),position=actor.mesh.geometry.attributes.position,p=new T.Vector3(),bind=new T.Vector3();actor.update(0);actor.skeleton.update();
  for(let i=0;i<position.count;i++){actor.mesh.getVertexPosition(i,p);bind.fromBufferAttribute(position as T.BufferAttribute,i);assert(p.distanceTo(bind)<1e-5);}
  actor.dispose();rows.push({bodyType,hairStyle,totalTriangles:triCount(d.surface),logicalVertices:d.surface.vertices.length,budgets});
}
assert(!WARDROBE_LOOKS.some(l=>l.slots.top==='palace_guard_armor'),'军装不能混入默认居民灵感/随机池');
for(let seed=0;seed<64;seed++)assert.notEqual(randomizeCharacter(createRecipe(),seed).slots.top,'palace_guard_armor');
const r=applyPalaceGuard(createRecipe()),spear=subset(makeCharacter(r).surface,'MilitarySpear.');
for(const mutate of [(c:Cage)=>{c.faces.pop();},(c:Cage)=>{c.faces[0].v.reverse();},(c:Cage)=>{c.vertices[0].w=[B.LeftHand,B.LeftHand,1];},(c:Cage)=>{c.vertices[0].p[0]=NaN;},(c:Cage)=>{c.faces.push({...c.faces[0]});}]){const c=cloneCage(spear);mutate(c);assert.throws(()=>closedRigid(c,B.RightHand,budgets.spear));negativeCases++;}
const detached=cloneCage(spear);for(const v of detached.vertices)v.p[0]+=.05;assert.throws(()=>assertGrip(detached,r));negativeCases++;
for(const value of [{...r,profession:'soldier'},{...r,slots:{...r.slots,headwear:'frontier_guard_helmet'}},{...r,slots:{...r.slots,top:'guard_light_armor'}}]){assert.throws(()=>parseRecipeFile(JSON.stringify(value)));negativeCases++;}
for(const make of [makeTop,makeTrousers,makeFootwear]){const p=structuredClone(make(r)!);p.mesh.faces.pop();assert.throws(()=>assertGarmentPiece(p));negativeCases++;}
// 旧整片刚性、错腿、坏权重、缺面、反绕序和坏坐标都必须拒绝，不将新权重改成任意双权重放行。
const outer=subset(makeCharacter(r).surface,'PalaceTasset.Right.Outer.');
for(const mutate of [
  (c:Cage)=>{for(const v of c.vertices)v.w=[B.RightThigh,B.RightThigh,1];},
  (c:Cage)=>{c.vertices[0].w[1]=B.LeftThigh;},
  (c:Cage)=>{c.vertices[0].w[2]=Number.NaN;},
  (c:Cage)=>{c.faces.pop();},
  (c:Cage)=>{c.faces[0].v.reverse();},
  (c:Cage)=>{c.vertices[0].p[0]=Number.NaN;},
]){const c=cloneCage(outer);mutate(c);assert.throws(()=>closedOuterTasset(c,'Right'));negativeCases++;}
if(process.argv.includes('--motion')){
  for(const bodyType of BODY_TYPES){
    const recipe=applyPalaceGuard(createRecipe({bodyType})),actor=makeActor(makeCharacter(recipe)),geometry=actor.mesh.geometry,inverses=actor.skeleton.boneInverses.map(m=>m.toArray());
    const position=geometry.attributes.position,index=geometry.attributes.skinIndex,weight=geometry.attributes.skinWeight,p=new T.Vector3(),q=new T.Vector3();
    const gripBind=new T.Vector3(...shapeRigidPoint(MILITARY_SPEAR_GRIP,B.RightHand,recipe,makeJoints(createRecipe()),makeJoints(recipe)));
    const gripVertices=actor.data.surface.vertices.filter(v=>v.id.startsWith('MilitarySpear.Shaft.1.'));
    for(const def of MOTION_CLIPS){
      const source=JSON.parse(readFileSync(`public/${motionAssetDirectory(def.id)}/${def.id}.json`,'utf8')),bake=retargetMotion(actor.data,source);
      actor.resetBindPose();const action=actor.mixer.clipAction(bake.clip);action.setLoop(T.LoopOnce,1).play();action.paused=true;action.clampWhenFinished=true;
      const times=[...new Set<number>([0,source.duration,...source.times,...source.times.slice(1).map((t:number,i:number)=>(t+source.times[i])/2)])].sort((a,b)=>a-b);
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
const report={passed:true,sourceSHA:process.env.REVIEW_HEAD_SHA??'local',rows,negativeCases,poses,motions:process.argv.includes('--motion')?MOTION_CLIPS.length:0,visualApproval:false,scope:'Actual closed assets, exact budgets, V5 identity, fixed bind, seed isolation; --motion samples all source keys and midpoints for skinning, rigid equipment and bind reuse. Lower-body intersections use the unchanged full tailoring test. No all-motion collision-free or combat-grip claim.'};
const dir=process.env.SOLDIER_CHECK_DIR??'review/soldier-numeric';mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/${poses?'motion':'assets'}.json`,JSON.stringify(report,null,2));console.log('SOLDIER_ASSETS',JSON.stringify(report));
