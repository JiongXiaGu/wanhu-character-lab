import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GENERATED_SYSTEM_ANIMATOR_CLIPS} from '../src/character/system-animator/catalog.generated';
import {CALIBRATION_CHILD,SAMPLE_BONE_COUNT,validateMotionData,type HumanoidMotionData} from '../src/character/motion/data';
import {calibration,retargetMotion,exportTargetMotion} from '../src/character/motion/retarget';
import {makeCharacter} from '../src/character/v3/outfit';
import {BODY_TYPES,createRecipe} from '../src/character/v3/types';

const q0=new T.Quaternion(),q1=new T.Quaternion(),p0=new T.Vector3(),p1=new T.Vector3();
const v=(a:readonly number[],o:number)=>new T.Vector3(a[o],a[o+1],a[o+2]);
function quality(source:HumanoidMotionData){
  let rotationalOutliers=0,multiJointFrames=0,maxRotationStepDegrees=0,maxHipsStepMeters=0;
  for(let f=0;f<source.times.length-1;f++){
    let frameOutliers=0;
    for(let i=1;i<20;i++){
      q0.fromArray(source.worldDeltas,(f*20+i)*4);q1.fromArray(source.worldDeltas,((f+1)*20+i)*4);
      const degrees=q0.angleTo(q1)*180/Math.PI;maxRotationStepDegrees=Math.max(maxRotationStepDegrees,degrees);
      if(degrees>30){rotationalOutliers++;frameOutliers++;}
    }
    if(frameOutliers>=3)multiJointFrames++;
    p0.fromArray(source.positions,(f*SAMPLE_BONE_COUNT+1)*3);p1.fromArray(source.positions,((f+1)*SAMPLE_BONE_COUNT+1)*3);
    maxHipsStepMeters=Math.max(maxHipsStepMeters,p0.distanceTo(p1));
  }
  return{rotationalOutliers,multiJointFrames,maxRotationStepDegrees,maxHipsStepMeters};
}
function targetWorldRotations(local:number[][],frame:number,parents:readonly number[]){
  const world=parents.map(()=>new T.Quaternion());
  for(let i=0;i<parents.length;i++){
    const localQ=new T.Quaternion().fromArray(local[i],frame*4);
    if(parents[i]<0)world[i].copy(localQ);else world[i].copy(world[parents[i]]).multiply(localQ).normalize();
  }
  return world;
}
function directionErrorDegrees(source:HumanoidMotionData,data:ReturnType<typeof makeCharacter>,bake:ReturnType<typeof retargetMotion>,frame:number,bone:number){
  const child=CALIBRATION_CHILD[bone],sourceDir=v(source.positions,(frame*SAMPLE_BONE_COUNT+child)*3).sub(v(source.positions,(frame*SAMPLE_BONE_COUNT+bone)*3)).normalize();
  const targetBind=v(data.joints[child].p,0).sub(v(data.joints[bone].p,0)).normalize(),world=targetWorldRotations(bake.rotations,frame,data.joints.map(j=>j.parent));
  return targetBind.applyQuaternion(world[bone]).angleTo(sourceDir)*180/Math.PI;
}

