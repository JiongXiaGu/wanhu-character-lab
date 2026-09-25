import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { LIVESTOCK } from '../src/livestock/catalog';
import { createAnimalActor } from '../src/livestock/actor';
import { createPoseCache, POSE_FPS } from '../src/livestock/pose-cache';
import { createCrowd, PHASE_COHORTS } from '../src/livestock/crowd';
import { resolveHabitat } from '../src/livestock/habitat';
import { CROWD_COUNTS } from '../src/livestock/types';
import { readSkinnedPoints as readPoints, assertClosedSkinnedMesh as closedSleepMesh } from './check-livestock-mesh-shared';

const specs = [
  { id: 'chicken_brown', bones: 8, drop: .118, headDrop: .12, headReach: .30 },
  { id: 'duck_domestic_brown', bones: 8, drop: .087, headDrop: .10, headReach: .32 },
  { id: 'goose_domestic_white', bones: 7, drop: .115, headDrop: .30, headReach: .40 },
  { id: 'pig_domestic_black', bones: 9, drop: .118, headDrop: .12, headReach: .64 },
  { id: 'dog_rural_yellow', bones: 9, drop: .284, headDrop: .40, headReach: .60 },
  { id: 'cat_rural_orange', bones: 9, drop: .130, headDrop: .14, headReach: .40 },
] as const;
const mean = (points: Vector3[], indices: number[]) => indices.reduce((sum, i) => sum.add(points[i]), new Vector3()).divideScalar(indices.length);
const reports: object[] = [];
let totalPoses = 0, totalFaults = 0;
for (const spec of specs) {
  const definition = LIVESTOCK.find(d => d.id === spec.id)!;
  const sleep = definition.motions.find(m => m.id === 'sleep')!;
  assert(sleep); assert.equal(sleep.surface, 'land'); assert.equal(sleep.duration, 3);
  assert(definition.habitats.every(h => h.mixed.every(m => m.motion !== 'sleep')), '睡眠不进入日常活动池');
  assert.equal(resolveHabitat(definition, 'land', 'sleep').motion, 'sleep');
  if (definition.habitats.some(h => h.id === 'water')) assert.equal(resolveHabitat(definition, 'water', 'sleep').motion, 'idle_water');
  const clips = definition.bakeClips(), clip = clips.get('sleep')!;
  assert.equal(clip.tracks.length, spec.bones * 2, '只烘焙现有骨骼的位置与旋转');
  assert(!clip.tracks.some(t => t.name.endsWith('.scale')), '不得缩腿或压扁网格伪装卧伏');
  for (const lod of definition.lods) {
    const actor = createAnimalActor(definition, lod.id), data = actor.data;
    assert.equal(actor.bones.length, spec.bones);
    const index = (name: string) => definition.joints.findIndex(j => j.name === name);
    const body = index('Body'), head = index('Head'), root = index('Root');
    const legs = (spec.bones === 9 ? ['FrontLegL', 'FrontLegR', 'RearLegL', 'RearLegR'] : ['LegL', 'LegR']).map(index);
    const headIds = data.indices.map((id, i) => data.bones[id] === head ? i : -1).filter(i => i >= 0);
    const soles = legs.map(b => data.indices.map((id, i) => data.bones[id] === b && data.positions[id][1] < .01 ? i : -1).filter(i => i >= 0));
    assert(soles.every(ids => ids.length > 0));
    actor.bind(); const bindPoints = readPoints(actor), bindHead = mean(bindPoints, headIds);
    const validateBind = () => {
      actor.bind();
      readPoints(actor).forEach((p, i) => assert(p.distanceTo(new Vector3(...data.positions[data.indices[i]])) < 1e-6, '真实inverse bind必须保持原网格'));
    };
    validateBind();
    const validateRest = () => {
      const points = readPoints(actor), headCenter = mean(points, headIds);
      assert(points.every(p => p.toArray().every(Number.isFinite) && p.y >= -.002), '睡眠全身不穿地');
      assert(actor.bones[root].position.length() < 1e-8, '原地睡眠不能有Root位移');
      assert(Math.abs(actor.bones[root].quaternion.w - 1) < 1e-8, '睡眠Root不翻转');
      for (const bone of actor.bones) assert(bone.scale.distanceTo(new Vector3(1, 1, 1)) < 1e-8, '骨骼不缩放');
      const drop = definition.joints[body].position[1] - actor.bones[body].position.y;
      assert(drop >= spec.drop - .004 && drop <= spec.drop + .001, '必须保持低伏，不是站立idle或悬浮');
      assert(bindHead.y - headCenter.y > spec.headDrop, '睡眠头部必须收低');
      const bodyPosition = actor.bones[body].getWorldPosition(new Vector3());
      assert(headCenter.distanceTo(bodyPosition) < spec.headReach, '头颈不能脱离身体');
      assert(Math.min(...points.map(p => p.y)) <= .04, '卧伏的支撑面不能悬空');
      for (const ids of soles) {
        const y = Math.min(...ids.map(i => points[i].y));
        assert(y >= .003 && y <= .008, `${spec.id}/${lod.id}折收足底仍须接地：${y}`);
      }
      for (let i = 0; i < points.length; i += 3) {
        const area = points[i + 1].clone().sub(points[i]).cross(points[i + 2].clone().sub(points[i])).length();
        assert(area > 1e-8, '睡姿不能压成退化面');
      }
      if (spec.bones === 9) closedSleepMesh(actor, points, bindPoints);
      return points;
    };
    actor.sample('sleep', 0); const first = validateRest(), firstFeet = soles.flat().map(i => first[i].clone());
    let minY = Infinity, maxBreath = 0;
    for (let frame = 0; frame <= 240; frame++) {
      actor.sample('sleep', frame / 240); const points = validateRest(); totalPoses++;
      points.forEach((p, i) => { minY = Math.min(minY, p.y); maxBreath = Math.max(maxBreath, p.distanceTo(first[i])); });
      soles.flat().forEach((id, i) => assert(points[id].distanceTo(firstFeet[i]) < 1e-7, '呼吸不应推动脚底滑行'));
      if (frame === 240) points.forEach((p, i) => assert(p.distanceTo(first[i]) < 1e-6, '卧姿呼吸循环首尾连续'));
    }
    assert(maxBreath > .001 && maxBreath < .009, '只有毫米级呼吸，不可用静止idle或大幅起落替代');
    const cache = createPoseCache(definition, lod.id), size = cache.size, frames = Math.ceil(sleep.duration * POSE_FPS);
    for (let f = 0; f <= frames; f++) {
      actor.sample('sleep', f / frames); const expected = readPoints(actor), actual = cache.get('sleep', f / frames).getAttribute('position');
      expected.forEach((p, i) => assert(p.distanceTo(new Vector3().fromBufferAttribute(actual, i)) < 1e-6, '真实骨骼与群体睡姿缓存一致'));
    }
    assert.equal(cache.size, size); cache.dispose(); cache.dispose();
    const crowd = createCrowd(definition, actor.material);
    const matrices = () => crowd.group.children.filter(m => m.visible).flatMap(object => {
      const m = object as InstancedMesh;
      return Array.from({ length: m.count }, (_, i) => { const v = new Matrix4(); m.getMatrixAt(i, v); return { batch: m.name, matrix: v.toArray() }; });
    });
    for (const count of CROWD_COUNTS) {
      crowd.setLayout(count, 824);
      crowd.update(0, { motion: 'sleep', surface: 'land', mixed: false, loop: true }, lod.id); const before = matrices();
      const cached = crowd.cachedPoses;
      crowd.update(1.5, { motion: 'sleep', surface: 'land', mixed: false, loop: true }, lod.id);
      assert.equal(before.length, count); assert.deepEqual(matrices(), before, '睡眠群体不应产生移动轨迹');
      assert(crowd.batchCount > 0 && crowd.batchCount <= PHASE_COHORTS); assert.equal(crowd.cachedPoses, cached);
      assert(crowd.group.children.filter(m => m.visible).every(m => m.name.includes('/sleep/')));
    }
    crowd.dispose(); crowd.dispose();
    let faults = 0;
    const reject = (mutate: () => void, validate = validateRest) => {
      actor.bind(); actor.sample('sleep', .5); mutate(); assert.throws(validate); faults++;
    };
    reject(() => actor.sample(definition.habitats[0].defaultMotion, .5));
    reject(() => { actor.bones[body].position.y += .15; });
    reject(() => { actor.bones[body].position.y -= .20; });
    reject(() => { actor.bones[legs[0]].position.y -= .12; });
    reject(() => { actor.bones[head].position.z += .6; });
    reject(() => { actor.bones[root].position.x += .12; });
    reject(() => { actor.bones[head].scale.setScalar(0); });
    actor.bones[head].scale.setScalar(1);
    const skin = actor.geometry.getAttribute('skinIndex'), saved = Array.from(skin.array);
    reject(() => {
      data.indices.forEach((id, i) => { if (data.bones[id] === legs[0]) skin.setX(i, head); });
    });
    saved.forEach((v, i) => { skin.array[i] = v; });
    const inverse = actor.skeleton.boneInverses[head].clone();
    actor.bind(); actor.skeleton.boneInverses[head].premultiply(new Matrix4().makeTranslation(.3, 0, 0));
    assert.throws(() => readPoints(actor).forEach((p, i) => assert(p.distanceTo(new Vector3(...data.positions[data.indices[i]])) < 1e-6, '错误inverse bind改变实际蒙皮'))); faults++;
    actor.skeleton.boneInverses[head].copy(inverse);
    const faultKinds = ['standing-substitute', 'floating-body', 'body-underground', 'leg-underground', 'head-detached', 'root-drift', 'bone-scale', 'leg-misbound', 'inverse-bind'];
    if (spec.bones === 9) {
      reject(() => { actor.bones[head].position.y = NaN; }); faultKinds.push('non-finite-sleep-pose');
      reject(() => { data.indices.forEach((id, i) => { if (data.bones[id] === head) skin.setX(i, body); }); });
      saved.forEach((v, i) => { skin.array[i] = v; }); faultKinds.push('head-misbound');
      reject(() => { actor.bones[index('Tail')].position.x += .8; }); faultKinds.push('tail-detached');
      const position = actor.geometry.getAttribute('position'), original = Array.from(position.array);
      const restorePosition = () => original.forEach((v, i) => { position.array[i] = v; });
      // 修改真正送往WebGL的非索引顶点和drawRange；不是只修改作者预算或动作名称。
      reject(() => { const b = new Vector3().fromBufferAttribute(position, 1), c = new Vector3().fromBufferAttribute(position, 2); position.setXYZ(1, c.x, c.y, c.z); position.setXYZ(2, b.x, b.y, b.z); });
      restorePosition(); faultKinds.push('inverted-render-triangle');
      reject(() => { position.setXYZ(1, position.getX(0), position.getY(0), position.getZ(0)); });
      restorePosition(); faultKinds.push('degenerate-render-triangle');
      reject(() => { actor.geometry.setDrawRange(3, position.count - 3); });
      actor.geometry.setDrawRange(0, Infinity); faultKinds.push('open-render-edge');
      actor.sample('sleep', .5); validateRest(); // 故障恢复后必须重新通过，防止相邻反例污染。
    }
    assert.equal(faults, faultKinds.length);
    totalFaults += faults;
    reports.push({ animal: definition.id, lod: lod.id, bones: spec.bones, triangles: lod.triangles, logicalVertices: lod.logicalVertices, poses: 241, cacheFrames: frames + 1, minY, maxBreath, faults, faultKinds });
    actor.dispose(); actor.dispose();
  }
}
assert.deepEqual(specs.map(s => s.id), LIVESTOCK.map(d => d.id), '正式目录不得遗漏睡眠专项');
assert.equal(totalPoses, 6 * 3 * 241, '六种家畜全部三档睡眠矩阵');
const dir = process.env.LIVESTOCK_CHECK_DIR ?? '/tmp/wanhu-livestock-checks'; mkdirSync(dir, { recursive: true });
const report = { result: 'passed', sourceSHA: process.env.REVIEW_HEAD_SHA ?? 'local', totalPoses, totalFaults, reports };
writeFileSync(`${dir}/livestock-sleep-numeric.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
