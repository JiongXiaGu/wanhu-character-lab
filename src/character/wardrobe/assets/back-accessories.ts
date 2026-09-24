import { B, rigid, type BackId, type Cage, type Recipe, type Vec3 } from '../../v3/types';
import { add, bridge, face, orient, ring, vertex, BOX } from '../../v3/cage';

/** 三件背负物的作者空间与原男性基模一致；装配后只走一次 shapeRigidPoint。 */
export const BACK_ACCESSORY_GEOMETRY_VERSION = 'wanhu-back-accessories-b1';
export const AUTHORED_BACK_IDS = ['bamboo_basket', 'firewood_bundle', 'book_case'] as const satisfies readonly BackId[];
export type AuthoredBackId = typeof AUTHORED_BACK_IDS[number];
export const isAuthoredBack = (id: BackId): id is AuthoredBackId =>
  (AUTHORED_BACK_IDS as readonly string[]).includes(id);
const weight = rigid(B.Chest);
const empty = (): Cage => ({ vertices: [], faces: [], anchors: {} });
// 削角矩形，不做真实竹丝；从经营俯视读到篓口和整体体积即可。
const chamfer = [[-.72, -1], [.72, -1], [1, -.65], [1, .65], [.72, 1], [-.72, 1], [-1, .65], [-1, -.65]] as const;

function box(c: Cage, id: string, p: Vec3, size: Vec3, color: string) {
  const low = ring(c, `${id}.Low`, add(p, [0, -size[1] / 2, 0]), [1, 0, 0], [0, 0, 1], BOX, size[0] / 2, size[2] / 2, weight);
  const high = ring(c, `${id}.High`, add(p, [0, size[1] / 2, 0]), [1, 0, 0], [0, 0, 1], BOX, size[0] / 2, size[2] / 2, weight);
  bridge(c, low, high, 'equipment', color);
  face(c, [...low].reverse(), 'equipment', color); face(c, high, 'equipment', color);
}

function basket(c: Cage) {
  const rows = [1.08, 1.115, 1.19, 1.215, 1.29, 1.315, 1.39, 1.408];
  const loops = rows.map((y, i) => {
    const t = (y - rows[0]) / (rows.at(-1)! - rows[0]);
    return ring(c, `Back.Basket.Outer${i}`, [0, y, -.274], [1, 0, 0], [0, 0, 1], chamfer,
      .115 + .053 * t, .088 + .036 * t, weight);
  });
  for (let i = 1; i < loops.length; i++) {
    for (let side = 0; side < 8; side++) {
      const next = (side + 1) % 8;
      const binding = i === 1 || i === 3 || i === 5 || i === 7;
      const color = binding ? '#9d8357' : side % 3 === 0 ? '#bca272' : '#b19868';
      face(c, [loops[i - 1][side], loops[i - 1][next], loops[i][next], loops[i][side]], 'equipment', color);
    }
  }
  const mouth = ring(c, 'Back.Basket.InnerRim', [0, 1.408, -.274], [1, 0, 0], [0, 0, 1], chamfer, .151, .107, weight);
  const floor = ring(c, 'Back.Basket.InnerFloor', [0, 1.115, -.274], [1, 0, 0], [0, 0, 1], chamfer, .103, .072, weight);
  // 篓口视觉敞开，但内壁、厚边、内外底连成封闭壳，不靠双面材质或黑片遮洞。
  bridge(c, loops.at(-1)!, mouth, 'equipment', '#cbb17b');
  bridge(c, mouth, floor, 'equipment', '#957c52');
  face(c, floor, 'equipment', '#a88b5d');
  face(c, loops[0], 'equipment', '#947849');
}

