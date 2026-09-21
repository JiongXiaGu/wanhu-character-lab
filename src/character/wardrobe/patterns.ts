import type { TopId, BottomId } from '../v3/types';

/** 注册标识和接口尺寸，不将第一批重新折叠成统一宽度参数。 */
export type TopPattern = { id:string; hem:number } & (
  { asset:'work-shirt'|'cross-shirt'|'half-sleeve'|'work-vest'|'short-jacket' } |
  { asset:'classic'; sleeve:'short'|'long'; width:number; cuff:number }
);
export type BottomPattern = { id:string; hem:number } & (
  { asset:'straight-cloth'|'bound-action'|'short-trousers'|'short-skirt' } |
  { asset:'classic'; thigh:number; knee:number; calf:number; trim:boolean }
);
export const TOP_PATTERNS:Record<Exclude<TopId,'body'>,TopPattern>={
  work_vest:{id:'sleeveless-work-v1',asset:'work-vest',hem:1.045},
  short_work_jacket:{id:'summer-short-jacket-v1',asset:'short-jacket',hem:1.025},
  farmer_tunic:{id:'farmer-short-v2',asset:'classic',sleeve:'short',width:1,cuff:1,hem:1.035},
  guard_light_armor:{id:'guard-lamellar-v2',asset:'classic',sleeve:'short',width:1.035,cuff:1.04,hem:1.035},
  archer_tunic:{id:'archer-short-v2',asset:'classic',sleeve:'short',width:.98,cuff:.95,hem:1.035},
  rough_tunic:{id:'work-shirt-v3',asset:'work-shirt',hem:1.045},
  cross_jacket:{id:'cross-shirt-v3',asset:'cross-shirt',hem:.985},
  layered_vest:{id:'half-sleeve-v3',asset:'half-sleeve',hem:1.015},
  ceremony_robe:{id:'ceremony-jacket-v2',asset:'classic',sleeve:'long',width:1.045,cuff:1.16,hem:1.035},
};
export const BOTTOM_PATTERNS:Record<Exclude<BottomId,'body'>,BottomPattern>={
  short_trousers:{id:'knee-work-shorts-v1',asset:'short-trousers',hem:.507},
  short_skirt:{id:'short-split-wrap-v1',asset:'short-skirt',hem:.511},
  work_pants:{id:'work-straight-v2',asset:'classic',thigh:1,knee:1,calf:1,hem:.095,trim:false},
  guard_pants:{id:'bound-action-v3',asset:'bound-action',hem:.095},
  archer_pants:{id:'archer-bound-v2',asset:'classic',thigh:.99,knee:.98,calf:.94,hem:.095,trim:false},
  loose_trousers:{id:'straight-cloth-v3',asset:'straight-cloth',hem:.095},
  work_wrap:{id:'work-split-v2',asset:'classic',thigh:1.045,knee:1.06,calf:1,hem:.095,trim:true},
  pleated_skirt:{id:'pleated-trousers-v2',asset:'classic',thigh:1.06,knee:1.16,calf:1.22,hem:.095,trim:true},
  robe_skirt:{id:'ceremony-trousers-v2',asset:'classic',thigh:1.06,knee:1.2,calf:1.24,hem:.095,trim:true},
};
export const PATTERN_VERSION='wanhu-authored-patterns-v4';
