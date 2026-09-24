import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as T from 'three';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { B, BODY_TYPES, BACK_IDS, TOP_IDS, createRecipe, type Cage } from '../src/character/v3/types';
import { triCount, edgeKey, cross, sub } from '../src/character/v3/cage';
import { parseRecipeFile, SLOT_OPTIONS, randomizeCharacter } from '../src/character/wardrobe/catalog';
import { makeBackAccessory, AUTHORED_BACK_IDS } from '../src/character/wardrobe/assets/back-accessories';
import { makeBackHarness } from '../src/character/wardrobe/assets/back-harness';
import { assembleGarments } from '../src/character/wardrobe/assembly';
import { makeBody } from '../src/character/v3/body';
import { assertComponentWinding } from './check-components';
import { MOTION_CLIPS, motionAssetDirectory } from '../src/character/motion/catalog';
import { retargetMotion } from '../src/character/motion/retarget';

const output = process.env.BACK_CHECK_DIR || join(tmpdir(), 'wanhu-back-checks');
mkdirSync(output, { recursive: true });
const budgets = { bamboo_basket: 156, firewood_bundle: 176, book_case: 180 } as const;
const report = { sourceSHA: process.env.REVIEW_HEAD_SHA || 'local-working-tree', passed: false, staticCombinations: 0,
  motionRows: [] as { bodyType: string; back: string; id: string; samples: number; sampling: string }[],
  poses: 0, rendererVertices: 0, maxRigidError: 0, negativeCases: 0, budgets,
  scope: 'Closed topology, strict Recipe V5, all current tops, actual SkinnedMesh positions, Chest rigidity and inverse-bind stability. All source keys and midpoints for five key motions; nine phases for other current sources. Not an all-triangle collision proof or user visual approval.' };
