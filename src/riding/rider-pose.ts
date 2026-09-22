import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, Vector3 } from 'three';
import { B, type CharacterData } from '../character/v3/types';
import { authorHorsePose, HORSE_FPS } from '../horse/animation';
import { RIDER_FIT } from './rider-seat';
import { RIDING_CLIP_IDS, ridingDefinition, type RidingSelection } from './types';

export const RIDER_POSE_VERSION = 'wanhu-rider-pose-m2-v1';
/** 制作层方向标定，只在生成轨道时使用；不是运行时IK，不修改人体绑定或服饰权重。 */
export function authorRiderPose(data: CharacterData, id: RidingSelection, phase: number): Quaternion[] {
  const rotations = data.joints.map(() => new Quaternion());
  const p = ((phase % 1) + 1) % 1, a = 2 * Math.PI * p;
  const moving = id !== 'pose', run = id === 'Rider_Run', walk = id === 'Rider_Walk';
  const wave = moving ? Math.sin(a) : 0;
  const horsePose = moving ? authorHorsePose(ridingDefinition(id).horse, p) : null;
  const horsePitch = horsePose ? horsePose.rotations[1][0] + horsePose.rotations[2][0] : 0;
  const setEuler = (bone: number, x: number, y = 0, z = 0) => rotations[bone].setFromEuler(new Euler(x, y, z, 'XYZ')).normalize();
  // 马背已经提供整体升降。骑手不再复制它的位移，只做有限的躯干缓冲。
  setEuler(B.Spine, (run ? .12 : .025) - horsePitch * .65 + (run ? .014 : .004) * wave, 0, walk ? .008 * wave : 0);
  setEuler(B.Chest, moving ? .004 * Math.sin(a + .4) : 0);
  setEuler(B.Neck, run ? -.04 : -.008);
  setEuler(B.Head, moving ? .004 * Math.sin(a - .2) : 0);
  const aim = (from: number, to: number, direction: Vector3) => {
    const rest = new Vector3(...data.joints[to].p).sub(new Vector3(...data.joints[from].p)).normalize();
    return new Quaternion().setFromUnitVectors(rest, direction.normalize()).normalize();
  };
  const fit = RIDER_FIT[data.recipe.bodyType];
  for (const side of [1, -1]) {
    const right = side === 1;
    const thigh = right ? B.RightThigh : B.LeftThigh, shin = right ? B.RightShin : B.LeftShin, foot = right ? B.RightFoot : B.LeftFoot;
    const soft = run ? .009 * Math.sin(a - .3) : walk ? .003 * wave : 0;
    const thighWorld = aim(thigh, shin, new Vector3(side * fit.thighDirection[0], fit.thighDirection[1], fit.thighDirection[2] + soft));
    const shinWorld = aim(shin, foot, new Vector3(side * .12, -.99, -.08 + soft));
    rotations[thigh].copy(thighWorld);
    rotations[shin].copy(thighWorld).invert().multiply(shinWorld).normalize();
    // 足部保持向前，不随膝盖摆成脚尖插入马腹的方向。
    rotations[foot].copy(shinWorld).invert().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), side * .08)).normalize();
    const upper = right ? B.RightUpperArm : B.LeftUpperArm, lower = right ? B.RightForearm : B.LeftForearm, hand = right ? B.RightHand : B.LeftHand;
    const upperWorld = aim(upper, lower, new Vector3(side * .12, -.93, .35 + .006 * wave));
    const lowerWorld = aim(lower, hand, new Vector3(-side * .14, .28, .95));
    rotations[upper].copy(upperWorld);
    rotations[lower].copy(upperWorld).invert().multiply(lowerWorld).normalize();
    // 当前没有缰绳和手指骨骼，手只保持放松前伸，不伪称精确握持。
  }
  return rotations;
}
export function bakeRiderClip(data: CharacterData, id: RidingSelection): AnimationClip {
  const duration = id === 'pose' ? 1 : ridingDefinition(id).duration;
  const frames = id === 'pose' ? 1 : Math.round(duration * HORSE_FPS);
  const times = Array.from({ length: frames + 1 }, (_, index) => duration * index / frames);
  const values = data.joints.map(() => [] as number[]);
  for (let frame = 0; frame <= frames; frame++) {
    const pose = authorRiderPose(data, id, frame === frames ? 0 : frame / frames);
    pose.forEach((q, bone) => values[bone].push(q.x, q.y, q.z, q.w));
  }
  const tracks = data.joints.map((bone, index) => new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values[index]));
  return new AnimationClip(id === 'pose' ? 'Rider_Pose' : id, duration, tracks);
}
export function bakeRiderClips(data: CharacterData): Map<RidingSelection, AnimationClip> {
  return new Map((['pose', ...RIDING_CLIP_IDS] as RidingSelection[]).map(id => [id, bakeRiderClip(data, id)]));
}
