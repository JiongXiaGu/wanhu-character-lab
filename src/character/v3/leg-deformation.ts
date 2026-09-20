import type { Vec3, Weight } from './types';

/** 固定关节制作坐标，不是玩家可编辑比例；膝前轮廓沿用原低模。 */
export const KNEE = Object.freeze({
  upperY: .529, centerY: .489, lowerY: .449,
  upperThighWeight: .94, centerThighWeight: .5, lowerThighWeight: .06,
});
export const BODY_GEOMETRY_VERSION = 'wanhu-skin-cage-v3';
export const BODY_TRIANGLES = 524;

/**
 * 仅在网格制作时求双权重。膝前保持局部过渡；膝后按离关节轴的距离降低权重梯度。
 * 整圈使用相同的陡梯度会让屈膝内侧折回自身，单纯增加环数不能解决。
 * 不读取动画相位、不移动关节、不执行每帧修正；未来独立版型可有自己的制作权重。
 */
export function kneeWeights(point: Vec3, thigh: number, shin: number): Weight {
  const frontHalfBand = .04545454545454545;
  const halfBand = frontHalfBand + 4 * Math.max(0, -point[2]);
  const weight = Math.max(0, Math.min(1, .5 + (point[1] - KNEE.centerY) / (2 * halfBand)));
  return [thigh, shin, weight];
}
