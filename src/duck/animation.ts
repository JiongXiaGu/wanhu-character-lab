import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import type { MotionDefinition } from '../livestock/types';
import { DUCK_BONES as B, DUCK_JOINTS, DUCK_SOLE } from './rig';

export const DUCK_ANIMATION_VERSION = 'wanhu-duck-motion-v1';
export const DUCK_MOTIONS: readonly MotionDefinition[] = [
  { id: 'idle_land', label: '停驻', description: '陆地观察，短颈轻轻转动。', duration: 3, surface: 'land' },
  { id: 'walk', label: '摇摆行走', description: '短步交替，身体左右轻摆。', duration: 1.2, surface: 'land' },
  { id: 'run', label: '奔跑', description: '受惊逃跑用动作；前倾快步。', duration: .6, surface: 'land' },
  { id: 'feed_land', label: '陆地觅食', description: '扁嘴低探，贴地左右轻扫。', duration: 2, surface: 'land' },
  { id: 'idle_water', label: '漂浮', description: '身体轻浮，腿在水下收拢。', duration: 3, surface: 'water' },
  { id: 'swim', label: '游泳', description: '身体平稳，双脚交替划水。', duration: 1.2, surface: 'water' },
  { id: 'dabble', label: '浅扎水觅食', description: '喙与头浅入水，尾部微抬。', duration: 2, surface: 'water' },
];
/** 作者姿态烘焙为原8骨局部轨道；不复用鸡动作，不做运行时浮力或IK。 */
export function authorDuckPose(motion: string, phase: number) {
  const definition = DUCK_MOTIONS.find(m => m.id === motion);
  if (!definition) throw new Error(`未知鸭动作：${motion}`);
  const p = Math.max(0, Math.min(1, phase)), a = p * Math.PI * 2;
  const rotations = DUCK_JOINTS.map(() => [0,0,0]), offsets = DUCK_JOINTS.map(() => [0,0,0]);
  rotations[B.Head][1] = Math.sin(a) * (motion.includes('idle') ? .18 : .025);
  if (motion === 'walk' || motion === 'run') {
    const running = motion === 'run', stride = running ? .15 : .075;
    rotations[B.Body][0] = running ? .14 : .025;
    rotations[B.Body][2] = Math.sin(a) * (running ? .10 : .095);
    offsets[B.Body][1] = .003 * Math.sin(2*a);
    rotations[B.Neck][0] = .035 * Math.sin(2*a);
    rotations[B.Head][0] = -rotations[B.Body][0] - rotations[B.Neck][0];
    rotations[B.Head][2] = -rotations[B.Body][2] * .65;
    rotations[B.WingL][2] = running ? -.10 : 0; rotations[B.WingR][2] = running ? .10 : 0;
    for (const [bone, shift] of [[B.LegL,0],[B.LegR,.5]]) {
      const t = (p + shift) % 1, swing = t >= .6, u = swing ? (t-.6)/.4 : t/.6;
      const z = stride * (swing ? -.5*Math.cos(Math.PI*u) : .5-u), angle = -Math.asin(z/.146);
      rotations[bone][0] = angle;
      const minY = Math.min(...DUCK_SOLE.map(([,y,z]) => .152+(y-.152)*Math.cos(angle)-(z+.060)*Math.sin(angle)));
      offsets[bone][1] = .006 + (swing ? Math.sin(Math.PI*u)*(running ? .042 : .025) : 0) - minY;
    }
  } else if (motion === 'feed_land') {
    const t = Math.max(0, Math.min(1, (p-.18)/.64)), dip = Math.sin(Math.PI*t)**4;
    rotations[B.Body][0] = .07*dip; offsets[B.Body][1] = -.025*dip;
    rotations[B.Neck][0] = 1.17*dip; rotations[B.Head][0] = .05*dip;
    rotations[B.Head][1] = Math.sin(a*2)*.18*dip;
  } else if (definition.surface === 'water') {
    offsets[B.Root][1] = .003*Math.sin(a);
    rotations[B.Body][2] = .014*Math.sin(a);
    for (const [bone,shift] of [[B.LegL,0],[B.LegR,Math.PI]]) {
      rotations[bone][0] = .65 + (motion === 'swim' ? .40*Math.sin(a+shift) : .025*Math.sin(a+shift));
      offsets[bone][1] = .012;
    }
    if (motion === 'dabble') {
      const t = Math.max(0, Math.min(1, (p-.18)/.64)), dip = Math.sin(Math.PI*t)**4;
      rotations[B.Body][0] = .14*dip;
      rotations[B.Neck][0] = .90*dip; rotations[B.Head][0] = .12*dip;
    }
  } else rotations[B.Neck][0] = .018*Math.sin(a);
  return { rotations, offsets };
}
export function bakeDuckClips(): Map<string, AnimationClip> {
  return new Map(DUCK_MOTIONS.map(motion => {
    const frames = Math.round(motion.duration*30), times = Array.from({ length: frames+1 }, (_,i) => i*motion.duration/frames);
    const poses = times.map((_,i) => authorDuckPose(motion.id, i/frames));
    const tracks = DUCK_JOINTS.flatMap((joint,index) => {
      const parent = joint.parent < 0 ? [0,0,0] : DUCK_JOINTS[joint.parent].position;
      const local = joint.position.map((v,i) => v-parent[i]);
      return [
        new VectorKeyframeTrack(`${joint.name}.position`, times, poses.flatMap(p => local.map((v,i) => v+p.offsets[index][i]))),
        new QuaternionKeyframeTrack(`${joint.name}.quaternion`, times, poses.flatMap(p => new Quaternion().setFromEuler(new Euler(...p.rotations[index] as [number,number,number])).toArray())),
      ];
    });
    return [motion.id, new AnimationClip(`Duck_${motion.id}`, motion.duration, tracks)];
  }));
}
