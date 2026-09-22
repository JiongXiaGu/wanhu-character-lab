import { AnimationClip, Euler, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import { MOUNT_FPS, MOUNT_MOTIONS, type MountMotion, type MountMotionDefinition } from '../mounts/types';
import type { Point3 } from '../horse/types';
import { CAMEL_JOINTS, camelBone } from './rig';
import { buildCamelMesh } from './geometry';

export const CAMEL_MOTION_VERSION = 'wanhu-camel-motion-m5-v1';
export const CAMEL_MOTIONS: Readonly<Record<MountMotion, MountMotionDefinition>> = {
  idle: { nativeId: 'Camel_Idle', duration: 4.8, label: '停驻', description: '长颈缓摆、轻呼吸与短耳尾动作。' },
  walk: { nativeId: 'Camel_Walk', duration: 1.6, label: '步行', description: '同侧前后腿略错相，左右交替，轻微侧摆。' },
  run: { nativeId: 'Camel_Run', duration: 1.0, label: '奔跑', description: '独立大步幅收伸腿与颈部补偿，不只是步行加速。' },
  eat: { nativeId: 'Camel_Eat', duration: 6.8, label: '进食', description: '三段长颈下探、停留啃食再抬头；本体专用。' },
};
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
/** +Z朝前：支撑半周期脚向-Z后掠，抬脚半周期回摆向前，不能反向蹬地。 */
export function authorCamelPose(id: MountMotion, phase: number) {
  const p = ((phase % 1) + 1) % 1, a = 2 * Math.PI * p;
  const rotations: Point3[] = CAMEL_JOINTS.map(() => [0, 0, 0]), pelvisOffset: Point3 = [0, 0, 0];
  const put = (name: string, x: number, y = 0, z = 0) => { rotations[camelBone(name)] = [x, y, z]; };
  put('LeftEar', .023 * Math.sin(a + .3), 0, .030 * Math.sin(a));
  put('RightEar', .021 * Math.sin(a - .4), 0, -.026 * Math.sin(a + .6));
  put('Tail', .016 * Math.sin(a), 0, .05 * Math.sin(a));
  put('TailMiddle', .02 * Math.sin(a - .2), 0, .065 * Math.sin(a - .3));
  put('TailEnd', .02 * Math.sin(a - .4), 0, .08 * Math.sin(a - .5));
  if (id === 'idle') {
    pelvisOffset[1] = .004 * Math.sin(a); put('Chest', .003 * Math.sin(a));
    put('NeckBase', .007 * Math.sin(a), .012 * Math.sin(a)); put('Neck', -.006 * Math.sin(a));
    put('NeckUpper', .010 * Math.sin(a - .2)); put('Head', .012 * Math.sin(a + .3), -.006 * Math.sin(a));
  } else if (id === 'eat') {
    const down = p < .24 ? smooth(p / .24) : p < .72 ? 1 : 1 - smooth((p - .72) / .28);
    put('NeckBase', 1.80 * down); put('Neck', .10 * down); put('NeckUpper', -.35 * down);
    put('Head', -.90 * down + .006 * down * Math.sin(4 * a), .01 * down * Math.sin(2 * a));
  } else {
    const run = id === 'run', pitch = (run ? .022 : .005) * Math.sin(a - .4);
    const roll = (run ? .024 : .018) * Math.sin(a), spine = -(run ? .008 : .002) * Math.sin(a - .4), chest = .004 * Math.sin(a + .2);
    pelvisOffset[1] = run ? .03 + .026 * Math.sin(2 * a - .4) : .006 + .004 * Math.sin(2 * a);
    put('Pelvis', pitch, 0, roll); put('Spine', spine); put('Chest', chest);
    put('NeckBase', (run ? .045 : .01) + .020 * Math.sin(a - .3), 0, -roll * .4);
    put('Neck', -.016 * Math.sin(a - .3)); put('NeckUpper', -.010 * Math.sin(a - .3)); put('Head', .014 * Math.sin(a + .2));
    const phases = run ? { BackLeft: 0, FrontLeft: .12, BackRight: .5, FrontRight: .62 } : { BackLeft: 0, FrontLeft: .07, BackRight: .5, FrontRight: .57 };
    for (const leg of ['FrontLeft', 'FrontRight', 'BackLeft', 'BackRight'] as const) {
      const q = 2 * Math.PI * ((phases[leg] - p + 1) % 1), front = leg.startsWith('Front'), swing = Math.max(0, Math.sin(q));
      const upper = -(run ? front ? .32 : .25 : front ? .16 : .14) * Math.cos(q);
      const middle = (run ? front ? .76 : .46 : front ? .48 : .28) * swing * swing;
      const lower = -(front ? .15 : run ? .45 : .28) * swing * swing;
      put(`${leg}Upper`, upper); put(`${leg}Middle`, middle); put(`${leg}Lower`, lower);
      put(`${leg}Foot`, -(pitch + (front ? spine + chest : 0) + upper + middle + lower), 0, -roll);
    }
  }
  return { rotations, pelvisOffset };
}
/** 创建片段时标定脚垫高度；运行时只有AnimationClip采样，没有腿IK、地形或根位移。 */
export function bakeCamelClips() {
  const data = buildCamelMesh(), footIds = new Set(data.triangles.filter(face => face.part.endsWith('Pad') || face.part.endsWith('Toe')).flatMap(face => face.indices));
  const footPoints = [...footIds].map(i => data.vertices[i]);
  const binds = CAMEL_JOINTS.map(j => new Matrix4().makeTranslation(...j.bindWorld).invert());
  const world = CAMEL_JOINTS.map(() => new Matrix4()), local = new Matrix4(), q = new Quaternion(), e = new Euler();
  const unit = new Vector3(1, 1, 1), pos = new Vector3(), point = new Vector3();
  return new Map(MOUNT_MOTIONS.map(id => {
    const def = CAMEL_MOTIONS[id], frames = Math.round(def.duration * MOUNT_FPS);
    const times = Array.from({ length: frames + 1 }, (_, i) => i * def.duration / frames), rotations = CAMEL_JOINTS.map(() => [] as number[]), positions: number[] = [];
    for (let frame = 0; frame <= frames; frame++) {
      const pose = authorCamelPose(id, frame === frames ? 0 : frame / frames);
      CAMEL_JOINTS.forEach((joint, i) => {
        const parent = CAMEL_JOINTS[joint.parent]; pos.set(...joint.bindWorld.map((value, axis) => value - (parent?.bindWorld[axis] ?? 0)) as Point3);
        if (i === 1) pos.add(new Vector3(...pose.pelvisOffset));
        q.setFromEuler(e.set(...pose.rotations[i], 'XYZ')).normalize(); rotations[i].push(q.x, q.y, q.z, q.w);
        local.compose(pos, q, unit); if (joint.parent < 0) world[i].copy(local); else world[i].multiplyMatrices(world[joint.parent], local);
      });
      let minimum = Infinity;
      for (const vertex of footPoints) {
        const bone = vertex.weight[0]; point.fromArray(vertex.position).applyMatrix4(binds[bone]).applyMatrix4(world[bone]); minimum = Math.min(minimum, point.y);
      }
      const clearance = Math.max(0, .014 - minimum), pelvis = CAMEL_JOINTS[1].bindWorld;
      positions.push(pelvis[0], pelvis[1] + pose.pelvisOffset[1] + clearance, pelvis[2]);
    }
    const tracks = CAMEL_JOINTS.slice(1).map((joint, i) => new QuaternionKeyframeTrack(`${joint.name}.quaternion`, times, rotations[i + 1]));
    return [id, new AnimationClip(def.nativeId, def.duration, [...tracks, new VectorKeyframeTrack('Pelvis.position', times, positions)])] as const;
  }));
}
