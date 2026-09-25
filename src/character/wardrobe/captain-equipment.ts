import { B, rigid, type Cage, type Recipe, type Vec3 } from '../v3/types';
import { ring, bridge, face, vertex, orient } from '../v3/cage';
import { addPalaceHelmet } from './military-equipment';
import { addFrontierHelmet } from './frontier-equipment';
import { addCityHelmet } from './city-equipment';

export const CAPTAIN_EQUIPMENT_VERSION = 'wanhu-captain-helmets-v2';

// 四向棱面形成有厚度的细束，不使用横向箱体、透明翎片或毛球。
const SECTION = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;
type CrestRow = readonly [name: string, y: number, z: number, width: number, depth: number];

function append(target: Cage, piece: Cage): void {
  orient(piece);
  const offset = target.vertices.length;
  target.vertices.push(...piece.vertices);
  target.faces.push(...piece.faces.map(f => ({ ...f, v: f.v.map(i => i + offset) })));
}

/** 三件顶饰共用小型闭合截面操作；轮廓与分区仍由各自作者数据决定。 */
function addCrest(target: Cage, prefix: string, rows: readonly CrestRow[], tip: Vec3, colors: readonly string[]): void {
  if (rows.length < 2 || colors.length !== rows.length) throw new Error('队长顶饰截面与色段不完整');
  const c: Cage = { vertices: [], faces: [], anchors: {} }, w = rigid(B.Head);
  const loops = rows.map(([name, y, z, width, depth]) =>
    ring(c, `${prefix}${name}`, [0, y, z], [1, 0, 0], [0, 0, 1], SECTION, width, depth, w));
  face(c, loops[0], 'equipment', colors[0]);
  for (let i = 0; i < loops.length - 1; i++) bridge(c, loops[i], loops[i + 1], 'equipment', colors[i]);
  const point = vertex(c, `${prefix}Tip`, tip, w), end = loops.at(-1)!;
  for (let i = 0; i < end.length; i++) face(c, [end[i], end[(i + 1) % end.length], point], 'equipment', colors.at(-1)!);
  append(target, c);
}

/** 仅在队长的临时副本中移除原短缨闭合组件；不改普通盔作者文件或盔壳/护颈。 */
function removePalacePlume(c: Cage): void {
  const first = c.vertices.findIndex(v => v.id.startsWith('PalaceHelmet.Plume.'));
  if (first < 0 || c.vertices.slice(first).some(v => !v.id.startsWith('PalaceHelmet.Plume.'))) {
    throw new Error('宫卫原短缨不再是独立末端组件，需要重新核对作者接口');
  }
  c.faces = c.faces.filter(f => {
    if (f.v.some(i => i < first) && f.v.some(i => i >= first)) throw new Error('宫卫短缨与盔壳共享面，不能直接替换');
    return f.v.every(i => i < first);
  });
  c.vertices.splice(first);
}

/** 宫卫：小铜座、细长束缨、收尖上端；不再拓宽原短缨。 */
export function addPalaceCaptainHelmet(target: Cage, recipe: Recipe): void {
  const c: Cage = { vertices: [], faces: [], anchors: {} };
  addPalaceHelmet(c, recipe);
  removePalacePlume(c);
  append(target, c);
  addCrest(target, 'PalaceHelmet.Plume.', [
    ['Base', 1.893, -.006, .011, .012],
    ['Socket', 1.925, -.006, .012, .013],
    ['Body', 2.005, -.012, .026, .028],
    ['Upper', 2.090, -.021, .013, .017],
  ], [0, 2.145, -.028], [recipe.dyes.accent, recipe.dyes.primary, recipe.dyes.primary, recipe.dyes.primary]);
}

/** 边军：紧束暗赤短缨托起细高盔尖；后倾克制，不再有肥厚拖尾。 */
export function addFrontierCaptainHelmet(target: Cage, recipe: Recipe): void {
  addFrontierHelmet(target, recipe);
  addCrest(target, 'FrontierHelmet.CaptainPlume.', [
    ['Base', 1.843, -.009, .011, .013],
    ['Socket', 1.867, -.009, .012, .014],
    ['Body', 1.916, -.012, .023, .025],
    ['Upper', 1.962, -.017, .007, .010],
  ], [0, 2.065, -.024], [recipe.dyes.secondary, recipe.dyes.accent, recipe.dyes.accent, recipe.dyes.secondary]);
}

/** 城军：朴素的窄竖冠叶；纵向收尖，原低檐与短后片保持。 */
export function addCityCaptainHelmet(target: Cage, recipe: Recipe): void {
  addCityHelmet(target, recipe);
  addCrest(target, 'CityHelmet.CaptainCrest.', [
    ['Base', 1.820, -.006, .010, .014],
    ['Body', 1.905, -.009, .024, .018],
    ['Upper', 1.978, -.016, .012, .012],
  ], [0, 2.015, -.022], [recipe.dyes.accent, recipe.dyes.accent, recipe.dyes.accent]);
}
