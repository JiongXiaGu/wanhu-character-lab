import {MIXAMO_CLIPS} from '../mixamo/catalog';
import {GENERATED_SYSTEM_ANIMATOR_CLIPS} from '../system-animator/catalog.generated';
export type MotionSource='mixamo-fbx'|'system-animator-glb';
export interface MotionDefinition{id:string;label:string;file:string;filename:string;category:string;loop:boolean;ground:boolean;source:MotionSource}
const FBX_CLIPS:MotionDefinition[]=MIXAMO_CLIPS.map(c=>({...c,source:'mixamo-fbx'}));
export const SYSTEM_ANIMATOR_CLIPS:readonly MotionDefinition[]=GENERATED_SYSTEM_ANIMATOR_CLIPS;
export const MOTION_CLIPS:readonly MotionDefinition[]=[...FBX_CLIPS,...SYSTEM_ANIMATOR_CLIPS];
export type MotionId=string;export type MotionSelection=MotionId|'none';
export function isMotionId(value:unknown):value is MotionId{return typeof value==='string'&&MOTION_CLIPS.some(c=>c.id===value);}
export function motionDefinition(id:MotionId):MotionDefinition{const def=MOTION_CLIPS.find(c=>c.id===id);if(!def)throw new Error(`未知动作 ${id}`);return def;}
export function motionAssetDirectory(id:MotionId){return motionDefinition(id).source==='system-animator-glb'?'system-animator':'mixamo';}
export function motionSourceLabel(source:MotionSource){return source==='system-animator-glb'?'XR Animator':'Mixamo';}
