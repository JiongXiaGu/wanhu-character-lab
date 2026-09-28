import { B, rigid, type Cage, type Recipe, type Region, type Vec3, type Weight } from '../../v3/types';
import { bridge, face, orient, ring, vertex } from '../../v3/cage';
import { kneeWeights } from '../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

/** C1 重做：胸部留量、几何束腰、克制长下摆；不调用旧上衣或裙装工厂。 */
type Row = readonly [name: string, y: number, width: number, depth: number];
const BODY: readonly Row[] = [
  ['Hem', .400, .294, .200],
  ['Knee', .489, .282, .188],
  ['KneeUpper', .580, .272, .176],
  ['Seat', .805, .248, .151],
  ['Hip', .940, .232, .141],
  ['BeltFold', 1.057, .178, .109],
  ['BeltLower', 1.065, .183, .116],
  ['Waist', 1.093, .172, .105],
  ['BeltUpper', 1.122, .177, .110],
  ['BeltShoulder', 1.130, .173, .104],
  ['Rib', 1.220, .204, .130],
  ['Chest', 1.310, .224, .136],
  ['Shoulder', 1.405, .213, .117],
  ['Collar', 1.447, .077, .069],
  ['Neck', 1.468, .067, .061],
];
const SEGMENTS = 12;
// 中线落在面内，避免一整列顶点需要第三根腿骨权重。
const PROFILE = Array.from({ length: SEGMENTS }, (_, i) => {
  const angle = (i + .5) * Math.PI * 2 / SEGMENTS;
  return [Math.sin(angle), Math.cos(angle)] as const;
});
/** 扁平腰髋截面配合真实束带；上下过渡回圆角衣身，避免水桶截面。 */
function profilePoint(x: number, z: number, y: number): [number,number] {
  const square = (n:number) => Math.sign(n)*Math.sqrt(Math.abs(n));
  const amount = Math.max(0, Math.min(1, (y-.84)/.15, (1.30-y)/.10));
  // 臀后与膝后留量独立于腰围，不靠把整件衣服加粗来包住屈膝下装。
  const backEase = z < 0 && y >= .580 && y <= .940 ? 1.08 : 1;
  return [x*(1-amount)+square(x)*amount,(z*(1-amount)+square(z)*amount)*backEase];
}
const SLEEVE_PROFILE = [
  [-.45, .90], [-.97, .36], [-.97, -.36], [-.45, -.90],
  [.45, -.90], [.97, -.36], [.97, .36], [.45, .90],
] as const;

function bodyWeight(point: Vec3, name: string): Weight {
  if (name === 'Neck' || name === 'Collar') return [B.Chest, B.Neck, .35];
  if (name === 'Shoulder' || name === 'Chest') return rigid(B.Chest);
  if (name === 'Rib') return [B.Spine, B.Chest, .35];
  if (name === 'Waist' || name.startsWith('Belt')) return [B.Hips, B.Spine, .35];
  const thigh = point[0] > 0 ? B.RightThigh : B.LeftThigh;
  const shin = point[0] > 0 ? B.RightShin : B.LeftShin;
  if (name === 'Hip') return [B.Hips, thigh, .60];
  if (name === 'Seat') return [B.Hips, thigh, .28];
  // 制作时沿内层折弯中性面计算权重，避免外袍厚度把同一膝区变成另一条弯曲轴。
  // 不读取下装、性别、动作或相位；三种代表下装仍使用同一份袍服几何。
  const neutralDepth = name === 'Knee' ? .167/.188 : name === 'KneeUpper' ? .153/.176 : .179/.200;
  const backEase = point[2] < 0 && name === 'KneeUpper' ? 1.08 : 1;
  return kneeWeights([point[0],point[1],point[2]*neutralDepth/backEase], thigh, shin);
}
function regionFor(y: number): Region {
  return y >= 1.085 ? 'torso' : y >= .940 ? 'pelvis' : y >= .489 ? 'thigh' : 'shin';
}

export function makeNarrowLongRobe(recipe: Recipe): GarmentPiece {
  if (recipe.slots.top !== 'narrow_long_robe') throw new Error('C1 作者资产只能生成 narrow_long_robe');
  const c: Cage = { vertices: [], faces: [], anchors: {} };
  const { primary, secondary, accent } = recipe.dyes;
  const loops = BODY.map(([name, y, width, depth]) => PROFILE.map(([x, z], k) => {
    const [px,pz] = profilePoint(x,z,y);
    const point: Vec3 = [px * width, y, pz * depth];
    return vertex(c, `Robe.${name}.${k}`, point, bodyWeight(point, name));
  }));
  for (let row = 0; row < loops.length - 1; row++) {
    for (let k = 0; k < SEGMENTS; k++) {
      // 胸肩之间的两侧开口，与独立八段窄袖共边缝合。
      if (BODY[row][0] === 'Chest' && [1, 2, 3, 7, 8, 9].includes(k)) continue;
      const color = ['BeltLower', 'Waist', 'BeltUpper'].includes(BODY[row][0]) ? secondary : BODY[row][0] === 'Collar' ? accent : primary;
      face(c, [loops[row][k], loops[row][(k + 1) % SEGMENTS], loops[row + 1][(k + 1) % SEGMENTS], loops[row + 1][k]], regionFor(BODY[row][1]), color);
    }
  }
  const openings: Record<string, number[]> = { neck: loops.at(-1)! };
  for (const side of [1, -1] as const) {
    const right = side === 1, label = right ? 'Right' : 'Left';
    const upper = right ? B.RightUpperArm : B.LeftUpperArm;
    const lower = right ? B.RightForearm : B.LeftForearm;
    const hand = right ? B.RightHand : B.LeftHand;
    const chest = loops[BODY.findIndex(r=>r[0]==='Chest')], shoulder = loops[BODY.findIndex(r=>r[0]==='Shoulder')];
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
  for (let row = 0; row <= BODY.findIndex(r=>r[0]==='Waist'); row++) {
    const [name, y, width, depth] = BODY[row];
    const next = PROFILE.map(([x,z],k)=>{
      const [px,pz]=profilePoint(x,z,y);
      return vertex(c,`Robe.Inner.${name}.${k}`,[px*(width-.006),y,pz*(depth-.006)],[...c.vertices[loops[row][k]].w]);
    });
    bridge(c, previous, next, regionFor(y), row === 0 ? accent : secondary);
    previous = next;
  }
  openings.waist = previous;
  // 先固定面片对角线，再统一朝向；否则反转四边面会改变内外层的对角线。
  // 抬腿后四点不共面，内外层必须保留一致的作者三角化。
  c.faces = c.faces.flatMap(f => f.v.slice(1, -1).map((_, i) => ({ ...f, v: [f.v[0], f.v[i + 1], f.v[i + 2]] })));
  orient(c);
  c.anchors = { ...openings, hem: loops[0], chest: loops[BODY.findIndex(r=>r[0]==='Chest')] };
  return {
    id: 'narrow_long_robe', slot: 'top', version: GARMENT_GEOMETRY_VERSION,
    mesh: c, covers: ['torso', 'upperArm', 'forearm', 'pelvis', 'thigh'], openings,
  };
}
