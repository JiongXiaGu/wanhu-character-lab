import type { TopId, BottomId, BodyType } from '../v3/types';

/** 美术资源数据：可独立修版，不向玩家暴露衣服尺寸或连续体型参数。 */
export interface TopPattern {
  id: string;
  hem: number;
  forearm: 'skin' | 'primary' | 'secondary';
  cuffScale: number;
}
export interface BottomPattern {
  id: string;
  kind: 'trousers' | 'wrap' | 'split';
  hem: number;
  extension: readonly [number, number, number]; // 腿根 / 膝区 / 小腿
}
export const TOP_PATTERNS: Partial<Record<TopId, TopPattern>> = {
  rough_tunic: { id: 'short-work-v1', hem: .88, forearm: 'skin', cuffScale: 1 },
  cross_jacket: { id: 'cross-jacket-v1', hem: .81, forearm: 'primary', cuffScale: 1.06 },
  layered_vest: { id: 'layered-vest-v1', hem: .72, forearm: 'secondary', cuffScale: 1.06 },
  ceremony_robe: { id: 'ceremony-top-v1', hem: .60, forearm: 'primary', cuffScale: 1.12 },
};
export const BOTTOM_PATTERNS: Partial<Record<BottomId, BottomPattern>> = {
  loose_trousers: { id: 'loose-trousers-v1', kind: 'trousers', hem: .84, extension: [.008,.008,.008] },
  work_wrap: { id: 'work-wrap-v1', kind: 'wrap', hem: .68, extension: [.012,.012,.012] },
  pleated_skirt: { id: 'pleated-split-v1', kind: 'split', hem: .39, extension: [.018,.038,.046] },
  robe_skirt: { id: 'long-split-v1', kind: 'split', hem: .30, extension: [.018,.038,.046] },
};
/** 适配目标只可能是两个固定基模；今后独立网格资源也从此契约注册。 */
export const PATTERN_BODY_TYPES: readonly BodyType[] = ['male','female'];
export const PATTERN_VERSION = 'wanhu-authored-patterns-v1';
