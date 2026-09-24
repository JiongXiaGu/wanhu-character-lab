export const MOTION_SCHEMA = 1;
export const MIXAMO_SCHEMA = MOTION_SCHEMA;
export const RETARGET_VERSION = 'wanhu-humanoid-5';
export const SOURCE_BONES = ['', 'Hips', 'Spine', 'Spine2', 'Neck', 'Head', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftUpLeg', 'LeftLeg', 'LeftFoot'] as const;
export const SOURCE_ENDPOINTS = ['HeadTop_End', 'RightHandMiddle1', 'LeftHandMiddle1', 'RightToeBase', 'LeftToeBase'] as const;
export const SAMPLE_BONES = [...SOURCE_BONES, ...SOURCE_ENDPOINTS] as const;
export const SAMPLE_BONE_COUNT = SAMPLE_BONES.length;
export const SAMPLE_PARENTS = [-1,0,1,2,3,4,3,6,7,8,3,10,11,12,1,14,15,1,17,18,5,9,13,16,19] as const;
export const CALIBRATION_CHILD = [-1,2,3,4,5,20,7,8,9,21,11,12,13,22,15,16,23,18,19,24] as const;
export interface GroundDiagnostics {leftFootMinY:number;rightFootMinY:number;leftToeMinY:number;rightToeMinY:number}
export interface MotionSourceMetadata {
 provider:'Mixamo'|'SystemAnimator'|'MediaPipe';format?:'fbx'|'glb'|'mp4';profile?:string;file:string;sha256:string;clipName:string;
 uniqueBones:number;rawBoneNodes:number;tracks:number;threeVersion:string;axisConversion:string;extractorVersion?:string;generator?:string;groundDiagnostics?:GroundDiagnostics;
 modelSha256?:string;poseSha256?:string;sourceStartSeconds?:number;sourceEndSeconds?:number;
}
export interface MediaPipeLandmarks33 {positions:number[];visibility:number[];validity?:number[];connections:number[][]}
export interface HumanoidMotionData {
 schema:number;id:string;source:MotionSourceMetadata;duration:number;fps:number;times:number[];names:string[];parents:number[];
 bindPositions:number[];worldDeltas:number[];positions:number[];
 mediapipe33?:MediaPipeLandmarks33;
}
export type MixamoMotionData=HumanoidMotionData;
export function validateMotionData(data:HumanoidMotionData,id:string):void{
 const count=data?.times?.length;
 if(data?.schema!==MOTION_SCHEMA||data.id!==id||!Number.isFinite(data.duration)||data.duration<=0||data.duration>120||!count||count<2||count>7202)throw new Error('人物动作数据版本、ID 或时长无效，请重新运行 npm run prepare:motion。');
 const equal=(a:readonly unknown[],b:readonly unknown[])=>Array.isArray(a)&&a.length===b.length&&a.every((v,i)=>v===b[i]);
 if(!equal(data.names,SAMPLE_BONES)||!equal(data.parents,SAMPLE_PARENTS))throw new Error('人物动作语义骨骼映射不匹配。');
 for(const [array,length] of [[data.bindPositions,SAMPLE_BONE_COUNT*3],[data.worldDeltas,count*20*4],[data.positions,count*SAMPLE_BONE_COUNT*3]] as const)if(!Array.isArray(array)||array.length!==length||!array.every(Number.isFinite))throw new Error('人物动作采样数组损坏。');
 if(!Number.isFinite(data.fps)||data.fps<=0||data.times[0]!==0||Math.abs(data.times[count-1]-data.duration)>1e-5||data.times.some((v,i)=>!Number.isFinite(v)||(i>0&&v<=data.times[i-1])))throw new Error('人物动作时间轴必须严格递增且包含完整末帧。');
 for(let i=0;i<data.worldDeltas.length;i+=4)if(Math.abs(Math.hypot(...data.worldDeltas.slice(i,i+4))-1)>1e-4)throw new Error('人物动作四元数没有归一化。');
 if(data.source.provider==='MediaPipe'){
  const pose=data.mediapipe33;
  if(!pose||pose.positions.length!==count*33*3||pose.visibility.length!==count*33||
     !pose.positions.every(Number.isFinite)||!pose.visibility.every(v=>Number.isFinite(v)&&v>=0&&v<=1)||
     (pose.validity!==undefined&&(!Array.isArray(pose.validity)||pose.validity.length!==count*33||!pose.validity.every(v=>v===0||v===1)))||
     !Array.isArray(pose.connections)||!pose.connections.every(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(v=>Number.isInteger(v)&&v>=0&&v<33)))
   throw new Error('MediaPipe 33 点来源骨架数据无效。');
 }
}
export const validateMixamoData=validateMotionData;
