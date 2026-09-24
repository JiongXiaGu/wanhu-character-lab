import type { Joint, Point } from '../livestock/types';

export const PIG_RIG_VERSION = 'wanhu-domestic-pig-rig-v2';
export const PIG_BODY_DROP = .05;
export const PIG_BONES = { Root: 0, Body: 1, Neck: 2, Head: 3, Tail: 4, FrontLegL: 5, FrontLegR: 6, RearLegL: 7, RearLegR: 8 } as const;
/** 猪独立的米制绑定，+Z朝前；四条短腿挂Root，不复制身体呼吸/俯仰。 */
export const PIG_JOINTS: readonly Joint[] = [
  { name: 'Root', parent: -1, position: [0, 0, 0] },
  { name: 'Body', parent: 0, position: [0, .415-PIG_BODY_DROP, -.045] },
  { name: 'Neck', parent: 1, position: [0, .375-PIG_BODY_DROP, .305] },
  { name: 'Head', parent: 2, position: [0, .335-PIG_BODY_DROP, .455] },
  { name: 'Tail', parent: 1, position: [0, .462-PIG_BODY_DROP, -.470] },
  { name: 'FrontLegL', parent: 0, position: [-.165, .310, .235] },
  { name: 'FrontLegR', parent: 0, position: [.165, .310, .235] },
  { name: 'RearLegL', parent: 0, position: [-.175, .310, -.325] },
  { name: 'RearLegR', parent: 0, position: [.175, .310, -.325] },
];
export const PIG_LEGS = [PIG_BONES.FrontLegL, PIG_BONES.FrontLegR, PIG_BONES.RearLegL, PIG_BONES.RearLegR] as const;
/** 简洁整蹄的作者足底，三档前后极值一致，烘焙接地不使用旧分趾外包。 */
export const PIG_SOLE: readonly Point[] = [
  [-.043,.006,-.040], [.043,.006,-.040], [.043,.006,.052], [-.043,.006,.052],
];
