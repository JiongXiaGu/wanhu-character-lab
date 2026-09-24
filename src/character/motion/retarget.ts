import * as T from 'three';
import {BODY_PROFILE_VERSION,type CharacterData,type Joint} from '../v3/types';
import {CALIBRATION_CHILD,RETARGET_VERSION,SAMPLE_BONE_COUNT,validateMotionData,type HumanoidMotionData} from './data';
import {motionDefinition} from './catalog';
export interface RetargetBake {clip:T.AnimationClip;rotations:number[][];hips:number[];sourcePositions:Float32Array;scale:number;groundLift:number[];rootTrajectory:number[];seamDegrees:number;loop:boolean;bounds:T.Box3}
const v=(a:readonly number[],o:number)=>new T.Vector3(a[o],a[o+1],a[o+2]);
export function calibration(joints:Joint[],source:HumanoidMotionData):T.Quaternion[]{
 if(joints.length!==20)throw new Error('人物动作重定向要求固定 20 骨骼。');const scale=joints[1].p[1]/.929;
 return joints.map((joint,i)=>{if(!i||i===5)return new T.Quaternion();const child=CALIBRATION_CHILD[i],sourceDirection=v(source.bindPositions,child*3).sub(v(source.bindPositions,i*3)).normalize();let direction:T.Vector3;
  if(i===9||i===13)direction=v(joint.p,0).sub(v(joints[joint.parent].p,0));else if(i===16||i===19)direction=new T.Vector3(0,-.073*scale,.15*scale);else direction=v(joints[child].p,0).sub(v(joint.p,0));
  return new T.Quaternion().setFromUnitVectors(direction.normalize(),sourceDirection);});
}
export function retargetMotion(data:CharacterData,source:HumanoidMotionData):RetargetBake{
 validateMotionData(source,source.id);const joints=data.joints,def=motionDefinition(source.id),count=source.times.length,isCapturedMotion=source.source.provider==='SystemAnimator'||source.source.provider==='MediaPipe',correct=calibration(joints,source),scale=joints[1].p[1]/source.bindPositions[4];if(isCapturedMotion)correct[1].identity();
 const localBind=joints.map(j=>v(j.p,0).sub(j.parent<0?new T.Vector3():v(joints[j.parent].p,0))),globalQ=joints.map(()=>new T.Quaternion()),globalP=joints.map(()=>new T.Vector3());
 const swing=new T.Quaternion(),spineDirection=v(joints[3].p,0).sub(v(joints[2].p,0)).normalize(),q=new T.Quaternion(),previous=joints.map(()=>new T.Quaternion());
 const rotations=joints.map(()=>[] as number[]),hips:number[]=[],rootTrajectory:number[]=[],minYs:number[]=[],sourcePositions=new Float32Array(count*SAMPLE_BONE_COUNT*3),bounds=new T.Box3();
 const sourceStart=v(source.positions,3),sourceEnd=v(source.positions,(count-1)*SAMPLE_BONE_COUNT*3+3),p=new T.Vector3(),p2=new T.Vector3(),root=new T.Vector3(),trend=new T.Vector3();
 for(let f=0;f<count;f++){
  const phase=source.times[f]/source.duration;trend.lerpVectors(sourceStart,sourceEnd,phase);root.copy(v(source.positions,f*SAMPLE_BONE_COUNT*3+3)).sub(v(source.bindPositions,3)).multiplyScalar(scale);
  root.x=(source.positions[f*SAMPLE_BONE_COUNT*3+3]-trend.x)*scale;root.z=(source.positions[f*SAMPLE_BONE_COUNT*3+5]-trend.z)*scale;root.add(localBind[1]);rootTrajectory.push((trend.x-sourceStart.x)*scale,0,(trend.z-sourceStart.z)*scale);
  for(let i=0;i<20;i++){globalQ[i].fromArray(source.worldDeltas,(f*20+i)*4).multiply(correct[i]).normalize();
   if(source.source.provider==='Mixamo'&&i===2){const expected=v(source.positions,(f*SAMPLE_BONE_COUNT+3)*3).sub(v(source.positions,(f*SAMPLE_BONE_COUNT+2)*3)).normalize();swing.setFromUnitVectors(spineDirection.clone().applyQuaternion(globalQ[i]),expected);globalQ[i].premultiply(swing).normalize();}
   const parent=joints[i].parent;q.copy(parent<0?globalQ[i]:globalQ[parent]).invert().multiply(globalQ[i]);if(parent<0)q.copy(globalQ[i]);q.normalize();if(f&&q.dot(previous[i])<0)q.set(-q.x,-q.y,-q.z,-q.w);previous[i].copy(q);rotations[i].push(q.x,q.y,q.z,q.w);
   if(i===1)globalP[i].copy(root);else if(parent<0)globalP[i].copy(localBind[i]);else globalP[i].copy(localBind[i]).applyQuaternion(globalQ[parent]).add(globalP[parent]);}
  let minY=Infinity;for(const vertex of data.body.vertices){const [a,b,weight]=vertex.w;p.fromArray(vertex.p).sub(v(joints[a].p,0)).applyQuaternion(globalQ[a]).add(globalP[a]).multiplyScalar(weight);p2.fromArray(vertex.p).sub(v(joints[b].p,0)).applyQuaternion(globalQ[b]).add(globalP[b]).multiplyScalar(1-weight);p.add(p2);minY=Math.min(minY,p.y);bounds.expandByPoint(p);}minYs.push(minY);hips.push(root.x,root.y,root.z);
  for(let i=0;i<SAMPLE_BONE_COUNT;i++){const o=(f*SAMPLE_BONE_COUNT+i)*3;sourcePositions[o]=(source.positions[o]-trend.x)*scale;sourcePositions[o+1]=source.positions[o+1]*scale;sourcePositions[o+2]=(source.positions[o+2]-trend.z)*scale;}}
 const groundLift:number[]=[];
 if(def.ground&&isCapturedMotion){const sorted=[...minYs].sort((a,b)=>a-b),sample=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.1))],fixed=Math.max(0,-sample);for(let f=0;f<count;f++){groundLift.push(fixed);hips[f*3+1]+=fixed;}if(fixed)bounds.translate(new T.Vector3(0,fixed,0));bounds.expandByScalar(.1);}
 else{for(let f=0;f<count;f++){const lift=def.ground?Math.max(0,-minYs[f]):0;groundLift.push(lift);hips[f*3+1]+=lift;}bounds.expandByScalar(Math.max(...groundLift)+.1);}
 const tracks:T.KeyframeTrack[]=rotations.map((values,i)=>new T.QuaternionKeyframeTrack(`${joints[i].name}.quaternion`,source.times,values));tracks.push(new T.VectorKeyframeTrack(`${joints[1].name}.position`,source.times,hips));
 let seamDegrees=0;for(const values of rotations)seamDegrees=Math.max(seamDegrees,new T.Quaternion().fromArray(values).angleTo(new T.Quaternion().fromArray(values,values.length-4))*180/Math.PI);const loop=def.loop&&seamDegrees<12&&v(hips,0).distanceTo(v(hips,hips.length-3))<.06;
 return{clip:new T.AnimationClip(`motion:${source.id}`,source.duration,tracks),rotations,hips,sourcePositions,scale,groundLift,rootTrajectory,seamDegrees,loop,bounds};
}
export function exportTargetMotion(data:CharacterData,source:HumanoidMotionData,bake:RetargetBake){return{schema:'wanhu-target-motion',version:2,retargetVersion:RETARGET_VERSION,skeletonVersion:'wanhu-20-v1',
 calibrationProfile:{id:data.recipe.bodyType==='female'?'female-anatomical-v1':'male-anatomical-v2',head:'source-world-bind-delta; neutral-face-forward-+Z',sourcePolicy:source.source.provider==='MediaPipe'?'mediapipe-segment-directions; no inferred axial twist':source.source.provider==='SystemAnimator'?'world-delta × retarget-pose-alignment; hips uses world-delta only':'mixamo-anatomical-direction-calibration'},coordinateSystem:'+X character-right / +Y up / +Z forward; quaternion xyzw',
 source:source.source,clipId:source.id,duration:source.duration,loop:bake.loop,times:source.times,rootMotionPolicy:'remove-linear-planar-trajectory; preserve-local-sway-and-height',groundPolicy:source.source.provider==='SystemAnimator'||source.source.provider==='MediaPipe'?'fixed-baseline-p10':'per-frame-safety-lift',
 bodyProfile:{id:data.recipe.bodyType,version:BODY_PROFILE_VERSION},bones:data.joints.map((joint,i)=>({id:i,name:joint.name,parent:joint.parent,bindLocalPosition:v(joint.p,0).sub(joint.parent<0?new T.Vector3():v(data.joints[joint.parent].p,0)).toArray(),bindLocalRotation:[0,0,0,1],rotations:bake.rotations[i],...(i===1?{positions:bake.hips}:{})})),rootTrajectory:bake.rootTrajectory,events:[],props:[],limitations:['No fingers/toes','No authored prop or gameplay event tracks','Not a Unity runtime package','No foot lock/IK in G1']};}
