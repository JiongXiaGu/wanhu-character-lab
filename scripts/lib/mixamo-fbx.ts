import * as T from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MOTION_SCHEMA, SAMPLE_BONES, SAMPLE_PARENTS, type HumanoidMotionData, validateMotionData } from '../../src/character/motion/data';
import { mixamoFilename, type MixamoId } from '../../src/character/mixamo/catalog';

/** 动画提取不下载/保留图片或外部人物几何。 */
class NoTexture extends T.TextureLoader { override load(): T.Texture { return new T.Texture(); } }
function semantic(name: string) { return name.replace(/^.*mixamorig[:_]?/i, ''); }
const rounded = (value: number) => +value.toFixed(7);
export function extractMixamo(id: MixamoId, directory = '动画参考'): HumanoidMotionData {
  const file = mixamoFilename(id), bytes = readFileSync(`${directory}/${file}`);
  const manager = new T.LoadingManager(); manager.addHandler(/.*/, new NoTexture());
  const globals = globalThis as unknown as Record<string, unknown>, oldWindow = globals.window;
  globals.window = { URL: { createObjectURL: () => 'data:image/png;base64,' }, innerWidth: 1, innerHeight: 1 };
  let fbx: T.Group;
  try { fbx = new FBXLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''); }
  finally { if (oldWindow === undefined) delete globals.window; else globals.window = oldWindow; }
  const raw: T.Bone[] = [], skins: T.SkinnedMesh[] = [];
  fbx.traverse(o => { if (o instanceof T.Bone) raw.push(o); if (o instanceof T.SkinnedMesh) skins.push(o); });
  const primary = new Map<string, T.Bone>();
  // 共享 FBX Bone 的同名叶节点不是动画节点；优先 transformData 节点。
  for (const b of raw) { const name = semantic(b.name); if (!primary.has(name) || b.userData.transformData) primary.set(name, b); }
  for (const name of SAMPLE_BONES.slice(1)) if (!primary.has(name)) throw new Error(`${file}: 缺少必要骨骼 ${name}`);
  const binds = new Map<string, T.Matrix4>();
  for (const [name, b] of primary) {
    for (const mesh of skins) {
      const index = mesh.skeleton.bones.indexOf(b);
      if (index >= 0) { binds.set(name, mesh.skeleton.boneInverses[index].clone().invert()); break; }
    }
    if (!binds.has(name)) throw new Error(`${file}: 无法从 SkinCluster 获取 ${name} 的绑定矩阵；不能用动作首帧代替。`);
  }
  const root = new T.Group(), bones = new Map<string, T.Bone>();
  for (const [name, original] of primary) { const b = new T.Bone(); b.name = original.name; bones.set(name, b); }
  for (const [name, original] of primary) {
    const b = bones.get(name)!; let parent = original.parent;
    while (parent instanceof T.Bone && semantic(parent.name) === name) parent = parent.parent;
    const parentName = parent instanceof T.Bone ? semantic(parent.name) : undefined;
    const local = binds.get(name)!.clone();
    if (parentName && binds.has(parentName)) local.premultiply(binds.get(parentName)!.clone().invert());
    local.decompose(b.position, b.quaternion, b.scale);
    (parentName && bones.has(parentName) ? bones.get(parentName)! : root).add(b);
  }
  root.updateMatrixWorld(true);
  const restP = new Map<string, T.Vector3>(), restQ = new Map<string, T.Quaternion>();
  for (const [name, bone] of bones) {
    restP.set(name, bone.getWorldPosition(new T.Vector3())); restQ.set(name, bone.getWorldQuaternion(new T.Quaternion()));
    if (bone.matrixWorld.elements.some((v, i) => Math.abs(v - binds.get(name)!.elements[i]) > 1e-3)) throw new Error(`${file}: 唯一骨架重建不匹配绑定矩阵。`);
  }
  // 源右侧 -X、前方 +Z；目标右侧 +X。矩阵共轭保留前向及左右语义。
  const right = restP.get('RightArm')!.clone().sub(restP.get('LeftArm')!); right.y = 0; right.normalize();
  const up = new T.Vector3(0, 1, 0);
  const forward = restP.get('LeftToeBase')!.clone().sub(restP.get('LeftFoot')!).add(restP.get('RightToeBase')!.clone().sub(restP.get('RightFoot')!));
  forward.y = 0; forward.addScaledVector(right, -forward.dot(right)).normalize();
  if (Math.abs(right.dot(forward)) > 1e-4 || right.length() < .99 || forward.length() < .99) throw new Error(`${file}: 无法确定人体坐标轴。`);
  const conversion = new T.Matrix4().makeBasis(right, up, forward).invert(), inverseConversion = conversion.clone().invert();
  const sourceClip = fbx.animations[0];
  if (!sourceClip || fbx.animations.length !== 1) throw new Error(`${file}: 需要明确的一条动画 Clip。`);
  const clip = sourceClip.clone(), mixer = new T.AnimationMixer(root), action = mixer.clipAction(clip);
  action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const fps = 30, frameCount = Math.ceil(clip.duration * fps), times: number[] = [], positions: number[] = [], deltas: number[] = [], bindPositions: number[] = [];
  const p = new T.Vector3(), q = new T.Quaternion(), matrix = new T.Matrix4();
  const previous = Array.from({ length: 20 }, () => new T.Quaternion());
  for (const name of SAMPLE_BONES) {
    if (!name) p.set(0, 0, 0); else p.copy(restP.get(name)!).applyMatrix4(conversion).multiplyScalar(.01);
    bindPositions.push(...p.toArray().map(rounded));
  }
  for (let frame = 0; frame <= frameCount; frame++) {
    const time = frame === frameCount ? clip.duration : Math.min(frame / fps, clip.duration);
    if (frame && time <= times.at(-1)!) continue;
    times.push(time); action.time = time; mixer.update(0); root.updateMatrixWorld(true);
    for (const name of SAMPLE_BONES) {
      if (!name) p.set(0, 0, 0); else bones.get(name)!.getWorldPosition(p).applyMatrix4(conversion).multiplyScalar(.01);
      positions.push(...p.toArray().map(rounded));
    }
    for (let bone = 0; bone < 20; bone++) {
      const name = SAMPLE_BONES[bone];
      if (!name) q.identity();
      else {
        bones.get(name)!.getWorldQuaternion(q).multiply(restQ.get(name)!.clone().invert());
        matrix.makeRotationFromQuaternion(q).premultiply(conversion).multiply(inverseConversion); q.setFromRotationMatrix(matrix).normalize();
      }
      if (frame && previous[bone].dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      previous[bone].copy(q); deltas.push(...q.toArray().map(rounded));
    }
  }
  mixer.stopAllAction(); mixer.uncacheRoot(root);
  const materials = new Set<T.Material>(), geometries = new Set<T.BufferGeometry>(), skeletons = new Set<T.Skeleton>();
  fbx.traverse(o => { if (o instanceof T.Mesh) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); } if (o instanceof T.SkinnedMesh) skeletons.add(o.skeleton); });
  for (const material of materials) { for (const value of Object.values(material)) if (value instanceof T.Texture) value.dispose(); material.dispose(); }
  geometries.forEach(g => g.dispose()); skeletons.forEach(s => s.dispose()); root.clear(); fbx.clear();
  const data: MixamoMotionData = {
    schema: MOTION_SCHEMA, id, source: { provider: 'Mixamo', format: 'fbx', profile: 'mixamo-fbx-v2', file, sha256: createHash('sha256').update(bytes).digest('hex'), clipName: sourceClip.name, uniqueBones: primary.size, rawBoneNodes: raw.length, tracks: clip.tracks.length, threeVersion: T.REVISION, extractorVersion: 'mixamo-fbx-v2', axisConversion: 'source anatomical frame → +X right / +Y up / +Z forward; rotation conjugation; cm → m' },
    duration: clip.duration, fps, times, names: [...SAMPLE_BONES], parents: [...SAMPLE_PARENTS], bindPositions, worldDeltas: deltas, positions,
  };
  validateMotionData(data, id); return data;
}
