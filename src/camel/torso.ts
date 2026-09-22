import { HorseMeshBuilder } from '../horse/geometry/builder';
import { weight } from './rig';

/** 骆驼作者截面：[前后位置、腹腔中心高、半宽、腹腔半高、背部隆起]。
 * 峰顶、峰坡、肩胛和臀部由同一纵向网格连接，不再叠加有底盖的圆锥。
 * 峰间鞍谷保持原坐点的留量；前后峰的坡长和圆钝顶部各自制作。
 */
const ROWS = [
  [-1.10, 1.540, .060, .120, .000],
  [-1.02, 1.520, .220, .250, .050],
  [-.94, 1.500, .310, .340, .180],
  [-.85, 1.485, .370, .380, .340],
  [-.77, 1.480, .398, .395, .460],
  [-.69, 1.475, .415, .405, .500],
  [-.61, 1.470, .424, .412, .485],
  [-.53, 1.465, .430, .414, .385],
  [-.44, 1.460, .432, .415, .150],
  [-.36, 1.460, .432, .415, .025],
  [-.28, 1.460, .430, .417, .005],
  [-.17, 1.463, .425, .422, .000],
  [-.06, 1.467, .425, .425, .000],
  [ .06, 1.475, .425, .420, .000],
  [ .18, 1.480, .423, .415, .000],
  [ .28, 1.486, .416, .410, .018],
  [ .36, 1.493, .405, .403, .085],
  [ .44, 1.500, .390, .395, .220],
  [ .53, 1.510, .373, .385, .390],
  [ .61, 1.520, .351, .368, .480],
  [ .69, 1.532, .318, .343, .470],
  [ .77, 1.540, .279, .310, .385],
  [ .85, 1.545, .232, .270, .215],
  [ .94, 1.550, .165, .215, .040],
  [1.02, 1.555, .080, .120, .000],
] as const;
const SIDES = 16;
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
function skinAt(z: number) {
  if (z <= -.67) return weight('Pelvis');
  if (z < -.04) return weight('Pelvis', 'Spine', 1 - smooth((z + .67) / .63));
  if (z < .68) return weight('Spine', 'Chest', 1 - smooth((z + .04) / .72));
  return weight('Chest');
}
function tint(from: string, to: string, amount: number): string {
  const a = Number.parseInt(from.slice(1), 16), b = Number.parseInt(to.slice(1), 16);
  const channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}
/** 创建时生成一次。共用边环、共用顶点和连续双权重；没有运行时焊接或法线遮掩。 */
export function appendCamelTorso(b: HorseMeshBuilder, coat: string, pale: string) {
  const rings = ROWS.map(([z, y, width, depth, rise]) => Array.from({ length: SIDES }, (_, s) => {
    const angle = s * 2 * Math.PI / SIDES, up = Math.sin(angle);
    // 隆起在侧腹渐隐，峰根没有单独圈边；保留有体积的肩部而非细柱。
    return b.vertex([width * Math.cos(angle), y + depth * up + rise * Math.max(0, up) ** 4, z], skinAt(z));
  }));
  const face = (a: number, c: number, d: number) => {
    const y = (b.data.vertices[a].position[1] + b.data.vertices[c].position[1] + b.data.vertices[d].position[1]) / 3;
    // 小幅暖色变化跟随表面高度，不再给峰顶贴一整圈深色“笔帽”。
    const color = y < 1.28 ? tint(coat, pale, .65 * smooth((1.28 - y) / .22)) : tint(coat, '#a48a64', .70 * smooth((y - 1.98) / .44));
    b.triangle(a, c, d, color, 'Body');
  };
  for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < SIDES; s++) {
    const next = (s + 1) % SIDES, a = rings[r][s], c = rings[r][next], d = rings[r + 1][s], e = rings[r + 1][next];
    // 对角线左右对称，避免在正面制造单侧斜切的视觉偏差。
    if (Math.cos((s + .5) * 2 * Math.PI / SIDES) > 0) { face(a, c, d); face(c, e, d); }
    else { face(a, c, e); face(a, e, d); }
  }
  const first = ROWS[0], last = ROWS[ROWS.length - 1];
  const start = b.vertex([0, first[1], first[0]], skinAt(first[0]));
  const end = b.vertex([0, last[1], last[0]], skinAt(last[0]));
  for (let s = 0; s < SIDES; s++) {
    const next = (s + 1) % SIDES;
    face(start, rings[0][next], rings[0][s]);
    face(end, rings[rings.length - 1][s], rings[rings.length - 1][next]);
  }
}
