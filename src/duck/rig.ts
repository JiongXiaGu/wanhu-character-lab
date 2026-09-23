import type { Joint, Point } from '../livestock/types';

export const DUCK_RIG_VERSION = 'wanhu-duck-rig-v1';
export const DUCK_BONES = { Root: 0, Body: 1, Neck: 2, Head: 3, LegL: 4, LegR: 5, WingL: 6, WingR: 7 } as const;
export const DUCK_WATERLINE = .185;
export const DUCK_JOINTS: readonly Joint[] = [
  { name: 'Root', parent: -1, position: [0, 0, 0] },
  { name: 'Body', parent: 0, position: [0, .225, -.045] },
  { name: 'Neck', parent: 1, position: [0, .265, .125] },
  { name: 'Head', parent: 2, position: [0, .391, .225] },
  { name: 'LegL', parent: 0, position: [-.077, .152, -.060] },
  { name: 'LegR', parent: 0, position: [.077, .152, -.060] },
  { name: 'WingL', parent: 1, position: [-.11, .25, -.03] },
  { name: 'WingR', parent: 1, position: [.11, .25, -.03] },
];
/** 相对左右腿中心X、绝对作者Y/Z；所有LOD脚底使用同一外包点校正。 */
export const DUCK_SOLE: readonly Point[] = [[-.028, .006, .012], [.028, .006, .012], [0, .006, -.091]];
