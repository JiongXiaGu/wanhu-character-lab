import { MIXAMO_CLIPS } from '../mixamo/catalog';
import { BVH_CLIPS } from '../bvh/catalog';

export type MotionSource='mixamo-fbx'|'bvh';
export interface MotionDefinition {
  id:string; label:string; file:string; filename:string; category:string; loop:boolean; ground:boolean; source:MotionSource;
}
export const MOTION_CLIPS:readonly MotionDefinition[]=[
  ...MIXAMO_CLIPS.map(c=>({...c,source:'mixamo-fbx' as const})),
  ...BVH_CLIPS.map(c=>({...c,source:'bvh' as const})),
];
export type MotionId=string;
export type MotionSelection=MotionId|'none';
export function isMotionId(value:unknown):value is MotionId {
  return typeof value==='string'&&MOTION_CLIPS.some(c=>c.id===value);
}
export function motionDefinition(id:MotionId):MotionDefinition {
  const def=MOTION_CLIPS.find(c=>c.id===id);
  if(!def)throw new Error(`未知外部动作 ${id}`);
  return def;
}
export function motionAssetPath(id:MotionId){
  const def=motionDefinition(id);
  return `${def.source==='bvh'?'bvh':'mixamo'}/${id}.json`;
}
