import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as T from 'three';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { cleanRecipe, type Cage, type Recipe, type Vec3 } from '../src/character/v3/types';
import { triCount } from '../src/character/v3/cage';
import { applyLook } from '../src/character/wardrobe/catalog';
import { GARMENT_GEOMETRY_VERSION, BODY_HIDE_VERSION, TAILORING_REVIEW_CLIPS } from '../src/character/wardrobe/tailoring';
import { retargetMixamo } from '../src/character/mixamo/retarget';
import type { MixamoMotionData } from '../src/character/mixamo/data';
import { assertComponentWinding } from './check-components';

const directory = 'review-tailoring';
mkdirSync(directory, { recursive: true });
const staticOnly = process.argv.includes('--static');
const clips = ['jogging', 'shooting-arrow', 'pilot-switches'] as const;
assert.deepEqual(TAILORING_REVIEW_CLIPS, clips, '重点矩阵不能遗漏坐姿拨开关');
const samples = ['plain', 'town', 'ceremony'] as const;
const profiles = [[1.76, .5], [1.58, 0], [1.92, 1]] as const;
const staticRows: object[] = [], motionRows: object[] = [], failures: object[] = [];
let checkedFrames = 0, checkedVertices = 0;

function recipeFor(sample: string, bodyType: 'male' | 'female', height: number, build: number): Recipe {
  // plain 的女性推荐是围裳：劳动短装样板统一选短衣/宽裤，保留该身体和配色。
  let r = applyLook(cleanRecipe({ bodyType, height, build }), `${sample}-${bodyType}`);
  if (sample === 'plain') r = cleanRecipe({ ...r, slots: { ...r.slots, top: 'rough_tunic', bottom: 'loose_trousers' } });
  if (sample === 'town') r = cleanRecipe({ ...r, slots: { ...r.slots, top: 'cross_jacket', bottom: 'pleated_skirt' } });
  if (sample === 'ceremony') r = cleanRecipe({ ...r, slots: { ...r.slots, top: 'ceremony_robe', bottom: 'robe_skirt' } });
  return r;
}
function bounds(c: Cage): number[] {
  const ps = c.vertices.filter(v => v.id.startsWith('TailoredPanel.')).map(v => v.p);
  assert(ps.length > 0);
  return [0, 1, 2].flatMap(i => [Math.min(...ps.map(p => p[i])), Math.max(...ps.map(p => p[i]))]);
}
function inspect(c: Cage, body: Cage): void {
  assertComponentWinding(c);
  assert(triCount(c) < 2600, '样板超过本批 2600 tris 预算');
  for (const region of ['pelvis', 'thigh', 'shin']) {
    assert.equal(c.faces.filter(f => f.region === region).length, body.faces.filter(f => f.region === region).length, `不可为消除穿模而删除 ${region} 内衬`);
  }
  for (const v of c.vertices) {
    assert(v.p.every(Number.isFinite));
    assert(v.w[2] >= 0 && v.w[2] <= 1);
    assert(v.w.slice(0, 2).every(i => Number.isInteger(i) && i >= 0 && i < 20));
  }
  // 前后开口不横跨中线，避免两块裙片静态共面/交叠；内层裤装完整保留。
  for (const side of ['Right', 'Left']) {
    const vs = c.vertices.filter(v => v.id.startsWith(`TailoredPanel.${side}.`));
    assert(vs.length > 0);
    assert(vs.every(v => side === 'Right' ? v.p[0] > 0 : v.p[0] < 0), '开衩被错误焊接或跨中线');
  }
}