function closed(c: Cage) {
  assert(c.vertices.length > 0 && c.faces.length > 0, 'missing accessory geometry');
  const edges = new Map<string, number>();
  for (const v of c.vertices) {
    assert(v.p.every(Number.isFinite) && v.w.every(Number.isFinite));
    assert(v.w[2] >= 0 && v.w[2] <= 1);
    assert(v.w.slice(0, 2).every(b => Number.isInteger(b) && b >= 0 && b < 20));
  }
  for (const f of c.faces) {
    assert(new Set(f.v).size === f.v.length);
    for (let i = 1; i < f.v.length - 1; i++) {
      const a = c.vertices[f.v[0]].p, b = c.vertices[f.v[i]].p, d = c.vertices[f.v[i + 1]].p;
      assert(Math.hypot(...cross(sub(b, a), sub(d, a))) > 1e-10, 'degenerate triangle');
    }
    f.v.forEach((a, i) => { const key = edgeKey(a, f.v[(i + 1) % f.v.length]); edges.set(key, (edges.get(key) || 0) + 1); });
  }
  assert([...edges.values()].every(count => count === 2), 'open/non-manifold accessory');
  assertComponentWinding(c);
}
function rigidBody(c: Cage) {
  closed(c);
  assert(c.vertices.every(v => v.w[0] === B.Chest && v.w[1] === B.Chest && v.w[2] === 1), 'back body must be Chest-rigid');
}
try {
  assert.deepEqual(SLOT_OPTIONS.back.map(x => x.id), [...BACK_IDS]);
  for (const bodyType of BODY_TYPES) for (const top of TOP_IDS) for (const back of AUTHORED_BACK_IDS) {
    const recipe = createRecipe({ bodyType, slots: { top, back } });
    assert.deepEqual(parseRecipeFile(JSON.stringify(recipe)), recipe);
    assert.equal(Object.keys(recipe.slots).length, 7); assert.equal(recipe.version, 5);
    const body = makeBackAccessory(recipe)!; rigidBody(body); assert.equal(triCount(body), budgets[back]);
    const harness = makeBackHarness(assembleGarments(makeBody(), recipe).surface, recipe)!;
    closed(harness); assert.equal(triCount(harness), 144);
    const data = makeCharacter(recipe), empty = makeCharacter(createRecipe({ ...recipe, slots: { ...recipe.slots, back: 'none' } }));
    assert.deepEqual(data.joints, empty.joints); assert.deepEqual(data.body, empty.body); assert.deepEqual(data.garments, empty.garments);
    assert.equal(triCount(data.surface) - triCount(empty.surface), budgets[back] + 144);
    assert(data.surface.vertices.filter(v => v.id.startsWith('Back.')).every(v => v.w[0] === B.Chest && v.w[2] === 1));
    assert(!empty.surface.vertices.some(v => /^Back[.H]/.test(v.id)));
    // 背部以外的作者点和衣面不因挂件改变，既有皮肤/服装预算保持。
    const before = new Map(empty.surface.vertices.map(v => [v.id, v]));
    for (const v of data.surface.vertices) if (before.has(v.id)) assert.deepEqual(v, before.get(v.id));
    report.staticCombinations++;
  }
  const base = createRecipe({ slots: { back: 'bamboo_basket' } });
  const broken = structuredClone(makeBackAccessory(base)!); broken.faces.pop(); assert.throws(() => closed(broken)); report.negativeCases++;
  const inward = structuredClone(makeBackAccessory(base)!); inward.faces[0].v.reverse(); assert.throws(() => closed(inward)); report.negativeCases++;
  const wrongBone = structuredClone(makeBackAccessory(base)!); wrongBone.vertices[0].w = [B.Head, B.Head, 1]; assert.throws(() => rigidBody(wrongBone)); report.negativeCases++;
  for (const value of [{ ...base, version: 4 }, { ...base, slots: { ...base.slots, back: 'unknown_back' } }, { ...base, extraSlot: 'bag' }]) {
    assert.throws(() => parseRecipeFile(JSON.stringify(value))); report.negativeCases++;
  }
  const seen = new Set<string>();
  for (let seed = 0; seed < 400; seed++) {
    const next = randomizeCharacter(base, seed); seen.add(next.slots.back);
    assert.deepEqual(randomizeCharacter(base, seed), next);
    assert.equal(randomizeCharacter(base, seed, ['back']).slots.back, base.slots.back);
  }
  assert(AUTHORED_BACK_IDS.every(id => seen.has(id)), 'random character must reach every new accessory');
  const dense = new Set(['jogging', 'pilot-switches', 'shooting-arrow', 'start-walking', 'snatch']);
  for (const bodyType of BODY_TYPES) for (const back of AUTHORED_BACK_IDS) {
    const data = makeCharacter(createRecipe({ bodyType, slots: { back } })), actor = makeActor(data);
    const inverse = actor.skeleton.boneInverses.map(m => m.toArray()), geometryId = actor.mesh.geometry.uuid;
    const gpu: { index: number; rigid: boolean }[] = []; let index = 0;
    for (const f of data.surface.faces) for (const vi of f.v) {
      const id = data.surface.vertices[vi].id;
      if (id.startsWith('Back.') || id.startsWith('BackHarness.')) gpu.push({ index, rigid: id.startsWith('Back.') });
      index++;
    }
    assert(gpu.length > 0); const actual = new T.Vector3(), expected = new T.Vector3(), matrix = new T.Matrix4();
    for (const def of MOTION_CLIPS) {
      const source = JSON.parse(readFileSync(`public/${motionAssetDirectory(def.id)}/${def.id}.json`, 'utf8'));
      const baked = retargetMotion(data, source);
      actor.resetBindPose();
      const action = actor.mixer.clipAction(baked.clip); action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play(); action.paused = true;
      const times: number[] = dense.has(def.id)
        ? [...new Set<number>([0, source.duration, ...source.times, ...source.times.slice(1).map((t: number, i: number) => (t + source.times[i]) / 2)])].sort((a, b) => a - b)
        : Array.from({ length: 9 }, (_, i) => i * source.duration / 8);
      for (const time of times) {
        action.time = time; actor.update(0);
        matrix.multiplyMatrices(actor.bones[B.Chest].matrixWorld, actor.skeleton.boneInverses[B.Chest]);
        for (const v of gpu) {
          actor.mesh.getVertexPosition(v.index, actual); assert(actual.toArray().every(Number.isFinite));
          assert(actor.mesh.boundingSphere!.containsPoint(actual), 'accessory escapes declared animation bounds');
          if (v.rigid) {
            expected.fromBufferAttribute(actor.mesh.geometry.attributes.position, v.index).applyMatrix4(matrix);
            const error = actual.distanceTo(expected); report.maxRigidError = Math.max(report.maxRigidError, error);
            assert(error < 1e-5, 'accessory distorted or attached to wrong animated bone');
          }
        }
        report.rendererVertices += gpu.length; report.poses++;
      }
      assert.equal(actor.mesh.geometry.uuid, geometryId);
      assert.deepEqual(actor.skeleton.boneInverses.map(m => m.toArray()), inverse);
      report.motionRows.push({ bodyType, back, id: def.id, samples: times.length, sampling: dense.has(def.id) ? 'source keys + midpoints' : 'nine phases' });
      action.stop(); actor.mixer.uncacheClip(baked.clip);
    }
    actor.dispose();
  }
  assert.equal(report.motionRows.length, BODY_TYPES.length * AUTHORED_BACK_IDS.length * MOTION_CLIPS.length);
  report.passed = true;
} finally {
  writeFileSync(join(output, 'numeric-checks.json'), JSON.stringify(report, null, 2));
  console.log('BACK_ACCESSORIES', JSON.stringify({ ...report, motionRows: report.motionRows.length }));
}
