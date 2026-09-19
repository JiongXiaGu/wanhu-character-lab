import * as T from 'three';
import { BODY_PROFILE_VERSION, type CharacterData, type Joint } from '../v3/types';
import { CALIBRATION_CHILD, RETARGET_VERSION, SAMPLE_BONE_COUNT, validateMixamoData, type MixamoMotionData } from './data';
import { mixamoDefinition } from './catalog';

export interface RetargetBake {
  clip: T.AnimationClip;
  rotations: number[][];
  hips: number[];
  sourcePositions: Float32Array;
  scale: number;
  groundLift: number[];
  rootTrajectory: number[];
  seamDegrees: number;
  loop: boolean;
  bounds: T.Box3;
}
const v = (array: readonly number[], offset: number) => new T.Vector3(array[offset], array[offset + 1], array[offset + 2]);

/** 网格仍在原 A-pose 蒙皮；校准的是动画姿态，不改 bind pose / inverse bind。 */
export function calibration(joints: Joint[], source: MixamoMotionData): T.Quaternion[] {
  if (joints.length !== 20) throw new Error('Mixamo 重定向要求固定 20 骨骼。');
  const scale = joints[1].p[1] / .929;
  return joints.map((joint, i) => {
    // HeadTop_End 是骨段端点，不是脸的朝向。源绑定中前倾约 5.46°，
    // 将它对齐目标竖直轴会给每帧额外加一次低头。头部刚性几何使用
    // 解剖坐标 +Z 的中立脸向，只传递 FBX 相对真实 bind 的世界旋转差。
    if (!i || i === 5) return new T.Quaternion();
    const child = CALIBRATION_CHILD[i];
    const sourceDirection = v(source.bindPositions, child * 3).sub(v(source.bindPositions, i * 3)).normalize();
    let direction: T.Vector3;
    if (i === 9 || i === 13) direction = v(joint.p, 0).sub(v(joints[joint.parent].p, 0));
    else if (i === 16 || i === 19) direction = new T.Vector3(0, -.073 * scale, .15 * scale);
    else direction = v(joints[child].p, 0).sub(v(joint.p, 0));
    return new T.Quaternion().setFromUnitVectors(direction.normalize(), sourceDirection);
  });
}

