import { B, rigid, type Cage, type Recipe, type HeadwearId } from '../v3/types';
import { OCT, ring, bridge, face, vertex, orient } from '../v3/cage';

export const HEAVY_HEADWEAR_IDS = [
  'palace_heavy_helmet', 'palace_heavy_captain_helmet',
  'frontier_heavy_helmet', 'frontier_heavy_captain_helmet',
  'city_heavy_helmet', 'city_heavy_captain_helmet',
] as const satisfies readonly HeadwearId[];
export type HeavyHeadwearId = typeof HEAVY_HEADWEAR_IDS[number];
export const isHeavyHeadwear = (id: HeadwearId): id is HeavyHeadwearId => (HEAVY_HEADWEAR_IDS as readonly string[]).includes(id);

// 三驻地只有盔壳比例/护颈轮廓和竖饰差异，衣甲仍是同一 Heavy 作者资源。
const STYLES = {
  palace: { prefix: 'HeavyPalaceHelmet', width: .164, depth: .164, nape: 1.510, crown: 1.858, tip: 2.084 },
  frontier: { prefix: 'HeavyFrontierHelmet', width: .160, depth: .174, nape: 1.490, crown: 1.838, tip: 2.071 },
  city: { prefix: 'HeavyCityHelmet', width: .169, depth: .158, nape: 1.520, crown: 1.844, tip: 2.060 },
} as const;

/** 厚眉檐、低宽壳、包耳与三面护颈，均为闭合实体；只使用原 Head 骨。 */
export function addHeavyHelmet(target: Cage, recipe: Recipe): void {
  if (!isHeavyHeadwear(recipe.slots.headwear)) throw new Error('重盔作者只接受六个真实 Heavy 头饰');
  const style = recipe.slots.headwear.startsWith('palace_') ? 'palace' : recipe.slots.headwear.startsWith('frontier_') ? 'frontier' : 'city';
  const captain = recipe.slots.headwear.includes('_captain_');
  const spec = STYLES[style], prefix = spec.prefix, { primary, secondary: iron, accent } = recipe.dyes;
  const c: Cage = { vertices: [], faces: [], anchors: {} }, w = rigid(B.Head);
  const rows = [
    ['Base', 1.698, spec.width, spec.depth],
    ['ForeheadLow', 1.705, spec.width + .013, spec.depth + .015],
    ['ForeheadHigh', 1.746, spec.width + .013, spec.depth + .015],
    ['Dome', 1.791, spec.width - .007, spec.depth - .003],
    ['Crown', spec.crown - .020, .088, .090],
    ['Summit', spec.crown, .028, .031],
  ] as const;
  const loops = rows.map(([name, y, x, z]) => ring(c, `${prefix}.Shell.${name}`, [0, y, -.010], [1, 0, 0], [0, 0, 1], OCT, x, z, w));
  for (let i = 1; i < loops.length; i++) bridge(c, loops[i - 1], loops[i], 'equipment', i === 2 ? accent : iron);
  face(c, loops[0], 'equipment', iron); face(c, loops.at(-1)!, 'equipment', iron);

  // 从前颊两侧包过耳后再接后颈；前方保持开脸。四条弧边围成厚壳，不用单面遮片。
  const path = [1, 2, 3, 4, 5, 6, 7] as const;
  const guards = ['OuterTop', 'OuterLow', 'InnerLow', 'InnerTop'].map((name, row) => path.map(i => {
    const inner = row >= 2, low = row === 1 || row === 2;
    const x = spec.width + (low ? .016 : .005) - (inner ? .018 : 0);
    const z = spec.depth + (low ? .018 : .006) - (inner ? .018 : 0);
    const y = low ? spec.nape + Math.max(0, OCT[i][1] + 1) * .055 + (inner ? .006 : 0) : 1.730;
    return vertex(c, `${prefix}.Guard.${name}.${i}`, [OCT[i][0] * x, y, OCT[i][1] * z - .010], w);
  }));
  for (let row = 0; row < 4; row++) for (let i = 0; i < path.length - 1; i++) face(c, [guards[row][i], guards[row][i + 1], guards[(row + 1) % 4][i + 1], guards[(row + 1) % 4][i]], 'equipment', row === 1 ? accent : iron);
  face(c, guards.map(row => row[0]), 'equipment', iron);
  face(c, guards.map(row => row.at(-1)!).reverse(), 'equipment', iron);

  if (captain) {
    const section = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;
    const crest = [
      ['Base', spec.crown - .008, -.010, .011, .012],
      ['Socket', spec.crown + .025, -.010, .012, .014],
      ['Body', spec.crown + .092, -.014, .023, .025],
      ['Upper', spec.tip - .037, -.019, .009, .012],
    ] as const;
    const rings = crest.map(([name, y, z, width, depth]) => ring(c, `${prefix}.Crest.${name}`, [0, y, z], [1, 0, 0], [0, 0, 1], section, width, depth, w));
    const color = style === 'palace' ? primary : style === 'frontier' ? accent : iron;
    face(c, rings[0], 'equipment', accent);
    for (let i = 1; i < rings.length; i++) bridge(c, rings[i - 1], rings[i], 'equipment', i === 1 ? accent : color);
    const tip = vertex(c, `${prefix}.Crest.Tip`, [0, spec.tip, -.024], w);
    for (let i = 0; i < 4; i++) face(c, [rings.at(-1)![i], rings.at(-1)![(i + 1) % 4], tip], 'equipment', style === 'frontier' ? iron : color);
  }
  orient(c);
  const offset = target.vertices.length;
  target.vertices.push(...c.vertices); target.faces.push(...c.faces.map(f => ({ ...f, v: f.v.map(i => i + offset) })));
}
