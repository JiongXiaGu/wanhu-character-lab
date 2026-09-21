import { weight } from '../rig';
import type { Point3 } from '../types';
import { HorseMeshBuilder, MANE, COAT_DARK } from './builder';
import { NECK_SECTIONS } from './body';

export function buildHorseDetails(builder: HorseMeshBuilder) {
  // 马鬃是封闭实体，不是相机朝向平面；沿邻近颈骨共用权重。
  builder.loft('Mane', NECK_SECTIONS.map((section, index, all) => {
    const a = all[Math.max(0, index - 1)].p, b = all[Math.min(all.length - 1, index + 1)].p;
    const dy = b[1] - a[1], dz = b[2] - a[2], length = Math.hypot(dy, dz);
    const ridge = section.depth + .035;
    return { p: [0, section.p[1] + ridge * dz / length, section.p[2] - ridge * dy / length] as Point3,
      width: .042, depth: index === 0 ? .045 : .065, skin: section.skin };
  }), 6, MANE);
  builder.loft('Forelock', [
    { p: [0, 2.13, 1.09], width: .062, depth: .035, skin: weight('Head') },
    { p: [0, 2.07, 1.23], width: .052, depth: .035, skin: weight('Head') },
    { p: [0, 2.00, 1.31], width: .012, depth: .015, skin: weight('Head') },
  ], 6, MANE);
  for (const side of ['Left', 'Right'] as const) {
    const sign = side === 'Left' ? -1 : 1;
    builder.loft(`${side}Ear`, [
      { p: [sign * .095, 2.075, 1.035], width: .047, depth: .036, skin: weight('Head') },
      { p: [sign * .114, 2.20, 1.023], width: .039, depth: .023, skin: weight('Head'), color: COAT_DARK },
      { p: [sign * .126, 2.30, 1.04], width: .009, depth: .008, skin: weight('Head'), color: COAT_DARK },
    ], 6);
    builder.gem(`${side}Eye`, [sign * .154, 1.975, 1.18], [.018, .025, .035], weight('Head'), '#202322');
    builder.gem(`${side}EyeGlint`, [sign * .170, 1.983, 1.194], [.0035, .005, .006], weight('Head'), '#dbd4ba');
    builder.gem(`${side}Nostril`, [sign * .12, 1.66, 1.512], [.013, .023, .028], weight('Head'), '#3a312b');
  }
  builder.loft('Tail', [
    { p: [0, 1.45, -.94], width: .066, depth: .067, skin: weight('Pelvis', 'Tail', .3) },
    { p: [0, 1.32, -1.035], width: .073, depth: .067, skin: weight('Tail') },
    { p: [0, 1.14, -1.13], width: .08, depth: .072, skin: weight('Tail') },
    { p: [0, .96, -1.16], width: .092, depth: .075, skin: weight('Tail', 'TailEnd', .5) },
    { p: [0, .70, -1.16], width: .10, depth: .075, skin: weight('TailEnd') },
    { p: [0, .54, -1.12], width: .041, depth: .035, skin: weight('TailEnd') },
  ], 8, MANE);
}
