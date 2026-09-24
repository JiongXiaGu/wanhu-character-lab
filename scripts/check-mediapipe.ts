import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {MEDIAPIPE_CLIPS,resolveMotionId} from '../src/character/motion/catalog';
import {CALIBRATION_CHILD,SAMPLE_BONE_COUNT,validateMotionData,type HumanoidMotionData} from '../src/character/motion/data';
import {retargetMotion,exportTargetMotion} from '../src/character/motion/retarget';
import {makeCharacter} from '../src/character/v3/outfit';
import {BODY_TYPES,createRecipe} from '../src/character/v3/types';

const expected=new Map([
  ['mediapipe-xinbaodao',{frames:661,start:23,end:45,missing:0}],
  ['mediapipe-xinbaodao-zhajishaoye',{frames:421,start:34,end:48,missing:0}],
]);
assert.equal(MEDIAPIPE_CLIPS.length,expected.size);
assert.equal(resolveMotionId('xr-b-ccae4e25'),'mediapipe-xinbaodao');

for(const definition of MEDIAPIPE_CLIPS){
  const specification=expected.get(definition.id);
  assert(specification,`未知 MediaPipe 候选 ${definition.id}`);
  const data=JSON.parse(readFileSync(`public/mediapipe/${definition.id}.json`,'utf8')) as HumanoidMotionData;
  const report=JSON.parse(readFileSync(`public/mediapipe/${definition.id}-report.json`,'utf8'));
  validateMotionData(data,definition.id);
  assert.equal(data.source.provider,'MediaPipe');
  assert.equal(data.source.format,'mp4');
  assert.equal(data.source.sourceStartSeconds,specification.start);
  assert.equal(data.source.sourceEndSeconds,specification.end);
  assert.equal(data.times.length,specification.frames);
  assert(data.mediapipe33);
  assert.equal(data.mediapipe33.positions.length,data.times.length*33*3);
  assert.equal(data.mediapipe33.visibility.length,data.times.length*33);
  if(data.mediapipe33.validity){
    assert.equal(data.mediapipe33.validity.length,data.times.length*33);
    assert.equal(data.mediapipe33.validity.filter(value=>value===0).length,specification.missing*33);
  }else assert.equal(specification.missing,0);
  assert.equal(data.source.poseSha256?.length,64);
  assert.equal(data.source.modelSha256?.length,64);
  if(definition.id==='mediapipe-xinbaodao-zhajishaoye')assert.equal(data.source.extractorVersion,'mediapipe-pose-clip-v3');
  assert.equal(report.videoSha256,data.source.sha256);
  assert.equal(report.poseSha256,data.source.poseSha256);
  assert.equal(report.frameCount,data.times.length);
  if(specification.missing)assert.equal(report.missingCriticalFrames,specification.missing);

  let maximumStep=0;
  const before=new T.Quaternion(),after=new T.Quaternion();
  for(let frame=1;frame<data.times.length;frame++)for(let bone=1;bone<20;bone++){
    before.fromArray(data.worldDeltas,((frame-1)*20+bone)*4);
    after.fromArray(data.worldDeltas,(frame*20+bone)*4);
    maximumStep=Math.max(maximumStep,before.angleTo(after)*180/Math.PI);
  }
  assert(maximumStep<90,`${definition.id} 出现 ${maximumStep.toFixed(1)}° 单帧翻转`);
  if(data.source.extractorVersion==='mediapipe-pose-clip-v3'){
    for(let frame=0;frame<data.times.length;frame++)for(const [upper,forearm] of [[7,8],[11,12]] as const){
      const point=(bone:number)=>new T.Vector3().fromArray(data.positions,(frame*SAMPLE_BONE_COUNT+bone)*3);
      const upperDirection=point(forearm).sub(point(upper)).normalize();
      const forearmDirection=point(forearm+1).sub(point(forearm)).normalize();
      const bendDegrees=upperDirection.angleTo(forearmDirection)*180/Math.PI;
      const upperRotation=new T.Quaternion().fromArray(data.worldDeltas,(frame*20+upper)*4);
      const forearmRotation=new T.Quaternion().fromArray(data.worldDeltas,(frame*20+forearm)*4);
      const excess=upperRotation.angleTo(forearmRotation)*180/Math.PI-bendDegrees;
      assert(excess<40,`${definition.id} 第 ${frame} 帧 ${forearm} 前臂相对上臂扭转 ${excess.toFixed(1)}°`);
      const bindDirection=new T.Vector3().fromArray(data.bindPositions,(forearm+1)*3)
        .sub(new T.Vector3().fromArray(data.bindPositions,forearm*3)).normalize();
      const directionError=bindDirection.applyQuaternion(forearmRotation).angleTo(forearmDirection)*180/Math.PI;
      assert(directionError<.1,`${definition.id} 第 ${frame} 帧 ${forearm} 前臂偏离来源骨段 ${directionError.toFixed(2)}°`);
    }
  }
  const pose=data.mediapipe33.positions;
  for(const bone of [4,5,16,19]){
    let minimumUp=1;
    for(let frame=0;frame<data.times.length;frame++){
      const orientation=new T.Quaternion().fromArray(data.worldDeltas,(frame*20+bone)*4);
      minimumUp=Math.min(minimumUp,new T.Vector3(0,1,0).applyQuaternion(orientation).y);
    }
    assert(minimumUp>(bone<6?.85:.95),`${definition.id} 第 ${bone} 骨骼低头或鞋底翻转：${minimumUp.toFixed(3)}`);
  }
  // 前臂弯曲时衣袖朝向可以与躯干相反；v3 已逐帧校验肘部相对扭转和肘腕方向。
  const facingBones=data.source.extractorVersion==='mediapipe-pose-clip-v3'?[7,11]:[7,8,11,12];
  for(const bone of facingBones){
    const sleeveFacing:number[]=[];
    for(let frame=0;frame<data.times.length;frame++){
      if(data.mediapipe33.validity?.[frame*33]===0)continue;
      const point=(index:number)=>new T.Vector3().fromArray(pose,(frame*33+index)*3);
      const right=point(24).sub(point(23)).add(point(12).sub(point(11)));
      const up=point(11).add(point(12)).sub(point(23)).sub(point(24));
      const torsoForward=right.cross(up).normalize();
      const orientation=new T.Quaternion().fromArray(data.worldDeltas,(frame*20+bone)*4);
      sleeveFacing.push(new T.Vector3(0,0,1).applyQuaternion(orientation).dot(torsoForward));
    }
    sleeveFacing.sort((a,b)=>a-b);
    assert(sleeveFacing[Math.floor(sleeveFacing.length/2)]>.5,`${definition.id} 第 ${bone} 衣袖累计扭转`);
  }
  for(const bodyType of BODY_TYPES){
    const character=makeCharacter(createRecipe({bodyType}));
    const bake=retargetMotion(character,data);
    assert.equal(bake.clip.tracks.length,21);
    assert(bake.rotations.every(track=>track.length===data.times.length*4&&track.every(Number.isFinite)));
    assert(bake.hips.every(Number.isFinite));
    assert(bake.rootTrajectory.every(value=>Math.abs(value)<1e-6),'不能伪造真实世界平移');
    for(let frame=0;frame<data.times.length;frame+=30){
      const world=character.joints.map(()=>new T.Quaternion());
      for(let bone=0;bone<20;bone++){
        const local=new T.Quaternion().fromArray(bake.rotations[bone],frame*4);
        const parent=character.joints[bone].parent;
        world[bone].copy(parent<0?local:world[parent].clone().multiply(local)).normalize();
      }
      for(const bone of [7,8,11,12]){
        const child=CALIBRATION_CHILD[bone];
        const sourceStart=new T.Vector3().fromArray(data.positions,(frame*SAMPLE_BONE_COUNT+bone)*3);
        const sourceEnd=new T.Vector3().fromArray(data.positions,(frame*SAMPLE_BONE_COUNT+child)*3);
        const sourceDirection=sourceEnd.sub(sourceStart).normalize();
        const targetDirection=new T.Vector3().fromArray(character.joints[child].p)
          .sub(new T.Vector3().fromArray(character.joints[bone].p)).normalize().applyQuaternion(world[bone]);
        const error=targetDirection.angleTo(sourceDirection)*180/Math.PI;
        assert(error<.05,`${definition.id} ${bodyType} 第 ${frame} 帧 ${bone} 偏离 ${error.toFixed(2)}°`);
      }
    }
    const exported=exportTargetMotion(character,data,bake);
    assert.equal(exported.bones.length,20);
    assert.equal(exported.source.provider,'MediaPipe');
  }
  console.log(`PASS ${definition.id}：${data.times.length} 帧，男女 20 骨，最大单帧旋转 ${maximumStep.toFixed(2)}°`);
}
