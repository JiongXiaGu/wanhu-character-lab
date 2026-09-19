import * as T from 'three';
import { B, type Joint, type Recipe, type Vec3 } from '../v3/types';
import { ACTIONS, type WorkId } from './catalog';
import { PoseSolver, palmOffset } from './kinematics';
import type { WorkSample, Contact } from './bake';
import type { WorkProps } from './props';

export const BOW_RELEASE_PHASE = 0.72;
export const BOW_IDS = ['bow_shot', 'bow_draw', 'bow_aim', 'bow_aim_high', 'bow_aim_low', 'bow_release', 'bow_cancel'] as const;
export type BowId = typeof BOW_IDS[number];
export function isBowId(id: string): id is BowId { return (BOW_IDS as readonly string[]).includes(id); }
const smooth = (a: number, b: number, p: number) => {
  const t = T.MathUtils.clamp((p - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = T.MathUtils.lerp;
export interface BowSample extends WorkSample {
  draw: number;
  nock: T.Vector3;
  axis: T.Vector3;
  limbs: T.Vector3[];
  arrowP: T.Vector3;
  arrowQ: T.Quaternion;
  arrowVisible: boolean;
  released: boolean;
}
/** 共用射箭时间域。取消只退弦，不经过放箭事件；瞄准为静态保持。 */
export function bowTime(id: BowId, phase: number): number {
  const p = T.MathUtils.clamp(phase, 0, 1);
  if (id === 'bow_draw') return p * 0.62;
  if (id.startsWith('bow_aim')) return 0.66;
  if (id === 'bow_release') return 0.70 + p * 0.30;
  if (id === 'bow_cancel') return 0.66 * (1 - p);
  return p;
}

/** IK 仅在构建 Clip/检查时求值。人体、工具和弓弦全部烘焙，不在运行帧重建 Mesh。 */
export function sampleBow(joints: Joint[], recipe: Recipe, id: BowId, phase: number): BowSample {
  const c = bowTime(id, phase), h = recipe.height / 1.76;
  const point = (x: number, y: number, z: number) => new T.Vector3(x * h, y * h, z * h);
  const pose = new PoseSolver(joints);
  const raise = smooth(0.22, 0.42, c) * (1 - smooth(0.84, 1, c));
  const draw = smooth(0.42, 0.62, c) * (1 - smooth(BOW_RELEASE_PHASE, 0.755, c));
  const released = id !== 'bow_cancel' && c >= BOW_RELEASE_PHASE;
  pose.hips.y -= 0.03 * h;
  pose.euler(B.Spine, 0.015, 0.08 * raise);
  pose.euler(B.Chest, 0.015, 0.24 * raise);
  pose.euler(B.Head, -0.025, -0.32 * raise);
  pose.fk();
  for (const side of [1, -1]) {
    const upper = side > 0 ? B.RightThigh : B.LeftThigh;
    const lower = side > 0 ? B.RightShin : B.LeftShin;
    const foot = side > 0 ? B.RightFoot : B.LeftFoot;
    const target = new T.Vector3(...joints[foot].p).add(point(0, 0, -side * 0.065));
    pose.chain(upper, lower, foot, target, point(side * 0.15, 0.4, 0.5));
    pose.worldRotation(foot, new T.Quaternion());
  }
  pose.euler(B.RightUpperArm, 0, 0, -0.37);
  pose.euler(B.LeftUpperArm, 0, 0, 0.37);
  pose.euler(B.RightForearm, -0.11);
  pose.euler(B.LeftForearm, -0.11);
  pose.fk();
  const neutral = pose.positions[B.RightHand].clone()
    .add(palmOffset(1, recipe).applyQuaternion(pose.world[B.RightHand]));
  const grip = point(-0.20, 1.11, 0.22).lerp(point(0.09, 1.49, 0.53), raise);
  let up = new T.Vector3(0, 1, 0);
  let forward = new T.Vector3(0, 0, 1);
  const pitch = id === 'bow_aim_high' ? -0.20 : id === 'bow_aim_low' ? 0.20 : 0;
  if (pitch) {
    const pivot = point(0.10, 1.49, 0.07), q = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), pitch);
    grip.sub(pivot).applyQuaternion(q).add(pivot);
    up.applyQuaternion(q); forward.applyQuaternion(q);
    pose.euler(B.Head, pitch - 0.025, -0.32 * raise);
    pose.fk();
  }
  const rest = grip.clone().addScaledVector(up, 0.055 * h).addScaledVector(forward, -0.13 * h);
  const anchor = point(0.125, 1.545, 0.07);
  const nock = rest.clone().lerp(anchor, draw);
  const arrowRest = grip.clone().addScaledVector(up, 0.055 * h);
  const axis = arrowRest.clone().sub(nock).normalize();
  const contacts: Contact[] = [];
  const hand = (side: number, target: T.Vector3, direction: T.Vector3, pole: T.Vector3, contact: boolean) => {
    const upper = side > 0 ? B.RightUpperArm : B.LeftUpperArm;
    const lower = side > 0 ? B.RightForearm : B.LeftForearm;
    const end = side > 0 ? B.RightHand : B.LeftHand;
    const offset = palmOffset(side, recipe);
    const q = new T.Quaternion().setFromUnitVectors(offset.clone().normalize(), direction.clone().normalize());
    const wrist = target.clone().sub(offset.clone().applyQuaternion(q));
    const unreachable = pose.chain(upper, lower, end, wrist, pole);
    pose.worldRotation(end, q);
    if (contact) contacts.push({ bone: end, point: target.toArray() as Vec3, offset: offset.toArray() as Vec3, unreachable });
  };
  hand(-1, grip, forward, point(-0.55, mix(0.95, 1.28, raise), 0.18), true);
  const reach = smooth(0.02, 0.16, c) * (1 - smooth(0.80, 1, c));
  const right = neutral.clone().lerp(nock, reach);
  if (released) {
    const recoil = smooth(0.72, 0.76, c) * (1 - smooth(0.78, 0.95, c));
    right.lerp(anchor.clone().add(point(0.075, 0.015, -0.055)), recoil);
  }
  hand(1, right, axis, point(0.66, mix(1.0, 1.52, raise), -0.19), reach > 0.999 && !released);
  pose.fk();
  const bend = 0.12 + draw * 0.06;
  const limbs = [
    [-0.42, -bend], [-0.28, 0.015], [-0.12, 0.035], [0, 0],
    [0.12, 0.035], [0.28, 0.015], [0.42, -bend],
  ].map(([y, z]) => grip.clone().addScaledVector(up, y * h).addScaledVector(axis, z * h));
  const arrowP = c < 0.18 ? right.clone() : nock.clone();
  let arrowAxis = axis;
  if (released) {
    // 固定释放锚点，箭不再跟随收弓；仅为飞行可视化，不代表弹道/伤害系统。
    const releaseGrip = point(0.09, 1.49, 0.53).add(point(0, 0.055, 0));
    arrowAxis = releaseGrip.sub(anchor).normalize();
    arrowP.copy(anchor).addScaledVector(arrowAxis, (c - BOW_RELEASE_PHASE) * 8 * h);
  }
  const arrowVisible = c >= 0.065 && c < 0.90;
  return {
    pose, propP: new T.Vector3(), propQ: new T.Quaternion(), contacts,
    attached: !released, toolContact: null, draw, nock, axis, limbs,
    arrowP, arrowQ: new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), arrowAxis),
    arrowVisible, released,
  };
}

