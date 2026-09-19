import { rigid, type Cage, type Recipe, type Weight, type GarmentDyes, type Vec3 } from '../v3/types';
import { add, mul, sub, face, vertex, orient } from '../v3/cage';

export type WardrobeLod = 0 | 2;
export const GARMENT_GEOMETRY_VERSION = 'wanhu-garment-geometry-v5';
export const BODY_HIDE_VERSION = 'wanhu-garment-hide-v4';
export const TAILORING_REVIEW_CLIPS = ['jogging', 'shooting-arrow', 'pilot-switches'] as const;

interface Pattern { end: number; width: number; depth: number; pleats?: boolean }
const TOP: Readonly<Record<string, Pattern>> = {
  rough_tunic: { end: .855, width: .215, depth: .133 },
  cross_jacket: { end: .79, width: .235, depth: .142 },
  layered_vest: { end: .70, width: .25, depth: .15 },
  ceremony_robe: { end: .62, width: .26, depth: .153 },
};
const BOTTOM: Readonly<Record<string, Pattern>> = {
  work_wrap: { end: .67, width: .245, depth: .15 },
  pleated_skirt: { end: .42, width: .275, depth: .158, pleats: true },
  robe_skirt: { end: .38, width: .26, depth: .153 },
};
export function hasTailoredPanels(recipe: Recipe): boolean {
  return Boolean(TOP[recipe.slots.top] || BOTTOM[recipe.slots.bottom]);
}
export function tailoringHem(recipe: Recipe): number | null {
  const parts = [TOP[recipe.slots.top], BOTTOM[recipe.slots.bottom]].filter(Boolean);
  return parts.length ? Math.min(...parts.map(p => p.end)) : null;
}
function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }
function tone(hex: string, factor: number): string {
  return '#' + [1, 3, 5].map(i => Math.round(Math.min(255, parseInt(hex.slice(i, i + 2), 16) * factor)).toString(16).padStart(2, '0')).join('');
}
function resizeLoop(c: Cage, name: string, factor: number): void {
  const loop = c.anchors[name];
  if (!loop) throw new Error(`服饰缺少绑定接口：${name}`);
  const center = mul(loop.reduce((a, i) => add(a, c.vertices[i].p), [0, 0, 0] as Vec3), 1 / loop.length);
  for (const i of loop) c.vertices[i].p = add(center, mul(sub(c.vertices[i].p, center), factor));
}

/** 只处理绑定空间的可见衣面；不改源人体、骨架、FBX 或每帧姿势。 */
export function styleTailoredSurface(c: Cage, recipe: Recipe, colors: GarmentDyes): void {
  const top = TOP[recipe.slots.top];
  if (top) {
    const longSleeve = recipe.slots.top !== 'rough_tunic';
    for (const f of c.faces) {
      if (f.region === 'torso' || f.region === 'upperArm') f.color = colors.primary;
      if (longSleeve && f.region === 'forearm') f.color = recipe.slots.top === 'layered_vest' ? colors.secondary : colors.primary;
      if (recipe.slots.top === 'layered_vest' && f.region === 'upperArm') f.color = colors.secondary;
    }
    for (const side of ['Right', 'Left']) {
      resizeLoop(c, side + 'Deltoid', 1.025);
      if (longSleeve) {
        // 原礼衣肘下 1.7 倍膨胀容易在坐姿伸手时碰到身体；改为收束袖。
        resizeLoop(c, side + 'ElbowUpper', 1.02);
        resizeLoop(c, side + 'Elbow', 1.025);
        resizeLoop(c, side + 'ElbowLower', recipe.slots.top === 'ceremony_robe' ? 1.09 : 1.05);
        // Wrist 与手掌共边，不扩大，也不删手部面。
      }
    }
  }
  if (recipe.slots.bottom === 'loose_trousers' || BOTTOM[recipe.slots.bottom]) {
    for (const f of c.faces) if (['pelvis', 'thigh', 'shin'].includes(f.region)) f.color = colors.secondary;
    for (const side of ['Right', 'Left']) {
      const loose = recipe.slots.bottom === 'loose_trousers';
      resizeLoop(c, side + 'Thigh', loose ? 1.16 : 1.02);
      resizeLoop(c, side + 'KneeUpper', loose ? 1.16 : 1.02);
      resizeLoop(c, side + 'Knee', loose ? 1.08 : 1.01);
      resizeLoop(c, side + 'Calf', loose ? 1.10 : 1.01);
    }
  }
}

