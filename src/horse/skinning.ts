import * as T from 'three';
import { buildHorseMesh } from './geometry';
import { createHorseRig } from './rig';
import type { HorseMeshData, HorseStats } from './types';

/** 逻辑点保持共用索引；这里只为低模块面拆分渲染点，权重不会重新求解。 */
export function makeHorseGeometry(data: HorseMeshData): T.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [], weights: number[] = [];
  const tint = new T.Color();
  for (const face of data.triangles) {
    tint.set(face.color);
    for (const index of face.indices) {
      const vertex = data.vertices[index], [a, b, first] = vertex.weight;
      positions.push(...vertex.position); colors.push(tint.r, tint.g, tint.b);
      indices.push(a, b, 0, 0); weights.push(first, 1 - first, 0, 0);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function createHorseActor() {
  const data = buildHorseMesh(), rig = createHorseRig(), geometry = makeHorseGeometry(data);
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .93, metalness: 0, flatShading: true });
  const mesh = new T.SkinnedMesh(geometry, material);
  mesh.name = 'WanhuHorse'; mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.add(rig.bones[0]); mesh.updateMatrixWorld(true); mesh.bind(rig.skeleton);
  // 单个实验资产不以静态包围盒剔除动画；Unity迁移需使用烘焙的动作并集边界。
  mesh.frustumCulled = false;
  const helper = new T.SkeletonHelper(rig.bones[0]); helper.visible = false;
  const helperMaterials = Array.isArray(helper.material) ? helper.material : [helper.material];
  helperMaterials.forEach(value => { value.depthTest = false; }); helper.renderOrder = 10;
  const mixer = new T.AnimationMixer(mesh);
  const stats: HorseStats = { triangles: data.triangles.length, logicalVertices: data.vertices.length,
    gpuVertices: geometry.getAttribute('position').count, bones: rig.bones.length };
  return { data, ...rig, mesh, helper, mixer, material, stats,
    sync() { mixer.update(0); mesh.updateMatrixWorld(true); rig.skeleton.update(); helper.updateMatrixWorld(true); },
    dispose() {
      mixer.stopAllAction(); mixer.uncacheRoot(mesh); geometry.dispose(); material.dispose();
      helper.geometry.dispose(); helperMaterials.forEach(value => value.dispose()); rig.skeleton.dispose();
      helper.removeFromParent(); mesh.removeFromParent();
    },
  };
}
export type HorseActor = ReturnType<typeof createHorseActor>;
