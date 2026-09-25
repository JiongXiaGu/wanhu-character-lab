import { B, rigid, type Cage, type Recipe } from '../v3/types';
import { BOX, ring, bridge, face, vertex, orient } from '../v3/cage';
import { addPalaceHelmet } from './military-equipment';
import { addFrontierHelmet } from './frontier-equipment';
import { addCityHelmet } from './city-equipment';

export const CAPTAIN_EQUIPMENT_VERSION = 'wanhu-captain-helmets-v1';

function append(target: Cage, piece: Cage): void {
  orient(piece);
  const offset = target.vertices.length;
  target.vertices.push(...piece.vertices);
  target.faces.push(...piece.faces.map(f => ({ ...f, v: f.v.map(i => i + offset) })));
}

/** 宫卫队长只把原短缨拓宽；盔壳、帽底与护颈完全复用普通宫卫，不改原作者资产。 */
export function addPalaceCaptainHelmet(target: Cage, recipe: Recipe): void {
  const c: Cage = { vertices: [], faces: [], anchors: {} };
  addPalaceHelmet(c, recipe);
  for (const v of c.vertices) {
    if (v.id.startsWith('PalaceHelmet.Plume.Mid.')) {
      v.p[0] *= 2.8;
      v.p[1] += .028;
      v.p[2] = -.036 + (v.p[2] + .036) * 1.2;
    } else if (v.id === 'PalaceHelmet.Plume.Tip') {
      v.p[1] += .032;
      v.p[2] -= .020;
    }
  }
  append(target, c);
}

/** 边军保留低圆盔与长护颈，只加闭合的暗赤后掠短缨；无新骨、透明片或物理。 */
export function addFrontierCaptainHelmet(target: Cage, recipe: Recipe): void {
  addFrontierHelmet(target, recipe);
  const c: Cage = { vertices: [], faces: [], anchors: {} }, w = rigid(B.Head);
  const base = ring(c, 'FrontierHelmet.CaptainPlume.Base', [0, 1.843, -.009], [1, 0, 0], [0, 0, 1], BOX, .019, .026, w);
  const mid = ring(c, 'FrontierHelmet.CaptainPlume.Mid', [0, 1.925, -.045], [1, 0, 0], [0, 0, 1], BOX, .053, .053, w);
  const tip = vertex(c, 'FrontierHelmet.CaptainPlume.Tip', [0, 1.952, -.151], w);
  face(c, base, 'equipment', recipe.dyes.accent);
  bridge(c, base, mid, 'equipment', recipe.dyes.accent);
  for (let i = 0; i < 4; i++) face(c, [mid[i], mid[(i + 1) % 4], tip], 'equipment', recipe.dyes.accent);
  append(target, c);
}

/** 城军队长采用低矮横冠：经营俯视可见横向轮廓，短檐与后片仍是原城市作者几何。 */
export function addCityCaptainHelmet(target: Cage, recipe: Recipe): void {
  addCityHelmet(target, recipe);
  const c: Cage = { vertices: [], faces: [], anchors: {} }, w = rigid(B.Head);
  const base = ring(c, 'CityHelmet.CaptainCrest.Base', [0, 1.820, -.006], [1, 0, 0], [0, 0, 1], BOX, .019, .021, w);
  const mid = ring(c, 'CityHelmet.CaptainCrest.Mid', [0, 1.895, -.006], [1, 0, 0], [0, 0, 1], BOX, .107, .045, w);
  const top = ring(c, 'CityHelmet.CaptainCrest.Top', [0, 1.927, -.009], [1, 0, 0], [0, 0, 1], BOX, .073, .032, w);
  face(c, base, 'equipment', recipe.dyes.accent);
  bridge(c, base, mid, 'equipment', recipe.dyes.accent);
  bridge(c, mid, top, 'equipment', recipe.dyes.accent);
  face(c, top, 'equipment', recipe.dyes.accent);
  append(target, c);
}
