import { CylinderGeometry } from 'three';
import { SaddleBuilder } from './geometry';
import { saddleDefinition, type SaddleId } from './catalog';
import { HORSE_JOINTS, horseBone } from '../rig';

export function buildSaddle(id: Exclude<SaddleId, 'none'>) {
  const definition = saddleDefinition(id), travel = id === 'travel', lift = definition.seat![1] - .41;
  const b = new SaddleBuilder(), leather = travel ? '#665039' : '#60412f', edge = '#a07c4d', cloth = travel ? '#596956' : '#88724f';
  // 鞍垫按现有马背横截面制作，不让平板从马背侧面露空。
  const xs = [-.33, -.26, -.13, 0, .13, .26, .33];
  b.plate([-.44, .30].map(z => ({ z, points: xs.map(x => [x, 1.671 + lift - .21 * (x / .33) ** 2] as [number, number]) })), .018, cloth);
  b.plate([[-.31, 1.78, .19], [-.15, 1.71, .165], [.10, 1.71, .165], [.23, 1.79, .19]].map(([z, y, width]) =>
    ({ z, points: [[-width, y + .015 + lift], [0, y + lift], [width, y + .015 + lift]] as [number, number][] })), .04, leather);
  for (const side of [-1, 1]) {
    // 脚蹬是简化挂件；形状留有穿鞋空间，不增加脚部IK或骨骼。
    b.bar([side * .22, 1.62 + lift, .08], [side * .49, 1.09 + lift, .10], .021, .012, leather);
    b.band([side * .49, 1.035 + lift, .14], [0, 0, 1], [0, 1, 0], .076, .066, .012, .028, '#aa9465', 8);
    b.box([side * .255, 1.595 + lift, .07], [.035, .039, .024], edge);
  }
  if (travel) {
    for (const side of [-1, 1]) {
      b.bundle([side * .415, 1.435, -.54], [.205, .27, .30], '#8f7855');
      b.box([side * .415, 1.573, -.54], [.215, .027, .28], '#65563e');
      b.box([side * .522, 1.435, -.54], [.012, .265, .025], leather);
      b.box([side * .529, 1.49, -.54], [.016, .036, .035], edge);
      b.bar([side * .20, 1.70, -.30], [side * .39, 1.565, -.50], .026, .014, leather);
    }
    const roll = new CylinderGeometry(.082, .082, .52, 8, 1, false); roll.rotateZ(Math.PI / 2); roll.translate(0, 1.735, -.54); b.add(roll, '#899077');
    for (const x of [-.16, .16]) b.band([x, 1.735, -.54], [0, 0, 1], [0, 1, 0], .086, .086, .009, .023, leather, 8);
  }
  return b.finish(HORSE_JOINTS[horseBone('Spine')].bindWorld);
}

/** 辔头制作点在马的绑定世界空间，装配时一次性转换到Head局部空间。 */
export const BIT_BIND = { left: [-.149, 1.705, 1.461], right: [.149, 1.705, 1.461] } as const;
export function buildBridle() {
  const b = new SaddleBuilder(), leather = '#4b382b', metal = '#b4a076';
  b.band([0, 1.705, 1.453], [1, 0, 0], [0, .745, .667], .143, .128, .012, .034, leather);
  b.band([0, 1.99, 1.145], [1, 0, 0], [0, .835, .550], .168, .200, .010, .027, leather);
  for (const side of [-1, 1]) {
    b.bar([side * .151, 1.711, 1.451], [side * .173, 1.972, 1.157], .019, .012, leather);
    b.band([side * .154, 1.705, 1.461], [0, 0, 1], [0, 1, 0], .025, .025, .008, .012, metal, 8);
  }
  return b.finish(HORSE_JOINTS[horseBone('Head')].bindWorld);
}
