import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import { HORSE_JOINTS, localBind } from './rig';
import { HORSE_CLIP_IDS, type HorseClipId, type Point3 } from './types';

export const HORSE_ANIMATION_VERSION = 'wanhu-horse-motion-m1-v2';
export const HORSE_FPS = 30;
export const HORSE_CLIPS: ReadonlyArray<{ id: HorseClipId; label: string; duration: number; description: string }> = [
  { id: 'Horse_Idle', label: '停驻 · Idle', duration: 3.6, description: '轻呼吸、头颈变化和小幅甩尾。' },
  { id: 'Horse_Walk', label: '行走 · Walk', duration: 1.2, description: '四拍交替迈步，较小背部起伏。' },
  { id: 'Horse_Run', label: '奔跑 · Run', duration: .8, description: '独立非对称疾驰节奏，收腿、伸展与腾空。' },
  { id: 'Horse_Eat', label: '吃草 · Eat', duration: 6, description: '低头、停留觅食、抬头，完整循环。' },
];
export function isHorseClip(value: string | null): value is HorseClipId { return HORSE_CLIP_IDS.includes(value as HorseClipId); }
export function horseClipDefinition(id: HorseClipId) { return HORSE_CLIPS.find(clip => clip.id === id)!; }

type Key = readonly [number, number];
/** 作者层的周期Hermite曲线。只在烘焙AnimationClip时调用，不是运行时IK或腿部求解。 */
function curve(keys: readonly Key[], phase: number): number {
  const p = ((phase % 1) + 1) % 1, n = keys.length;
  let segment = n - 1;
  for (let i = 0; i < n - 1; i++) if (p >= keys[i][0] && p < keys[i + 1][0]) { segment = i; break; }
  const at = (index: number): Key => {
    const cycle = Math.floor(index / n), key = keys[((index % n) + n) % n];
    return [key[0] + cycle, key[1]];
  };
  const before = at(segment - 1), a = at(segment), b = at(segment + 1), after = at(segment + 2);
  const h = b[0] - a[0], t = (p - a[0]) / h, t2 = t * t, t3 = t2 * t;
  const ma = (b[1] - before[1]) / (b[0] - before[0]), mb = (after[1] - a[1]) / (after[0] - a[0]);
  return (2 * t3 - 3 * t2 + 1) * a[1] + (t3 - 2 * t2 + t) * h * ma
    + (-2 * t3 + 3 * t2) * b[1] + (t3 - t2) * h * mb;
}
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
export interface HorseAuthoredPose { rotations: Point3[]; pelvisOffset: Point3 }
/** 局部旋转与骨盆偏移的作者姿态；Root始终保持绑定，不包含场景运动。 */
export function authorHorsePose(id: HorseClipId, phase: number): HorseAuthoredPose {
  const p = ((phase % 1) + 1) % 1, angle = p * TAU;
  const rotations: Point3[] = HORSE_JOINTS.map(() => [0, 0, 0]);
  const pelvisOffset: Point3 = [0, 0, 0];
  const put = (name: string, x: number, y = 0, z = 0) => {
    const i = HORSE_JOINTS.findIndex(j => j.name === name); rotations[i] = [x, y, z];
  };
  if (id === 'Horse_Idle') {
    pelvisOffset[1] = .004 * Math.sin(angle);
    put('Chest', .006 * Math.sin(angle)); put('Neck', .017 * Math.sin(angle));
    put('Head', .025 * Math.sin(angle + .3), .022 * Math.sin(angle));
    put('Tail', .035 * Math.sin(angle), 0, .075 * Math.sin(angle));
    put('TailEnd', .025 * Math.sin(angle - .4), 0, .09 * Math.sin(angle - .35));
  } else if (id === 'Horse_Eat') {
    const down = p < .22 ? smooth(p / .22) : p <= .72 ? 1 : 1 - smooth((p - .72) / .28);
    pelvisOffset[1] = -.012 * down;
    put('Chest', .018 * down); put('Spine', -.006 * down);
    put('Neck', 1.80 * down); put('NeckUpper', .45 * down);
    put('Head', -1.75 * down + .018 * down * Math.sin(angle * 4), .035 * down * Math.sin(angle * 2));
    put('Tail', .018 * Math.sin(angle), 0, .045 * Math.sin(angle));
    put('TailEnd', 0, 0, .05 * Math.sin(angle - .3));
  } else {
    const run = id === 'Horse_Run';
    const pelvisPitch = run ? .035 * Math.sin(angle - .7) : .007 * Math.sin(2 * angle);
    const spinePitch = run ? -.014 * Math.sin(angle - .7) : -.004 * Math.sin(2 * angle);
    const chestPitch = run ? .010 * Math.sin(angle + .4) : .004 * Math.sin(2 * angle + .3);
    // 审图后校准作者层高度曲线，消除首稿约4cm的入地；不读取蹄位置、不执行贴地求解。
    pelvisOffset[1] = run ? .017 + .048 * Math.sin(angle - .8)
      : .0113 - .0099 * Math.cos(2 * angle) - .0012 * Math.sin(2 * angle);
    put('Pelvis', pelvisPitch); put('Spine', spinePitch); put('Chest', chestPitch);
    put('Neck', run ? .10 + .10 * Math.sin(angle - .4) : .025 * Math.sin(2 * angle - .4));
    put('NeckUpper', run ? -.045 * Math.sin(angle - .4) : -.012 * Math.sin(2 * angle - .4));
    put('Head', run ? -.05 + .05 * Math.sin(angle + .4) : .018 * Math.sin(2 * angle + .2));
    put('Tail', (run ? .24 : .04) + .05 * Math.sin(angle), 0, .07 * Math.sin(angle));
    put('TailEnd', .05 * Math.sin(angle - .5), 0, .1 * Math.sin(angle - .4));
    // Walk：后左→前左→后右→前右；Run：后足相继推进，再由前足相继接地。
    const contacts = run ? { BackRight: 0, BackLeft: .13, FrontRight: .42, FrontLeft: .55 }
      : { BackLeft: 0, FrontLeft: .25, BackRight: .5, FrontRight: .75 };
    for (const leg of ['FrontLeft', 'FrontRight', 'BackLeft', 'BackRight'] as const) {
      const q = (p - contacts[leg] + 1) % 1, front = leg.startsWith('Front');
      let upper: number, middle: number, lower: number;
      if (!run) {
        upper = curve([[0, front ? -.24 : -.16], [.32, .015], [.64, front ? .27 : .27], [.77, .19], [.91, front ? -.29 : -.20]], q);
        middle = front ? curve([[0, .015], [.62, .025], [.77, .86], [.9, .43]], q)
          : curve([[0, -.02], [.62, .015], [.78, .47], [.91, .24]], q);
        lower = front ? curve([[0, 0], [.63, -.035], [.79, -.16], [.93, -.02]], q)
          : curve([[0, .02], [.63, -.05], [.79, -.46], [.93, -.13]], q);
      } else {
        upper = front ? curve([[0, -.50], [.16, -.02], [.30, .64], [.50, .61], [.72, -.10], [.90, -.65]], q)
          : curve([[0, -.19], [.16, .05], [.31, .53], [.48, .52], [.72, -.15], [.90, -.24]], q);
        middle = front ? curve([[0, .06], [.28, .04], [.49, 1.10], [.66, 1.20], [.86, .43]], q)
          : curve([[0, .04], [.29, .10], [.49, .71], [.67, .77], [.87, .23]], q);
        lower = front ? curve([[0, -.04], [.28, -.03], [.54, -.31], [.72, -.25], [.90, -.05]], q)
          : curve([[0, .025], [.30, -.10], [.50, -.82], [.71, -.71], [.90, -.12]], q);
      }
      put(`${leg}Upper`, upper); put(`${leg}Middle`, middle); put(`${leg}Lower`, lower);
      // 作者层蹄姿抵消链条俯仰，保持平蹄；没有读取地形、目标位置或接触解算。
      const bodyPitch = pelvisPitch + (front ? spinePitch + chestPitch : 0);
      put(`${leg}Hoof`, -(bodyPitch + upper + middle + lower));
    }
  }
  return { rotations, pelvisOffset };
}

