import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, Vector3 } from 'three';
import { B, type CharacterData } from '../character/v3/types';
import { shapePoint } from '../character/v3/body';
import { mountDefinition } from '../mounts/catalog';
import { MOUNT_FPS, type MountId } from '../mounts/types';
import { RIDING_CLIP_IDS, ridingDefinition, type RidingSelection } from './types';

export const RIDER_POSE_VERSION = 'wanhu-rider-pose-m4-v1';
/** 只在创建轨道时校准；马的M3参数不改，灰驴使用自己的跨坐宽度和时长。 */
export function authorRiderPose(data: CharacterData, id: RidingSelection, phase: number, mountId: MountId = 'horse_chestnut'): Quaternion[] {
  const definition = mountDefinition(mountId), rotations = data.joints.map(() => new Quaternion());
  const p = ((phase % 1) + 1) % 1, a = 2 * Math.PI * p, moving = id !== 'pose', run = id === 'Rider_Run', walk = id === 'Rider_Walk';
  const wave = moving ? Math.sin(a) : 0, backPitch = moving ? definition.backPitch(ridingDefinition(id, mountId).motion, p) : 0;
  const setEuler = (bone: number, x: number, y = 0, z = 0) => rotations[bone].setFromEuler(new Euler(x, y, z, 'XYZ')).normalize();
  setEuler(B.Spine, (run ? .12 : .025) - backPitch * .65 + (run ? .014 : .004) * wave, 0, walk ? .008 * wave : 0);
  setEuler(B.Chest, moving ? .004 * Math.sin(a + .4) : 0); setEuler(B.Neck, run ? -.04 : -.008); setEuler(B.Head, moving ? .004 * Math.sin(a - .2) : 0);
  const aim = (from: number, to: number, direction: Vector3) => {
    const rest = new Vector3(...data.joints[to].p).sub(new Vector3(...data.joints[from].p)).normalize();
    return new Quaternion().setFromUnitVectors(rest, direction.normalize()).normalize();
  };
  const fit = definition.riderFit[data.recipe.bodyType];
  for (const side of [1, -1]) {
    const right = side === 1, thigh = right ? B.RightThigh : B.LeftThigh, shin = right ? B.RightShin : B.LeftShin, foot = right ? B.RightFoot : B.LeftFoot;
    const soft = run ? .009 * Math.sin(a - .3) : walk ? .003 * wave : 0;
    const thighWorld = aim(thigh, shin, new Vector3(side * fit.thighDirection[0], fit.thighDirection[1], fit.thighDirection[2] + soft));
    const shinWorld = aim(shin, foot, new Vector3(side * .12, -.99, -.08 + soft));
    rotations[thigh].copy(thighWorld); rotations[shin].copy(thighWorld).invert().multiply(shinWorld).normalize();
    rotations[foot].copy(shinWorld).invert().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), side * .08)).normalize();
    const upper = right ? B.RightUpperArm : B.LeftUpperArm, lower = right ? B.RightForearm : B.LeftForearm, hand = right ? B.RightHand : B.LeftHand;
    const upperWorld = aim(upper, lower, new Vector3(side * .08, -.91, .41 + .006 * wave)), lowerWorld = aim(lower, hand, new Vector3(-side * .22, .20, .95));
    rotations[upper].copy(upperWorld); rotations[lower].copy(upperWorld).invert().multiply(lowerWorld).normalize();
    const restHand = new Vector3(...shapePoint([side * .546, .832, .025], data.recipe)).sub(new Vector3(...data.joints[hand].p)).normalize();
    const handWorld = new Quaternion().setFromUnitVectors(restHand, new Vector3(-side * .10, -.86, .50).normalize());
    rotations[hand].copy(lowerWorld).invert().multiply(handWorld).normalize();
  }
  return rotations;
}
export function bakeRiderClip(data: CharacterData, id: RidingSelection, mountId: MountId = 'horse_chestnut'): AnimationClip {
  const duration = id === 'pose' ? 1 : ridingDefinition(id, mountId).duration, frames = id === 'pose' ? 1 : Math.round(duration * MOUNT_FPS);
  const times = Array.from({ length: frames + 1 }, (_, index) => duration * index / frames), values = data.joints.map(() => [] as number[]);
  for (let frame = 0; frame <= frames; frame++) { const pose = authorRiderPose(data, id, frame === frames ? 0 : frame / frames, mountId); pose.forEach((q, bone) => values[bone].push(q.x, q.y, q.z, q.w)); }
  return new AnimationClip(id === 'pose' ? 'Rider_Pose' : id, duration, data.joints.map((bone, index) => new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values[index])));
}
export function bakeRiderClips(data: CharacterData, mountId: MountId = 'horse_chestnut'): Map<RidingSelection, AnimationClip> { return new Map((['pose', ...RIDING_CLIP_IDS] as RidingSelection[]).map(id => [id, bakeRiderClip(data, id, mountId)])); }
