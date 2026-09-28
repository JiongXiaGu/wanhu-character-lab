import { B, rigid, type Cage, type Recipe, type Region, type Vec3, type Weight } from '../../v3/types';
import { bridge, face, orient, ring, vertex } from '../../v3/cage';
import { kneeWeights } from '../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

/** C1：独立的直身长袍。只复用缝环操作，不调用任何旧上衣/裙装工厂。 */
type Row = readonly [name: string, y: number, width: number, depth: number];
const BODY: readonly Row[] = [
  ['Hem', .405, .290, .197],
  ['KneeLower', .449, .288, .190],
  ['Knee', .489, .284, .181],
  ['KneeUpper', .550, .276, .173],
  ['Seat', .805, .248, .151],
  ['Hip', .940, .232, .141],
  ['Waist', 1.085, .218, .132],
  ['Rib', 1.180, .213, .135],
  ['Chest', 1.300, .224, .136],
  ['Shoulder', 1.405, .219, .120],
  ['Collar', 1.447, .077, .069],
  ['Neck', 1.462, .067, .061],
];
const SEGMENTS = 12;
// 中线落在面内，避免一整列顶点需要第三根腿骨权重。
const PROFILE = Array.from({ length: SEGMENTS }, (_, i) => {
  const angle = (i + .5) * Math.PI * 2 / SEGMENTS;
  return [Math.sin(angle), Math.cos(angle)] as const;
});
const SLEEVE_PROFILE = [
  [-.45, .90], [-.97, .36], [-.97, -.36], [-.45, -.90],
  [.45, -.90], [.97, -.36], [.97, .36], [.45, .90],
] as const;

function bodyWeight(point: Vec3, name: string): Weight {
  if (name === 'Neck' || name === 'Collar') return [B.Chest, B.Neck, .35];
  if (name === 'Shoulder' || name === 'Chest') return rigid(B.Chest);
  if (name === 'Rib') return [B.Spine, B.Chest, .35];
  if (name === 'Waist') return [B.Hips, B.Spine, .35];
  const thigh = point[0] > 0 ? B.RightThigh : B.LeftThigh;
  const shin = point[0] > 0 ? B.RightShin : B.LeftShin;
  if (name === 'Hip') return [B.Hips, thigh, .60];
  if (name === 'Seat') return [B.Hips, thigh, .28];
  return kneeWeights(point, thigh, shin);
}
function regionFor(y: number): Region {
  return y >= 1.085 ? 'torso' : y >= .940 ? 'pelvis' : y >= .489 ? 'thigh' : 'shin';
}

export function makeNarrowLongRobe(recipe: Recipe): GarmentPiece {
  if (recipe.slots.top !== 'narrow_long_robe') throw new Error('C1 作者资产只能生成 narrow_long_robe');
  const c: Cage = { vertices: [], faces: [], anchors: {} };
  const { primary, secondary, accent } = recipe.dyes;
  const loops = BODY.map(([name, y, width, depth]) => PROFILE.map(([x, z], k) => {
    const point: Vec3 = [x * width, y, z * depth];
    return vertex(c, `Robe.${name}.${k}`, point, bodyWeight(point, name));
  }));
  for (let row = 0; row < loops.length - 1; row++) {
    for (let k = 0; k < SEGMENTS; k++) {
      // 胸肩之间的两侧开口，与独立八段窄袖共边缝合。
      if (row === 8 && [1, 2, 3, 7, 8, 9].includes(k)) continue;
      const color = row === 0 ? accent : row === 10 ? secondary : primary;
      face(c, [loops[row][k], loops[row][(k + 1) % SEGMENTS], loops[row + 1][(k + 1) % SEGMENTS], loops[row + 1][k]], regionFor(BODY[row][1]), color);
    }
  }
  const openings: Record<string, number[]> = { neck: loops.at(-1)! };
  for (const side of [1, -1] as const) {
    const right = side === 1, label = right ? 'Right' : 'Left';
    const upper = right ? B.RightUpperArm : B.LeftUpperArm;
    const lower = right ? B.RightForearm : B.LeftForearm;
    const hand = right ? B.RightHand : B.LeftHand;
    const chest = loops[8], shoulder = loops[9];
    let previous = right
      ? [chest[1], chest[2], chest[3], chest[4], shoulder[4], shoulder[3], shoulder[2], shoulder[1]]
      : [chest[10], chest[9], chest[8], chest[7], shoulder[7], shoulder[8], shoulder[9], shoulder[10]];
    previous.forEach((index, k) => { c.vertices[index].w = [B.Chest, upper, k < 4 ? .87 : .62]; });
    const rows: readonly [string, Vec3, number, number, Weight][] = [
      ['Shoulder', [side * .278, 1.304, 0], .052, .064, [B.Chest, upper, .16]],
      ['Upper', [side * .340, 1.189, 0], .055, .051, rigid(upper)],
      ['Elbow', [side * .394, 1.101, 0], .046, .043, [upper, lower, .5]],
      ['ElbowLower', [side * .414, 1.066, .002], .047, .043, [upper, lower, .08]],
      ['WristFacing', [side * .492, .932, .014], .032, .030, [lower, hand, .4]],
      ['Cuff', [side * .508, .904, .014], .031, .029, [lower, hand, .18]],
    ];
    for (const [name, center, width, depth, weight] of rows) {
      const next = ring(c, `Robe.${label}.${name}`, center, [side * .866, .5, 0], [0, 0, 1], SLEEVE_PROFILE, width, depth, weight);
      bridge(c, previous, next, name === 'Shoulder' || name === 'Upper' ? 'upperArm' : 'forearm', name === 'Cuff' ? accent : primary);
      previous = next;
    }
    openings[label + 'Cuff'] = previous;
  }
  // 下摆不横封双腿：由厚边回折至腰内，再封闭真实腰口。
  // 内外对应点共用制作权重；这是固定作者几何，不按动作删面或重新蒙皮。
  let previous = loops[0];
  for (let row = 0; row <= 6; row++) {
    const [name, y, width, depth] = BODY[row];
    const next = PROFILE.map(([x, z], k) => vertex(c, `Robe.Inner.${name}.${k}`,
      [x * (width - .008), y, z * (depth - .008)], [...c.vertices[loops[row][k]].w]));
    bridge(c, previous, next, regionFor(y), row === 0 ? accent : secondary);
    previous = next;
  }
  openings.waist = previous;
  orient(c);
  c.anchors = { ...openings, hem: loops[0], chest: loops[8] };
  return {
    id: 'narrow_long_robe', slot: 'top', version: GARMENT_GEOMETRY_VERSION,
    mesh: c, covers: ['torso', 'upperArm', 'forearm', 'pelvis', 'thigh'], openings,
  };
}
