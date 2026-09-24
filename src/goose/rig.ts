import type { Joint, Point } from '../livestock/types';

export const GOOSE_RIG_VERSION = 'wanhu-goose-rig-v1';
export const GOOSE_BONES = { Root: 0, Body: 1, NeckBase: 2, NeckTip: 3, Head: 4, LegL: 5, LegR: 6 } as const;
export const GOOSE_WATERLINE = .235;
/** 鹅独立的米制绑定；双段颈部替代无用途的翼骨，不修改鸡鸭骨序。 */
export const GOOSE_JOINTS: readonly Joint[] = [
  { name: 'Root', parent: -1, position: [0, 0, 0] },
  { name: 'Body', parent: 0, position: [0, .305, -.045] },
  { name: 'NeckBase', parent: 1, position: [0, .370, .153] },
  { name: 'NeckTip', parent: 2, position: [0, .585, .162] },
  { name: 'Head', parent: 3, position: [0, .777, .233] },
  { name: 'LegL', parent: 0, position: [-.094, .220, -.040] },
  { name: 'LegR', parent: 0, position: [.094, .220, -.040] },
];
/** 蹼足前缘比后跟宽；各档共用外包点，烘焙时校正接地，不使用运行时IK。 */
export const GOOSE_SOLE: readonly Point[] = [[-.038, .006, .056], [.038, .006, .056], [0, .006, -.090]];
