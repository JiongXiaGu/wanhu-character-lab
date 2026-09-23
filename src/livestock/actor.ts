import { AnimationMixer, Bone, BufferGeometry, Color, Float32BufferAttribute, LoopOnce, MeshStandardMaterial, Skeleton, SkeletonHelper, SkinnedMesh, Uint16BufferAttribute } from 'three';
import type { AnimalActor, LivestockDefinition, LivestockLodId } from './types';

/** 单只精确检查路径；三档LOD共用同一骨骼语义与动作，不在运行时删面。 */
export function createAnimalActor(definition: LivestockDefinition, lod: LivestockLodId = 'lod0'): AnimalActor {
  const lodDefinition = definition.lods.find(value => value.id === lod);
  if (!lodDefinition) throw new Error(`未知家畜LOD：${lod}`);
  const data = lodDefinition.buildMesh(), geometry = new BufferGeometry();
  const positions: number[] = [], colors: number[] = [], skinIndices: number[] = [], weights: number[] = [];
  for (const index of data.indices) {
    positions.push(...data.positions[index]); colors.push(...new Color(data.colors[index]).toArray());
    skinIndices.push(data.bones[index], 0, 0, 0); weights.push(1, 0, 0, 0);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  geometry.computeVertexNormals();
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: 0, flatShading: true });
  const mesh = new SkinnedMesh(geometry, material), bones = definition.joints.map(joint => { const bone = new Bone(); bone.name = joint.name; return bone; });
  definition.joints.forEach((joint, index) => {
    const parent = joint.parent < 0 ? [0, 0, 0] : definition.joints[joint.parent].position;
    bones[index].position.set(...joint.position.map((value, axis) => value - parent[axis]) as [number, number, number]);
    if (joint.parent < 0) mesh.add(bones[index]); else bones[joint.parent].add(bones[index]);
  });
  mesh.name = `${definition.id}/${lod}`; mesh.frustumCulled = false;
  mesh.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones); mesh.bind(skeleton);
  const helper = new SkeletonHelper(mesh), mixer = new AnimationMixer(mesh);
  const actions = new Map([...definition.bakeClips()].map(([id, clip]) => [id, mixer.clipAction(clip).setLoop(LoopOnce, 1)]));
  let selected = '', disposed = false;
  const sync = () => { mesh.updateMatrixWorld(true); skeleton.update(); };
  return {
    data, mesh, geometry, material, bones, skeleton, helper,
    sample(motion, phase) {
      const action = actions.get(motion);
      if (!action) throw new Error(`未知家畜动作：${motion}`);
      if (selected !== motion) { mixer.stopAllAction(); action.reset().play(); selected = motion; }
      action.enabled = true; action.paused = true;
      action.time = Math.max(0, Math.min(1, Number.isFinite(phase) ? phase : 0)) * action.getClip().duration;
      mixer.update(0); sync();
    },
    bind() { mixer.stopAllAction(); selected = ''; skeleton.pose(); sync(); },
    dispose() {
      if (disposed) return; disposed = true;
      mixer.stopAllAction(); mixer.uncacheRoot(mesh); mesh.removeFromParent(); helper.removeFromParent();
      helper.geometry.dispose(); const hm = helper.material; if (Array.isArray(hm)) hm.forEach(m => m.dispose()); else hm.dispose();
      skeleton.dispose(); geometry.dispose(); material.dispose();
    },
  };
}
