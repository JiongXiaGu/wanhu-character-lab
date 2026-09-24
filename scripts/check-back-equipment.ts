import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { B, BODY_TYPES, TOP_IDS, createRecipe, type Cage } from '../src/character/v3/types';
import { edgeKey, triCount, cross, sub, cloneCage } from '../src/character/v3/cage';
import { BACK_EQUIPMENT_IDS } from '../src/character/wardrobe/back-equipment';
import { parseRecipeFile, randomizeCharacter, SLOT_OPTIONS } from '../src/character/wardrobe/catalog';
import { assertComponentWinding } from './check-components';

const budgets = { bamboo_basket: 380, firewood_bundle: 392, book_case: 284 };
function backMesh(c:Cage):Cage {
  const indices=c.vertices.flatMap((v,i)=>v.id.startsWith('Back.')?[i]:[]), map=new Map(indices.map((v,i)=>[v,i]));
  return {vertices:indices.map(i=>c.vertices[i]),faces:c.faces.filter(f=>f.v.every(i=>map.has(i))).map(f=>({...f,v:f.v.map(i=>map.get(i)!)})),anchors:{}};
}
function validate(c:Cage) {
  assert(c.vertices.length>0); assert.equal(new Set(c.vertices.map(v=>v.id)).size,c.vertices.length);
  const edges=new Map<string,number>();
  for(const v of c.vertices){
    assert(v.p.every(Number.isFinite)); assert(v.w.slice(0,2).every(b=>Number.isInteger(b)&&b>=0&&b<20)); assert(v.w[2]>=0&&v.w[2]<=1);
    if(v.id.includes('.Payload.'))assert.deepEqual(v.w,[B.Chest,B.Chest,1]);
  }
  for(const f of c.faces){
    assert.equal(f.region,'equipment'); assert.match(f.color!,/^#[0-9a-f]{6}$/i);
    for(let k=1;k<f.v.length-1;k++)assert(Math.hypot(...cross(sub(c.vertices[f.v[k]].p,c.vertices[f.v[0]].p),sub(c.vertices[f.v[k+1]].p,c.vertices[f.v[0]].p)))>1e-10,'退化面');
    f.v.forEach((a,i)=>{const key=edgeKey(a,f.v[(i+1)%f.v.length]);edges.set(key,(edges.get(key)??0)+1);});
  }
  for(const count of edges.values())assert.equal(count,2,'背具不是闭合厚壳');
  assertComponentWinding(c);
}
let combinations=0;
for(const bodyType of BODY_TYPES)for(const top of TOP_IDS)for(const back of BACK_EQUIPMENT_IDS){
  const recipe=createRecipe({bodyType,slots:{top,back}}), data=makeCharacter(recipe), mesh=backMesh(data.surface);
  validate(mesh); assert.equal(triCount(mesh),budgets[back]); assert.equal(data.joints.length,20);
  const plain=makeCharacter(createRecipe({...recipe,slots:{...recipe.slots,back:'none'}}));
  const rearIndices=new Set(plain.surface.faces.filter(f=>f.region==='torso').flatMap(f=>f.v));
  const rearZ=Math.min(...[...rearIndices].map(i=>plain.surface.vertices[i].p[2]));
  const frontZ=Math.max(...mesh.vertices.filter(v=>v.id.includes('.Payload.')).map(v=>v.p[2]));
  assert(Math.abs(rearZ-frontZ-.012*(bodyType==='female'?1.66/1.76:1))<1e-8,'绑定姿态载荷贴背留量');
  assert.deepEqual(data.body,plain.body);assert.deepEqual(data.joints,plain.joints);assert.deepEqual(data.garments,plain.garments);
  assert.deepEqual(data.surface.vertices.filter(v=>!v.id.startsWith('Back.')),plain.surface.vertices,'背具不得改写人体和服装');
  assert.deepEqual(parseRecipeFile(JSON.stringify(recipe)),recipe);assert.equal(recipe.version,5);assert.equal(Object.keys(recipe).length,6);assert.equal(Object.keys(recipe.slots).length,7);
  assert.equal(randomizeCharacter(recipe,421,['back']).slots.back,back);assert(SLOT_OPTIONS.back.some(o=>o.id===back));
  const actor=makeActor(data),positions=actor.mesh.geometry.attributes.position;
  actor.resetBindPose();actor.mesh.updateMatrixWorld(true);actor.skeleton.update();
  const p=new T.Vector3(),bind=new T.Vector3();
  for(let i=0;i<positions.count;i++){actor.mesh.getVertexPosition(i,p);bind.fromBufferAttribute(positions as T.BufferAttribute,i);assert(p.distanceTo(bind)<1e-5);}
  actor.dispose();combinations++;
}
const example=backMesh(makeCharacter(createRecipe({slots:{back:'bamboo_basket'}})).surface);
for(const mutate of [(c:Cage)=>{c.faces.pop();},(c:Cage)=>{c.faces[0].v.reverse();},(c:Cage)=>{c.vertices[0].w=[B.Head,B.Head,1];},(c:Cage)=>{c.vertices[0].p[0]=NaN;}]){const bad=cloneCage(example);mutate(bad);assert.throws(()=>validate(bad));}
const badRecipe=createRecipe();(badRecipe.slots as any).back='unknown_back';assert.throws(()=>parseRecipeFile(JSON.stringify(badRecipe)));
console.log(JSON.stringify({backEquipment:'passed',combinations,budgets,negativeCases:5,checks:'closed oriented shells, finite geometry, <=2 weights, rigid payload, actual bind pose, V5 roundtrip, wardrobe independence, locked randomization'}));

if(process.argv.includes('--motion')){
  const {MOTION_CLIPS,motionAssetDirectory}=await import('../src/character/motion/catalog');
  const {retargetMotion}=await import('../src/character/motion/retarget');
  const {createRidingPlayer}=await import('../src/riding/riding-player');
  let poses=0,ridingPoses=0;
  function checkPose(actor:ReturnType<typeof makeActor>){
    const bind=actor.mesh.geometry.attributes.position,si=actor.mesh.geometry.attributes.skinIndex,sw=actor.mesh.geometry.attributes.skinWeight;
    const p=new T.Vector3(),expected=new T.Vector3(),m=new T.Matrix4().multiplyMatrices(actor.bones[B.Chest].matrixWorld,actor.skeleton.boneInverses[B.Chest]);
    for(let i=0;i<bind.count;i++){
      actor.mesh.getVertexPosition(i,p);assert(p.toArray().every(Number.isFinite));assert(p.length()<8);
      if(si.getX(i)===B.Chest&&sw.getX(i)===1){expected.fromBufferAttribute(bind as T.BufferAttribute,i).applyMatrix4(actor.mesh.bindMatrix).applyMatrix4(m).applyMatrix4(actor.mesh.bindMatrixInverse);assert(p.distanceTo(expected)<1e-5,'刚性顶点不跟随真实胸骨');}
    }
  }
  for(const def of MOTION_CLIPS){
    const source=JSON.parse(readFileSync(`public/${motionAssetDirectory(def.id)}/${def.id}.json`,'utf8'));
    for(const bodyType of BODY_TYPES)for(const back of BACK_EQUIPMENT_IDS){
      const actor=makeActor(makeCharacter(createRecipe({bodyType,slots:{back}}))),geometry=actor.mesh.geometry,inverse=actor.skeleton.boneInverses.map(m=>m.toArray());
      const bake=retargetMotion(actor.data,source),action=actor.mixer.clipAction(bake.clip);action.setLoop(T.LoopOnce,1).play();action.paused=true;action.clampWhenFinished=true;
      const times:number[]=source.times.flatMap((t:number,i:number)=>i?[((source.times[i-1]+t)/2),t]:[t]);
      for(const time of times){action.time=time;actor.update(0);checkPose(actor);poses++;}
      assert.equal(actor.mesh.geometry,geometry);assert.deepEqual(actor.skeleton.boneInverses.map(m=>m.toArray()),inverse);actor.mixer.uncacheClip(bake.clip);actor.dispose();
    }
  }
  for(const mount of ['horse_chestnut','donkey_gray','camel_bactrian','cattle_yellow','yak_black','buffalo_water'] as const)for(const bodyType of BODY_TYPES)for(const back of BACK_EQUIPMENT_IDS){
    const player=createRidingPlayer(createRecipe({bodyType,slots:{back}}),'travel',mount);
    for(const clip of ['Rider_Idle','Rider_Walk','Rider_Run'] as const){player.select(clip);for(const phase of [0,.25,.5,.75,1]){player.seek(phase);checkPose(player.rider);ridingPoses++;}}
    player.dispose();
  }
  console.log(JSON.stringify({backMotion:'passed',clips:MOTION_CLIPS.length,poses,ridingPoses,checks:'source keys+midpoints, actual skinning, rigid Chest follow, geometry/inverse-bind reuse; no collision-free claim'}));
}
