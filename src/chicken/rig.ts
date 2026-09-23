import type { Joint, Point } from '../livestock/types';

export const CHICKEN_RIG_VERSION = 'wanhu-chicken-rig-v1';
export const CHICKEN_BONES = { Root: 0, Body: 1, Neck: 2, Head: 3, LegL: 4, LegR: 5, WingL: 6, WingR: 7 } as const;
export const CHICKEN_JOINTS: readonly Joint[] = [
  { name: 'Root', parent: -1, position: [0, 0, 0] },
  { name: 'Body', parent: 0, position: [0, .255, 0] },
  { name: 'Neck', parent: 1, position: [0, .30, .14] },
  { name: 'Head', parent: 2, position: [0, .436, .22] },
  { name: 'LegL', parent: 0, position: [-.063, .175, 0] },
  { name: 'LegR', parent: 0, position: [.063, .175, 0] },
  { name: 'WingL', parent: 1, position: [-.09, .27, 0] },
  { name: 'WingR', parent: 1, position: [.09, .27, 0] },
];
/** 与脚部作者网格共用，制作时计算最低点；播放时没有脚部IK。 */
export const FOOT_POINTS: readonly Point[] = [[-.030, .005, .06], [.030, .005, .06], [0, .005, -.03], [0, .024, .005]];
