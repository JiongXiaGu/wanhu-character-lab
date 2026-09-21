import { Bone, Skeleton, Vector3 } from 'three';
import type { HorseJoint, HorseWeight, Point3 } from './types';

/** +X右、+Y上、+Z前，米。绑定局部旋转全部为单位四元数；没有缩放轨道。 */
export const HORSE_JOINTS: readonly HorseJoint[] = [
  { name: 'Root', parent: -1, bindWorld: [0, 0, 0] },
  { name: 'Pelvis', parent: 0, bindWorld: [0, 1.23, -.55] },
  { name: 'Spine', parent: 1, bindWorld: [0, 1.30, -.12] },
  { name: 'Chest', parent: 2, bindWorld: [0, 1.34, .48] },
  { name: 'Neck', parent: 3, bindWorld: [0, 1.40, .62] },
  { name: 'NeckUpper', parent: 4, bindWorld: [0, 1.73, .87] },
  { name: 'Head', parent: 5, bindWorld: [0, 1.97, 1.05] },
  { name: 'FrontLeftUpper', parent: 3, bindWorld: [-.235, 1.19, .55] },
  { name: 'FrontLeftMiddle', parent: 7, bindWorld: [-.235, .73, .60] },
  { name: 'FrontLeftLower', parent: 8, bindWorld: [-.235, .235, .59] },
  { name: 'FrontLeftHoof', parent: 9, bindWorld: [-.235, .11, .65] },
  { name: 'FrontRightUpper', parent: 3, bindWorld: [.235, 1.19, .55] },
  { name: 'FrontRightMiddle', parent: 11, bindWorld: [.235, .73, .60] },
  { name: 'FrontRightLower', parent: 12, bindWorld: [.235, .235, .59] },
  { name: 'FrontRightHoof', parent: 13, bindWorld: [.235, .11, .65] },
  { name: 'BackLeftUpper', parent: 1, bindWorld: [-.245, 1.22, -.63] },
  { name: 'BackLeftMiddle', parent: 15, bindWorld: [-.245, .90, -.42] },
  { name: 'BackLeftLower', parent: 16, bindWorld: [-.245, .47, -.77] },
  { name: 'BackLeftHoof', parent: 17, bindWorld: [-.245, .11, -.70] },
  { name: 'BackRightUpper', parent: 1, bindWorld: [.245, 1.22, -.63] },
  { name: 'BackRightMiddle', parent: 19, bindWorld: [.245, .90, -.42] },
  { name: 'BackRightLower', parent: 20, bindWorld: [.245, .47, -.77] },
  { name: 'BackRightHoof', parent: 21, bindWorld: [.245, .11, -.70] },
  { name: 'Tail', parent: 1, bindWorld: [0, 1.42, -.96] },
  { name: 'TailEnd', parent: 23, bindWorld: [0, .97, -1.13] },
];
export const HORSE_RIG_VERSION = 'wanhu-horse-rig-m1-v1';
export function horseBone(name: string): number {
  const index = HORSE_JOINTS.findIndex(j => j.name === name);
  if (index < 0) throw new Error(`未知马骨骼：${name}`);
  return index;
}
export function weight(a: string, b = a, first = 1): HorseWeight {
  if (!Number.isFinite(first) || first < 0 || first > 1) throw new Error('非法马蒙皮权重');
  return [horseBone(a), horseBone(b), first];
}
export function localBind(index: number): Point3 {
  const joint = HORSE_JOINTS[index], parent = HORSE_JOINTS[joint.parent];
  return joint.bindWorld.map((v, axis) => v - (parent?.bindWorld[axis] ?? 0)) as Point3;
}
export function createHorseRig() {
  const bones = HORSE_JOINTS.map((joint, index) => {
    const bone = new Bone(); bone.name = joint.name; bone.position.fromArray(localBind(index)); return bone;
  });
  HORSE_JOINTS.forEach((joint, index) => { if (joint.parent >= 0) bones[joint.parent].add(bones[index]); });
  bones[0].updateMatrixWorld(true);
  const skeleton = new Skeleton(bones); skeleton.calculateInverses();
  return { bones, skeleton, reset() {
    bones.forEach((bone, index) => {
      bone.position.fromArray(localBind(index)); bone.quaternion.identity(); bone.scale.copy(new Vector3(1, 1, 1));
    });
    bones[0].updateMatrixWorld(true); skeleton.update();
  } };
}
