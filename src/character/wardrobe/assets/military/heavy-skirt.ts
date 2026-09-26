import { B, type Cage, type Recipe, type Vec3, type Weight } from '../../../v3/types';
import { bridge, face, vertex, orient } from '../../../v3/cage';
import { kneeWeights } from '../../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from '../contract';

const PROFILE = [[.27, 1], [.76, .88], [1, 0], [.76, -.88], [.27, -1], [-.27, -1], [-.76, -.88], [-1, 0], [-.76, .88], [-.27, 1]] as const;
const WAIST = [[1.205, .195, .132, 1], [1.105, .211, .125, .72], [.980, .243, .105, .60]] as const;
// 前后甲裳各有窄活动缝；两侧为完整围裳，不是外挂大腿板。
// 外层与裆部、内折裙边和两条裤管连为一个闭合衣壳，腿出口真实存在。
const LEG = [[-.30, .36], [.57, .91], [1, 0], [.57, -.91], [-.30, -.36], [-.33, -.22], [-.35, 0], [-.33, .22]] as const;

export function makeHeavyArmorSkirt(recipe: Recipe): GarmentPiece {
  const c: Cage = { vertices: [], faces: [], anchors: {} }, openings: Record<string, number[]> = {};
  const { primary: cloth, secondary: iron, accent: binding } = recipe.dyes;
  const shade = (color: string, factor: number) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * factor)).toString(16).padStart(2, '0')).join('');
  const roots: number[][] = [];
  for (const side of [1, -1] as const) {
    const thigh = side === 1 ? B.RightThigh : B.LeftThigh, shin = side === 1 ? B.RightShin : B.LeftShin, foot = side === 1 ? B.RightFoot : B.LeftFoot;
    const name = side === 1 ? 'Right' : 'Left';
    const rows = [
      ['Entry', .940, .160, .095], ['Upper', .760, .182, .105],
      ['LowerThigh', .590, .195, .175], ['KneeUpper', .529, .194, .170],
      ['Knee', .489, .192, .160], ['KneeLower', .449, .187, .150],
      ['Hem', .375, .181, .140], ['HemEdge', .360, .180, .140],
    ] as const;
    let previous: number[] = [];
    for (let row = 0; row < rows.length; row++) {
      const [label, y, width, depth] = rows[row];
      const loop = LEG.map(([x, z], column) => {
        const point: Vec3 = [side * (.112 + x * width), y, side * z * depth];
        let w: Weight = row === 0 ? [B.Hips, thigh, .64]
          : row === 1 ? [B.Hips, thigh, .22] : kneeWeights(point, thigh, shin);
        if (row === 0 && [5, 6, 7].includes(column)) {
          point[1] = column === 6 ? .855 : .882;
          w = [B.Hips, thigh, column === 6 ? .35 : .50];
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
  for (let row = 0; row < WAIST.length; row++) {
    const [y, width, depth, hip] = WAIST[row];
    const loop = PROFILE.map(([x, z], column) => vertex(c, `HeavyArmorSkirt.Waist.${row}.${column}`, [x * width, y, z * depth], row === 0 ? [B.Hips, B.Hips, 1] : [B.Hips, x > 0 ? B.RightThigh : B.LeftThigh, hip + (1 - hip) * .16 * (1 - z)]));
    if (!row) openings.waist = loop;
    else bridge(c, previous, loop, row < 3 ? 'pelvis' : 'thigh', row === 1 ? binding : shade(iron, row % 2 ? 1.10 : .96));
    previous = loop;
  }
  bridge(c, previous, entry, 'thigh', iron);
  orient(c); c.anchors = { ...openings };
  return { id: recipe.slots.bottom, slot: 'bottom', version: GARMENT_GEOMETRY_VERSION, mesh: c, covers: ['pelvis', 'thigh', 'shin'], openings };
}
