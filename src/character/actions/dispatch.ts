import * as T from 'three';
import type { Joint, Recipe } from '../v3/types';
import { ACTIONS, type WorkId } from './catalog';
import { bakeWork as bakeLabor, sampleWork as sampleLabor, type WorkSample } from './bake';
import { createWorkProps as createLaborProps, type WorkProps } from './props';
import { isBowId, sampleBow, bakeBow, createBowProps } from './bow';

/** 所有可播放 Action 的统一入口；劳动求解器无需认识弓箭的道具节点。 */
export function sampleWork(joints: Joint[], recipe: Recipe, id: WorkId, phase: number): WorkSample {
  if (isBowId(id)) return sampleBow(joints, recipe, id, phase);
  // 抱持待机直接复用拾取末帧，保证拾取 → 保持 → 放下的接缝一致。
  if (id === 'carry_hold') return sampleLabor(joints, recipe, 'pick', 1);
  return sampleLabor(joints, recipe, id, phase);
}
export function bakeWork(joints: Joint[], recipe: Recipe, id: WorkId): T.AnimationClip {
  if (isBowId(id)) return bakeBow(joints, recipe, id);
  if (id !== 'carry_hold') return bakeLabor(joints, recipe, id);
  const sample = sampleWork(joints, recipe, id, 0), times = [0, ACTIONS[id].duration];
  const twice = (values: number[]) => [...values, ...values];
  const tracks: T.KeyframeTrack[] = joints.map((j, i) => new T.QuaternionKeyframeTrack(`${j.name}.quaternion`, times, twice(sample.pose.local[i].toArray())));
  tracks.push(new T.VectorKeyframeTrack('Hips.position', times, twice(sample.pose.hips.toArray())));
  tracks.push(new T.VectorKeyframeTrack('WorkObject.position', times, twice(sample.propP.toArray())));
  tracks.push(new T.QuaternionKeyframeTrack('WorkObject.quaternion', times, twice(sample.propQ.toArray())));
  return new T.AnimationClip(`work/${id}`, ACTIONS[id].duration, tracks);
}
export function createWorkProps(id: WorkId, recipe: Recipe): WorkProps {
  return isBowId(id) ? createBowProps(recipe) : createLaborProps(id, recipe);
}
