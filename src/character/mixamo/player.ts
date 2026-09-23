import { BODY_HEIGHT } from '../v3/types';
import * as T from 'three';
import { createClipClock } from '../../animation/clip-clock';
import type { Actor } from '../v3/rig';
import { SAMPLE_BONE_COUNT, SAMPLE_PARENTS, validateMixamoData, type MixamoMotionData } from './data';
import { motionAssetPath, motionDefinition, type MotionId, type MotionSource } from '../motion/catalog';
import { retargetMixamo, exportTargetMotion, type RetargetBake } from './retarget';

const cache = new Map<MotionId, Promise<MixamoMotionData>>();
/** 只缓存有限的源动作；不缓存某个角色或其装备，失败后允许重试。 */
export function loadMixamo(id: MotionId): Promise<MixamoMotionData> {
  const found = cache.get(id); if (found) return found;
  const pending = fetch(`${import.meta.env.BASE_URL}${motionAssetPath(id)}`).then(async response => {
    if (!response.ok) throw new Error(`动画资源 ${response.status}；请运行 npm run prepare:mixamo 后重新启动。`);
    const data = await response.json() as MixamoMotionData; validateMixamoData(data, id); return data;
  }).catch(error => { if (cache.get(id) === pending) cache.delete(id); throw error; });
  cache.set(id, pending);
  if (cache.size > 3) cache.delete(cache.keys().next().value!);
  return pending;
}
export interface MixamoStatus {
  id: MotionId; source: MotionSource; ready: boolean; duration: number; loop: boolean; seamDegrees: number; sourceHash: string;
  phase: number; stage: string; finished: boolean;
}
export interface MixamoPlayer {
  id: MotionId; sourceScene: T.Scene; targetDebug: T.LineSegments; bake: RetargetBake;
  update: (delta: number) => void; seek: (phase: number) => void; replay: () => void; setLoop: (value: boolean) => void;
  setHeadAxes: (visible: boolean) => void;
  status: () => MixamoStatus; export: () => ReturnType<typeof exportTargetMotion>; dispose: () => void;
}
/** 仅用于审查：青色为面前方，金色为头部向上轴，不用头顶辅助点猜脸向。 */
function makeHeadAxes(): T.LineSegments {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute([.5,.9,1, .5,.9,1, 1,.8,.4, 1,.8,.4], 3));
  const lines = new T.LineSegments(geometry, new T.LineBasicMaterial({vertexColors:true,depthTest:false}));
  lines.visible=false; lines.frustumCulled=false; lines.renderOrder=10;
  return lines;
}
export function createMixamoPlayer(actor: Actor, source: MixamoMotionData): MixamoPlayer {
  const bake = retargetMixamo(actor.data, source), def = motionDefinition(source.id);
  const scene = new T.Scene(), geometry = new T.BufferGeometry();
  const edges = SAMPLE_PARENTS.map((parent, i) => [parent, i]).filter(([parent, i]) => parent > 0 && i !== 1);
  const points = new Float32Array(edges.length * 6);
  geometry.setAttribute('position', new T.BufferAttribute(points, 3).setUsage(T.DynamicDrawUsage));
  const material = new T.LineBasicMaterial({ color: '#e4c495' });
  const lines = new T.LineSegments(geometry, material); lines.frustumCulled = false; scene.add(lines);
  const dotsGeo = new T.SphereGeometry(.017 * BODY_HEIGHT[actor.data.recipe.bodyType] / 1.76, 6, 4), dotsMat = new T.MeshBasicMaterial({ color: '#9cd9dd' });
  const dots = Array.from({ length: 24 }, () => { const dot = new T.Mesh(dotsGeo, dotsMat); scene.add(dot); return dot; });
  const grid = new T.GridHelper(3.2, 16, '#697b7d', '#40585e'); scene.add(grid);
  const sourceDebug=makeHeadAxes(), targetDebug=makeHeadAxes(); scene.add(sourceDebug);
  actor.resetBindPose();
  const action = actor.mixer.clipAction(bake.clip);
  // 只有这一个 FBX 时间游标；定位/暂停/末帧不会启动旧程序动作。
  action.reset().setLoop(T.LoopOnce, 1).setEffectiveWeight(1).play(); action.clampWhenFinished = true; action.paused = true;
  actor.mesh.boundingSphere = bake.bounds.getBoundingSphere(new T.Sphere());
  const clock = createClipClock(source.duration, bake.loop);
  let disposed = false;
  const pa = new T.Vector3(), pb = new T.Vector3(), end = new T.Vector3();
  const qa = new T.Quaternion(), qb = new T.Quaternion();
  function samplePoint(index: number, frame: number, next: number, alpha: number, target: T.Vector3) {
    target.fromArray(bake.sourcePositions, (frame * SAMPLE_BONE_COUNT + index) * 3);
    pa.fromArray(bake.sourcePositions, (next * SAMPLE_BONE_COUNT + index) * 3); target.lerp(pa, alpha);
  }
  function axes(lines:T.LineSegments, origin:T.Vector3, rotation:T.Quaternion) {
    const attr=lines.geometry.getAttribute('position') as T.BufferAttribute, length=.24*BODY_HEIGHT[actor.data.recipe.bodyType]/1.76;
    for(let i=0;i<2;i++){
      attr.setXYZ(i*2,origin.x,origin.y,origin.z);
      end.set(0,i===1?length:0,i===0?length:0).applyQuaternion(rotation).add(origin);
      attr.setXYZ(i*2+1,end.x,end.y,end.z);
    }
    attr.needsUpdate=true;
  }
  function sync() {
    if (disposed) return;
    const time = clock.time;
    action.enabled = true; action.time = time; actor.update(0);
    let frame = Math.min(source.times.length - 2, Math.floor(time * source.fps));
    while (frame > 0 && source.times[frame] > time) frame--;
    const next = frame + 1, alpha = T.MathUtils.clamp((time - source.times[frame]) / (source.times[next] - source.times[frame]), 0, 1);
    for (let i = 1; i < SAMPLE_BONE_COUNT; i++) { samplePoint(i, frame, next, alpha, pb); dots[i - 1].position.copy(pb); }
    edges.forEach(([a, b], i) => { dots[a - 1].position.toArray(points, i * 6); dots[b - 1].position.toArray(points, i * 6 + 3); });
    geometry.attributes.position.needsUpdate = true;
    if(targetDebug.visible){
      qa.fromArray(source.worldDeltas,(frame*20+5)*4); qb.fromArray(source.worldDeltas,(next*20+5)*4); qa.slerp(qb,alpha).normalize();
      axes(sourceDebug,dots[4].position,qa);
      actor.bones[5].getWorldPosition(pb); actor.bones[5].getWorldQuaternion(qb); axes(targetDebug,pb,qb);
    }
  }
  const player: MixamoPlayer = {
    id: source.id, sourceScene: scene, targetDebug, bake,
    update(delta) { clock.advance(delta); sync(); },
    seek(phase) { clock.seek(phase); sync(); },
    replay() { clock.replay(); sync(); },
    setLoop(value) { clock.setLoop(value); sync(); },
    setHeadAxes(visible){sourceDebug.visible=visible;targetDebug.visible=visible;sync();},
    status() { return { id: source.id, source: def.source, ready: true, duration: source.duration, loop: clock.loop, seamDegrees: bake.seamDegrees, sourceHash: source.source.sha256,
      phase: clock.phase, stage: `${def.source==='bvh'?'BVH':'Mixamo'} · ${def.label}`, finished: clock.finished }; },
    export() { return exportTargetMotion(actor.data, source, bake); },
    dispose() {
      disposed = true; action.stop(); actor.mixer.uncacheClip(bake.clip);
      geometry.dispose(); material.dispose(); dotsGeo.dispose(); dotsMat.dispose(); grid.geometry.dispose();
      for (const m of Array.isArray(grid.material) ? grid.material : [grid.material]) m.dispose();
      for(const debug of [sourceDebug,targetDebug]){debug.removeFromParent();debug.geometry.dispose();(debug.material as T.Material).dispose();}
      scene.clear();
    },
  };
  player.seek(0); return player;
}