function firewood(c: Cage) {
  const profile = Array.from({ length: 5 }, (_, i) => [Math.cos(i * Math.PI * 2 / 5), Math.sin(i * Math.PI * 2 / 5)] as [number, number]);
  const logs = [
    { y: 1.195, z: -.225, r: .045, length: .44, shift: -.015, tilt: .014 },
    { y: 1.295, z: -.233, r: .049, length: .415, shift: .013, tilt: -.014 },
    { y: 1.245, z: -.321, r: .05, length: .48, shift: 0, tilt: .009 },
    { y: 1.34, z: -.310, r: .041, length: .395, shift: -.006, tilt: -.01 },
    { y: 1.147, z: -.311, r: .039, length: .425, shift: .013, tilt: .011 },
  ];
  logs.forEach((log, i) => {
    const a = ring(c, `Back.Firewood.Log${i}.A`, [log.shift - log.length / 2, log.y - log.tilt, log.z], [0, 1, 0], [0, 0, 1], profile, log.r, log.r * .87, weight);
    const b = ring(c, `Back.Firewood.Log${i}.B`, [log.shift + log.length / 2, log.y + log.tilt, log.z], [0, 1, 0], [0, 0, 1], profile, log.r * .9, log.r * .82, weight);
    for (let j = 0; j < 5; j++) face(c, [a[j], a[(j + 1) % 5], b[(j + 1) % 5], b[j]], 'equipment', ['#806043', '#765438', '#906c49'][j % 3]);
    face(c, a, 'equipment', i % 2 ? '#c4a174' : '#b99a70');
    face(c, b, 'equipment', i % 2 ? '#d0b083' : '#bd9a69');
  });
  // 两道扁绳为闭合薄实体。共用固定作者轮廓，无绳物理、额外骨骼或逐帧重建。
  const outline = [[1.105, -.328], [1.167, -.179], [1.32, -.18], [1.389, -.289], [1.333, -.363], [1.222, -.377]] as const;
  for (const [index, x] of [-.115, .115].entries()) {
    const loops = outline.map(([y, z], i) => {
      const dy = y - 1.25, dz = z + .277, length = Math.hypot(dy, dz);
      const p: Vec3 = [x, y, z], n: Vec3 = [0, dy / length * .004, dz / length * .004];
      return [vertex(c, `Back.Firewood.Rope${index}.${i}.0`, add(p, [-.010, 0, 0]), weight),
        vertex(c, `Back.Firewood.Rope${index}.${i}.1`, add(add(p, [-.010, 0, 0]), n), weight),
        vertex(c, `Back.Firewood.Rope${index}.${i}.2`, add(add(p, [.010, 0, 0]), n), weight),
        vertex(c, `Back.Firewood.Rope${index}.${i}.3`, add(p, [.010, 0, 0]), weight)];
    });
    loops.forEach((loop, i) => bridge(c, loop, loops[(i + 1) % loops.length], 'equipment', '#c3ad7f'));
  }
}

function bookCase(c: Cage, recipe: Recipe) {
  const wood = '#9a744c';
  box(c, 'Back.Books.Base', [0, 1.11, -.26], [.292, .028, .208], wood);
  for (const x of [-.13, .13]) for (const z of [-.174, -.346])
    box(c, `Back.Books.Upright${x}.${z}`, [x, 1.304, z], [.021, .375, .020], '#b09262');
  for (let i = 0; i < 3; i++) {
    const bottom = 1.135 + i * .095, height = .075, width = i === 1 ? .233 : .218;
    const rows = [bottom, bottom + .008, bottom + height - .008, bottom + height];
    const loops = rows.map((y, j) => ring(c, `Back.Books.Volume${i}.${j}`, [i === 1 ? .006 : -.003, y, -.258], [1, 0, 0], [0, 0, 1], BOX, width / 2, .079, weight));
    loops.slice(1).forEach((loop, j) => bridge(c, loops[j], loop, 'equipment', j === 1 ? '#d6cbb0' : ['#63756b', '#78654e', '#546770'][i]));
    face(c, loops[0], 'equipment', '#66746a'); face(c, loops.at(-1)!, 'equipment', '#66746a');
  }
  box(c, 'Back.Books.Lid', [0, 1.494, -.26], [.298, .032, .218], wood);
  box(c, 'Back.Books.ClothCover', [0, 1.517, -.26], [.248, .014, .186], recipe.dyes.primary);
  // 书笈背面保留一条简化绑带，布盖随主布色，竹木和纸页不跟随染色。
  box(c, 'Back.Books.Tie', [0, 1.332, -.354], [.019, .39, .008], recipe.dyes.accent);
}

export function makeBackAccessory(recipe: Recipe): Cage | undefined {
  const id = recipe.slots.back;
  if (!isAuthoredBack(id)) return undefined;
  const c = empty();
  if (id === 'bamboo_basket') basket(c);
  else if (id === 'firewood_bundle') firewood(c);
  else bookCase(c, recipe);
  orient(c);
  return c;
}

export function appendBackAccessory(target: Cage, recipe: Recipe): void {
  const piece = makeBackAccessory(recipe);
  if (!piece) return;
  const offset = target.vertices.length;
  target.vertices.push(...piece.vertices);
  target.faces.push(...piece.faces.map(f => ({ ...f, v: f.v.map(i => i + offset) })));
}
