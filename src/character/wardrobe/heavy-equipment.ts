import { B, rigid, type Cage, type Recipe, type HeadwearId } from '../v3/types';
import { OCT, ring, bridge, face, vertex, orient } from '../v3/cage';

export const HEAVY_HEADWEAR_IDS = [
  'palace_heavy_helmet', 'palace_heavy_captain_helmet',
  'frontier_heavy_helmet', 'frontier_heavy_captain_helmet',
  'city_heavy_helmet', 'city_heavy_captain_helmet',
] as const satisfies readonly HeadwearId[];
export type HeavyHeadwearId = typeof HEAVY_HEADWEAR_IDS[number];
export const isHeavyHeadwear = (id: HeadwearId): id is HeavyHeadwearId => (HEAVY_HEADWEAR_IDS as readonly string[]).includes(id);

// 驻地只拥有盔形与色区差异；衣甲共享，身份仅切换同一重盔上的细高竖饰。
const STYLES = {
  palace: { prefix: 'HeavyPalaceHelmet', width: .179, depth: .183, nape: 1.486, cheek: 1.548, crown: 1.911, brow: .035 },
  frontier: { prefix: 'HeavyFrontierHelmet', width: .173, depth: .198, nape: 1.463, cheek: 1.523, crown: 1.878, brow: .040 },
  city: { prefix: 'HeavyCityHelmet', width: .186, depth: .181, nape: 1.490, cheek: 1.535, crown: 1.892, brow: .032 },
} as const;
const shade = (color: string, k: number) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('');

/** 重步兵盔：前伸厚眉檐、高容积盔碗、覆颊与分层护颈；全为闭合实体，仍只绑定 Head。 */
export function addHeavyHelmet(target: Cage, recipe: Recipe): void {
  if (!isHeavyHeadwear(recipe.slots.headwear)) throw new Error('重盔作者只接受六个真实 Heavy 头饰');
  const style = recipe.slots.headwear.startsWith('palace_') ? 'palace' : recipe.slots.headwear.startsWith('frontier_') ? 'frontier' : 'city';
  const captain = recipe.slots.headwear.includes('_captain_');
  const spec = STYLES[style], prefix = spec.prefix, { primary, secondary: iron, accent } = recipe.dyes;
  const c: Cage = { vertices: [], faces: [], anchors: {} }, w = rigid(B.Head);
  const rows = [
    ['Base', 1.685, spec.width, spec.depth],
    ['ForeheadLow', 1.703, spec.width + .014, spec.depth + .016],
    ['ForeheadHigh', 1.756, spec.width + .014, spec.depth + .016],
    ['BowlLower', 1.788, spec.width + .004, spec.depth + .005],
    ['Dome', 1.830, spec.width - .014, spec.depth - .009],
    ['Crown', spec.crown - .032, .100, .109],
    ['Summit', spec.crown, .031, .033],
  ] as const;
  const loops = rows.map(([name, y, x, z]) => {
    const loop = ring(c, `${prefix}.Shell.${name}`, [0, y, -.010], [1, 0, 0], [0, 0, 1], OCT, x, z, w);
    if (name === 'ForeheadLow' || name === 'ForeheadHigh') for (const i of loop) {
      const v = c.vertices[i]; if (v.p[2] > 0) v.p[2] += spec.brow * Math.max(0, (v.p[2] + .010) / z);
    }
    return loop;
  });
  for (let i = 1; i < loops.length; i++) bridge(c, loops[i - 1], loops[i], 'equipment', i === 2 ? style === 'frontier' ? shade(iron, 1.25) : accent : i === 4 ? shade(iron, 1.14) : iron);
  face(c, loops[0], 'equipment', iron); face(c, loops.at(-1)!, 'equipment', iron);

  // 七点弧从前颊绕过双耳至后颈。内外各三层形成可见厚度，前脸不封成面罩。
  const path = [[.58, .89], [1, .18], [.76, -.68], [0, -1], [-.76, -.68], [-1, .18], [-.58, .89]] as const;
  const names = ['OuterTop', 'OuterMiddle', 'OuterLow', 'InnerLow', 'InnerMiddle', 'InnerTop'] as const;
  const guards = names.map((name, row) => path.map(([px, pz], i) => {
    const inner = row >= 3, level = inner ? 5 - row : row;
    const width = spec.width + [ .007, .018, .030 ][level] - (inner ? .018 : 0);
    const depth = spec.depth + [ .008, .018, .016 ][level] - (inner ? .018 : 0);
    const lowY = i === 0 || i === 6 ? spec.cheek : spec.nape + Math.max(0, pz + 1) * .025;
    const y = level === 0 ? 1.741 : level === 1 ? (1.741 + lowY) * .5 : lowY;
    return vertex(c, `${prefix}.Guard.${name}.${i + 1}`, [px * width, y + (inner && level === 2 ? .009 : 0), pz * depth - .010], w);
  }));
  for (let row = 0; row < guards.length; row++) for (let i = 0; i < path.length - 1; i++) face(c, [guards[row][i], guards[row][i + 1], guards[(row + 1) % guards.length][i + 1], guards[(row + 1) % guards.length][i]], 'equipment', row === 2 ? shade(accent, .85) : row === 1 ? shade(iron, 1.12) : iron);
  face(c, guards.map(row => row[0]), 'equipment', iron);
  face(c, guards.map(row => row.at(-1)!).reverse(), 'equipment', iron);

  if (captain) {
    const section = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const, tipY = spec.crown + .226;
    const crest = [
      ['Base', spec.crown - .008, -.010, .011, .012],
      ['Socket', spec.crown + .025, -.010, .012, .014],
      ['Body', spec.crown + .092, -.014, .023, .025],
      ['Upper', tipY - .037, -.019, .009, .012],
    ] as const;
    const rings = crest.map(([name, y, z, width, depth]) => ring(c, `${prefix}.Crest.${name}`, [0, y, z], [1, 0, 0], [0, 0, 1], section, width, depth, w));
    const color = style === 'palace' ? primary : style === 'frontier' ? accent : iron;
    face(c, rings[0], 'equipment', accent);
    for (let i = 1; i < rings.length; i++) bridge(c, rings[i - 1], rings[i], 'equipment', i === 1 ? accent : color);
    const tip = vertex(c, `${prefix}.Crest.Tip`, [0, tipY, -.024], w);
    for (let i = 0; i < 4; i++) face(c, [rings.at(-1)![i], rings.at(-1)![(i + 1) % 4], tip], 'equipment', style === 'frontier' ? iron : color);
  }
  orient(c);
  const offset = target.vertices.length;
  target.vertices.push(...c.vertices); target.faces.push(...c.faces.map(f => ({ ...f, v: f.v.map(i => i + offset) })));
}
