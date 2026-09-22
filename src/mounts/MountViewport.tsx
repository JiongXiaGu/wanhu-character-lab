import { useEffect, useRef } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { HorseDisplay, HorseView, HorseStats } from '../horse/types';
import { createSaddleActor, type SaddleActor } from '../horse/saddles/saddle-actor';
import type { SaddleId } from '../horse/saddles/catalog';
import { mountDefinition } from './catalog';
import { createMountPlayer, type MountPlayer } from './player';
import type { MountActor, MountDefinition, MountId, MountPlayback, MountSelection } from './types';

export interface MountViewOptions { mountId: MountId; saddleId: SaddleId; clip: MountSelection; playing: boolean; speed: number; phase: number; seekRevision: number; loop: boolean; view: HorseView; viewRevision: number; orthographic: boolean; display: HorseDisplay; skeleton: boolean; grid: boolean }
interface Props { options: MountViewOptions; onStats: (value: HorseStats) => void; onPlayback: (value: MountPlayback) => void; onError: (value: string) => void }
interface Bundle { definition: MountDefinition; actor: MountActor; player: MountPlayer; tack: SaddleActor; dispose(): void }
interface Runtime { bundle: Bundle; renderer: T.WebGLRenderer; scene: T.Scene; perspective: T.PerspectiveCamera; ortho: T.OrthographicCamera; camera: T.PerspectiveCamera | T.OrthographicCamera; controls: OrbitControls; grid: T.GridHelper; resize(): void; render(): void }
export interface MountReview { mountId(): MountId; stats: HorseStats; seek(phase: number): void; getStatus(): MountPlayback; geometryId(): string; cameraState(): unknown; matricesFinite(): boolean; jointPositions(): Record<string, number[]> }
interface LegacyHorseReview extends Omit<MountReview, 'getStatus'> { getStatus(): Omit<MountPlayback, 'clip'> & { clip: string } }
declare global { interface Window { __MOUNT_REVIEW__?: MountReview; __HORSE_REVIEW__?: LegacyHorseReview } }
const DIRECTIONS: Record<HorseView, [number, number, number]> = { front: [0, .18, 6], left: [-6, .18, 0], right: [6, .18, 0], back: [0, .18, -6], three: [4.6, 2.1, 5.2], 'rear-three': [-4.6, 2.1, -5.2] };
function makeBundle(id: MountId, saddle: SaddleId): Bundle {
  const definition = mountDefinition(id), actor = definition.createActor(); let player: MountPlayer;
  try { player = createMountPlayer(actor, definition); } catch (error) { actor.dispose(); throw error; }
  let tack: SaddleActor; try { tack = createSaddleActor(actor, saddle, definition.saddle); } catch (error) { player.dispose(); actor.dispose(); throw error; }
  return { definition, actor, player, tack, dispose() { tack.dispose(); player.dispose(); actor.dispose(); } };
}
function applyDisplay(rt: Runtime, o: MountViewOptions) {
  const material = rt.bundle.actor.material; material.vertexColors = o.display !== 'clay'; material.color.set(o.display === 'clay' ? '#c2b49c' : '#ffffff'); material.wireframe = o.display === 'wire'; material.needsUpdate = true;
  rt.bundle.actor.helper.visible = o.skeleton; rt.grid.visible = o.grid; rt.bundle.tack.setDisplay(o.display); rt.bundle.actor.sync(); rt.render();
}
function applyCamera(rt: Runtime, o: MountViewOptions) {
  const next = o.orthographic ? rt.ortho : rt.perspective;
  if (next !== rt.camera) { rt.controls.dispose(); rt.camera = next; rt.controls = new OrbitControls(next, rt.renderer.domElement); rt.controls.enableDamping = true; rt.controls.minDistance = 2.6; rt.controls.maxDistance = 12; rt.controls.minZoom = .5; rt.controls.maxZoom = 4; }
  rt.camera.zoom = 1; rt.controls.target.set(0, rt.bundle.definition.frame.bodyY, .15); rt.camera.position.copy(rt.controls.target).add(new T.Vector3(...DIRECTIONS[o.view])); rt.camera.lookAt(rt.controls.target); rt.controls.update(); rt.resize(); rt.render();
}
/** 本体页和骑乘页分工保持；所有本体种类共用这一场景，不创建第二个隐藏Canvas。 */
export function MountViewport({ options, onStats, onPlayback, onError }: Props) {
  const host = useRef<HTMLDivElement>(null), runtime = useRef<Runtime | null>(null), latest = useRef(options), stats = useRef(onStats), report = useRef(onPlayback), error = useRef(onError);
  latest.current = options; stats.current = onStats; report.current = onPlayback; error.current = onError;
  useEffect(() => {
    const el = host.current; if (!el) return; let renderer: T.WebGLRenderer, bundle: Bundle;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (reason) { error.current(String(reason)); return; }
    try { bundle = makeBundle(latest.current.mountId, latest.current.saddleId); } catch (reason) { renderer.dispose(); error.current(String(reason)); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; el.appendChild(renderer.domElement);
    const scene = new T.Scene(); scene.add(new T.HemisphereLight('#ede9df', '#52646d', 2.1));
    const key = new T.DirectionalLight('#fff0d8', 2.8); key.position.set(-3.5, 5, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); key.shadow.bias = -.0005;
    const fill = new T.DirectionalLight('#b5d7ed', 1.05); fill.position.set(3, 2, -2); scene.add(key, fill);
    const floor = new T.Mesh(new T.CircleGeometry(3.1, 64), new T.MeshStandardMaterial({ color: '#2e4147', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.003; floor.receiveShadow = true; scene.add(floor);
    const grid = new T.GridHelper(5, 20, '#697b7d', '#40585e'); grid.position.y = .002; scene.add(grid, bundle.actor.mesh, bundle.actor.helper);
    bundle.player.select(latest.current.clip); bundle.player.setLoop(latest.current.loop); bundle.player.seek(latest.current.phase);
    const perspective = new T.PerspectiveCamera(34, 1, .01, 50), ortho = new T.OrthographicCamera(-2, 2, 2, -2, .01, 50), controls = new OrbitControls(ortho, renderer.domElement); controls.enableDamping = true; controls.minZoom = .5; controls.maxZoom = 4; controls.minDistance = 2.6; controls.maxDistance = 12;
    const rt: Runtime = { bundle, renderer, scene, perspective, ortho, camera: ortho, controls, grid,
      resize() { const width = Math.max(1, el.clientWidth), height = Math.max(1, el.clientHeight), aspect = width / height; renderer.setSize(width, height, false); perspective.aspect = aspect; perspective.updateProjectionMatrix(); const half = Math.max(rt.bundle.definition.frame.bodyHalf, 1.72 / aspect); ortho.left = -half * aspect; ortho.right = half * aspect; ortho.top = half; ortho.bottom = -half; ortho.updateProjectionMatrix(); },
      render() { renderer.render(scene, rt.camera); },
    };
    runtime.current = rt; applyCamera(rt, latest.current); applyDisplay(rt, latest.current); stats.current(bundle.actor.stats); report.current(bundle.player.status());
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('review')) {
      const hook: MountReview = { mountId: () => rt.bundle.definition.id, get stats() { return rt.bundle.actor.stats; }, seek(p) { rt.bundle.player.seek(p); rt.render(); report.current(rt.bundle.player.status()); }, getStatus: () => rt.bundle.player.status(), geometryId: () => rt.bundle.actor.mesh.geometry.uuid,
        cameraState: () => ({ position: rt.camera.position.toArray(), target: rt.controls.target.toArray(), projection: rt.camera.projectionMatrix.toArray() }),
        matricesFinite: () => rt.bundle.actor.bones.every(b => b.matrixWorld.elements.every(Number.isFinite)) && Array.from(rt.bundle.actor.skeleton.boneMatrices).every(Number.isFinite),
        jointPositions: () => Object.fromEntries(rt.bundle.actor.bones.map(b => [b.name, b.getWorldPosition(new T.Vector3()).toArray()])),
      };
      window.__MOUNT_REVIEW__ = hook;
      // 原马专项检查钩子仅作视图别名，真实播放器使用idle/walk/run/eat语义。
      window.__HORSE_REVIEW__ = { ...hook, get stats() { return rt.bundle.actor.stats; }, getStatus() { const s = rt.bundle.player.status(); return { ...s, clip: s.clip === 'bind' ? 'bind' : rt.bundle.definition.motions[s.clip].nativeId }; } };
    }
    const observer = new ResizeObserver(() => { rt.resize(); rt.render(); }); observer.observe(el);
    let frame = 0, previous = performance.now(), lastReport = 0, stopped = false;
    const animate = (now: number) => { if (stopped) return; const dt = Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now; rt.bundle.player.update(latest.current.playing ? dt * latest.current.speed : 0); rt.controls.update(); rt.render(); if (now - lastReport > 80) { report.current(rt.bundle.player.status()); lastReport = now; } frame = requestAnimationFrame(animate); }; frame = requestAnimationFrame(animate);
    const lost = (e: Event) => { e.preventDefault(); error.current('WebGL上下文丢失，请刷新。'); }; renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => { stopped = true; cancelAnimationFrame(frame); observer.disconnect(); rt.controls.dispose(); rt.bundle.dispose(); floor.geometry.dispose(); floor.material.dispose(); grid.geometry.dispose(); for (const m of Array.isArray(grid.material) ? grid.material : [grid.material]) m.dispose(); key.shadow.map?.dispose(); renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.dispose(); renderer.domElement.remove(); runtime.current = null; delete window.__MOUNT_REVIEW__; delete window.__HORSE_REVIEW__; };
  }, []);
  useEffect(() => {
    const rt = runtime.current; if (!rt || rt.bundle.definition.id === options.mountId) return;
    try {
      const old = rt.bundle, status = old.player.status(), next = makeBundle(options.mountId, options.saddleId);
      try { next.player.select(status.clip); next.player.setLoop(status.loop); next.player.seek(status.phase); } catch (reason) { next.dispose(); throw reason; }
      const delta = next.definition.frame.bodyY - old.definition.frame.bodyY;
      rt.bundle = next; rt.scene.add(next.actor.mesh, next.actor.helper); old.dispose(); rt.controls.target.y += delta; rt.camera.position.y += delta; rt.controls.update(); rt.resize(); applyDisplay(rt, options); stats.current(next.actor.stats); report.current(next.player.status());
    } catch (reason) { error.current(`坐骑切换失败：${String(reason)}`); }
  }, [options.mountId]);
  useEffect(() => { const rt = runtime.current; if (rt) { rt.bundle.tack.select(options.saddleId); applyDisplay(rt, options); } }, [options.saddleId]);
  useEffect(() => { const rt = runtime.current; if (rt) { rt.bundle.player.select(options.clip); rt.bundle.player.seek(options.phase); report.current(rt.bundle.player.status()); rt.render(); } }, [options.clip]);
  useEffect(() => { const rt = runtime.current; if (rt) { rt.bundle.player.seek(options.phase); report.current(rt.bundle.player.status()); rt.render(); } }, [options.phase, options.seekRevision]);
  useEffect(() => { const rt = runtime.current; if (rt) rt.bundle.player.setLoop(options.loop); }, [options.loop]);
  useEffect(() => { const rt = runtime.current; if (rt) applyCamera(rt, options); }, [options.view, options.viewRevision, options.orthographic]);
  useEffect(() => { const rt = runtime.current; if (rt) applyDisplay(rt, options); }, [options.display, options.skeleton, options.grid]);
  return <div className="horse-viewport" data-testid="horse-viewport" data-mount-id={options.mountId} ref={host}/>;
}