const SEGMENT_NAMES = [...Array.from({ length: 6 }, (_, i) => `BowLimb${i}`), 'BowStringTop', 'BowStringBottom'];
function segments(s: BowSample): [T.Vector3, T.Vector3][] {
  return [...s.limbs.slice(0, -1).map((p, i) => [p, s.limbs[i + 1]] as [T.Vector3, T.Vector3]),
    [s.limbs[6], s.nock], [s.nock, s.limbs[0]]];
}
/** 除均匀采样外保留事件帧，释放前/后不会因帧率四舍五入错开。 */
export function bakeBow(joints: Joint[], recipe: Recipe, id: BowId): T.AnimationClip {
  const def = ACTIONS[id as WorkId], count = Math.ceil(def.duration * 60);
  const phases = Array.from(new Set([
    ...Array.from({ length: count + 1 }, (_, i) => i / count),
    ...def.events.map(e => e.phase),
  ])).sort((a, b) => a - b);
  const times = phases.map(p => p * def.duration);
  const tracks: T.KeyframeTrack[] = [];
  const rotations = joints.map(() => [] as number[]), hips: number[] = [];
  const parts = SEGMENT_NAMES.map(() => ({ p: [] as number[], q: [] as number[], s: [] as number[] }));
  const arrowP: number[] = [], arrowQ: number[] = [], arrowS: number[] = [];
  const quaternion = (values: number[], q: T.Quaternion) => {
    if (values.length && values[values.length - 4] * q.x + values[values.length - 3] * q.y + values[values.length - 2] * q.z + values[values.length - 1] * q.w < 0)
      q.set(-q.x, -q.y, -q.z, -q.w);
    values.push(q.x, q.y, q.z, q.w);
  };
  for (const p of phases) {
    const s = sampleBow(joints, recipe, id, p);
    s.pose.local.forEach((q, i) => quaternion(rotations[i], q));
    hips.push(...s.pose.hips.toArray());
    segments(s).forEach(([a, b], i) => {
      const d = b.clone().sub(a);
      parts[i].p.push(...a.clone().add(b).multiplyScalar(0.5).toArray());
      quaternion(parts[i].q, new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()));
      parts[i].s.push(1, d.length(), 1);
    });
    arrowP.push(...s.arrowP.toArray()); quaternion(arrowQ, s.arrowQ);
    const scale = s.arrowVisible ? 1 : 0;
    arrowS.push(scale, scale, scale);
  }
  joints.forEach((joint, i) => tracks.push(new T.QuaternionKeyframeTrack(`${joint.name}.quaternion`, times, rotations[i])));
  tracks.push(new T.VectorKeyframeTrack('Hips.position', times, hips));
  parts.forEach((part, i) => {
    tracks.push(new T.VectorKeyframeTrack(`${SEGMENT_NAMES[i]}.position`, times, part.p));
    tracks.push(new T.QuaternionKeyframeTrack(`${SEGMENT_NAMES[i]}.quaternion`, times, part.q));
    tracks.push(new T.VectorKeyframeTrack(`${SEGMENT_NAMES[i]}.scale`, times, part.s));
  });
  tracks.push(new T.VectorKeyframeTrack('ShotArrow.position', times, arrowP));
  tracks.push(new T.QuaternionKeyframeTrack('ShotArrow.quaternion', times, arrowQ));
  tracks.push(new T.VectorKeyframeTrack('ShotArrow.scale', times, arrowS, T.InterpolateDiscrete));
  return new T.AnimationClip(`work/${id}`, def.duration, tracks);
}

