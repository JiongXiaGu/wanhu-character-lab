import { B, type Cage, type Recipe, type Vec3, type Weight } from '../../../v3/types';
import { bridge, face, vertex, orient } from '../../../v3/cage';
import { kneeWeights } from '../../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from '../contract';

const PROFILE = [[.27, 1], [.76, .88], [1, 0], [.76, -.88], [.27, -1], [-.27, -1], [-.76, -.88], [-1, 0], [-.76, .88], [-.27, 1]] as const;
// 完整前后围裳延伸到近膝部；原高胯分叉下移到低位活动出口。
const WRAP_ROWS = [[1.205, .195, .132, 1], [1.105, .211, .136, .72], [.980, .249, .150, .60], [.760, .275, .174, .22], [.580, .284, .180, .05]] as const;
// 开衩仅留在末端；裙边回折接入真实腿出口，与上段围裳形成单一闭合壳。
// 不从腰胯处分成两条宽腿管，也不用封死双腿的平面裙底。
const LEG = [[-.30, .36], [.57, .91], [1, 0], [.57, -.91], [-.30, -.36], [-.33, -.22], [-.35, 0], [-.33, .22]] as const;

/** 共享长甲裳候选；只拥有下装制作网格，驻地/身份/Recipe 和运行时不变。 */
export function makeHeavyArmorSkirt(recipe: Recipe): GarmentPiece {
  const c: Cage = { vertices: [], faces: [], anchors: {} }, openings: Record<string, number[]> = {};
  const { primary: cloth, secondary: iron, accent: binding } = recipe.dyes;
  const shade = (color: string, factor: number) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * factor)).toString(16).padStart(2, '0')).join('');
  const roots: number[][] = [];
  for (const side of [1, -1] as const) {
    const thigh = side === 1 ? B.RightThigh : B.LeftThigh, shin = side === 1 ? B.RightShin : B.LeftShin, foot = side === 1 ? B.RightFoot : B.LeftFoot;
    const name = side === 1 ? 'Right' : 'Left';
    const rows = [
      ['Entry', .545, .194, .170],
      ['Knee', .489, .192, .160], ['KneeLower', .449, .187, .150],
      ['Hem', .375, .181, .140], ['HemEdge', .360, .180, .140],
    ] as const;
    let previous: number[] = [];
    for (let row = 0; row < rows.length; row++) {
      const [label, y, width, depth] = rows[row];
      const loop = LEG.map(([x, z], column) => {
        const point: Vec3 = [side * (.112 + x * width), y, side * z * depth];
        let w: Weight = kneeWeights(point, thigh, shin);
        if (row === 0 && [5, 6, 7].includes(column)) {
          point[1] = column === 6 ? .525 : .535;
          w = kneeWeights(point, thigh, shin);
        }
        // 内侧回收面沿前后边界插值膝权重，避免中央 z=0 的陡权重峰将裳底反折。
        // 这是固定作者权重；不依赖动作相位、不修改骨骼，也不增加碰撞豁免。
        if ([5, 6, 7].includes(column)) {
          const frontWeight = kneeWeights([point[0], point[1], depth * .36], thigh, shin)[2];
          const backWeight = kneeWeights([point[0], point[1], -depth * .36], thigh, shin)[2];
          const t = (point[2] / (depth * .36) + 1) * .5;
          w = [thigh, shin, backWeight + (frontWeight - backWeight) * t];
        }
        return vertex(c, `HeavyArmorSkirt.${name}.${label}.${column}`, point, w);
      });
      if (previous.length) bridge(c, previous, loop, 'thigh', label === 'HemEdge' ? binding : shade(iron, row % 2 ? 1.12 : 1.02));
      else roots.push(loop);
      previous = loop;
    }
    // 厚裙边向内折回各自裤管；不使用封死两腿的扇形底面。
    const liner = [[-.45, .9], [.5, .9], [1, 0], [.5, -.9], [-.45, -.9], [-.88, -.52], [-1, 0], [-.88, .52]] as const;
    for (const [label, y, width, depth] of [['Opening', .335, .059, .059], ['Calf', .290, .066, .064], ['Cuff', .095, .046, .045]] as const) {
      const loop = liner.map(([x, z], column) => {
        const point: Vec3 = [side * (.101 + x * width), y, side * z * depth];
        const w: Weight = label === 'Cuff' ? [shin, foot, .2] : kneeWeights(point, thigh, shin);
        return vertex(c, `HeavyArmorLiner.${name}.${label}.${column}`, point, w);
      });
      bridge(c, previous, loop, 'shin', label === 'Opening' ? iron : cloth);
      previous = loop;
    }
    openings[name + 'Cuff'] = previous;
  }
  const [r, l] = roots, right = [r[4], r[5], r[6], r[7], r[0]], left = [l[0], l[7], l[6], l[5], l[4]];
  for (let k = 0; k < 4; k++) face(c, [right[k], right[k + 1], left[k + 1], left[k]], 'thigh', iron);
  const entry = [r[0], r[1], r[2], r[3], r[4], l[0], l[1], l[2], l[3], l[4]];
  let previous: number[] = [];
  for (let row = 0; row < WRAP_ROWS.length; row++) {
    const [y, width, depth, hip] = WRAP_ROWS[row];
    const loop = PROFILE.map(([x, z], column) => {
      const thigh = x > 0 ? B.RightThigh : B.LeftThigh, shin = x > 0 ? B.RightShin : B.LeftShin;
      // 下段正面收敛前突量，避免深蹲抬膝时撞入腰口；后围裳保留完整厚度。
      const point: Vec3 = [x * width, y, z * depth * (row >= 3 && z > 0 ? .72 : 1)];
      const weight: Weight = row === 0 ? [B.Hips, B.Hips, 1]
        : row < 4 ? [B.Hips, thigh, hip + (1 - hip) * .16 * (1 - z)]
        : kneeWeights(point, thigh, shin);
      return vertex(c, `HeavyArmorSkirt.Waist.${row}.${column}`, point, weight);
    });
    if (!row) openings.waist = loop;
    else bridge(c, previous, loop, row < 3 ? 'pelvis' : 'thigh', row === 1 ? binding : shade(iron, row % 2 ? 1.10 : .96));
    previous = loop;
  }
  bridge(c, previous, entry, 'thigh', iron);
  orient(c); c.anchors = { ...openings };
  return { id: recipe.slots.bottom, slot: 'bottom', version: GARMENT_GEOMETRY_VERSION, mesh: c, covers: ['pelvis', 'thigh', 'shin'], openings };
}
