import { GENERATED_BVH_CLIPS } from './catalog.generated';

export interface BvhDefinition {
  id:string; label:string; file:string; filename:string; category:string; loop:boolean; ground:boolean;
}
export const BVH_CLIPS:readonly BvhDefinition[]=GENERATED_BVH_CLIPS;
export type BvhId=string;
export function isBvhId(value:unknown):value is BvhId {
  return typeof value==='string'&&BVH_CLIPS.some(c=>c.id===value);
}
export function bvhDefinition(id:BvhId):BvhDefinition {
  const def=BVH_CLIPS.find(c=>c.id===id);
  if(!def)throw new Error(`未知 BVH 动作 ${id}`);
  return def;
}
export function bvhFilename(id:BvhId){return bvhDefinition(id).filename;}
