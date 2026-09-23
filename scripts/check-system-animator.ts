import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GENERATED_SYSTEM_ANIMATOR_CLIPS} from '../src/character/system-animator/catalog.generated';
import {SAMPLE_BONE_COUNT,validateMotionData,type HumanoidMotionData} from '../src/character/motion/data';
import {retargetMotion,exportTargetMotion} from '../src/character/motion/retarget';
import {makeCharacter} from '../src/character/v3/outfit';
import {BODY_TYPES,createRecipe} from '../src/character/v3/types';

const q0=new T.Quaternion(),q1=new T.Quaternion(),p0=new T.Vector3(),p1=new T.Vector3();
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
assert(GENERATED_SYSTEM_ANIMATOR_CLIPS.length>0,'没有 SystemAnimator GLB 样本。');
for(const def of GENERATED_SYSTEM_ANIMATOR_CLIPS){
  const source=JSON.parse(readFileSync(`public/system-animator/${def.id}.json`,'utf8')) as HumanoidMotionData;
  validateMotionData(source,def.id);assert.equal(source.source.provider,'SystemAnimator');assert.equal(source.source.format,'glb');assert.equal(source.source.profile,'system-animator-glb-v1');
  assert(source.bindPositions[4]>.5&&source.bindPositions[4]<1.5);assert(source.source.groundDiagnostics&&Object.values(source.source.groundDiagnostics).every(Number.isFinite));assert(Math.abs(source.fps-30)<1e-4);
  const report=quality(source);assert(Number.isFinite(report.maxRotationStepDegrees)&&Number.isFinite(report.maxHipsStepMeters));
  for(const bodyType of BODY_TYPES){
    const data=makeCharacter(createRecipe({bodyType})),bake=retargetMotion(data,source);assert.equal(bake.clip.tracks.length,21);
    assert(bake.rotations.every(a=>a.length===source.times.length*4&&a.every(Number.isFinite)));assert(bake.hips.every(Number.isFinite));
    assert(Math.max(...bake.groundLift)-Math.min(...bake.groundLift)<1e-8);assert(Math.abs(bake.rootTrajectory[0])<1e-8&&Math.abs(bake.rootTrajectory[2])<1e-8);
    assert(bake.hips[1]>.25&&bake.hips[1]<1.5,`首帧 Hips 高度异常：${bake.hips[1]}`);
    const out=exportTargetMotion(data,source,bake);assert.equal(out.bones.length,20);assert.equal(out.source.provider,'SystemAnimator');assert.equal(out.groundPolicy,'fixed-baseline-p10');assert.equal(out.calibrationProfile.sourcePolicy,'bind-delta-world; no static source-bind direction calibration');
    const head=bake.rotations[5],first=new T.Quaternion().fromArray(head,0);let authored=false;for(let i=4;i<head.length;i+=4)if(first.angleTo(new T.Quaternion().fromArray(head,i))>.01){authored=true;break;}assert(authored,'Head 动画被错误清零');

    // 关键回归：SystemAnimator 已提供相对真实 Bind 的 World Delta。
    // 将所有 Delta 设为 Identity 后，目标 20 骨必须保持自己的 Bind Pose；
    // 禁止重新套用 Mixamo 的源骨段方向静态校准。
    const neutral=structuredClone(source);
    for(let i=0;i<neutral.worldDeltas.length;i+=4){neutral.worldDeltas[i]=0;neutral.worldDeltas[i+1]=0;neutral.worldDeltas[i+2]=0;neutral.worldDeltas[i+3]=1;}
    const neutralBake=retargetMotion(data,neutral);
    for(let bone=0;bone<20;bone++)for(let f=0;f<neutral.times.length;f++){
      const local=new T.Quaternion().fromArray(neutralBake.rotations[bone],f*4);
      assert(local.angleTo(new T.Quaternion())<1e-6,`${def.id}/${bodyType}/bone${bone}/frame${f}: Bind-Delta identity regression`);
    }
  }
  console.log(`PASS ${def.id} · ${source.times.length} samples · male/female · bind-delta retarget · quality ${JSON.stringify(report)}`);
}
