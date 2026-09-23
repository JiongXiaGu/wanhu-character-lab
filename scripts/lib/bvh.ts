import * as T from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { MIXAMO_SCHEMA, SAMPLE_BONES, SAMPLE_BONE_COUNT, SAMPLE_PARENTS, type MixamoMotionData, validateMixamoData } from '../../src/character/mixamo/data';

const rounded=(value:number)=>+value.toFixed(7);
const normalized=(name:string)=>name.replace(/[^a-z0-9]/gi,'').toLowerCase();

function duplicateQuaternionTracks(clip:T.AnimationClip,a:string,b:string):boolean{
  const find=(name:string)=>clip.tracks.find(t=>t.name.toLowerCase().endsWith(`[${name.toLowerCase()}].quaternion`));
  const ta=find(a),tb=find(b);
  if(!ta||!tb||ta.values.length!==tb.values.length||ta.values.length===0)return false;
  for(let i=0;i<ta.values.length;i++)if(Math.abs(ta.values[i]-tb.values[i])>1e-6)return false;
  return true;
}

export function extractBvh(id:string,filename:string,rootDirectory='动画参考_BVH'):MixamoMotionData{
  const path=resolve(rootDirectory,filename),text=readFileSync(path,'utf8');
  const parsed=new BVHLoader().parse(text),skeleton=parsed.skeleton,clip=parsed.clip;
  if(!skeleton.bones.length||!clip)throw new Error(`${filename}: BVH 没有可用骨架或动画。`);
  const boneCount=skeleton.bones.length,byName=new Map<string,T.Bone>();
  for(const bone of skeleton.bones)byName.set(normalized(bone.name),bone);
  const pick=(...names:string[])=>{
    for(const name of names){const found=byName.get(normalized(name));if(found)return found;}
    throw new Error(`${filename}: 缺少必要骨骼 ${names.join(' / ')}`);
  };
  const mapped=new Map<string,T.Bone>([
    ['Hips',pick('hips')],['Spine',pick('spine')],['Spine2',pick('upperChest','chest')],['Neck',pick('neck')],['Head',pick('head')],
    ['RightShoulder',pick('rightShoulder')],['RightArm',pick('rightUpperArm')],['RightForeArm',pick('rightLowerArm')],['RightHand',pick('rightHand')],
    ['LeftShoulder',pick('leftShoulder')],['LeftArm',pick('leftUpperArm')],['LeftForeArm',pick('leftLowerArm')],['LeftHand',pick('leftHand')],
    ['RightUpLeg',pick('rightUpperLeg')],['RightLeg',pick('rightLowerLeg')],['RightFoot',pick('rightFoot')],
    ['LeftUpLeg',pick('leftUpperLeg')],['LeftLeg',pick('leftLowerLeg')],['LeftFoot',pick('leftFoot')],
    ['RightHandMiddle1',pick('rightMiddleProximal','rightIndexProximal')],['LeftHandMiddle1',pick('leftMiddleProximal','leftIndexProximal')],
    ['RightToeBase',pick('rightToes')],['LeftToeBase',pick('leftToes')],
  ]);
  const root=new T.Group(),rootBone=skeleton.bones[0];
  root.add(rootBone);root.updateMatrixWorld(true);
  const world=(name:string)=>mapped.get(name)!.getWorldPosition(new T.Vector3());
  const up=world('Head').sub(world('Hips')).normalize();
  const right=world('RightArm').sub(world('LeftArm'));right.addScaledVector(up,-right.dot(up)).normalize();
  const forward=world('LeftToeBase').sub(world('LeftFoot')).add(world('RightToeBase').sub(world('RightFoot')));
  forward.addScaledVector(up,-forward.dot(up)).addScaledVector(right,-forward.dot(right)).normalize();
  if(!Number.isFinite(right.lengthSq())||right.lengthSq()<.99||!Number.isFinite(forward.lengthSq())||forward.lengthSq()<.99)throw new Error(`${filename}: 无法确定 BVH 人体坐标轴。`);
  const conversion=new T.Matrix4().makeBasis(right,up,forward).invert(),inverseConversion=conversion.clone().invert();
  const convertedHips=world('Hips').applyMatrix4(conversion);
  if(Math.abs(convertedHips.y)<1e-5)throw new Error(`${filename}: Hips 绑定高度无效。`);
  const unitScale=.929/Math.abs(convertedHips.y);
  const head=mapped.get('Head')!,neck=mapped.get('Neck')!,headRestLocal=head.quaternion.clone();
  const headDuplicate=duplicateQuaternionTracks(clip,'neck','head');
  const restQ=new Map<string,T.Quaternion>();
  for(const name of SAMPLE_BONES.slice(1,20))restQ.set(name,mapped.get(name)!.getWorldQuaternion(new T.Quaternion()));
  const rawSample=(name:string,target=new T.Vector3())=>{
    if(!name)return target.set(0,0,0);
    if(name==='HeadTop_End'){
      const hp=head.getWorldPosition(new T.Vector3()),np=neck.getWorldPosition(new T.Vector3());
      return target.copy(hp).add(hp.clone().sub(np).multiplyScalar(.9));
    }
    return mapped.get(name)!.getWorldPosition(target);
  };
  const convertPoint=(point:T.Vector3)=>point.applyMatrix4(conversion).multiplyScalar(unitScale);
  const bindPositions:number[]=[];
  for(const name of SAMPLE_BONES)bindPositions.push(...convertPoint(rawSample(name)).toArray().map(rounded));
  const frameMatch=text.match(/Frames:\s*(\d+)/i),timeMatch=text.match(/Frame\s+Time:\s*([\d.eE+-]+)/i);
  const frameCount=Number(frameMatch?.[1]),frameTime=Number(timeMatch?.[1]);
  if(!Number.isInteger(frameCount)||frameCount<2||!Number.isFinite(frameTime)||frameTime<=0)throw new Error(`${filename}: Frames / Frame Time 无效。`);
  const duration=(frameCount-1)*frameTime,fps=1/frameTime;
  if(duration<=0||duration>120||frameCount>7202)throw new Error(`${filename}: BVH 时长或帧数超出人物试衣范围。`);
  const mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);
  action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const times:number[]=[],positions:number[]=[],deltas:number[]=[];
  const currentQ=new T.Quaternion(),deltaQ=new T.Quaternion(),matrix=new T.Matrix4(),previous=Array.from({length:20},()=>new T.Quaternion());
  for(let frame=0;frame<frameCount;frame++){
    const time=frame===frameCount-1?duration:frame*frameTime;
    times.push(time);action.time=Math.min(time,clip.duration);mixer.update(0);
    if(headDuplicate)head.quaternion.copy(headRestLocal);
    root.updateMatrixWorld(true);
    for(const name of SAMPLE_BONES)positions.push(...convertPoint(rawSample(name)).toArray().map(rounded));
    for(let i=0;i<20;i++){
      const name=SAMPLE_BONES[i];
      if(!name)deltaQ.identity();
      else{
        mapped.get(name)!.getWorldQuaternion(currentQ);
        deltaQ.copy(currentQ).multiply(restQ.get(name)!.clone().invert());
        matrix.makeRotationFromQuaternion(deltaQ).premultiply(conversion).multiply(inverseConversion);
        deltaQ.setFromRotationMatrix(matrix).normalize();
      }
      if(frame&&previous[i].dot(deltaQ)<0)deltaQ.set(-deltaQ.x,-deltaQ.y,-deltaQ.z,-deltaQ.w);
      previous[i].copy(deltaQ);deltas.push(...deltaQ.toArray().map(rounded));
    }
  }
  mixer.stopAllAction();mixer.uncacheRoot(root);root.remove(rootBone);skeleton.dispose();
  const data:MixamoMotionData={
    schema:MIXAMO_SCHEMA,id,
    source:{provider:'BVH',format:'bvh',file:filename,sha256:createHash('sha256').update(text).digest('hex'),clipName:clip.name||basename(filename),uniqueBones:boneCount,rawBoneNodes:boneCount,tracks:clip.tracks.length,threeVersion:T.REVISION,axisConversion:'BVH anatomical frame → +X right / +Y up / +Z forward; auto-scale by bind Hips height',extractorVersion:'v1-bvh-humanoid',headCorrection:headDuplicate?'duplicate neck/head local rotation: head local track suppressed':'none'},
    duration,fps,times,names:[...SAMPLE_BONES],parents:[...SAMPLE_PARENTS],bindPositions,worldDeltas:deltas,positions,
  };
  if(positions.length!==frameCount*SAMPLE_BONE_COUNT*3)throw new Error(`${filename}: BVH 采样位置数量不匹配。`);
  validateMixamoData(data,id);return data;
}
