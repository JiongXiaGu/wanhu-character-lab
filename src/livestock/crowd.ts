import { DynamicDrawUsage, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { MeshStandardMaterial } from 'three';
import { createPoseCache } from './pose-cache';
import { habitatDefinition, mixedChoice, motionSurface, surfaceOffset } from './habitat';
import type { LabOptions, LivestockDefinition, LivestockLodId } from './types';

export const PHASE_COHORTS = 8;
export const MIXED_DURATION = 9;
export interface Placement { x: number; z: number; yaw: number; scale: number; cohort: number; offset: number; pick: number }
function random(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6d2b79f5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/** 稳定种子只在重新散布时使用；每个动物占一个有留量的格位，不是寻路系统。 */
export function makePlacements(count: number, seed: number): Placement[] {
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error('家畜数量必须为1至500的整数。');
  const rng = random(seed), columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, i) => {
    const x = (i % columns - (columns - 1) / 2) * 1.45 + (rng() - .5) * .12;
    const z = (Math.floor(i / columns) - (rows - 1) / 2) * 1.45 + (rng() - .5) * .12;
    const yaw = rng() * Math.PI * 2, scale = .94 + rng() * .12, offset = rng(), pick = rng();
    return { x, z, yaw, scale, offset, pick, cohort: Math.floor(rng() * PHASE_COHORTS) };
  });
}
export function layoutHalf(count: number) { return count === 1 ? .45 : Math.ceil(Math.sqrt(count)) * 1.45 / 2 + .55; }
export function previewDuration(definition: LivestockDefinition, options: Pick<LabOptions, 'count' | 'mixed' | 'motion'> & Partial<Pick<LabOptions, 'surface'>>) {
  return options.count > 1 && options.mixed ? habitatDefinition(definition, options.surface ?? motionSurface(definition, options.motion)).duration : definition.motions.find(m => m.id === options.motion)!.duration;
}
export function createCrowd(definition: LivestockDefinition, material: MeshStandardMaterial) {
  const group = new Group(), caches = new Map<LivestockLodId, ReturnType<typeof createPoseCache>>(), batches = new Map<string, InstancedMesh>();
  function ensureLod(lod: LivestockLodId) {
    let cache = caches.get(lod);
    if (cache) return cache;
    cache = createPoseCache(definition, lod); caches.set(lod, cache);
    for (const motion of definition.motions) for (let cohort = 0; cohort < PHASE_COHORTS; cohort++) {
      const mesh = new InstancedMesh(cache.get(motion.id, 0), material, 500);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage); mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false;
      mesh.name = `${lod}/${motion.id}/${cohort}`; group.add(mesh); batches.set(mesh.name, mesh);
    }
    return cache;
  }
  let placements: Placement[] = [], disposed = false;
  const matrix = new Matrix4(), rotation = new Quaternion(), position = new Vector3(), scale = new Vector3(), up = new Vector3(0, 1, 0);
  return {
    group, get cachedPoses() { return [...caches.values()].reduce((sum, cache) => sum + cache.size, 0); }, get placements() { return placements; },
    get batchCount() { return [...batches.values()].filter(mesh => mesh.visible).length; },
    setLayout(count: number, seed: number) { placements = makePlacements(count, seed); },
    update(time: number, options: Pick<LabOptions, 'motion' | 'mixed' | 'loop'> & Partial<Pick<LabOptions, 'surface'>>, lod: LivestockLodId) {
      const cache = ensureLod(lod), profile = habitatDefinition(definition, options.surface ?? motionSurface(definition, options.motion));
      for (const mesh of batches.values()) { mesh.count = 0; mesh.visible = false; }
      for (const item of placements) {
        const choice = mixedChoice(profile, item.pick), motionId = options.mixed ? choice.motion : options.motion;
        const motion = definition.motions.find(m => m.id === motionId);
        if (!motion || (motion.surface ?? 'land') !== profile.id) throw new Error(`环境动作不匹配：${definition.id}/${profile.id}/${motionId}`);
        const cohort = options.loop || options.mixed ? item.cohort : 0;
        const mesh = batches.get(`${lod}/${motion.id}/${cohort}`)!;
        if (!mesh.visible) {
          const phase = options.loop || options.mixed ? (time / motion.duration + cohort / PHASE_COHORTS) % 1 : Math.min(1, time / motion.duration);
          mesh.geometry = cache.get(motion.id, phase); mesh.visible = true;
        }
        let x = item.x, z = item.z, yaw = item.yaw;
        if (options.mixed && choice.radius) {
          const angle = (time / profile.duration * (choice.laps ?? 1) + item.offset) * Math.PI * 2, radius = choice.radius;
          x += Math.cos(angle) * radius; z += Math.sin(angle) * radius; yaw = -angle;
        }
        position.set(x, surfaceOffset(profile, item.scale), z); rotation.setFromAxisAngle(up, yaw); scale.setScalar(item.scale);
        matrix.compose(position, rotation, scale); mesh.setMatrixAt(mesh.count++, matrix);
      }
      for (const mesh of batches.values()) if (mesh.visible) mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      if (disposed) return; disposed = true; group.removeFromParent();
      for (const mesh of batches.values()) mesh.dispose(); group.clear(); batches.clear();
      for (const cache of caches.values()) cache.dispose(); caches.clear(); placements = [];
    },
  };
}