/** 标准局部位置／四元数轨道，可离线保存、迁移或再次烘焙GPU动画；不更改人物FBX。 */
export function bakeHorseClip(id: HorseClipId): AnimationClip {
  const definition = horseClipDefinition(id), frames = Math.round(definition.duration * HORSE_FPS);
  const times = Array.from({ length: frames + 1 }, (_, i) => i * definition.duration / frames);
  const quaternions = HORSE_JOINTS.map(() => [] as number[]), positions: number[] = [];
  const q = new Quaternion(), euler = new Euler(), bind = localBind(1);
  times.forEach((_, frame) => {
    const pose = authorHorsePose(id, frame === frames ? 0 : frame / frames);
    pose.rotations.forEach((rotation, bone) => { q.setFromEuler(euler.set(...rotation, 'XYZ')).normalize(); quaternions[bone].push(q.x, q.y, q.z, q.w); });
    positions.push(bind[0] + pose.pelvisOffset[0], bind[1] + pose.pelvisOffset[1], bind[2] + pose.pelvisOffset[2]);
  });
  const tracks = HORSE_JOINTS.slice(1).map((bone, index) => new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, quaternions[index + 1]));
  return new AnimationClip(id, definition.duration, [...tracks, new VectorKeyframeTrack('Pelvis.position', times, positions)]);
}
export function bakeHorseClips() { return new Map(HORSE_CLIP_IDS.map(id => [id, bakeHorseClip(id)])); }
