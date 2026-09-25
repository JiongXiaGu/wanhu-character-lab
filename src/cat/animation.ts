import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import type { MotionDefinition } from '../livestock/types';
import { CAT_BONES as B, CAT_JOINTS, CAT_LEGS, CAT_TAIL_ROOT, catSole } from './rig';

export const CAT_ANIMATION_VERSION = 'wanhu-rural-cat-motion-v1';
export const CAT_MOTIONS: readonly MotionDefinition[] = [
  { id: 'idle', label: '停驻', description: '轻微呼吸、侧顾，长尾缓慢摆动。', duration: 4, surface: 'land' },
  { id: 'walk', label: '行走', description: '轻巧短步，四足错相，支撑脚向后扫。', duration: .8, surface: 'land' },
  { id: 'run', label: '奔跑', description: '前后足组错相快跑；仅显式预览。', duration: .5, surface: 'land' },
  { id: 'sniff', label: '闻地', description: '俯首靠近地面观察、闻嗅，四脚稳定。', duration: 4, surface: 'land' },
  { id: 'groom', label: '理毛', description: '抬起一只前足，低头梳理；不增加舌头或下巴骨。', duration: 4, surface: 'land' },
  { id: 'sleep', label: '睡觉', description: '胸腹低伏、头颈放松、长尾收低，原地缓慢呼吸。', duration: 3, surface: 'land' },
];
const smooth = (a: number, b: number, p: number) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };
export function authorCatPose(motion: string, phase: number) {
  if (!CAT_MOTIONS.some(value => value.id === motion)) throw new Error(`未知猫动作：${motion}`);
  const p = Math.max(0, Math.min(1, Number.isFinite(phase) ? phase : 0)), a = p * 2 * Math.PI;
  const rotations = CAT_JOINTS.map(() => [0, 0, 0]), offsets = CAT_JOINTS.map(() => [0, 0, 0]);
  rotations[B.Tail][1] = .075 * Math.sin(a); rotations[B.Tail][2] = .045 * Math.sin(a);
  if (motion === 'sleep') {
    const drop = .130;
    offsets[B.Body][1] = -drop + .0008 * (1 - Math.cos(a));
    // 放松头颈但不把短喉部压进胸腔，三档共用同一姿势。
    rotations[B.Neck][0] = .40; offsets[B.Neck][1] = -.008; rotations[B.Head][0] = -.15;
    rotations[B.Tail] = [-1.50, .55, .10];
    // 绕真实埋入点放松长尾，根点不随枢轴误差离开躯干。
    const root = new Vector3(...CAT_TAIL_ROOT).sub(new Vector3(...CAT_JOINTS[B.Tail].position));
    const q = new Quaternion().setFromEuler(new Euler(...rotations[B.Tail] as [number, number, number]));
    offsets[B.Tail] = root.clone().sub(root.clone().applyQuaternion(q)).toArray();
    for (const bone of CAT_LEGS) {
      const joint = new Vector3(...CAT_JOINTS[bone].position), front = bone <= B.FrontLegR, side = Math.sign(joint.x);
      const anchor = new Vector3(side * (front ? .045 : .048), front ? .307 : .308, front ? .075 : -.143);
      const angle = front ? -.87 : -1.10, rotation = new Quaternion().setFromEuler(new Euler(angle, 0, 0));
      const target = joint.clone().sub(anchor).applyQuaternion(rotation).add(anchor); target.y -= drop;
      const lowest = Math.min(...catSole(bone).map(point => new Vector3(...point).sub(joint).applyQuaternion(rotation).add(target).y));
      target.y += .006 - lowest;
      rotations[bone][0] = angle; offsets[bone] = target.sub(joint).toArray();
    }
  } else if (motion === 'walk' || motion === 'run') {
    const running = motion === 'run', stride = running ? .18 : .10, stance = running ? .54 : .66;
    const phases = running ? [0, .08, .48, .56] : [0, .5, .75, .25];
    offsets[B.Body][1] = (running ? .004 : .0015) * Math.sin(2 * a);
    rotations[B.Body][0] = (running ? .018 : .005) * Math.sin(a);
    rotations[B.Neck][0] = running ? .035 : 0; rotations[B.Head][0] = -rotations[B.Neck][0] * .6;
    CAT_LEGS.forEach((bone, i) => {
      const joint = CAT_JOINTS[bone].position, t = (p + phases[i]) % 1, swing = t >= stance;
      const u = swing ? (t - stance) / (1 - stance) : t / stance;
      const z = stride * (swing ? -.5 * Math.cos(Math.PI * u) : .5 - u), angle = -Math.asin(z / (joint[1] - .006));
      const floor = Math.min(...catSole(bone).map(([, y, z]) => joint[1] + (y - joint[1]) * Math.cos(angle) - (z - joint[2]) * Math.sin(angle)));
      rotations[bone][0] = angle;
      offsets[bone][1] = .006 + (swing ? Math.sin(Math.PI * u) * (running ? .035 : .023) : 0) - floor;
    });
  } else if (motion === 'sniff') {
    const dip = smooth(.06, .32, p) * (1 - smooth(.74, .96, p));
    // 低头由躯干、颈、头共同分担，避免把短喉部单个截面压进胸部；四足仍独立接地。
    rotations[B.Body][0] = .20 * dip; offsets[B.Body][1] = -.020 * dip;
    rotations[B.Neck][0] = .55 * dip; offsets[B.Neck][1] = -.008 * dip;
    rotations[B.Head][0] = .20 * dip; rotations[B.Head][1] = .045 * Math.sin(3 * a) * dip;
  } else if (motion === 'groom') {
    const lift = smooth(.10, .32, p) * (1 - smooth(.70, .94, p));
    rotations[B.FrontLegL][0] = -1.04 * lift; rotations[B.FrontLegL][2] = .10 * lift;
    offsets[B.FrontLegL][1] = .020 * lift; offsets[B.FrontLegL][2] = -.030 * lift;
    rotations[B.Neck][0] = .40 * lift; offsets[B.Neck][1] = -.008 * lift;
    rotations[B.Head][0] = .10 * lift; rotations[B.Head][1] = -.10 * lift;
    rotations[B.Tail][1] = .05 * Math.sin(a);
  } else {
    offsets[B.Body][1] = .0013 * Math.sin(a); rotations[B.Neck][0] = .008 * Math.sin(a);
    rotations[B.Head][1] = .09 * Math.sin(a) * Math.sin(Math.PI * p) ** 2;
  }
  return { rotations, offsets };
}
/** 一次性烘焙30fps作者轨道；运行时仍使用家畜共用Mixer与Pose Cache。 */
export function bakeCatClips(): Map<string, AnimationClip> {
  return new Map(CAT_MOTIONS.map(motion => {
    const frames = Math.round(motion.duration * 30), times = Array.from({ length: frames + 1 }, (_, i) => i * motion.duration / frames);
    const poses = times.map((_, i) => authorCatPose(motion.id, i / frames));
    const tracks = CAT_JOINTS.flatMap((joint, index) => {
      const parent = joint.parent < 0 ? [0, 0, 0] : CAT_JOINTS[joint.parent].position;
      const local = joint.position.map((value, axis) => value - parent[axis]);
      return [new VectorKeyframeTrack(`${joint.name}.position`, times, poses.flatMap(pose => local.map((value, axis) => value + pose.offsets[index][axis]))),
        new QuaternionKeyframeTrack(`${joint.name}.quaternion`, times, poses.flatMap(pose => new Quaternion().setFromEuler(new Euler(...pose.rotations[index] as [number, number, number])).toArray()))];
    });
    return [motion.id, new AnimationClip(`Cat_${motion.id}`, motion.duration, tracks)];
  }));
}
