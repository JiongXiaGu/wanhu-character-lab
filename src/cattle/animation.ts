import { AnimationClip, Euler, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import { MOUNT_FPS, MOUNT_MOTIONS, type MountMotion, type MountMotionDefinition } from '../mounts/types';
import type { Point3 } from '../horse/types';
import { CATTLE_JOINTS, cattleBone } from './rig';
import { buildCattleMesh } from './geometry';

export const CATTLE_MOTION_VERSION = 'wanhu-cattle-motion-m6-v2';
export const CATTLE_MOTIONS: Readonly<Record<MountMotion, MountMotionDefinition>> = {
  idle: { nativeId: 'Cattle_Idle', duration: 5.2, label: '停驻', description: '厚重身体缓慢呼吸、横耳轻摆、细尾甩动。' },
  walk: { nativeId: 'Cattle_Walk', duration: 1.8, label: '步行', description: '缓慢稳重的对角腿节奏，短粗颈随步轻点。' },
  run: { nativeId: 'Cattle_Run', duration: 1.05, label: '奔跑', description: '沉重快跑，较大步幅与胸臀起伏，不作赛马式疾驰。' },
  eat: { nativeId: 'Cattle_Eat', duration: 6.8, label: '进食', description: '短颈和宽头一起下探，低位扫动啃食，再缓慢抬头。' },
};
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
/** 独立作者曲线；+Z前进的支撑腿向-Z后掠，禁止倒放时钟或镜像修方向。 */
export function authorCattlePose(id: MountMotion, phase: number) {
  const p = ((phase % 1) + 1) % 1, a = 2 * Math.PI * p;
  const rotations: Point3[] = CATTLE_JOINTS.map(() => [0, 0, 0]), pelvisOffset: Point3 = [0, 0, 0];
  const put = (name: string, x: number, y = 0, z = 0) => { rotations[cattleBone(name)] = [x, y, z]; };
  put('LeftEar', .025 * Math.sin(a + .3), .020 * Math.sin(2 * a), .045 * Math.sin(a));
  put('RightEar', .022 * Math.sin(a - .4), -.018 * Math.sin(2 * a + .2), -.04 * Math.sin(a + .6));
  put('Tail', .016 * Math.sin(a), 0, .085 * Math.sin(a));
  put('TailMiddle', .025 * Math.sin(a - .3), 0, .12 * Math.sin(a - .35));
  put('TailEnd', .02 * Math.sin(a - .6), 0, .14 * Math.sin(a - .65));
  if (id === 'idle') {
    pelvisOffset[1] = .003 * Math.sin(a); put('Chest', .0035 * Math.sin(a));
    put('NeckBase', .006 * Math.sin(a), .008 * Math.sin(a)); put('Neck', -.005 * Math.sin(a));
    put('Head', .01 * Math.sin(a + .3), -.005 * Math.sin(a));
  } else if (id === 'eat') {
    const down = p < .25 ? smooth(p / .25) : p < .72 ? 1 : 1 - smooth((p - .72) / .28);
    put('NeckBase', 1.48 * down); put('Neck', .03 * down);
    put('Head', .02 * down + .006 * down * Math.sin(4 * a), .014 * down * Math.sin(2 * a));
  } else {
    const run = id === 'run', pitch = (run ? .022 : .006) * Math.sin(a - .35);
    const roll = (run ? .012 : .009) * Math.sin(a), spine = -(run ? .009 : .003) * Math.sin(a - .35), chest = .004 * Math.sin(a + .2);
    pelvisOffset[1] = run ? .025 + .020 * Math.sin(2 * a - .3) : .008 + .004 * Math.sin(2 * a);
    put('Pelvis', pitch, 0, roll); put('Spine', spine); put('Chest', chest);
    put('NeckBase', (run ? .025 : .008) + (run ? .02 : .012) * Math.sin(a - .3), 0, -roll * .3);
    put('Neck', -.009 * Math.sin(a - .3)); put('Head', .01 * Math.sin(a + .2));
    const phases = run ? { FrontLeft: 0, BackRight: .08, FrontRight: .5, BackLeft: .58 } : { FrontLeft: 0, BackRight: .04, FrontRight: .5, BackLeft: .54 };
    for (const leg of ['FrontLeft', 'FrontRight', 'BackLeft', 'BackRight'] as const) {
      const q = 2 * Math.PI * ((phases[leg] - p + 1) % 1), front = leg.startsWith('Front'), swing = Math.max(0, Math.sin(q));
      const upper = -(run ? front ? .44 : .26 : front ? .17 : .15) * Math.cos(q);
      const middle = (run ? front ? .80 : .42 : front ? .42 : .26) * swing * swing;
      const lower = -(front ? .13 : run ? .40 : .26) * swing * swing;
      put(`${leg}Upper`, upper); put(`${leg}Middle`, middle); put(`${leg}Lower`, lower);
      put(`${leg}Foot`, -(pitch + (front ? spine + chest : 0) + upper + middle + lower), 0, -roll);
    }
  }
  return { rotations, pelvisOffset };
}
/** 仅在创建AnimationClip时以真实绑定标定蹄底留量；运行时无IK、地形或水平根位移。 */
export function bakeCattleClips() {
  const data = buildCattleMesh(), hoofIds = new Set(data.triangles.filter(face => face.part.endsWith('Hoof')).flatMap(face => face.indices));
  const hoofPoints = [...hoofIds].map(i => data.vertices[i]);
  const binds = CATTLE_JOINTS.map(j => new Matrix4().makeTranslation(...j.bindWorld).invert());
  const world = CATTLE_JOINTS.map(() => new Matrix4()), local = new Matrix4(), q = new Quaternion(), e = new Euler();
  const unit = new Vector3(1, 1, 1), pos = new Vector3(), point = new Vector3();
  return new Map(MOUNT_MOTIONS.map(id => {
    const def = CATTLE_MOTIONS[id], frames = Math.round(def.duration * MOUNT_FPS);
    const times = Array.from({ length: frames + 1 }, (_, i) => i * def.duration / frames), rotations = CATTLE_JOINTS.map(() => [] as number[]), positions: number[] = [];
    for (let frame = 0; frame <= frames; frame++) {
      const pose = authorCattlePose(id, frame === frames ? 0 : frame / frames);
      CATTLE_JOINTS.forEach((joint, i) => {
        const parent = CATTLE_JOINTS[joint.parent]; pos.set(...joint.bindWorld.map((value, axis) => value - (parent?.bindWorld[axis] ?? 0)) as Point3);
        if (i === 1) pos.add(new Vector3(...pose.pelvisOffset));
        q.setFromEuler(e.set(...pose.rotations[i], 'XYZ')).normalize(); rotations[i].push(q.x, q.y, q.z, q.w);
        local.compose(pos, q, unit); if (joint.parent < 0) world[i].copy(local); else world[i].multiplyMatrices(world[joint.parent], local);
      });
      let minimum = Infinity;
      for (const vertex of hoofPoints) {
        const bone = vertex.weight[0]; point.fromArray(vertex.position).applyMatrix4(binds[bone]).applyMatrix4(world[bone]); minimum = Math.min(minimum, point.y);
      }
      const clearance = Math.max(0, .014 - minimum), pelvis = CATTLE_JOINTS[1].bindWorld;
      positions.push(pelvis[0], pelvis[1] + pose.pelvisOffset[1] + clearance, pelvis[2]);
    }
    const tracks = CATTLE_JOINTS.slice(1).map((joint, i) => new QuaternionKeyframeTrack(`${joint.name}.quaternion`, times, rotations[i + 1]));
    return [id, new AnimationClip(def.nativeId, def.duration, [...tracks, new VectorKeyframeTrack('Pelvis.position', times, positions)])] as const;
  }));
}
