import { AnimationClip, Euler, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import { MOUNT_FPS, MOUNT_MOTIONS, type MountMotion, type MountMotionDefinition } from '../mounts/types';
import type { Point3 } from '../horse/types';
import { BUFFALO_JOINTS, buffaloBone } from './rig';
import { buildBuffaloMesh } from './geometry';

export const BUFFALO_MOTION_VERSION = 'wanhu-buffalo-motion-m8-v1';
export const BUFFALO_MOTIONS: Readonly<Record<MountMotion, MountMotionDefinition>> = {
  idle: { nativeId: 'Buffalo_Idle', duration: 5.8, label: '停驻', description: '低沉宽体缓慢呼吸，横耳和长尾轻摆。' },
  walk: { nativeId: 'Buffalo_Walk', duration: 2.0, label: '步行', description: '慢而重的中等步幅，背部起伏克制，前后肢承重清楚。' },
  run: { nativeId: 'Buffalo_Run', duration: 1.15, label: '奔跑', description: '短距离沉重快跑，增加后肢推地，不采用赛马式疾驰。' },
  eat: { nativeId: 'Buffalo_Eat', duration: 7.2, label: '进食', description: '低位宽头和短颈一起下压，近地停留扫动后缓慢抬头。' },
};
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
/** 水牛独立作者曲线；低位脚向-Z后掠，高位回到+Z，不倒放或镜像修正方向。 */
export function authorBuffaloPose(id: MountMotion, phase: number) {
  const p = ((phase % 1) + 1) % 1, a = 2 * Math.PI * p;
  const rotations: Point3[] = BUFFALO_JOINTS.map(() => [0, 0, 0]), pelvisOffset: Point3 = [0, 0, 0];
  const put = (name: string, x: number, y = 0, z = 0) => { rotations[buffaloBone(name)] = [x, y, z]; };
  put('LeftEar', .019 * Math.sin(a + .3), .015 * Math.sin(2 * a), .035 * Math.sin(a));
  put('RightEar', .018 * Math.sin(a - .4), -.013 * Math.sin(2 * a + .2), -.032 * Math.sin(a + .6));
  put('Tail', .011 * Math.sin(a), 0, .070 * Math.sin(a));
  put('TailMiddle', .019 * Math.sin(a - .3), 0, .11 * Math.sin(a - .35));
  put('TailEnd', .016 * Math.sin(a - .6), 0, .13 * Math.sin(a - .65));
  if (id === 'idle') {
    pelvisOffset[1] = .002 * Math.sin(a); put('Chest', .0028 * Math.sin(a));
    put('NeckBase', .0035 * Math.sin(a), .004 * Math.sin(a)); put('Neck', -.004 * Math.sin(a));
    put('Head', .006 * Math.sin(a + .3), -.004 * Math.sin(a));
  } else if (id === 'eat') {
    const down = p < .28 ? smooth(p / .28) : p < .73 ? 1 : 1 - smooth((p - .73) / .27);
    put('NeckBase', .80 * down); put('Neck', -.02 * down);
    put('Head', .045 * down + .004 * down * Math.sin(4 * a), .012 * down * Math.sin(2 * a));
  } else {
    const run = id === 'run', pitch = (run ? .016 : .004) * Math.sin(a - .35);
    const roll = (run ? .009 : .006) * Math.sin(a), spine = -(run ? .006 : .002) * Math.sin(a - .35), chest = .003 * Math.sin(a + .2);
    pelvisOffset[1] = run ? .018 + .013 * Math.sin(2 * a - .3) : .006 + .003 * Math.sin(2 * a);
    put('Pelvis', pitch, 0, roll); put('Spine', spine); put('Chest', chest);
    put('NeckBase', (run ? .017 : .006) + (run ? .014 : .009) * Math.sin(a - .3), 0, -roll * .3);
    put('Neck', -.007 * Math.sin(a - .3)); put('Head', .008 * Math.sin(a + .2));
    const phases = run ? { FrontLeft: 0, BackRight: .09, FrontRight: .5, BackLeft: .59 } : { FrontLeft: 0, BackRight: .05, FrontRight: .5, BackLeft: .55 };
    for (const leg of ['FrontLeft', 'FrontRight', 'BackLeft', 'BackRight'] as const) {
      const q = 2 * Math.PI * ((phases[leg] - p + 1) % 1), front = leg.startsWith('Front'), swing = Math.max(0, Math.sin(q));
      // 短前肢在快跑回收期加大屈膝，保证有实际离地回摆而非贴地往返。
      const upper = -(run ? front ? .42 : .27 : front ? .18 : .155) * Math.cos(q);
      const middle = (run ? front ? .84 : .47 : front ? .42 : .29) * swing * swing;
      const lower = -(front ? .13 : run ? .41 : .26) * swing * swing;
      put(`${leg}Upper`, upper); put(`${leg}Middle`, middle); put(`${leg}Lower`, lower);
      put(`${leg}Foot`, -(pitch + (front ? spine + chest : 0) + upper + middle + lower), 0, -roll);
    }
  }
  return { rotations, pelvisOffset };
}
/** 仅在创建AnimationClip时以真实绑定标定蹄底留量；运行时无IK、地形或水平根位移。 */
export function bakeBuffaloClips() {
  const data = buildBuffaloMesh(), hoofIds = new Set(data.triangles.filter(face => face.part.endsWith('Hoof')).flatMap(face => face.indices));
  const hoofPoints = [...hoofIds].map(i => data.vertices[i]);
  const binds = BUFFALO_JOINTS.map(j => new Matrix4().makeTranslation(...j.bindWorld).invert());
  const world = BUFFALO_JOINTS.map(() => new Matrix4()), local = new Matrix4(), q = new Quaternion(), e = new Euler();
  const unit = new Vector3(1, 1, 1), pos = new Vector3(), point = new Vector3();
  return new Map(MOUNT_MOTIONS.map(id => {
    const def = BUFFALO_MOTIONS[id], frames = Math.round(def.duration * MOUNT_FPS);
    const times = Array.from({ length: frames + 1 }, (_, i) => i * def.duration / frames), rotations = BUFFALO_JOINTS.map(() => [] as number[]), positions: number[] = [];
    for (let frame = 0; frame <= frames; frame++) {
      const pose = authorBuffaloPose(id, frame === frames ? 0 : frame / frames);
      BUFFALO_JOINTS.forEach((joint, i) => {
        const parent = BUFFALO_JOINTS[joint.parent]; pos.set(...joint.bindWorld.map((value, axis) => value - (parent?.bindWorld[axis] ?? 0)) as Point3);
        if (i === 1) pos.add(new Vector3(...pose.pelvisOffset));
        q.setFromEuler(e.set(...pose.rotations[i], 'XYZ')).normalize(); rotations[i].push(q.x, q.y, q.z, q.w);
        local.compose(pos, q, unit); if (joint.parent < 0) world[i].copy(local); else world[i].multiplyMatrices(world[joint.parent], local);
      });
      let minimum = Infinity;
      for (const vertex of hoofPoints) {
        const bone = vertex.weight[0]; point.fromArray(vertex.position).applyMatrix4(binds[bone]).applyMatrix4(world[bone]); minimum = Math.min(minimum, point.y);
      }
      const clearance = Math.max(0, .014 - minimum), pelvis = BUFFALO_JOINTS[1].bindWorld;
      positions.push(pelvis[0], pelvis[1] + pose.pelvisOffset[1] + clearance, pelvis[2]);
    }
    const tracks = BUFFALO_JOINTS.slice(1).map((joint, i) => new QuaternionKeyframeTrack(`${joint.name}.quaternion`, times, rotations[i + 1]));
    return [id, new AnimationClip(def.nativeId, def.duration, [...tracks, new VectorKeyframeTrack('Pelvis.position', times, positions)])] as const;
  }));
}
