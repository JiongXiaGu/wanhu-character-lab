import {MIXAMO_CLIPS} from '../mixamo/catalog';
import {GENERATED_SYSTEM_ANIMATOR_CLIPS} from '../system-animator/catalog.generated';
export type MotionSource='mixamo-fbx'|'system-animator-glb'|'mediapipe-pose';
export interface MotionDefinition{id:string;label:string;file:string;filename:string;category:string;loop:boolean;ground:boolean;source:MotionSource}
const FBX_CLIPS:MotionDefinition[]=MIXAMO_CLIPS.map(c=>({...c,source:'mixamo-fbx'}));
export const SYSTEM_ANIMATOR_CLIPS:readonly MotionDefinition[]=GENERATED_SYSTEM_ANIMATOR_CLIPS;
export const MEDIAPIPE_CLIPS:readonly MotionDefinition[]=[
 {id:'mediapipe-xinbaodao',label:'新宝岛 · MediaPipe',file:'虾不咕的抖音 23–45 秒',filename:'虾不咕的抖音 - 抖音.mp4',category:'MediaPipe',loop:false,ground:true,source:'mediapipe-pose'},
 {id:'mediapipe-xinbaodao-zhajishaoye',label:'新宝岛 · 炸鸡少爷（34–48 秒候选）',file:'炸鸡少爷 34–48 秒',filename:'新宝岛 炸鸡少爷.mp4',category:'MediaPipe',loop:false,ground:true,source:'mediapipe-pose'},
 {id:'mediapipe-guogaitou-rrrrrrrry',label:'抓个锅盖头 · MediaPipe（全片）',file:'抓个锅盖头 全片',filename:'@rrrrrrrry_yang 嘿 抓个锅盖头… 4K.mp4',category:'MediaPipe',loop:false,ground:true,source:'mediapipe-pose'},
];
export const MOTION_CLIPS:readonly MotionDefinition[]=[...FBX_CLIPS,...SYSTEM_ANIMATOR_CLIPS,...MEDIAPIPE_CLIPS];
export type MotionId=string;export type MotionSelection=MotionId|'none';
export function resolveMotionId(value:unknown):MotionSelection{return value==='xr-b-ccae4e25'?'mediapipe-xinbaodao':isMotionId(value)?value:'none';}
export function isMotionId(value:unknown):value is MotionId{return typeof value==='string'&&MOTION_CLIPS.some(c=>c.id===value);}
export function motionDefinition(id:MotionId):MotionDefinition{const def=MOTION_CLIPS.find(c=>c.id===id);if(!def)throw new Error(`未知动作 ${id}`);return def;}
export function motionAssetDirectory(id:MotionId){const source=motionDefinition(id).source;return source==='system-animator-glb'?'system-animator':source==='mediapipe-pose'?'mediapipe':'mixamo';}
export function motionSourceLabel(source:MotionSource){return source==='system-animator-glb'?'XR Animator':source==='mediapipe-pose'?'MediaPipe':'Mixamo';}
