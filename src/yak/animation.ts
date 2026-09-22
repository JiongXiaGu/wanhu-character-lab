import { AnimationClip, Euler, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import { MOUNT_FPS, MOUNT_MOTIONS, type MountMotion, type MountMotionDefinition } from '../mounts/types';
import type { Point3 } from '../horse/types';
import { YAK_JOINTS, yakBone } from './rig';
import { buildYakMesh } from './geometry';

export const YAK_MOTION_VERSION = 'wanhu-yak-motion-m7-v1';
export const YAK_MOTIONS: Readonly<Record<MountMotion, MountMotionDefinition>> = {
  idle: { nativeId: 'Yak_Idle', duration: 5.8, label: '停驻', description: '缓慢呼吸、低头回稳，小耳和蓬尾轻摆，额毛只有微幅随动。' },
  walk: { nativeId: 'Yak_Walk', duration: 1.95, label: '步行', description: '低重心短步、稍错相的四足支撑，厚重前躯平稳推进。' },
  run: { nativeId: 'Yak_Run', duration: 1.10, label: '奔跑', description: '短距离沉重快跑，增加收腿与步幅，不模拟赛马冲刺。' },
  eat: { nativeId: 'Yak_Eat', duration: 7.2, label: '进食', description: '短粗颈和宽头向下探，低位啃食停留后缓慢抬起。' },
};
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
/** 牦牛独立作者曲线。骨盆仅竖向留量；+Z向前，低位支撑足向-Z后掠。 */
export function authorYakPose(id: MountMotion, phase: number) {
  const p = ((phase % 1) + 1) % 1, a = p * 2 * Math.PI;
  const rotations: Point3[] = YAK_JOINTS.map(() => [0, 0, 0]), pelvisOffset: Point3 = [0, 0, 0];
  const put = (name: string, x: number, y = 0, z = 0) => { rotations[yakBone(name)] = [x, y, z]; };
  put('LeftEar', .020 * Math.sin(a + .25), .012 * Math.sin(2 * a), .033 * Math.sin(a));
  put('RightEar', .018 * Math.sin(a - .4), -.011 * Math.sin(2 * a + .2), -.030 * Math.sin(a + .55));
  put('Tail', .012 * Math.sin(a), 0, .055 * Math.sin(a));
  put('TailMiddle', .020 * Math.sin(a - .3), 0, .085 * Math.sin(a - .35));
  put('TailEnd', .018 * Math.sin(a - .6), 0, .10 * Math.sin(a - .65));
  put('Forelock', .010 * Math.sin(a - .3));
  if (id === 'idle') {
    pelvisOffset[1] = .002 * Math.sin(a); put('Chest', .0025 * Math.sin(a));
    put('NeckBase', .007 * Math.sin(a), .005 * Math.sin(a));
    put('Neck', -.004 * Math.sin(a)); put('Head', .012 * Math.sin(a - .2), -.004 * Math.sin(a));
  } else if (id === 'eat') {
    const down = p < .26 ? smooth(p / .26) : p < .74 ? 1 : 1 - smooth((p - .74) / .26);
    put('NeckBase', .89 * down); put('Neck', .045 * down);
    put('Head', .020 * down + .006 * down * Math.sin(4 * a), .014 * down * Math.sin(2 * a));
    put('Forelock', .010 * down * Math.sin(2 * a));
  } else {
    const run = id === 'run', pitch = (run ? .017 : .0045) * Math.sin(a - .3);
    const roll = (run ? .010 : .007) * Math.sin(a), spine = -(run ? .006 : .0025) * Math.sin(a - .3), chest = .003 * Math.sin(a + .15);
    pelvisOffset[1] = run ? .020 + .012 * Math.sin(2 * a - .3) : .006 + .003 * Math.sin(2 * a);
    put('Pelvis', pitch, 0, roll); put('Spine', spine); put('Chest', chest);
    put('NeckBase', (run ? .020 : .006) + (run ? .016 : .010) * Math.sin(a - .4), 0, -roll * .25);
    put('Neck', -.007 * Math.sin(a - .4)); put('Head', .008 * Math.sin(a + .1));
    const phases = run ? { FrontLeft: 0, BackRight: .10, FrontRight: .5, BackLeft: .60 } : { FrontLeft: 0, BackRight: .09, FrontRight: .5, BackLeft: .59 };
    for (const leg of ['FrontLeft', 'FrontRight', 'BackLeft', 'BackRight'] as const) {
      const q = 2 * Math.PI * ((phases[leg] - p + 1) % 1), front = leg.startsWith('Front'), swing = Math.max(0, Math.sin(q));
      const upper = -(run ? front ? .36 : .24 : front ? .16 : .14) * Math.cos(q);
      const middle = (run ? front ? .72 : .45 : front ? .43 : .29) * swing * swing;
      const lower = -(front ? .13 : run ? .40 : .26) * swing * swing;
      put(`${leg}Upper`, upper); put(`${leg}Middle`, middle); put(`${leg}Lower`, lower);
      put(`${leg}Foot`, -(pitch + (front ? spine + chest : 0) + upper + middle + lower), 0, -roll);
    }
  }
  return { rotations, pelvisOffset };
}
/** 资源创建时以作者绑定的前向变换标定蹄底；播放只有轨道采样，没有腿IK或地形查询。 */
export function bakeYakClips() {
  const data = buildYakMesh(), ids = new Set(data.triangles.filter(f => f.part.endsWith('Hoof')).flatMap(f => f.indices));
  const hoofPoints = [...ids].map(i => data.vertices[i]);
  const binds = YAK_JOINTS.map(j => new Matrix4().makeTranslation(...j.bindWorld).invert());
  const world = YAK_JOINTS.map(() => new Matrix4()), local = new Matrix4(), q = new Quaternion(), e = new Euler();
  const unit = new Vector3(1, 1, 1), pos = new Vector3(), point = new Vector3();
  return new Map(MOUNT_MOTIONS.map(id => {
    const def = YAK_MOTIONS[id], frames = Math.round(def.duration * MOUNT_FPS);
    const times = Array.from({ length: frames + 1 }, (_, i) => i * def.duration / frames);
    const rotations = YAK_JOINTS.map(() => [] as number[]), positions: number[] = [];
    for (let frame = 0; frame <= frames; frame++) {
      const pose = authorYakPose(id, frame === frames ? 0 : frame / frames);
      YAK_JOINTS.forEach((joint, i) => {
        const parent = YAK_JOINTS[joint.parent];
        pos.set(...joint.bindWorld.map((value, axis) => value - (parent?.bindWorld[axis] ?? 0)) as Point3);
        if (i === 1) pos.add(new Vector3(...pose.pelvisOffset));
        q.setFromEuler(e.set(...pose.rotations[i], 'XYZ')).normalize(); rotations[i].push(q.x, q.y, q.z, q.w);
        local.compose(pos, q, unit); if (joint.parent < 0) world[i].copy(local); else world[i].multiplyMatrices(world[joint.parent], local);
      });
      let minimum = Infinity;
      for (const vertex of hoofPoints) {
        const bone = vertex.weight[0]; point.fromArray(vertex.position).applyMatrix4(binds[bone]).applyMatrix4(world[bone]); minimum = Math.min(minimum, point.y);
      }
      const clearance = Math.max(0, .014 - minimum), pelvis = YAK_JOINTS[1].bindWorld;
      positions.push(pelvis[0], pelvis[1] + pose.pelvisOffset[1] + clearance, pelvis[2]);
    }
    const tracks = YAK_JOINTS.slice(1).map((joint, i) => new QuaternionKeyframeTrack(`${joint.name}.quaternion`, times, rotations[i + 1]));
    return [id, new AnimationClip(def.nativeId, def.duration, [...tracks, new VectorKeyframeTrack('Pelvis.position', times, positions)])] as const;
  }));
}
