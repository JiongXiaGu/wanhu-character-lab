import * as T from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SAMPLE_BONES, SAMPLE_BONE_COUNT, MIXAMO_SCHEMA, validateMixamoData, type MixamoMotionData } from '../../src/character/mixamo/data';
import { bvhFilename, type BvhId } from '../../src/character/bvh/catalog';

const SOURCE_NODES=[
  '', 'hips', 'spine', 'upperChest', 'neck', 'head',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  '__headTip', 'rightMiddleProximal', 'leftMiddleProximal', 'rightToes', 'leftToes',
] as const;
const rounded=(value:number)=>+value.toFixed(7);
function normalizedName(name:string){return name.replace(/[\s:_-]+/g,'').toLowerCase();}
function convertedPosition(bone:T.Bone,conversion:T.Matrix4,target=new T.Vector3()){
  return bone.getWorldPosition(target).applyMatrix4(conversion);
}
function headTip(head:T.Vector3,neck:T.Vector3,target=new T.Vector3()){
  const direction=head.clone().sub(neck);
  const length=Math.max(direction.length()*.7,1e-4);
  return target.copy(head).add(direction.normalize().multiplyScalar(length));
}
export function extractBvh(id:BvhId,directory='动画参考_BVH'):MixamoMotionData {
  const file=bvhFilename(id),bytes=readFileSync(`${directory}/${file}`),text=bytes.toString('utf8');
  const result=new BVHLoader().parse(text),root=result.skeleton.bones[0],clip=result.clip;
  if(!root||!clip||clip.tracks.length<2)throw new Error(`${file}: BVH 缺少骨架或动画轨道。`);
  const byName=new Map<string,T.Bone>();
  for(const bone of result.skeleton.bones){
    const key=normalizedName(bone.name);
    if(key&&key!=='endsite'&&!byName.has(key))byName.set(key,bone);
  }
  const boneFor=(name:string)=>{
    const bone=byName.get(normalizedName(name));
    if(!bone)throw new Error(`${file}: 缺少必要骨骼 ${name}`);
    return bone;
  };
  for(const name of SOURCE_NODES)if(name&&name!=='__headTip')boneFor(name);
  root.updateMatrixWorld(true);
  const restP=new Map<string,T.Vector3>(),restQ=new Map<string,T.Quaternion>();
  for(const [name,bone] of byName){
    restP.set(name,bone.getWorldPosition(new T.Vector3()));
    restQ.set(name,bone.getWorldQuaternion(new T.Quaternion()));
  }
  const right=restP.get(normalizedName('rightUpperArm'))!.clone().sub(restP.get(normalizedName('leftUpperArm'))!);
  right.y=0;right.normalize();
  const up=new T.Vector3(0,1,0);
  const forward=restP.get(normalizedName('leftToes'))!.clone().sub(restP.get(normalizedName('leftFoot'))!)
    .add(restP.get(normalizedName('rightToes'))!.clone().sub(restP.get(normalizedName('rightFoot'))!));
  forward.y=0;forward.addScaledVector(right,-forward.dot(right)).normalize();
  if(right.length()<.99||forward.length()<.99||Math.abs(right.dot(forward))>1e-4)
    throw new Error(`${file}: 无法从手臂和脚趾确定人体坐标轴。`);
  const conversion=new T.Matrix4().makeBasis(right,up,forward).invert(),inverseConversion=conversion.clone().invert();
  const sourceTimes=Array.from(clip.tracks[0].times as ArrayLike<number>);
  if(sourceTimes.length<2)throw new Error(`${file}: BVH 帧数不足。`);
  const times=sourceTimes.map(rounded),duration=times.at(-1)!;
  const fps=1/(times[1]-times[0]);
  const mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);
  action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
  const bindPositions:number[]=[],positions:number[]=[],worldDeltas:number[]=[];
  const p=new T.Vector3(),p2=new T.Vector3(),q=new T.Quaternion(),matrix=new T.Matrix4();
  const previous=Array.from({length:20},()=>new T.Quaternion());
  const bindPoint=(index:number,target:T.Vector3)=>{
    if(index===20){
      const h=restP.get(normalizedName('head'))!.clone().applyMatrix4(conversion);
      const n=restP.get(normalizedName('neck'))!.clone().applyMatrix4(conversion);
      return headTip(h,n,target);
    }
    return target.copy(restP.get(normalizedName(SOURCE_NODES[index]))!).applyMatrix4(conversion);
  };
  for(let i=0;i<SAMPLE_BONE_COUNT;i++){
    if(i===0)p.set(0,0,0);else bindPoint(i,p);
    bindPositions.push(...p.toArray().map(rounded));
  }
  action.time=times[0];mixer.update(0);root.updateMatrixWorld(true);
  const animatedRoot=convertedPosition(boneFor('hips'),conversion,new T.Vector3());
  const restRoot=restP.get(normalizedName('hips'))!.clone().applyMatrix4(conversion);
  const baseMotion=animatedRoot.sub(restRoot);
  const samplePoint=(index:number,target:T.Vector3)=>{
    if(index===20){
      const h=convertedPosition(boneFor('head'),conversion,p);
      const n=convertedPosition(boneFor('neck'),conversion,p2);
      return headTip(h,n,target).sub(baseMotion);
    }
    return convertedPosition(boneFor(SOURCE_NODES[index]),conversion,target).sub(baseMotion);
  };
  for(let frame=0;frame<times.length;frame++){
    action.time=times[frame];mixer.update(0);root.updateMatrixWorld(true);
    for(let i=0;i<SAMPLE_BONE_COUNT;i++){
      if(i===0)p.set(0,0,0);else samplePoint(i,p);
      positions.push(...p.toArray().map(rounded));
    }
    for(let i=0;i<20;i++){
      if(i===0)q.identity();
      else {
        const name=normalizedName(SOURCE_NODES[i]),bone=byName.get(name)!;
        bone.getWorldQuaternion(q).multiply(restQ.get(name)!.clone().invert());
        matrix.makeRotationFromQuaternion(q).premultiply(conversion).multiply(inverseConversion);
        q.setFromRotationMatrix(matrix).normalize();
      }
      if(frame&&previous[i].dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);
      previous[i].copy(q);worldDeltas.push(...q.toArray().map(rounded));
    }
  }
  mixer.stopAllAction();mixer.uncacheRoot(root);result.skeleton.dispose();
  const data:MixamoMotionData={
    schema:MIXAMO_SCHEMA,id,
    source:{provider:'BVH',file,sha256:createHash('sha256').update(bytes).digest('hex'),clipName:clip.name||'animation',
      uniqueBones:byName.size,rawBoneNodes:result.skeleton.bones.length,tracks:clip.tracks.length,threeVersion:T.REVISION,
      axisConversion:'BVH anatomical frame → +X right / +Y up / +Z forward; root first-frame translation neutralized; rotation conjugation'},
    duration,fps,times,names:[...SAMPLE_BONES],parents:[-1,0,1,2,3,4,3,6,7,8,3,10,11,12,1,14,15,1,17,18,5,9,13,16,19],
    bindPositions,worldDeltas,positions,
  };
  validateMixamoData(data,id);
  return data;
}