assert(GENERATED_SYSTEM_ANIMATOR_CLIPS.length>0,'没有 SystemAnimator GLB 样本。');
for(const def of GENERATED_SYSTEM_ANIMATOR_CLIPS){
  const source=JSON.parse(readFileSync(`public/system-animator/${def.id}.json`,'utf8')) as HumanoidMotionData;
  validateMotionData(source,def.id);assert.equal(source.source.provider,'SystemAnimator');assert.equal(source.source.format,'glb');assert.equal(source.source.profile,'system-animator-glb-v1');
  assert(source.bindPositions[4]>.5&&source.bindPositions[4]<1.5);assert(source.source.groundDiagnostics&&Object.values(source.source.groundDiagnostics).every(Number.isFinite));assert(Math.abs(source.fps-30)<1e-4);
  const report=quality(source);
  for(const bodyType of BODY_TYPES){
    const data=makeCharacter(createRecipe({bodyType})),staticCorrection=calibration(data.joints,source);
    // XR Animator Hips->Spine 是短斜段，不能拿它把整个目标骨盆永久倾斜。
    assert(staticCorrection[1].angleTo(new T.Quaternion())*180/Math.PI>20,'样本不再暴露短斜 Hips 段；请重新审查 Hips 策略。');
    const bake=retargetMotion(data,source);assert.equal(bake.clip.tracks.length,21);
    assert(bake.rotations.every(a=>a.length===source.times.length*4&&a.every(Number.isFinite)));assert(bake.hips.every(Number.isFinite));
    assert(Math.max(...bake.groundLift)-Math.min(...bake.groundLift)<1e-8);assert(Math.abs(bake.rootTrajectory[0])<1e-8&&Math.abs(bake.rootTrajectory[2])<1e-8);assert(bake.hips[1]>.25&&bake.hips[1]<1.5);
    const out=exportTargetMotion(data,source,bake);assert.equal(out.bones.length,20);assert.equal(out.source.provider,'SystemAnimator');assert.equal(out.groundPolicy,'fixed-baseline-p10');assert.equal(out.calibrationProfile.sourcePolicy,'world-delta × retarget-pose-alignment; hips uses world-delta only');

    // 手的位置由 UpperArm / Forearm 的世界方向决定。对应源段和目标段必须真正重合，
    // 不能仅验证四元数合法却让手腕系统性偏 50–60°。
    let worstArmDirection=0;
    const stride=Math.max(1,Math.floor(source.times.length/80));
    for(let frame=0;frame<source.times.length;frame+=stride)for(const bone of [7,8,11,12]){
      const error=directionErrorDegrees(source,data,bake,frame,bone);worstArmDirection=Math.max(worstArmDirection,error);
      assert(error<.02,`${def.id}/${bodyType}/frame${frame}/bone${bone}: arm segment differs from source by ${error}°`);
    }

    // Hips 自身不允许静态 46° 倾斜：目标必须接近源 Delta，而不是带 Retarget Pose 倾角。
    // 源 JSON 将分量保留7位小数，angleTo要求单位四元数；先独立验证长度，再按运行时语义归一化。
    const sourceHips=new T.Quaternion().fromArray(source.worldDeltas,4),targetHips=new T.Quaternion().fromArray(bake.rotations[1],0);
    const sourceLengthSq=sourceHips.lengthSq(),targetLengthSq=targetHips.lengthSq();
    const rawHipsErrorDegrees=sourceHips.angleTo(targetHips)*180/Math.PI;
    assert(Math.abs(sourceLengthSq-1)<1e-6,'源Hips四元数长度超出序列化舍入误差');
    assert(Math.abs(targetLengthSq-1)<1e-10,'目标Hips四元数未归一化');
    sourceHips.normalize();targetHips.normalize();
    const hipsErrorDegrees=sourceHips.angleTo(targetHips)*180/Math.PI;
    assert(hipsErrorDegrees<.02,`${def.id}/${bodyType}: Hips 被错误叠加静态方向校准 (${hipsErrorDegrees}°)`);
    // 归一化不是放宽方向门槛：注入0.1°实际偏转后，原0.02°检查仍必须拒绝。
    const wrongHips=targetHips.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.1*Math.PI/180)).normalize();
    assert.throws(()=>assert(sourceHips.angleTo(wrongHips)*180/Math.PI<.02));
    console.log(`HIPS ${def.id}/${bodyType}: ${JSON.stringify({sourceLengthSq,targetLengthSq,rawHipsErrorDegrees,hipsErrorDegrees,faultInjections:1})}`);

    const head=bake.rotations[5],first=new T.Quaternion().fromArray(head,0);let authored=false;for(let i=4;i<head.length;i+=4)if(first.angleTo(new T.Quaternion().fromArray(head,i))>.01){authored=true;break;}assert(authored,'Head 动画被错误清零');
    console.log(`RETARGET ${def.id}/${bodyType}: worst arm direction ${worstArmDirection.toFixed(6)}°`);
  }
  console.log(`PASS ${def.id} · ${source.times.length} samples · male/female · hybrid retarget pose · quality ${JSON.stringify(report)}`);
}
