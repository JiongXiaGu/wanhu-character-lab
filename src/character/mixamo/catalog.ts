import { GENERATED_CLIPS } from './catalog.generated';
export interface MotionDefinition { id:string; label:string; file:string; filename:string; category:string; loop:boolean; ground:boolean }
/** 注册表由 prepare:mixamo 扫描真实文件生成；未知文件不会被静默略过。 */
export const MIXAMO_CLIPS:readonly MotionDefinition[]=GENERATED_CLIPS;
export type MixamoId=string;
export type MixamoSelection=MixamoId|'none';
export function isMixamoId(value:unknown):value is MixamoId{return typeof value==='string'&&MIXAMO_CLIPS.some(c=>c.id===value);}
export function mixamoDefinition(id:MixamoId):MotionDefinition{const def=MIXAMO_CLIPS.find(c=>c.id===id);if(!def)throw new Error(`未知 FBX 动作 ${id}`);return def;}
export function mixamoFilename(id:MixamoId){return mixamoDefinition(id).filename;}
