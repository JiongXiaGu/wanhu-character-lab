import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Color, FrontSide, Matrix4, Ray, Vector3 } from 'three';
import { CAT_DEFINITION as definition } from '../src/cat/definition';
import { CAT_BONES as B, CAT_JOINTS, CAT_LEGS } from '../src/cat/rig';
import { createAnimalActor } from '../src/livestock/actor';
import { createPoseCache, POSE_FPS } from '../src/livestock/pose-cache';
import { createCrowd, makePlacements, PHASE_COHORTS } from '../src/livestock/crowd';
import { resolveHabitat } from '../src/livestock/habitat';
import { livestockDefinition } from '../src/livestock/catalog';
import { CROWD_COUNTS } from '../src/livestock/types';
import type { AnimalMeshData, LivestockLodDefinition } from '../src/livestock/types';
import { assertClosedSkinnedMesh, readSkinnedPoints } from './check-livestock-mesh-shared';

function topology(data: AnimalMeshData): void {
  const visited = new Set<number>();
  for (const part of data.parts) {
    const end = part.start + part.count, edges = new Map<string, number>(), directions = new Map<string, number>(), neighbors = new Map<number, Set<number>>();
    let faces = 0, volume = 0;
    for (let i = 0; i < data.indices.length; i += 3) {
      const ids = data.indices.slice(i, i + 3); if (ids[0] < part.start || ids[0] >= end) continue;
      assert(ids.every(id => id >= part.start && id < end)); faces++;
      const [a, b, c] = ids.map(id => new Vector3(...data.positions[id]));
      assert([...a, ...b, ...c].every(Number.isFinite), '非有限作者点');
      assert(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-12, `${part.name}退化作者面`);
      volume += a.dot(b.clone().cross(c)) / 6;
      for (let j = 0; j < 3; j++) {
        const a = ids[j], b = ids[(j + 1) % 3], key = `${Math.min(a, b)}/${Math.max(a, b)}`;
        edges.set(key, (edges.get(key) ?? 0) + 1); directions.set(key, (directions.get(key) ?? 0) + (a < b ? 1 : -1));
        if (!neighbors.has(a)) neighbors.set(a, new Set()); if (!neighbors.has(b)) neighbors.set(b, new Set());
        neighbors.get(a)!.add(b); neighbors.get(b)!.add(a);
      }
    }
    assert([...edges.values()].every(n => n === 2), `${part.name}开放或非流形边`);
    assert([...directions.values()].every(n => n === 0) && volume > 1e-9, `${part.name}绕序错误`);
    assert.equal(part.count - edges.size + faces, 2);
    const connected = new Set([part.start]), pending = [part.start];
    while (pending.length) for (const next of neighbors.get(pending.pop()!) ?? []) if (!connected.has(next)) { connected.add(next); pending.push(next); }
    assert.equal(connected.size, part.count, `${part.name}不是单个连通壳`);
    for (const id of connected) { assert(!visited.has(id)); visited.add(id); }
  }
  assert.equal(visited.size, data.positions.length, '隐藏孤立点');
}
function weights(data: AnimalMeshData): void {
  assert(data.bones.every(b => Number.isInteger(b) && b >= 0 && b < 9));
  for (let i = 0; i < data.parts[0].count; i++) {
    const z = data.positions[i][2]; assert.equal(data.bones[i], z < .12 ? B.Body : z < .16 ? B.Neck : B.Head, '主壳真实权重');
  }
  for (const part of data.parts.slice(1)) {
    const bone = part.name === 'Tail' ? B.Tail : part.name.includes('Leg') ? CAT_JOINTS.findIndex(j => j.name === part.name) : B.Head;
    for (let i = part.start; i < part.start + part.count; i++) assert.equal(data.bones[i], bone, `${part.name}绑定错误`);
  }
}
function landmarks(data: AnimalMeshData): void {
  const span = (points: readonly (readonly number[])[], axis: number) => Math.max(...points.map(p => p[axis])) - Math.min(...points.map(p => p[axis]));
  const main = data.positions.slice(0, data.parts[0].count), head = main.filter((_, i) => data.bones[i] === B.Head), body = main.filter((_, i) => data.bones[i] === B.Body);
  assert.equal(data.parts[0].name, 'BodyNeckHeadMuzzle');
  assert(span(head, 0) > .18 && span(head, 0) < .21, '圆颊而非犬的长头');
  assert(Math.max(...head.map(p => p[2])) < .37 && span(head, 2) < .19, '短口鼻边界');
  assert(span(body, 0) > .20 && span(body, 0) < .23 && Math.min(...body.map(p => p[1])) > .17, '完整猫腿与胸腹留空');
  for (const part of data.parts.slice(1)) {
    const points = data.positions.slice(part.start, part.start + part.count);
    if (part.name.includes('Leg')) assert(span(points, 1) > .29 && span(points, 0) > .048 && points.filter(p => p[1] < .01).length >= 3, '不能降成短腿或针尖猫足');
    if (part.name === 'Tail') assert(span(points, 1) > .20 && span(points, 2) > .07 && Math.max(...points.map(p => p[1])) > .52, '三档保留长弯尾');
    if (part.name.startsWith('Ear')) assert(Math.max(...points.map(p => p[1])) > .49 && Math.max(...points.map(p => p[1])) < .51, '猫耳剪影');
    if (part.name.startsWith('Eye')) assert(data.colors.slice(part.start, part.start + part.count).every(c => new Color(c).getHSL({ h: 0, s: 0, l: 0 }).l < .1), '不用白眼圈');
  }
}
function validate(data: AnimalMeshData, lod: LivestockLodDefinition): void {
  assert.equal(data.positions.length, lod.logicalVertices); assert.equal(data.indices.length, lod.triangles * 3);
  assert.equal(data.colors.length, data.positions.length); assert.equal(data.bones.length, data.positions.length);
  assert(data.indices.every(i => Number.isInteger(i) && i >= 0 && i < data.positions.length));
  topology(data); weights(data); landmarks(data);
}
function faceAttachments(data: AnimalMeshData, points: Vector3[]): void {
  const logical: Vector3[] = []; data.indices.forEach((id, i) => { logical[id] = points[i]; });
  const faces = Array.from({ length: data.indices.length / 3 }, (_, i) => data.indices.slice(i * 3, i * 3 + 3)).filter(ids => ids[0] < data.parts[0].count);
  for (const part of data.parts.filter(p => p.name.startsWith('Eye') || p.name.startsWith('Ear'))) {
    const ids = part.name.startsWith('Eye') ? [part.start] : part.count === 6 ? [part.start + 3, part.start + 4] : [part.start, part.start + 1, part.start + 2];
    const root = ids.reduce((sum, id) => sum.add(logical[id]), new Vector3()).divideScalar(ids.length);
    const ray = new Ray(root, new Vector3(.923, .181, .339).normalize()), hit = new Vector3(); let count = 0;
    for (const f of faces) if (ray.intersectTriangle(logical[f[0]], logical[f[1]], logical[f[2]], false, hit) && hit.distanceTo(root) > 1e-8) count++;
    assert(count % 2 === 1, `${part.name}根部离体`);
  }
}
assert.equal(livestockDefinition(definition.id), definition);
assert.deepEqual(CAT_JOINTS.map(j => j.parent), [-1, 0, 1, 2, 1, 0, 0, 0, 0]);
assert.deepEqual(definition.motions.map(m => m.id), ['idle', 'walk', 'run', 'sniff', 'groom', 'sleep']);
assert.deepEqual(definition.habitats.map(h => h.id), ['land']);
assert.deepEqual(definition.habitats[0].mixed.map(m => [m.motion, m.weight]), [['idle', .35], ['walk', .25], ['sniff', .20], ['groom', .20]]);
assert.equal(resolveHabitat(definition, 'water', 'swim').motion, 'idle');
const reports: { poses: number; faults: number; [key: string]: unknown }[] = [];
for (const lod of definition.lods) {
  const actor = createAnimalActor(definition, lod.id), data = actor.data; validate(data, lod);
  assert.equal(actor.bones.length, 9); assert.equal(actor.material.side, FrontSide); assert.equal(actor.material.transparent, false); assert.equal(actor.geometry.groups.length, 0);
  const source = actor.geometry.getAttribute('position'); assert.equal(source.count, lod.triangles * 3);
  const inverseBind = () => {
    actor.bind(); actor.skeleton.boneInverses.forEach((matrix, i) => {
      const expected = new Matrix4().makeTranslation(...CAT_JOINTS[i].position).invert();
      matrix.elements.forEach((n, j) => assert(Math.abs(n - expected.elements[j]) < 1e-6, '错误inverse bind'));
    });
    readSkinnedPoints(actor).forEach((p, i) => assert(p.distanceTo(new Vector3(...data.positions[data.indices[i]])) < 1e-6, 'bind改变了原网格'));
  };
  inverseBind(); const bind = readSkinnedPoints(actor);
  const sample = (motion: string, phase: number) => { actor.sample(motion, phase); return readSkinnedPoints(actor); };
  const soles = CAT_LEGS.map(bone => data.indices.map((id, i) => data.bones[id] === bone && data.positions[id][1] < .01 ? i : -1).filter(i => i >= 0));
  const nose = data.indices.map((id, i) => id < data.parts[0].count && data.positions[id][2] > .34 ? i : -1).filter(i => i >= 0);
  const validatePose = (points: Vector3[]) => {
    assert(points.every(p => p.toArray().every(Number.isFinite)), '非有限Pose');
    assert(Math.min(...points.map(p => p.y)) >= -.002, `穿地：${Math.min(...points.map(p => p.y))}`);
    assert(points.every(p => p.length() < 1), '异常拉伸或离体');
    assertClosedSkinnedMesh(actor, points, bind); faceAttachments(data, points);
  };
  let poses = 0, minGround = Infinity, maxRadius = 0, minSniffNose = Infinity;
  for (const motion of definition.motions) {
    const first = sample(motion.id, 0), last = sample(motion.id, 1);
    first.forEach((p, i) => assert(p.distanceTo(last[i]) < 1e-5, `${motion.id}循环接缝`));
    for (let frame = 0; frame <= 240; frame++) {
      const points = sample(motion.id, frame / 240); poses++;
      try { validatePose(points); } catch (error) { throw new Error(`${lod.id}/${motion.id}/${frame}: ${error}`); }
      minGround = Math.min(minGround, ...points.map(p => p.y)); maxRadius = Math.max(maxRadius, ...points.map(p => Math.hypot(p.x, p.z)));
      if (motion.id === 'sniff') minSniffNose = Math.min(minSniffNose, ...nose.map(i => points[i].y));
    }
  }
  assert(minSniffNose >= .001 && minSniffNose < .12, `${lod.id}闻地鼻端：${minSniffNose}`);
  function forwardGait(sampler = sample): void {
    for (const motion of ['walk', 'run']) {
      const running = motion === 'run', stance = running ? .54 : .66, phases = running ? [0, .08, .48, .56] : [0, .5, .75, .25];
      for (let leg = 0; leg < 4; leg++) {
        const phase = (t: number) => (t - phases[leg] + 1) % 1;
        const a = sampler(motion, phase(.08 * stance)), b = sampler(motion, phase(.85 * stance));
        const z = (points: Vector3[]) => soles[leg].reduce((sum, i) => sum + points[i].z, 0) / soles[leg].length;
        assert(z(a) - z(b) > (running ? .08 : .04), '支撑脚没有向-Z后扫');
        for (const points of [a, b]) assert(Math.abs(Math.min(...soles[leg].map(i => points[i].y)) - .006) < .001, '支撑足不接地');
        const swing = sampler(motion, phase(stance + (1 - stance) / 2)); assert(Math.min(...soles[leg].map(i => swing[i].y)) > .020, '摆动足未抬起');
      }
    }
  }
  forwardGait();
  const groom = sample('groom', .5);
  assert(Math.min(...soles[0].map(i => groom[i].y)) > .10, '理毛必须抬起前足');
  for (const sole of soles.slice(1)) assert(Math.abs(Math.min(...sole.map(i => groom[i].y)) - .006) < .001, '理毛支撑脚稳定');
  const cache = createPoseCache(definition, lod.id), cachedPoses = cache.size;
  for (const motion of definition.motions) for (const phase of [0, .5, 1]) {
    const frames = Math.max(2, Math.ceil(motion.duration * POSE_FPS)), actual = cache.get(motion.id, phase).getAttribute('position');
    const expected = sample(motion.id, Math.round(phase * frames) / frames);
    expected.forEach((p, i) => assert(p.distanceTo(new Vector3().fromBufferAttribute(actual, i)) < 1e-6, '缓存与精确蒙皮不一致'));
  }
  assert.equal(cache.size, cachedPoses); cache.dispose(); cache.dispose();
  const crowd = createCrowd(definition, actor.material); let minSpacing = Infinity;
  for (const count of CROWD_COUNTS) {
    crowd.setLayout(count, 731); assert.deepEqual(crowd.placements, makePlacements(count, 731, definition.previewSpacing));
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) minSpacing = Math.min(minSpacing, Math.hypot(crowd.placements[i].x - crowd.placements[j].x, crowd.placements[i].z - crowd.placements[j].z));
    for (const motion of definition.motions) for (const mixed of [false, true]) {
      crowd.update(.37, { motion: motion.id, surface: 'land', mixed, loop: true }, lod.id);
      assert.equal(crowd.group.children.reduce((sum, mesh) => sum + (mesh as any).count, 0), count);
      assert(crowd.batchCount > 0 && crowd.batchCount <= (mixed ? 4 : 1) * PHASE_COHORTS);
      if (mixed) assert(crowd.group.children.filter(m => m.visible).every(m => !m.name.includes('/run/') && !m.name.includes('/sleep/')));
    }
  }
  assert(minSpacing > 2 * (maxRadius * 1.06 + .15), '预览格距不足');
  const warm = crowd.cachedPoses;
  for (let i = 0; i < 40; i++) crowd.update(i / 7, { motion: 'groom', surface: 'land', mixed: true, loop: true }, lod.id);
  assert.equal(crowd.cachedPoses, warm); crowd.dispose(); crowd.dispose();
  let faults = 0; const fails = (fn: () => void) => { assert.throws(fn); faults++; };
  for (const bone of [B.FrontLegL, B.Head, B.Tail]) {
    const broken = structuredClone(data); broken.bones = broken.bones.map(b => b === bone ? B.Root : b); fails(() => weights(broken));
  }
  for (const kind of ['inverted', 'open', 'degenerate', 'nan']) {
    const broken = structuredClone(data);
    if (kind === 'inverted') [broken.indices[0], broken.indices[1]] = [broken.indices[1], broken.indices[0]];
    if (kind === 'open') broken.indices.splice(0, 3);
    if (kind === 'degenerate') broken.positions[broken.indices[1]] = broken.positions[broken.indices[0]];
    if (kind === 'nan') broken.positions[0] = [NaN, 0, 0];
    fails(() => topology(broken));
  }
  for (const bone of [B.Head, B.Tail, B.FrontLegL]) {
    actor.sample('sleep', .5); actor.bones[bone].position.x += .8; fails(() => validatePose(readSkinnedPoints(actor))); actor.bind();
  }
  actor.sample('sleep', .5); actor.bones[B.Head].position.y = NaN; fails(() => validatePose(readSkinnedPoints(actor))); actor.bind();
  const inverse = actor.skeleton.boneInverses[B.Head].clone(); actor.skeleton.boneInverses[B.Head].elements[12] += .2;
  fails(inverseBind); actor.skeleton.boneInverses[B.Head].copy(inverse); inverseBind();
  const skin = actor.geometry.getAttribute('skinIndex'), originalSkin = Array.from(skin.array);
  skin.setX(data.indices.findIndex(id => data.bones[id] === B.Tail), B.Head); fails(() => validatePose(sample('sleep', .5)));
  originalSkin.forEach((n, i) => { skin.array[i] = n; });
  fails(() => forwardGait((motion, phase) => sample(motion, 1 - phase)));
  const shortTail = structuredClone(data), tail = shortTail.parts.find(p => p.name === 'Tail')!;
  for (let i = tail.start; i < tail.start + tail.count; i++) { const [x, y, z] = shortTail.positions[i]; shortTail.positions[i] = [x, .32 + (y - .32) * .2, z]; }
  fails(() => landmarks(shortTail));
  validatePose(sample('idle', .5)); actor.dispose(); actor.dispose();
  assert.equal(poses, 6 * 241);
  reports.push({ lod: lod.id, triangles: lod.triangles, logicalVertices: lod.logicalVertices, closedShells: data.parts.length, poses, faults, minGround, minSniffNose, maxRadius, minSpacing, cachedPoses });
}
const dir = process.env.LIVESTOCK_CHECK_DIR ?? '/tmp/wanhu-livestock-checks'; mkdirSync(dir, { recursive: true });
const report = { result: 'passed', sourceSHA: process.env.REVIEW_HEAD_SHA ?? 'local', animal: definition.id, bones: 9, totalPoses: reports.reduce((sum, r) => sum + r.poses, 0), totalFaultInjections: reports.reduce((sum, r) => sum + r.faults, 0), counts: CROWD_COUNTS, reports };
writeFileSync(`${dir}/cat-numeric.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
