import type { Vec3 } from "./types";

/** 女性基模的中性、低模比例场。共用 Cage 拓扑，不依赖服装/职业或源动画。 */
const torso: readonly [number, number, number][] = [
  [.81, 1.045, 1.015], [.91, 1.075, 1.035], [1.055, .89, .95],
  [1.18, .90, .97], [1.30, .90, .99], [1.395, .89, .95],
  [1.455, .87, .89], [1.51, .89, .92], [1.545, .85, .93],
  [1.63, .93, .97], [1.72, .96, .98], [1.80, .97, .98],
];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function profile(y: number): [number, number] {
  if (y <= torso[0][0]) return [torso[0][1], torso[0][2]];
  for (let i = 1; i < torso.length; i++) if (y <= torso[i][0]) {
    const a = torso[i - 1], b = torso[i], t = smooth(a[0], b[0], y);
    return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  return [.97, .98];
}
export function femalePoint(p: Vec3): Vec3 {
  const [x, y, z] = p, ax = Math.abs(x), side = Math.sign(x), [sx, sz] = profile(y);
  // 双腿不以躯干缩放：髋轴略宽，小腿/脚更轻，中心裆点仍为零。
  const legX = .90 * x + side * .017 * smooth(0, .07, ax);
  const leg = 1 - smooth(.805, .93, y);
  let xx = legX * leg + x * sx * (1 - leg);
  let zz = z * (.91 * leg + sz * (1 - leg));
  // 手臂由同一空间变换匹配骨骼，避免腰部收窄误挤压手和前臂。
  const arm = smooth(.19, .255, ax) * (1 - smooth(1.40, 1.48, y));
  xx = xx * (1 - arm) + (x * .945 - side * .005) * arm;
  zz = zz * (1 - arm) + z * .91 * arm;
  // 仅给胸前连续面极小的体积变化，不另加球体或额外骨骼。
  const chest = smooth(1.12, 1.28, y) * (1 - smooth(1.30, 1.43, y));
  zz += .008 * chest * smooth(0, .08, z) * (1 - arm);
  return [xx, y, zz];
}