// 三角形诊断是离线测试，不加入浏览器动画循环。
interface IndexedTri { ids: [number, number, number]; group: string }
interface Tri { ids: [number, number, number]; p: [Vec3, Vec3, Vec3]; lo: Vec3; hi: Vec3 }
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function segmentPierces(a: Vec3, b: Vec3, tri: [Vec3, Vec3, Vec3]): boolean {
  const e1 = sub(tri[1], tri[0]), e2 = sub(tri[2], tri[0]), d = sub(b, a), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-11) return false;
  const s = sub(a, tri[0]), inv = 1 / det, u = inv * dot(s, h);
  if (u <= 1e-6 || u >= 1 - 1e-6) return false;
  const q = cross(s, e1), v = inv * dot(d, q), t = inv * dot(e2, q);
  return v > 1e-6 && u + v < 1 - 1e-6 && t > 1e-6 && t < 1 - 1e-6;
}
assert(segmentPierces([.2, .2, -1], [.2, .2, 1], [[0, 0, 0], [1, 0, 0], [0, 1, 0]]));
assert(!segmentPierces([2, 2, -1], [2, 2, 1], [[0, 0, 0], [1, 0, 0], [0, 1, 0]]));
function intersects(a: Tri, b: Tri): boolean {
  for (let axis = 0; axis < 3; axis++) if (a.hi[axis] < b.lo[axis] || b.hi[axis] < a.lo[axis]) return false;
  for (let i = 0; i < 3; i++) if (segmentPierces(a.p[i], a.p[(i + 1) % 3], b.p) || segmentPierces(b.p[i], b.p[(i + 1) % 3], a.p)) return true;
  return false;
}
function triangles(c: Cage): IndexedTri[] {
  const result: IndexedTri[] = [];
  for (const f of c.faces) {
    let group = '';
    if (['pelvis', 'thigh', 'shin'].includes(f.region)) group = 'liner';
    for (const side of ['Right', 'Left']) if (f.v.every(i => c.vertices[i].id.startsWith(`TailoredPanel.${side}.0.`))) group = side;
    if (!group) continue;
    for (let k = 1; k < f.v.length - 1; k++) result.push({ ids: [f.v[0], f.v[k], f.v[k + 1]], group });
  }
  return result;
}
function posedTriangle(t: IndexedTri, points: Vec3[]): Tri {
  const p = t.ids.map(i => points[i]) as [Vec3, Vec3, Vec3];
  return { ids: t.ids, p, lo: [0, 1, 2].map(a => Math.min(p[0][a], p[1][a], p[2][a])) as Vec3,
    hi: [0, 1, 2].map(a => Math.max(p[0][a], p[1][a], p[2][a])) as Vec3 };
}
function skinPoints(c: Cage, matrices: Float32Array): Vec3[] {
  return c.vertices.map(v => {
    const p: Vec3 = [0, 0, 0];
    for (const [bone, w] of [[v.w[0], v.w[2]], [v.w[1], 1 - v.w[2]]]) {
      const k = bone * 16;
      for (let a = 0; a < 3; a++) p[a] += w * (matrices[k + a] * v.p[0] + matrices[k + 4 + a] * v.p[1] + matrices[k + 8 + a] * v.p[2] + matrices[k + 12 + a]);
    }
    assert(p.every(Number.isFinite));
    return p;
  });
}
try {
  for (const sample of samples) for (const bodyType of ['male', 'female'] as const) for (const [height, build] of profiles) {
    const recipe = recipeFor(sample, bodyType, height, build), saved = JSON.stringify(recipe);
    const high = makeCharacter(recipe, { lod: 0 }), low = makeCharacter(recipe, { lod: 2 });
    assert.deepEqual(high.body, low.body); assert.deepEqual(high.joints, low.joints);
    assert.deepEqual(high.recipe, low.recipe); assert.equal(high.joints.length, 20);
    assert(triCount(low.surface) < triCount(high.surface), 'LOD2 必须真正减面');
    const a = bounds(high.surface), b = bounds(low.surface), maxBoundError = Math.max(...a.map((x, i) => Math.abs(x - b[i])));
    assert(maxBoundError < .012 * height / 1.76, 'LOD 改变衣长或主要轮廓');
    for (const [lod, data] of [[0, high], [2, low]] as const) {
      inspect(data.surface, data.body);
      staticRows.push({ sample, bodyType, height, build, lod, triangles: triCount(data.surface), maxBoundError });
      if (staticOnly) continue;
      const actor = makeActor(data), indexed = triangles(data.surface);
      try {
        actor.update(0); actor.mesh.skeleton.update();
        const atBind = skinPoints(data.surface, actor.mesh.skeleton.boneMatrices);
        assert(Math.max(...atBind.map((p, i) => Math.hypot(...sub(p, data.surface.vertices[i].p)))) < 1e-5, 'CPU 诊断蒙皮未还原绑定姿态');
        for (const id of (height === 1.76 ? clips : ['pilot-switches'] as const)) {
          const source = JSON.parse(readFileSync(`public/mixamo/${id}.json`, 'utf8')) as MixamoMotionData;
          const bake = retargetMixamo(data, source), action = actor.mixer.clipAction(bake.clip);
          actor.resetBindPose(); action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play(); action.paused = true;
          const indices = [...new Set(Array.from({ length: 25 }, (_, i) => Math.round((source.times.length - 1) * i / 24)))];
          let piercedFrames = 0, maxLinerPairs = 0, maxPanelPairs = 0;
          for (const frame of indices) {
            action.time = source.times[frame]; actor.update(0); actor.mesh.skeleton.update();
            const points = skinPoints(data.surface, actor.mesh.skeleton.boneMatrices);
            checkedFrames++; checkedVertices += points.length;
            const liner = indexed.filter(t => t.group === 'liner').map(t => posedTriangle(t, points));
            const right = indexed.filter(t => t.group === 'Right').map(t => posedTriangle(t, points));
            const left = indexed.filter(t => t.group === 'Left').map(t => posedTriangle(t, points));
            let linerPairs = 0, panelPairs = 0;
            const witnesses: object[] = [];
            for (const t of [...right, ...left]) for (const inner of liner) if (intersects(t, inner)) {
              linerPairs++;
              if (witnesses.length < 3) witnesses.push({ cloth: t.ids.map(i => data.surface.vertices[i].id), liner: inner.ids.map(i => data.surface.vertices[i].id) });
            }
            for (const t of right) for (const other of left) if (intersects(t, other)) panelPairs++;
            maxLinerPairs = Math.max(maxLinerPairs, linerPairs); maxPanelPairs = Math.max(maxPanelPairs, panelPairs);
            if (linerPairs || panelPairs) {
              piercedFrames++;
              if (failures.length < 40) failures.push({ sample, bodyType, height, build, lod, id, time: source.times[frame], frame, linerPairs, panelPairs, witnesses });
            }
          }
          motionRows.push({ sample, bodyType, height, build, lod, id, sampledFrames: indices.length, piercedFrames, maxLinerPairs, maxPanelPairs });
          action.stop(); actor.mixer.uncacheClip(bake.clip);
        }
      } finally { actor.dispose(); }
    }
    assert.equal(JSON.stringify(recipe), saved, '试衣修改了玩家配方');
  }
  console.log(JSON.stringify({ staticVariants: staticRows.length, checkedFrames, failures: failures.length, staticOnly }));
  assert.equal(failures.length, 0, '常用试衣动作检测到分裳/内衬穿插；查看 numeric.json 的具体时间和顶点');
} finally {
  const report = { sourceSha: process.env.REVIEW_HEAD_SHA ?? 'local', testedSha: process.env.GITHUB_SHA ?? 'local', geometryVersion: GARMENT_GEOMETRY_VERSION, bodyHideVersion: BODY_HIDE_VERSION,
    staticOnly, staticVariants: staticRows.length, checkedFrames, checkedVertices, staticRows, motionRows, failures,
    passed: staticRows.length === 36 && !failures.length && (staticOnly || checkedFrames > 0),
    scope: '离线非共面三角形贯穿抽样：衣片外表面与连续内衬、左右衣片。不涵盖共面接触、全部自碰撞、手/身体/道具或连续时间碰撞；仍需实际截图和视频审查。LOD2 保留原 510 tris 身体，不是最终 Crowd LOD。' };
  writeFileSync(`${directory}/numeric.json`, JSON.stringify(report, null, 2));
}
