import { AnimationClip, Euler, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import { MOUNT_FPS, MOUNT_MOTIONS, type MountMotion, type MountMotionDefinition } from '../mounts/types';
import { DONKEY_JOINTS, donkeyBone } from './rig';
import { buildDonkeyMesh } from './geometry';
import type { Point3 } from '../horse/types';

export const DONKEY_MOTION_VERSION = 'wanhu-donkey-motion-m4-v1';
export const DONKEY_MOTIONS: Readonly<Record<MountMotion, MountMotionDefinition>> = {
  idle: { nativeId: 'Donkey_Idle', duration: 4, label: '停驻', description: '轻呼吸、长耳转动和尾端摆动。' },
  walk: { nativeId: 'Donkey_Walk', duration: 1.4, label: '步行', description: '短步幅四拍交替，保持较低躯干起伏。' },
  run: { nativeId: 'Donkey_Run', duration: .9, label: '奔跑', description: '独立接地相位与收伸腿，不是马动作缩放或步行加速。' },
  eat: { nativeId: 'Donkey_Eat', duration: 6, label: '进食', description: '低头、停留和抬头，仅在坐骑本体页播放。' },
};
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** 灰驴自己的作者曲线。骨盆离地标定只在烘焙轨道时执行，不在播放中做IK。 */
export function authorDonkeyPose(id: MountMotion, phase: number) {
  const p = ((phase % 1) + 1) % 1, a = Math.PI * 2 * p;
  const rotations: Point3[] = DONKEY_JOINTS.map(() => [0, 0, 0]), pelvisOffset: Point3 = [0, 0, 0];
  const put = (name: string, x: number, y = 0, z = 0) => { rotations[donkeyBone(name)] = [x, y, z]; };
  put('LeftEar', .035 * Math.sin(a + .3), 0, .045 * Math.sin(a));
  put('RightEar', .028 * Math.sin(a - .4), 0, -.037 * Math.sin(a + .6));
  put('Tail', .018 * Math.sin(a), 0, .07 * Math.sin(a)); put('TailEnd', .025 * Math.sin(a - .4), 0, .10 * Math.sin(a - .5));
  if (id === 'idle') {
    pelvisOffset[1] = .003 * Math.sin(a); put('Chest', .004 * Math.sin(a)); put('Neck', .012 * Math.sin(a)); put('Head', .018 * Math.sin(a + .2), .012 * Math.sin(a));
  } else if (id === 'eat') {
    const down = p < .23 ? smooth(p / .23) : p < .73 ? 1 : 1 - smooth((p - .73) / .27);
    // 首稿口鼻最低仍离地约14cm；校准颈部作者姿态，不改地面或放宽检测范围。
    put('Neck', 2.00 * down); put('NeckUpper', .45 * down); put('Head', -1.75 * down + .012 * down * Math.sin(4 * a), .018 * down * Math.sin(2 * a));
  } else {
    const run = id === 'run', pitch = (run ? .025 : .005) * Math.sin(a - .4), spine = -(run ? .008 : .002) * Math.sin(a - .4), chest = .004 * Math.sin(a + .2);
    pelvisOffset[1] = run ? .024 + .025 * Math.sin(a - .5) : .006 + .004 * Math.sin(2 * a);
    put('Pelvis', pitch); put('Spine', spine); put('Chest', chest);
    put('Neck', (run ? .04 : 0) + .024 * Math.sin(a - .3)); put('NeckUpper', -.012 * Math.sin(a - .3)); put('Head', .018 * Math.sin(a + .2));
    const phases = run ? { BackRight: 0, BackLeft: .14, FrontRight: .46, FrontLeft: .57 } : { BackLeft: 0, FrontLeft: .25, BackRight: .5, FrontRight: .75 };
    for (const leg of ['FrontLeft', 'FrontRight', 'BackLeft', 'BackRight'] as const) {
      const q = 2 * Math.PI * ((phases[leg] - p + 1) % 1), front = leg.startsWith('Front'), swing = Math.max(0, Math.sin(q));
      const upper = -(run ? front ? .38 : .28 : front ? .19 : .16) * Math.cos(q);
      const middle = (run ? front ? .87 : .51 : front ? .56 : .31) * swing * swing;
      const lower = -(front ? .16 : run ? .53 : .30) * swing * swing;
      put(`${leg}Upper`, upper); put(`${leg}Middle`, middle); put(`${leg}Lower`, lower);
      put(`${leg}Hoof`, -(pitch + (front ? spine + chest : 0) + upper + middle + lower));
    }
  }
  return { rotations, pelvisOffset };
}
export function bakeDonkeyClips() {
  const hoofVertices = buildDonkeyMesh();
  const hoofIds = new Set(hoofVertices.triangles.filter(f => f.part.endsWith('Hoof')).flatMap(f => f.indices));
  const hoofPoints = [...hoofIds].map(i => hoofVertices.vertices[i]);
  const binds = DONKEY_JOINTS.map(j => new Matrix4().makeTranslation(...j.bindWorld).invert());
  const world = DONKEY_JOINTS.map(() => new Matrix4()), local = new Matrix4(), q = new Quaternion(), e = new Euler(), unit = new Vector3(1, 1, 1), pos = new Vector3(), point = new Vector3();
  return new Map(MOUNT_MOTIONS.map(id => {
    const def = DONKEY_MOTIONS[id], frames = Math.round(def.duration * MOUNT_FPS), times = Array.from({ length: frames + 1 }, (_, i) => i * def.duration / frames);
    const rotations = DONKEY_JOINTS.map(() => [] as number[]), positions: number[] = [];
    for (let frame = 0; frame <= frames; frame++) {
      const pose = authorDonkeyPose(id, frame === frames ? 0 : frame / frames);
      DONKEY_JOINTS.forEach((joint, i) => {
        const parent = DONKEY_JOINTS[joint.parent]; pos.set(...joint.bindWorld.map((n, a) => n - (parent?.bindWorld[a] ?? 0)) as Point3);
        if (i === 1) pos.add(new Vector3(...pose.pelvisOffset));
        q.setFromEuler(e.set(...pose.rotations[i], 'XYZ')).normalize(); rotations[i].push(q.x, q.y, q.z, q.w);
        local.compose(pos, q, unit); if (joint.parent < 0) world[i].copy(local); else world[i].multiplyMatrices(world[joint.parent], local);
      });
      let minimum = Infinity;
      for (const vertex of hoofPoints) {
        const bone = vertex.weight[0]; point.fromArray(vertex.position).applyMatrix4(binds[bone]).applyMatrix4(world[bone]); minimum = Math.min(minimum, point.y);
      }
      // 作者烘焙时用真实蹄壳校准竖向留量，不改地面、不拉伸骨骼，不在运行时贴蹄。
      const clearance = Math.max(0, .012 - minimum), pelvis = DONKEY_JOINTS[1].bindWorld;
      positions.push(pelvis[0] + pose.pelvisOffset[0], pelvis[1] + pose.pelvisOffset[1] + clearance, pelvis[2] + pose.pelvisOffset[2]);
    }
    const tracks = DONKEY_JOINTS.slice(1).map((joint, i) => new QuaternionKeyframeTrack(`${joint.name}.quaternion`, times, rotations[i + 1]));
    return [id, new AnimationClip(def.nativeId, def.duration, [...tracks, new VectorKeyframeTrack('Pelvis.position', times, positions)])] as const;
  }));
}
