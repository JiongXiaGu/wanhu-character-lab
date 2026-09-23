import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {BVH_CLIPS} from '../src/character/bvh/catalog';
import {motionDefinition} from '../src/character/motion/catalog';
import {validateMixamoData,type MixamoMotionData} from '../src/character/mixamo/data';
import {retargetMixamo} from '../src/character/mixamo/retarget';
import {createMixamoPlayer} from '../src/character/mixamo/player';
import {makeCharacter} from '../src/character/v3/outfit';
import {makeActor} from '../src/character/v3/rig';
import {BODY_TYPES,DEFAULT_RECIPE} from '../src/character/v3/types';

assert(BVH_CLIPS.length>=1,'至少需要一个 BVH 样本用于验证。');
let frames=0;
for(const def of BVH_CLIPS){
  const source=JSON.parse(readFileSync(`public/bvh/${def.id}.json`,'utf8')) as MixamoMotionData;
  validateMixamoData(source,def.id);
  assert.equal(source.source.provider,'BVH');
  assert.equal(motionDefinition(def.id).source,'bvh');
  assert(source.bindPositions[4]>0,'BVH Hips 绑定高度必须为正值。');
  assert(source.times.length>=2&&source.fps>0);
  if(def.filename.endsWith('简单跳舞_A.bvh')){
    assert.equal(source.times.length,238);
    assert(Math.abs(source.fps-30)<.01);
    assert(Math.abs(source.duration-7.9)<.02);
  }
  for(const bodyType of BODY_TYPES){
    const data=makeCharacter({...DEFAULT_RECIPE,bodyType}),actor=makeActor(data),bake=retargetMixamo(data,source);
    assert.equal(bake.rotations.length,20);assert(bake.hips.every(Number.isFinite));
    const action=actor.mixer.clipAction(bake.clip).setLoop(T.LoopOnce,1).play();action.paused=true;action.clampWhenFinished=true;
    for(let f=0;f<source.times.length;f++){
      action.time=source.times[f];actor.update(0);frames++;
      assert(actor.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)));
      assert(actor.bones.every(b=>Math.abs(b.quaternion.length()-1)<1e-5));
    }
    actor.mixer.uncacheClip(bake.clip);actor.dispose();
  }
  const actor=makeActor(makeCharacter(DEFAULT_RECIPE)),player=createMixamoPlayer(actor,source);
  assert.equal(player.status().source,'bvh');assert(player.status().stage.startsWith('BVH · '));
  player.seek(.5);assert(Math.abs(player.status().phase-.5)<1e-6);
  player.setLoop(true);player.replay();player.update(.25);assert(player.status().phase>0);
  player.dispose();actor.dispose();
  console.log(`PASS ${def.id} · ${source.times.length} frames · ${source.duration.toFixed(3)}s`);
}
console.log(JSON.stringify({bvhClips:BVH_CLIPS.length,bodyTypes:2,sampledFrames:frames}));
