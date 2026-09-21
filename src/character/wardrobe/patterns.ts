import type { TopId, BottomId } from '../v3/types';

/** 注册标识和接口尺寸；每个保留款式必须有明确用途或轮廓差异。 */
export type TopPattern = { id:string; hem:number } & (
  { asset:'work-shirt'|'cross-shirt'|'half-sleeve'|'work-vest'|'short-jacket' } |
  { asset:'classic'; sleeve:'short'|'long'; width:number; cuff:number }
);
export type BottomPattern = { id:string; hem:number; stressOnlyClips?:readonly string[] } & (
  { asset:'short-trousers'|'continuous-short-skirt'|'continuous-long-skirt' } |
  { asset:'classic'; thigh:number; knee:number; calf:number; trim:boolean }
);
export const TOP_PATTERNS:Record<Exclude<TopId,'body'>,TopPattern>={
  work_vest:{id:'sleeveless-work-v1',asset:'work-vest',hem:1.045},
  short_work_jacket:{id:'summer-short-jacket-v1',asset:'short-jacket',hem:1.025},
  farmer_tunic:{id:'farmer-short-v2',asset:'classic',sleeve:'short',width:1,cuff:1,hem:1.035},
  rough_tunic:{id:'work-shirt-v3',asset:'work-shirt',hem:1.045},
  cross_jacket:{id:'cross-shirt-v3',asset:'cross-shirt',hem:.985},
  layered_vest:{id:'half-sleeve-v3',asset:'half-sleeve',hem:1.015},
  ceremony_robe:{id:'ceremony-jacket-v2',asset:'classic',sleeve:'long',width:1.045,cuff:1.16,hem:1.035},
};
export const BOTTOM_PATTERNS:Record<Exclude<BottomId,'body'>,BottomPattern>={
  short_trousers:{id:'closed-cuff-shorts-v2',asset:'short-trousers',hem:.504},
  true_short_skirt:{id:'continuous-short-skirt-v1',asset:'continuous-short-skirt',hem:.505,stressOnlyClips:['snatch']},
  long_skirt:{id:'plain-long-skirt-v1',asset:'continuous-long-skirt',hem:.092,stressOnlyClips:['snatch']},
  work_pants:{id:'work-straight-v2',asset:'classic',thigh:1,knee:1,calf:1,hem:.095,trim:false},
  work_wrap:{id:'work-split-v2',asset:'classic',thigh:1.045,knee:1.06,calf:1,hem:.095,trim:true},
};
export const PATTERN_VERSION='wanhu-authored-patterns-v6';
