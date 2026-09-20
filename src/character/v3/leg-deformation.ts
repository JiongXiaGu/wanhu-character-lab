/** 固定成年基模的膝关节制作基准。裸模和首批裤装共享关节位置，不共享衣面。 */
export const KNEE = Object.freeze({
  upperY: 0.529,
  centerY: 0.489,
  lowerY: 0.449,
  upperThighWeight: 0.94,
  centerThighWeight: 0.5,
  lowerThighWeight: 0.06,
});
/** 只变更皮肤蒙皮；骨骼索引、绑定位置和裸模膝部原值不变。 */
export const BODY_GEOMETRY_VERSION = 'wanhu-skin-cage-v2';
