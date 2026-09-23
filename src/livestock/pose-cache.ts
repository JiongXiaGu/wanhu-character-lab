import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { createAnimalActor } from './actor';
import type { LivestockDefinition } from './types';

export const POSE_FPS = 24;
/** 页面内共享静态姿态缓存；不把500套Skeleton/Mixer放进渲染循环。不是Unity GPU动画实现。 */
export function createPoseCache(definition: LivestockDefinition) {
  const actor = createAnimalActor(definition), entries = new Map<string, BufferGeometry[]>(), point = new Vector3();
  let disposed = false;
  try {
    for (const motion of definition.motions) {
      const count = Math.max(2, Math.ceil(motion.duration * POSE_FPS)), frames: BufferGeometry[] = [];
      entries.set(motion.id, frames);
      for (let f = 0; f <= count; f++) {
        actor.sample(motion.id, f / count);
        const source = actor.geometry.getAttribute('position'), values = new Float32Array(source.count * 3);
        for (let i = 0; i < source.count; i++) {
          point.fromBufferAttribute(source, i); actor.mesh.applyBoneTransform(i, point); point.toArray(values, i * 3);
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(values, 3));
        geometry.setAttribute('color', actor.geometry.getAttribute('color').clone());
        geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); frames.push(geometry);
      }
    }
  } catch (error) { for (const frames of entries.values()) for (const geometry of frames) geometry.dispose(); throw error; }
  finally { actor.dispose(); }
  return {
    get size() { return [...entries.values()].reduce((sum, value) => sum + value.length, 0); },
    get(motion: string, phase: number) {
      const frames = entries.get(motion); if (!frames) throw new Error(`姿态缓存缺少动作：${motion}`);
      const p = Math.max(0, Math.min(1, Number.isFinite(phase) ? phase : 0));
      return frames[Math.round(p * (frames.length - 1))];
    },
    dispose() { if (disposed) return; disposed = true; for (const frames of entries.values()) for (const geometry of frames) geometry.dispose(); entries.clear(); },
  };
}
