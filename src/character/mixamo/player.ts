import * as T from 'three';
import type { Actor } from '../v3/rig';
import type { WorkStatus } from '../actions/player';
import { SAMPLE_BONE_COUNT, SAMPLE_PARENTS, validateMixamoData, type MixamoMotionData } from './data';
import { mixamoDefinition, type MixamoId } from './catalog';
import { retargetMixamo, exportTargetMotion, type RetargetBake } from './retarget';

const cache = new Map<MixamoId, Promise<MixamoMotionData>>();
/** 只缓存有限的源动作；不缓存某个角色或其装备，失败后允许重试。 */
export function loadMixamo(id: MixamoId): Promise<MixamoMotionData> {
  const found = cache.get(id); if (found) return found;
  const pending = fetch(`${import.meta.env.BASE_URL}mixamo/${id}.json`).then(async response => {
    if (!response.ok) throw new Error(`动画资源 ${response.status}；请在仓库根目录运行 npm run prepare:mixamo 后重新启动。`);
    const data = await response.json() as MixamoMotionData; validateMixamoData(data, id); return data;
  }).catch(error => { if (cache.get(id) === pending) cache.delete(id); throw error; });
  cache.set(id, pending);
  if (cache.size > 3) cache.delete(cache.keys().next().value!);
  return pending;
}
export interface MixamoStatus extends WorkStatus {
  id: MixamoId; ready: boolean; duration: number; loop: boolean; seamDegrees: number; sourceHash: string;
}
export interface MixamoPlayer {
  id: MixamoId; sourceScene: T.Scene; bake: RetargetBake;
  update: (delta: number) => void; seek: (phase: number) => void; replay: () => void;
  status: () => MixamoStatus; export: () => ReturnType<typeof exportTargetMotion>; dispose: () => void;
}
export function createMixamoPlayer(actor: Actor, source: MixamoMotionData): MixamoPlayer {
  const bake = retargetMixamo(actor.data, source), def = mixamoDefinition(source.id);
  const scene = new T.Scene(), geometry = new T.BufferGeometry();
  const edges = SAMPLE_PARENTS.map((parent, i) => [parent, i]).filter(([parent, i]) => parent > 0 && i !== 1);
  const points = new Float32Array(edges.length * 6);
  geometry.setAttribute('position', new T.BufferAttribute(points, 3).setUsage(T.DynamicDrawUsage));
  const material = new T.LineBasicMaterial({ color: '#e4c495' });
  const lines = new T.LineSegments(geometry, material); lines.frustumCulled = false; scene.add(lines);
  const dotsGeo = new T.SphereGeometry(.017 * actor.data.recipe.height / 1.76, 6, 4), dotsMat = new T.MeshBasicMaterial({ color: '#9cd9dd' });
  const dots = Array.from({ length: 24 }, () => { const dot = new T.Mesh(dotsGeo, dotsMat); scene.add(dot); return dot; });
  const grid = new T.GridHelper(3.2, 16, '#697b7d', '#40585e'); scene.add(grid);
  actor.mixer.stopAllAction();
  const action = actor.mixer.clipAction(bake.clip);
  // 同一时间游标驱动源骨架与目标，暂停、定位和完整末帧保持同步。
  action.reset().setLoop(T.LoopOnce, 1).setEffectiveWeight(1).play(); action.clampWhenFinished = true; action.paused = true; actor.action = action;
  actor.mesh.boundingSphere = bake.bounds.getBoundingSphere(new T.Sphere());
  let time = 0, disposed = false;
  const pa = new T.Vector3(), pb = new T.Vector3();
  function samplePoint(index: number, frame: number, next: number, alpha: number, target: T.Vector3) {
    target.fromArray(bake.sourcePositions, (frame * SAMPLE_BONE_COUNT + index) * 3);
    pa.fromArray(bake.sourcePositions, (next * SAMPLE_BONE_COUNT + index) * 3); target.lerp(pa, alpha);
  }
  function sync() {
    if (disposed) return;
    action.enabled = true; action.time = time; actor.update(0);
    let frame = Math.min(source.times.length - 2, Math.floor(time * source.fps));
    while (frame > 0 && source.times[frame] > time) frame--;
    const next = frame + 1, alpha = T.MathUtils.clamp((time - source.times[frame]) / (source.times[next] - source.times[frame]), 0, 1);
    for (let i = 1; i < SAMPLE_BONE_COUNT; i++) { samplePoint(i, frame, next, alpha, pb); dots[i - 1].position.copy(pb); }
    edges.forEach(([a, b], i) => { dots[a - 1].position.toArray(points, i * 6); dots[b - 1].position.toArray(points, i * 6 + 3); });
    geometry.attributes.position.needsUpdate = true;
  }
  const player: MixamoPlayer = {
    id: source.id, sourceScene: scene, bake,
    update(delta) { if (!Number.isFinite(delta) || delta <= 0) { sync(); return; } const next = time + delta; time = bake.loop ? next % source.duration : Math.min(source.duration, next); sync(); },
    seek(phase) { time = T.MathUtils.clamp(Number.isFinite(phase) ? phase : 0, 0, 1) * source.duration; sync(); },
    replay() { time = 0; sync(); },
    status() { return { id: source.id, ready: true, duration: source.duration, loop: bake.loop, seamDegrees: bake.seamDegrees, sourceHash: source.source.sha256,
      phase: time / source.duration, stage: `Mixamo · ${def.label}`, finished: !bake.loop && time >= source.duration - 1e-6,
      eventCount: 0, lastEvent: '外部人体动画 · 无业务事件', propTriangles: 0, maxGripError: 0 }; },
    export() { return exportTargetMotion(actor.data, source, bake); },
    dispose() { disposed = true; action.stop(); actor.mixer.uncacheClip(bake.clip); geometry.dispose(); material.dispose(); dotsGeo.dispose(); dotsMat.dispose(); grid.geometry.dispose(); for (const m of Array.isArray(grid.material) ? grid.material : [grid.material]) m.dispose(); scene.clear(); },
  };
  player.seek(0); return player;
}
