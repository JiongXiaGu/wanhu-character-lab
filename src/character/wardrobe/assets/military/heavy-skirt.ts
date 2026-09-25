import { B, type Cage, type Recipe, type Vec3, type Weight } from '../../../v3/types';
import { bridge, face, vertex, ring, orient } from '../../../v3/cage';
import { KNEE, kneeWeights } from '../../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from '../contract';

// 重甲以高腰护圈、外展侧甲和厚前后摆改变体量；裙底不低于中甲，不使用外挂大腿板。
const PROFILE = [[.27, 1], [.76, .88], [1, 0], [.76, -.88], [.27, -1], [-.27, -1], [-.76, -.88], [-1, 0], [-.76, .88], [-.27, 1]] as const;
const ROWS = [[1.075, .182, .125], [1.025, .204, .141], [.965, .250, .164], [.910, .259, .175], [.835, .278, .186], [.765, .290, .198], [.705, .292, .192], [.685, .292, .192]] as const;
const HIP_WEIGHTS = [1, .92, .74, .55, .43, .35, .29, .28] as const;
const REAR_LIFT = [0, 0, 0, 0, .012, .034, .055, .055] as const;

/** 独立重甲下装作者资产。裙壳、跨中线裆口及两条裤管只有一个连通壳，无叠穿黑短裤。 */
export function makeHeavyArmorSkirt(recipe: Recipe): GarmentPiece {
  const c: Cage = { vertices: [], faces: [], anchors: {} }, openings: Record<string, number[]> = {};
  const { primary: cloth, secondary: iron, accent: binding } = recipe.dyes;
  const shade = (color: string, factor: number) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * factor)).toString(16).padStart(2, '0')).join('');
  const roots: number[][] = [];
  const legProfile: readonly (readonly [number, number])[] = [[-.45, .9], [.5, .9], [1, 0], [.5, -.9], [-.45, -.9], [-.88, -.52], [-1, 0], [-.88, .52]];
  for (const side of [1, -1] as const) {
    const right = side === 1, name = right ? 'Right' : 'Left';
    const thigh = right ? B.RightThigh : B.LeftThigh, shin = right ? B.RightShin : B.LeftShin, foot = right ? B.RightFoot : B.LeftFoot;
    const profile = right ? legProfile : legProfile.map(([x, z]) => [-x, -z] as const);
    const rows: readonly [string, number, number, number, Weight][] = [
      ['Entry', .655, .081, .079, [B.Hips, thigh, .12]],
      ['KneeUpper', KNEE.upperY, .064, .061, [thigh, shin, .94]],
      ['Knee', KNEE.centerY, .060, .058, [thigh, shin, .5]],
      ['KneeLower', KNEE.lowerY, .061, .056, [thigh, shin, .06]],
      ['Calf', .29, .066, .064, [shin, shin, 1]],
      ['Cuff', .095, .046, .045, [shin, foot, .2]],
    ];
    let previous: number[] = [];
    for (const [label, y, width, depth, weights] of rows) {
      const loop = ring(c, `HeavyArmorLiner.${name}.${label}`, [side * .101, y, 0], [1, 0, 0], [0, 0, 1], profile, width, depth, weights);
      if (label === 'Entry') for (const k of [0, 4, 5, 6, 7]) {
        const end = k === 0 || k === 4;
        c.vertices[loop[k]].p[1] = end ? .835 : k === 6 ? .850 : .865;
        c.vertices[loop[k]].w = [B.Hips, thigh, end ? .40 : k === 6 ? .35 : .50];
      }
      if (label.startsWith('Knee') || label === 'Calf') for (const i of loop) c.vertices[i].w = kneeWeights(c.vertices[i].p, thigh, shin);
      if (previous.length) bridge(c, previous, loop, label === 'KneeUpper' ? 'thigh' : 'shin', cloth);
      else roots.push(loop);
      previous = loop;
    }
    openings[name + 'Cuff'] = previous;
  }
  const [r, l] = roots, right = [r[4], r[5], r[6], r[7], r[0]], left = [l[0], l[7], l[6], l[5], l[4]];
  for (let k = 0; k < 4; k++) face(c, [right[k], right[k + 1], left[k + 1], left[k]], 'thigh', iron);
  const entry = [r[0], r[1], r[2], r[3], r[4], l[0], l[1], l[2], l[3], l[4]];
  let previous: number[] = [];
  for (let row = 0; row < ROWS.length; row++) {
    const [y, width, depth] = ROWS[row];
    const loop = PROFILE.map(([x, z], column) => {
      const thigh = x > 0 ? B.RightThigh : B.LeftThigh;
      const weights: Weight = row === 0 ? [B.Hips, B.Hips, 1] : [B.Hips, thigh, HIP_WEIGHTS[row]];
      const point: Vec3 = [x * width, y + Math.max(0, -z) * REAR_LIFT[row], z * (depth + (row >= 6 && z > 0 ? .015 : 0))];
      return vertex(c, `HeavyArmorSkirt.${row}.${column}`, point, weights);
    });
    if (!row) openings.waist = loop;
    else bridge(c, previous, loop, row < 3 ? 'pelvis' : 'thigh', row === 1 || row === ROWS.length - 1 ? binding : shade(iron, row < 3 ? .85 : row < 5 ? 1.12 : .97));
    previous = loop;
  }
  bridge(c, previous, entry, 'thigh', iron);
  orient(c);
  // 裆口回收面保留明确对角线，避免跨中线四边形在迈步时向外翻折。
  for (const f of c.faces) if (f.v.length === 4 && f.v.some(i => c.vertices[i].id === 'HeavyArmorLiner.Left.Entry.4') && f.v.some(i => c.vertices[i].id === 'HeavyArmorSkirt.7.0')) f.v.push(f.v.shift()!);
  c.anchors = { ...openings };
  return { id: recipe.slots.bottom, slot: 'bottom', version: GARMENT_GEOMETRY_VERSION, mesh: c, covers: ['pelvis', 'thigh', 'shin'], openings };
}
