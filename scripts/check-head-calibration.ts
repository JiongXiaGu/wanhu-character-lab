import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import * as T from 'three';
import { MIXAMO_CLIPS } from '../src/character/mixamo/catalog';
import {RETARGET_VERSION,type HumanoidMotionData} from '../src/character/motion/data';
import {calibration,retargetMotion,exportTargetMotion} from '../src/character/motion/retarget';
import { makeActor } from '../src/character/v3/rig';
import { makeCharacter } from '../src/character/v3/outfit';
import { DEFAULT_RECIPE, BODY_TYPES, emptySlots } from '../src/character/v3/types';

const degrees=180/Math.PI, records:unknown[]=[];
let frames=0,worstHeadError=0;
for(const def of MIXAMO_CLIPS){
  const source=JSON.parse(readFileSync(`public/mixamo/${def.id}.json`,'utf8')) as HumanoidMotionData;
  const headTip=new T.Vector3().fromArray(source.bindPositions,60).sub(new T.Vector3().fromArray(source.bindPositions,15)).normalize();
  const oldCorrection=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),headTip);
  const oldBias=oldCorrection.angleTo(new T.Quaternion())*degrees;
  // 负对照：这套实际上传 FBX 的端点校准确实引入固定偏差，测试不能只验证自己。
  assert(oldBias>5&&oldBias<6,`${def.id}: unexpectedly changed reference rig; review calibration before updating baseline`);
  let minPitch=Infinity,maxPitch=-Infinity;
  for(const bodyType of BODY_TYPES)
  {
    const data=makeCharacter({...DEFAULT_RECIPE,bodyType,slots:emptySlots()});
    const saved=JSON.stringify(data),actor=makeActor(data),bake=retargetMotion(data,source);
    assert(calibration(data.joints,source)[5].angleTo(new T.Quaternion())<1e-10);
    const action=actor.mixer.clipAction(bake.clip).setLoop(T.LoopOnce,1).play();action.paused=true;action.clampWhenFinished=true;
    for(let frame=0;frame<source.times.length;frame++){
      action.enabled=true;action.time=source.times[frame];actor.update(0);frames++;
      const actual=actor.bones[5].getWorldQuaternion(new T.Quaternion()).normalize();
      const expected=new T.Quaternion().fromArray(source.worldDeltas,(frame*20+5)*4).normalize();
      const error=actual.angleTo(expected)*degrees;worstHeadError=Math.max(worstHeadError,error);
      assert(error<.002,`${def.id}/${bodyType}/${frame}: head yaw/pitch/roll changed by ${error} degrees`);
      const forward=new T.Vector3(0,0,1).applyQuaternion(actual);
      const pitch=Math.asin(T.MathUtils.clamp(-forward.y,-1,1))*degrees;
      minPitch=Math.min(minPitch,pitch);maxPitch=Math.max(maxPitch,pitch);
    }
    const output=exportTargetMotion(data,source,bake);
    assert.equal(output.retargetVersion,RETARGET_VERSION);assert.equal(output.calibrationProfile.id,bodyType==='female'?'female-anatomical-v1':'male-anatomical-v2');
    assert.equal(output.bodyProfile.id,bodyType);
    assert.equal(output.skeletonVersion,'wanhu-20-v1');assert.equal(JSON.stringify(data),saved,'calibration mutated geometry/bind/DIY');
    // 只挪动头顶辅助点不得重新改变头部朝向；它仍可以用于源骨架显示。
    const perturbed=structuredClone(source);perturbed.bindPositions[62]+=.2;
    assert.deepEqual(retargetMotion(data,perturbed).rotations[5],bake.rotations[5]);
    actor.dispose();
  }
  if(def.id==='shooting-arrow')assert(maxPitch-minPitch>30,'真实搭箭低头被错误抹平');
  records.push({clipId:def.id,oldExtraBindTiltDegrees:oldBias,minAuthoredPitch:minPitch,maxAuthoredPitch:maxPitch});
}
// 静态模型的脸向是 +Z；没有播放动画时也不能内置抬头补丁或自动待机。
const actor=makeActor(makeCharacter(DEFAULT_RECIPE));
actor.update(10);assert.deepEqual(actor.bones[5].quaternion.toArray(),[0,0,0,1]);actor.resetBindPose();actor.dispose();
const report={retargetVersion:RETARGET_VERSION,clips:MIXAMO_CLIPS.length,bodyTypes:2,profilesPerBodyType:1,sampledFrames:frames,worstHeadQuaternionErrorDegrees:worstHeadError,records};
mkdirSync('review-motion',{recursive:true});writeFileSync('review-motion/head-calibration.json',JSON.stringify(report,null,2));
console.log('PASS head calibration: '+JSON.stringify(report));
