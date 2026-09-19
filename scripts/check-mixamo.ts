import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { MIXAMO_CLIPS } from '../src/character/mixamo/catalog';
import { CALIBRATION_CHILD, SAMPLE_BONE_COUNT, validateMixamoData, type MixamoMotionData } from '../src/character/mixamo/data';
import { retargetMixamo, exportTargetMotion } from '../src/character/mixamo/retarget';
import { createMixamoPlayer } from '../src/character/mixamo/player';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { DEFAULT_RECIPE, applyPreset, patchSlots } from '../src/character/v3/types';
let frames = 0, worstDirection = 0;
for (const def of MIXAMO_CLIPS) {
  const source = JSON.parse(readFileSync(`public/mixamo/${def.id}.json`, 'utf8')) as MixamoMotionData;
  validateMixamoData(source, def.id);
  assert.equal(source.source.uniqueBones, 65); assert.equal(source.source.rawBoneNodes, 130);
  for (const [height, build] of [[1.58, 0], [1.76, .5], [1.92, 1]]) {
    const recipe = patchSlots(applyPreset({ ...DEFAULT_RECIPE, height, build }, 'archer'), { headwear: 'farmer_straw_hat', leftHand: 'none' });
    const saved = JSON.stringify(recipe), data = makeCharacter(recipe), actor = makeActor(data), geometry = actor.mesh.geometry;
    const bake = retargetMixamo(data, source);
    assert.equal(JSON.stringify(recipe), saved); assert.equal(actor.bones.length, 20);
    assert.equal(actor.data.recipe.slots.headwear, 'farmer_straw_hat');
    actor.mixer.stopAllAction(); const action = actor.mixer.clipAction(bake.clip); action.setLoop(T.LoopOnce,1).play(); action.paused = true; action.clampWhenFinished = true;
    for (let f = 0; f < source.times.length; f++) {
      action.time = source.times[f]; actor.update(0); frames++;
      assert.equal(actor.mesh.geometry, geometry);
      for (let i = 0; i < 20; i++) {
        assert(actor.bones[i].matrixWorld.elements.every(Number.isFinite));
        assert(Math.abs(actor.bones[i].quaternion.length() - 1) < 1e-5);
        if (i < 1 || [5, 9, 13, 16, 19].includes(i)) continue;
        const child = CALIBRATION_CHILD[i];
        const expected = new T.Vector3().fromArray(source.positions, (f * SAMPLE_BONE_COUNT + child) * 3).sub(new T.Vector3().fromArray(source.positions, (f * SAMPLE_BONE_COUNT + i) * 3)).normalize();
        const bindDirection = new T.Vector3().fromArray(data.joints[child].p).sub(new T.Vector3().fromArray(data.joints[i].p)).normalize();
        const actual = bindDirection.applyQuaternion(actor.bones[i].getWorldQuaternion(new T.Quaternion()));
        const error = actual.angleTo(expected) * 180 / Math.PI;
        worstDirection = Math.max(worstDirection, error);
        assert(error < .2, `${def.id}/${i}/${f}: source-target direction ${error}`);
      }
      for (let i = 0; i < actor.mesh.geometry.attributes.position.count; i++) {
        const p = actor.mesh.getVertexPosition(i, new T.Vector3());
        assert(p.toArray().every(Number.isFinite)); assert(p.length() < 8);
      }
    }
    const out = exportTargetMotion(data, source, bake);
    assert.equal(out.bones.length, 20); assert.equal(out.bones[0].parent, -1);
    assert(out.bones.every(b => b.rotations.length === source.times.length * 4));
    assert.equal(out.events.length, 0); assert.equal(out.props.length, 0);
    assert.equal(out.source.sha256, source.source.sha256);
    assert.equal(bake.hips[0], 0); assert.equal(bake.hips[2], 0);
    assert(Math.abs(bake.hips.at(-3)!) < 1e-6 && Math.abs(bake.hips.at(-1)!) < 1e-6);
    if (bake.loop) assert(bake.seamDegrees < 12);
    actor.mixer.uncacheClip(bake.clip); actor.dispose();
  }
  console.log(`PASS ${def.id} · 3 proportions · ${source.times.length} source frames`);
}
const first = JSON.parse(readFileSync('public/mixamo/jogging.json','utf8'));
for (const mutate of [(d:any)=>d.times.reverse(),(d:any)=>d.worldDeltas[0]=NaN,(d:any)=>d.names[2]='BadBone',(d:any)=>d.schema=999]) {
  const bad=structuredClone(first);mutate(bad);assert.throws(()=>validateMixamoData(bad,'jogging'));
}
for(const id of ['jogging','shooting-arrow'] as const){
  const actor=makeActor(makeCharacter(DEFAULT_RECIPE));
  const player=createMixamoPlayer(actor,JSON.parse(readFileSync(`public/mixamo/${id}.json`,'utf8')));
  player.seek(1);player.update(0);assert.equal(player.status().phase,1);
  player.replay();assert.equal(player.status().phase,0);player.update(.3);const paused=player.status().phase;
  player.update(0);player.update(NaN);assert.equal(player.status().phase,paused);
  player.seek(-5);assert.equal(player.status().phase,0);player.seek(5);assert.equal(player.status().phase,1);
  player.dispose();actor.dispose();
}
console.log(JSON.stringify({clips:MIXAMO_CLIPS.length,proportions:3,sampledFrames:frames,worstDirectionDegrees:worstDirection,invalidDataRejected:4,playerBoundaryCases:2}));
