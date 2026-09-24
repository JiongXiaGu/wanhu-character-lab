import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import type { MotionDefinition, Point } from '../livestock/types';
import { CHICKEN_BONES as B, CHICKEN_JOINTS, FOOT_POINTS } from './rig';

export const CHICKEN_ANIMATION_VERSION = 'wanhu-chicken-motion-v4';
export const CHICKEN_MOTIONS: readonly MotionDefinition[] = [
  { id: 'idle', label: '停驻', description: '轻轻转头，短暂停留。', duration: 3 },
  { id: 'walk', label: '行走', description: '交替迈步，头颈前后点动。', duration: .9 },
  { id: 'run', label: '奔跑', description: '身体前倾，小步快跑。', duration: .6 },
  { id: 'peck', label: '啄食', description: '观察地面，低头啄一下。', duration: 1.5 },
  { id: 'sleep', label: '睡觉', description: '低伏收颈，保持卧姿缓慢呼吸。', duration: 3, surface: 'land' },
];
export function authorChickenPose(motion: string, phase: number) {
  if (!CHICKEN_MOTIONS.some(m => m.id === motion)) throw new Error(`未知鸡动作：${motion}`);
  const p = Math.max(0, Math.min(1, phase)), a = p * Math.PI * 2;
  const rotations: number[][] = CHICKEN_JOINTS.map(() => [0, 0, 0]);
  const offsets: number[][] = CHICKEN_JOINTS.map(() => [0, 0, 0]);
  rotations[B.Head][1] = Math.sin(a) * (motion === 'idle' ? .22 : .045);
  if (motion === 'walk' || motion === 'run') {
    const running = motion === 'run', stride = running ? .17 : .10;
    rotations[B.Body][0] = running ? .16 : .035;
    rotations[B.Body][2] = Math.sin(a) * .025;
    offsets[B.Body][1] = .004 * Math.sin(a * 2);
    rotations[B.Neck][0] = .09 * Math.sin(a * 2);
    rotations[B.Head][0] = -.07 * Math.sin(a * 2) - rotations[B.Body][0];
    offsets[B.Neck][2] = .009 * Math.sin(a * 2);
    for (const [bone, shift] of [[B.LegL, 0], [B.LegR, .5]]) {
      const t = (p + shift) % 1;
      const swing = t >= .6, u = swing ? (t - .6) / .4 : t / .6;
      const z = stride * (swing ? -.5 * Math.cos(Math.PI * u) : .5 - u);
      const angle = -Math.asin(z / .17);
      const lift = swing ? Math.sin(Math.PI * u) * (running ? .045 : .028) : 0;
      rotations[bone][0] = angle;
      const minY = Math.min(...FOOT_POINTS.map(([, y, fz]) => (y - .175) * Math.cos(angle) - fz * Math.sin(angle)));
      offsets[bone][1] = .004 + lift - (.175 + minY);
    }
  } else if (motion === 'sleep') {
    // 保持卧伏的独立循环，不在每轮呼吸时重新站起；只用现有八骨。
    const breath = .5 - .5 * Math.cos(a);
    offsets[B.Body][1] = -.118 + .002 * breath;
    offsets[B.Neck][1] = -.065;
    offsets[B.Neck][2] = -.020;
    rotations[B.Neck][0] = -.65 + .008 * breath;
    rotations[B.Head][0] = .90 - .008 * breath;
    rotations[B.Head][1] = 0;
    // 单段腿折收于腹下，作者阶段按原足底校正接地；没有缩腿或运行时IK。
    for (const bone of [B.LegL, B.LegR]) {
      const angle = 1.18;
      rotations[bone][0] = angle;
      const minY = Math.min(...FOOT_POINTS.map(([, y, z]) => .175 + (y - .175) * Math.cos(angle) - z * Math.sin(angle)));
      offsets[bone][1] = .005 - minY;
    }
  } else if (motion === 'peck') {
    const t = Math.max(0, Math.min(1, (p - .24) / .42)), dip = Math.pow(Math.sin(Math.PI * t), 4);
    rotations[B.Body][0] = .07 * dip;
    offsets[B.Body][1] = -.040 * dip;
    rotations[B.Neck][0] = 2.00 * dip;
    rotations[B.Head][0] = -.10 * dip;
  } else {
    rotations[B.Neck][0] = Math.sin(a) * .025;
  }
  return { rotations, offsets };
}
/** 烘焙局部轨道；首尾完整。这里只制作动作，不执行导航或玩法。 */
export function bakeChickenClips(): Map<string, AnimationClip> {
  const clips = new Map<string, AnimationClip>();
  for (const motion of CHICKEN_MOTIONS) {
    const frames = Math.round(motion.duration * 30), times = Array.from({ length: frames + 1 }, (_, i) => i * motion.duration / frames);
    const poses = times.map((_, i) => authorChickenPose(motion.id, i / frames));
    const tracks = CHICKEN_JOINTS.flatMap((joint, index) => {
      const parent = joint.parent < 0 ? [0, 0, 0] : CHICKEN_JOINTS[joint.parent].position;
      const local = joint.position.map((value, axis) => value - parent[axis]);
      const positions = poses.flatMap(pose => local.map((value, axis) => value + pose.offsets[index][axis]));
      const rotations = poses.flatMap(pose => new Quaternion().setFromEuler(new Euler(...pose.rotations[index] as [number, number, number])).toArray());
      return [new VectorKeyframeTrack(`${joint.name}.position`, times, positions), new QuaternionKeyframeTrack(`${joint.name}.quaternion`, times, rotations)];
    });
    clips.set(motion.id, new AnimationClip(`Chicken_${motion.id}`, motion.duration, tracks));
  }
  return clips;
}
