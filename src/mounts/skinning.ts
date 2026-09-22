import { AnimationMixer, Bone, MeshStandardMaterial, Skeleton, SkeletonHelper, SkinnedMesh, type Material } from 'three';
import { makeHorseGeometry } from '../horse/skinning';
import type { HorseJoint, HorseMeshData } from '../horse/types';
import type { MountActor } from './types';

/** 新动物共用渲染装配，不共用绑定矩阵、外形或动画。原马Actor路径不改。 */
export function makeMountActor(data: HorseMeshData, joints: readonly HorseJoint[], name: string): MountActor {
  const bones = joints.map((joint, i) => {
    if (joint.parent >= i || joint.parent < -1) throw new Error(`非法坐骑父序：${joint.name}`);
    const bone = new Bone(), parent = joints[joint.parent]; bone.name = joint.name;
    bone.position.set(...joint.bindWorld.map((value, axis) => value - (parent?.bindWorld[axis] ?? 0)) as [number, number, number]); return bone;
  });
  const geometry = makeHorseGeometry(data), material = new MeshStandardMaterial({ vertexColors: true, roughness: .93, metalness: 0, flatShading: true });
  const mesh = new SkinnedMesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  joints.forEach((joint, i) => (joint.parent < 0 ? mesh : bones[joint.parent]).add(bones[i]));
  mesh.updateMatrixWorld(true); const skeleton = new Skeleton(bones); skeleton.calculateInverses(); mesh.bind(skeleton);
  const helper = new SkeletonHelper(bones[0]); helper.visible = false; helper.renderOrder = 10;
  for (const m of Array.isArray(helper.material) ? helper.material : [helper.material]) m.depthTest = false;
  const mixer = new AnimationMixer(mesh); let disposed = false;
  const sync = () => { mixer.update(0); mesh.updateMatrixWorld(true); skeleton.update(); helper.updateMatrixWorld(true); };
  return { data, bones, skeleton, mesh, material, helper, mixer,
    stats: { triangles: data.triangles.length, logicalVertices: data.vertices.length, gpuVertices: geometry.getAttribute('position').count, bones: bones.length },
    reset() {
      bones.forEach((bone, i) => { const j = joints[i], p = joints[j.parent]; bone.position.set(...j.bindWorld.map((n, a) => n - (p?.bindWorld[a] ?? 0)) as [number, number, number]); bone.quaternion.identity(); bone.scale.set(1, 1, 1); }); sync();
    }, sync,
    dispose() {
      if (disposed) return; disposed = true; mixer.stopAllAction(); mixer.uncacheRoot(mesh);
      geometry.dispose(); material.dispose(); skeleton.dispose(); helper.geometry.dispose();
      for (const m of Array.isArray(helper.material) ? helper.material : [helper.material]) (m as Material).dispose();
      helper.removeFromParent(); mesh.removeFromParent();
    },
  };
}