interface SkinRow { y: number; w: Weight }
/** 新衣片读取真实身体接口的权重，尤其保留膝部过渡，不把下摆一直绑在 Hips/Thigh。 */
function skinRows(c: Cage, side: string): SkinRow[] {
  return ['Waist', 'Hip', side + 'Thigh', side + 'KneeUpper', side + 'Knee', side + 'KneeLower', side + 'Calf', side + 'Ankle'].map(name => {
    const ids = c.anchors[name];
    if (!ids?.length) throw new Error(`服饰缺少蒙皮接口：${name}`);
    return { y: ids.reduce((sum, i) => sum + c.vertices[i].p[1], 0) / ids.length, w: [...c.vertices[ids[0]].w] };
  });
}
function interpolateSkin(a: Weight, b: Weight, t: number): Weight {
  const sums = new Map<number, number>();
  for (const [w, factor] of [[a, 1 - t], [b, t]] as const) {
    sums.set(w[0], (sums.get(w[0]) ?? 0) + factor * w[2]);
    sums.set(w[1], (sums.get(w[1]) ?? 0) + factor * (1 - w[2]));
  }
  const ranked = [...sums].filter(([, w]) => w > 1e-10).sort((x, y) => y[1] - x[1] || x[0] - y[0]);
  if (ranked.length === 1) return rigid(ranked[0][0]);
  const [first, second] = ranked;
  return [first[0], second[0], first[1] / (first[1] + second[1])];
}
function skinAt(rows: SkinRow[], y: number): Weight {
  if (y >= rows[0].y) return [...rows[0].w];
  for (let i = 1; i < rows.length; i++) if (y >= rows[i].y) {
    const a = rows[i - 1], b = rows[i];
    return interpolateSkin(a.w, b.w, clamp01((a.y - y) / (a.y - b.y)));
  }
  return [...rows.at(-1)!.w];
}
function curve(y: number, points: readonly (readonly [number, number])[]): number {
  if (y >= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) if (y >= points[i][0]) {
    const a = points[i - 1], b = points[i], t = (a[0] - y) / (a[0] - b[0]);
    return a[1] + (b[1] - a[1]) * t;
  }
  return points.at(-1)![1];
}
function append(c: Cage, piece: Cage): void {
  orient(piece);
  const offset = c.vertices.length;
  c.vertices.push(...piece.vertices);
  c.faces.push(...piece.faces.map(f => ({ ...f, v: f.v.map(i => i + offset) })));
}

/**
 * 两侧独立、有厚度的开口分裳。上衣下摆与下装仅是一张连续衣面的色区，
 * 不再叠加两个互相穿插的壳体。完整裤装内衬保留在开口内，禁止逐帧删面。
 * lod 只改变角向采样和褶面；腰口、膝过渡、下缘及颜色边界保持一致。
 */
export function addTailoredPanels(c: Cage, recipe: Recipe, colors: GarmentDyes, lod: WardrobeLod = 0): void {
  if (lod !== 0 && lod !== 2) throw new Error(`不支持的服饰 LOD：${lod}`);
  const upper = TOP[recipe.slots.top], lower = BOTTOM[recipe.slots.bottom];
  if (!upper && !lower) return;
  const parts = [upper, lower].filter(Boolean);
  const end = Math.min(...parts.map(p => p.end)), width = Math.max(...parts.map(p => p.width)), depth = Math.max(...parts.map(p => p.depth));
  const start = 1.055, count = lod === 2 ? 6 : 12, pleats = Boolean(lower?.pleats && lod === 0);
  const values = [start, .91, .805, .529, .489, .449, .293, end, end + .02];
  if (upper && lower && upper.end > end) values.push(upper.end, upper.end + .014);
  const rows = [...new Set(values.filter(y => y <= start && y >= end).map(y => Number(y.toFixed(6))))].sort((a, b) => b - a);
  const colorAt = (y: number): string => {
    if (y <= end + .020001) return colors.accent;
    if (upper && lower && Math.abs(y - upper.end - .007) < .00701) return colors.accent;
    return upper && y >= upper.end ? colors.primary : lower ? colors.secondary : colors.primary;
  };
  for (const side of [1, -1]) {
    const name = side === 1 ? 'Right' : 'Left', skin = skinRows(c, name);
    const piece: Cage = { vertices: [], faces: [], anchors: {} }, layers: number[][][] = [];
    for (let layer = 0; layer < 2; layer++) {
      const loops: number[][] = [];
      for (let r = 0; r < rows.length; r++) {
        const y = rows[r], legPart = clamp01((.91 - y) / (.91 - .805));
        const center = .101 * legPart, gap = .004 + .012 * legPart;
        const halfWidth = curve(y, [[start, .166], [.91, .197], [.805, Math.min(width, .239)], [.529, width], [.293, width * .97]]);
        const halfDepth = curve(y, [[start, .109], [.91, .139], [.805, depth], [.293, depth * .98]]);
        const rx = halfWidth - center;
        const edgeAngle = Math.asin(Math.max(-.95, Math.min(.95, (gap - center) / rx)));
        const w = skinAt(skin, y), loop: number[] = [];
        for (let i = 0; i <= count; i++) {
          const angle = edgeAngle + (Math.PI - 2 * edgeAngle) * i / count;
          const fold = pleats && r > 1 && i > 0 && i < count && i % 2 === 1 ? 1.008 : 1;
          const x = side * (center + Math.sin(angle) * (rx - layer * .004) * fold);
          const z = Math.cos(angle) * (halfDepth - layer * .004) * fold;
          loop.push(vertex(piece, `TailoredPanel.${name}.${layer}.${r}.${i}`, [x, y, z], [...w]));
        }
        loops.push(loop);
      }
      layers.push(loops);
    }
    for (let layer = 0; layer < 2; layer++) for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < count; i++) {
      const color = colorAt((rows[r] + rows[r + 1]) / 2);
      face(piece, [layers[layer][r][i], layers[layer][r][i + 1], layers[layer][r + 1][i + 1], layers[layer][r + 1][i]], 'detail', layer ? tone(color, .82) : pleats && i % 2 ? tone(color, .96) : color);
    }
    for (const r of [0, rows.length - 1]) for (let i = 0; i < count; i++) {
      face(piece, [layers[0][r][i], layers[0][r][i + 1], layers[1][r][i + 1], layers[1][r][i]], 'detail', colors.accent);
    }
    for (const i of [0, count]) for (let r = 0; r < rows.length - 1; r++) {
      face(piece, [layers[0][r][i], layers[0][r + 1][i], layers[1][r + 1][i], layers[1][r][i]], 'detail', colors.accent);
    }
    append(c, piece);
  }
  // 不删除 pelvis/thigh/shin。开口、坐姿与混搭都可看到连续的内衬，源人体仍完整。
}