/** 道具自己的节点不是人体骨骼。固定几何 + 变换轨道；不模拟绳索、不逐帧改顶点。 */
export function createBowProps(recipe: Recipe): WorkProps {
  const h = recipe.height / 1.76;
  const group = new T.Group(), object = new T.Group(), debug = new T.Group();
  group.name = 'WorkScene'; object.name = 'WorkObject'; group.add(object, debug);
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  function mesh(geometry: T.BufferGeometry, color: string): T.Mesh {
    const c = new T.Color(color), values: number[] = [];
    for (let i = 0; i < geometry.attributes.position.count; i++) values.push(c.r, c.g, c.b);
    geometry.setAttribute('color', new T.Float32BufferAttribute(values, 3));
    const result = new T.Mesh(geometry, material); result.castShadow = true; return result;
  }
  SEGMENT_NAMES.forEach((name, i) => {
    const radius = (i < 6 ? 0.014 : 0.0022) * h;
    const part = mesh(new T.CylinderGeometry(radius, radius, 1, i < 6 ? 6 : 3), i < 6 ? '#9c7145' : '#ece0bb');
    part.name = name; part.frustumCulled = false; object.add(part);
  });
  const arrow = new T.Group(); arrow.name = 'ShotArrow'; object.add(arrow);
  const shaft = mesh(new T.CylinderGeometry(0.0035 * h, 0.0035 * h, 0.64 * h, 5), '#c7a369');
  shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.32 * h; arrow.add(shaft);
  const tip = mesh(new T.ConeGeometry(0.011 * h, 0.045 * h, 4), '#9fa9a4');
  tip.rotation.x = Math.PI / 2; tip.position.z = 0.66 * h; arrow.add(tip);
  for (const angle of [0, Math.PI / 2]) {
    const feather = mesh(new T.BoxGeometry(0.033 * h, 0.003 * h, 0.075 * h), '#d9d6bd');
    feather.rotation.z = angle; feather.position.z = 0.063 * h; arrow.add(feather);
  }
  let triangles = 0;
  group.traverse(node => { if (node instanceof T.Mesh) triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; });
  return { group, object, wheel: null, debug, triangles, dispose() {
    group.traverse(node => { if (node instanceof T.Mesh) node.geometry.dispose(); });
    material.dispose(); group.removeFromParent();
  } };
}