/** 只在载入动作或改变体型时烘焙；播放阶段没有重定向、IK 或顶点重建。 */
export function retargetMixamo(data: CharacterData, source: MixamoMotionData): RetargetBake {
  validateMixamoData(source, source.id);
  const joints = data.joints, def = mixamoDefinition(source.id), count = source.times.length;
  const correct = calibration(joints, source), scale = joints[1].p[1] / source.bindPositions[4];
  const localBind = joints.map(j => v(j.p, 0).sub(j.parent < 0 ? new T.Vector3() : v(joints[j.parent].p, 0)));
  const globalQ = joints.map(() => new T.Quaternion()), globalP = joints.map(() => new T.Vector3());
  const swing = new T.Quaternion(), spineDirection = v(joints[3].p, 0).sub(v(joints[2].p, 0)).normalize();
  const q = new T.Quaternion(), previous = joints.map(() => new T.Quaternion());
  const rotations = joints.map(() => [] as number[]), hips: number[] = [], groundLift: number[] = [], rootTrajectory: number[] = [];
  const sourcePositions = new Float32Array(count * SAMPLE_BONE_COUNT * 3), bounds = new T.Box3();
  const sourceStart = v(source.positions, 3), sourceEnd = v(source.positions, (count - 1) * SAMPLE_BONE_COUNT * 3 + 3);
  const p = new T.Vector3(), p2 = new T.Vector3(), root = new T.Vector3(), trend = new T.Vector3();
  for (let f = 0; f < count; f++) {
    const phase = source.times[f] / source.duration;
    trend.lerpVectors(sourceStart, sourceEnd, phase);
    root.copy(v(source.positions, f * SAMPLE_BONE_COUNT * 3 + 3)).sub(v(source.bindPositions, 3)).multiplyScalar(scale);
    // 导航接管起点到终点的水平轨迹，但保留步态侧摆、俯身和跳跃的垂直位移。
    root.x = (source.positions[f * SAMPLE_BONE_COUNT * 3 + 3] - trend.x) * scale;
    root.z = (source.positions[f * SAMPLE_BONE_COUNT * 3 + 5] - trend.z) * scale;
    root.add(localBind[1]);
    rootTrajectory.push((trend.x - sourceStart.x) * scale, 0, (trend.z - sourceStart.z) * scale);
    for (let i = 0; i < 20; i++) {
      globalQ[i].fromArray(source.worldDeltas, (f * 20 + i) * 4).multiply(correct[i]).normalize();
      // 源 Spine → Spine1 → Spine2 折叠为目标 Spine → Chest；补偿省略关节的弯曲。
      if (i === 2) {
        const expected = v(source.positions, (f * SAMPLE_BONE_COUNT + 3) * 3).sub(v(source.positions, (f * SAMPLE_BONE_COUNT + 2) * 3)).normalize();
        swing.setFromUnitVectors(spineDirection.clone().applyQuaternion(globalQ[i]), expected);
        globalQ[i].premultiply(swing).normalize();
      }
      const parent = joints[i].parent;
      q.copy(parent < 0 ? globalQ[i] : globalQ[parent]).invert().multiply(globalQ[i]);
      if (parent < 0) q.copy(globalQ[i]);
      q.normalize();
      if (f && q.dot(previous[i]) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      previous[i].copy(q); rotations[i].push(q.x, q.y, q.z, q.w);
      if (i === 1) globalP[i].copy(root);
      else if (parent < 0) globalP[i].copy(localBind[i]);
      else globalP[i].copy(localBind[i]).applyQuaternion(globalQ[parent]).add(globalP[parent]);
    }
    // 以人体而非帽子/武器求最低点。仅防止穿地，不把跳跃/游泳压回地面。
    let minY = Infinity;
    for (const vertex of data.body.vertices) {
      const [a, b, weight] = vertex.w;
      p.fromArray(vertex.p).sub(v(joints[a].p, 0)).applyQuaternion(globalQ[a]).add(globalP[a]).multiplyScalar(weight);
      p2.fromArray(vertex.p).sub(v(joints[b].p, 0)).applyQuaternion(globalQ[b]).add(globalP[b]).multiplyScalar(1 - weight);
      p.add(p2); minY = Math.min(minY, p.y); bounds.expandByPoint(p);
    }
    const lift = def.ground ? Math.max(0, -minY) : 0;
    groundLift.push(lift); hips.push(root.x, root.y + lift, root.z);
    for (let i = 0; i < SAMPLE_BONE_COUNT; i++) {
      const offset = (f * SAMPLE_BONE_COUNT + i) * 3;
      sourcePositions[offset] = (source.positions[offset] - trend.x) * scale;
      sourcePositions[offset + 1] = source.positions[offset + 1] * scale;
      sourcePositions[offset + 2] = (source.positions[offset + 2] - trend.z) * scale;
    }
  }
  const tracks: T.KeyframeTrack[] = rotations.map((values, i) => new T.QuaternionKeyframeTrack(`${joints[i].name}.quaternion`, source.times, values));
  tracks.push(new T.VectorKeyframeTrack(`${joints[1].name}.position`, source.times, hips));
  let seamDegrees = 0;
  for (const values of rotations) seamDegrees = Math.max(seamDegrees, new T.Quaternion().fromArray(values).angleTo(new T.Quaternion().fromArray(values, values.length - 4)) * 180 / Math.PI);
  // 明显不闭合的片段不能强制循环并谎称无缝。
  const loop = def.loop && seamDegrees < 12 && v(hips, 0).distanceTo(v(hips, hips.length - 3)) < .06;
  bounds.expandByScalar(Math.max(...groundLift) + .1);
  return { clip: new T.AnimationClip(`mixamo:${source.id}`, source.duration, tracks), rotations, hips, sourcePositions, scale, groundLift, rootTrajectory, seamDegrees, loop, bounds };
}

/** 渲染器无关的目标局部轨道；不是 Unity AnimationClip/Avatar，也不含业务或弓弦事件。 */
export function exportTargetMotion(data: CharacterData, source: MixamoMotionData, bake: RetargetBake) {
  return {
    schema: 'wanhu-target-motion', version: 1, retargetVersion: RETARGET_VERSION,
    skeletonVersion: 'wanhu-20-v1',
    calibrationProfile: { id: data.recipe.bodyType === 'female' ? 'female-anatomical-v1' : 'male-anatomical-v2', head: 'source-world-bind-delta; neutral-face-forward-+Z' },
    coordinateSystem: '+X character-right / +Y up / +Z forward; quaternion xyzw',
    source: source.source, clipId: source.id, duration: source.duration, loop: bake.loop, times: source.times,
    rootMotionPolicy: 'remove-linear-planar-trajectory; preserve-local-sway-and-height',
    proportion: { bodyType: data.recipe.bodyType, profileVersion: BODY_PROFILE_VERSION, height: data.recipe.height, build: data.recipe.build },
    bones: data.joints.map((joint, i) => ({ id: i, name: joint.name, parent: joint.parent,
      bindLocalPosition: v(joint.p, 0).sub(joint.parent < 0 ? new T.Vector3() : v(data.joints[joint.parent].p, 0)).toArray(),
      bindLocalRotation: [0, 0, 0, 1], rotations: bake.rotations[i], ...(i === 1 ? { positions: bake.hips } : {}) })),
    rootTrajectory: bake.rootTrajectory, events: [], props: [],
    limitations: ['No fingers/toes', 'No authored prop or gameplay event tracks', 'Not a Unity runtime package', 'Seam check is numerical, not a foot-lock guarantee'],
  };
}
