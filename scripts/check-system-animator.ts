import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {SYSTEM_ANIMATOR_CLIPS} from '../src/character/system-animator/catalog.generated';
import {validateMotionData,type HumanoidMotionData} from '../src/character/motion/data';
import {retargetMotion,exportTargetMotion} from '../src/character/motion/retarget';
import {createMotionPlayer} from '../src/character/motion/player';
import {makeCharacter} from '../src/character/v3/outfit';
import {makeActor} from '../src/character/v3/rig';
import {BODY_TYPES,createRecipe} from '../src/character/v3/types';

assert(SYSTEM_ANIMATOR_CLIPS.length>0,'动画参考_glb 至少需要一个 XR Animator GLB 样本。');
for(const def of SYSTEM_ANIMATOR_CLIPS){
 const source=JSON.parse(readFileSync(`public/system-animator/${def.id}.json`,'utf8')) as HumanoidMotionData;
 validateMotionData(source,def.id);assert.equal(source.source.provider,'XR Animator');assert.equal(source.source.format,'glb');assert.equal(source.source.profile,'system-animator-glb-v1');
 assert(source.bindPositions[4]>.7&&source.bindPositions[4]<1.2,`${def.id}: Hips Bind 高度异常 ${source.bindPositions[4]}`);
 assert(source.times.length>=390&&source.times.length<=400,`${def.id}: 30fps 采样帧数异常 ${source.times.length}`);
 assert(Math.abs(source.fps-30)<1e-6);assert(source.diagnostics?.sourceFootMinY);
 for(const bodyType of BODY_TYPES){
  const data=makeCharacter(createRecipe({bodyType})),actor=makeActor(data),bake=retargetMotion(data,source);
  assert.equal(actor.bones.length,20);assert.equal(bake.clip.tracks.length,21);assert(bake.rotations.every(r=>r.length===source.times.length*4));
  assert(bake.hips.every(Number.isFinite));assert(bake.rootTrajectory.every(Number.isFinite));
  const uniqueLift=new Set(bake.groundLift.map(v=>v.toFixed(7)));assert(uniqueLift.size===1,'XR Animator G1 必须使用固定 Ground Baseline，不得逐帧顶起人物。');
  const output=exportTargetMotion(data,source,bake);assert.equal(output.bones.length,20);assert.equal(output.calibrationProfile.source,'system-animator-glb-v1');
  const action=actor.mixer.clipAction(bake.clip).setLoop(T.LoopOnce,1).play();action.paused=true;action.clampWhenFinished=true;
  for(const phase of [0,.25,.5,.75,1]){action.time=source.duration*phase;actor.update(0);assert(actor.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)));const p=new T.Vector3();for(let i=0;i<actor.mesh.geometry.attributes.position.count;i++){actor.mesh.getVertexPosition(i,p);assert(p.toArray().every(Number.isFinite));assert(p.length()<8);}}
  actor.mixer.uncacheClip(bake.clip);actor.dispose();
 }
 const actor=makeActor(makeCharacter(createRecipe()));const player=createMotionPlayer(actor,source);player.seek(.5);assert(Math.abs(player.status().phase-.5)<1e-8);player.dispose();actor.dispose();
 console.log(`PASS GLB ${def.id} · ${source.times.length} frames · male/female · fixed ground baseline`);
}
