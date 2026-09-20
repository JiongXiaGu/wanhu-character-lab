import type { TopId, BottomId } from '../v3/types';

/** 固定服装资产注册，不是体型编辑参数，也不包含旧衣面补偿。 */
export interface TopPattern {
  id: string;
  sleeve: 'short' | 'long' | 'layered';
  width: number;
  cuff: number;
  hem: number;
}
export interface BottomPattern {
  id: string;
  thigh: number;
  knee: number;
  calf: number;
  hem: number;
  trim: boolean;
}
export const TOP_PATTERNS: Record<Exclude<TopId, 'body'>, TopPattern> = {
  farmer_tunic: { id:'farmer-short-v2', sleeve:'short', width:1, cuff:1, hem:1.035 },
  guard_light_armor: { id:'guard-lamellar-v2', sleeve:'short', width:1.035, cuff:1.04, hem:1.035 },
  archer_tunic: { id:'archer-short-v2', sleeve:'short', width:.98, cuff:.95, hem:1.035 },
  rough_tunic: { id:'work-short-v2', sleeve:'short', width:1.015, cuff:1.06, hem:1.035 },
  cross_jacket: { id:'cross-jacket-v2', sleeve:'long', width:1, cuff:1.05, hem:1.035 },
  layered_vest: { id:'layered-half-sleeve-v2', sleeve:'layered', width:1.035, cuff:1, hem:1.035 },
  ceremony_robe: { id:'ceremony-jacket-v2', sleeve:'long', width:1.045, cuff:1.16, hem:1.035 },
};
export const BOTTOM_PATTERNS: Record<Exclude<BottomId, 'body'>, BottomPattern> = {
  work_pants: { id:'work-straight-v2', thigh:1, knee:1, calf:1, hem:.095, trim:false },
  guard_pants: { id:'guard-bound-v2', thigh:1.015, knee:1, calf:.95, hem:.095, trim:true },
  archer_pants: { id:'archer-bound-v2', thigh:.99, knee:.98, calf:.94, hem:.095, trim:false },
  loose_trousers: { id:'straight-cloth-v2', thigh:1.025, knee:1.06, calf:1.06, hem:.095, trim:false },
  work_wrap: { id:'work-split-v2', thigh:1.045, knee:1.06, calf:1, hem:.095, trim:true },
  pleated_skirt: { id:'pleated-trousers-v2', thigh:1.06, knee:1.16, calf:1.22, hem:.095, trim:true },
  robe_skirt: { id:'ceremony-trousers-v2', thigh:1.06, knee:1.2, calf:1.24, hem:.095, trim:true },
};
export const PATTERN_VERSION = 'wanhu-authored-patterns-v2';
