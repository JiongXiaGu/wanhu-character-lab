import { useEffect, useRef } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Recipe } from '../character/v3/types';
import type { HorseDisplay, HorseView } from '../horse/types';
import type { SaddleId } from '../horse/saddles/catalog';
import type { MountId } from '../mounts/types';
import { createRidingPlayer, type RidingPlayer } from './riding-player';
import type { RidingPlayback, RidingSelection, RidingStats } from './types';

export interface RidingViewOptions {
  mountId: MountId; recipe: Recipe; saddleId: SaddleId; reins: boolean; clip: RidingSelection; playing: boolean; speed: number; phase: number; seekRevision: number;
  loop: boolean; view: HorseView; viewRevision: number; orthographic: boolean; display: HorseDisplay; riderSkeleton: boolean; horseSkeleton: boolean; seat: boolean; grid: boolean;
}
interface Props { options: RidingViewOptions; onStats: (value: RidingStats) => void; onPlayback: (value: RidingPlayback) => void; onError: (message: string) => void }
interface Runtime { player: RidingPlayer; scene: T.Scene; renderer: T.WebGLRenderer; controls: OrbitControls; camera: T.PerspectiveCamera | T.OrthographicCamera; perspective: T.PerspectiveCamera; ortho: T.OrthographicCamera; grid: T.GridHelper; seatHelper: T.AxesHelper; resize(): void; render(): void }
export interface RidingReview {
  mountId(): MountId; seek(phase: number): void; getStatus(): RidingPlayback; stats(): RidingStats;
  geometryIds(): { horse: string; rider: string }; recipe(): Recipe; saddleState(): unknown; matricesFinite(): boolean; cameraState(): unknown; jointPositions(): unknown;
}
declare global { interface Window { __RIDING_REVIEW__?: RidingReview } }
const DIRECTIONS: Record<HorseView, [number, number, number]> = { front: [0, .15, 7.6], left: [-7.6, .15, 0], right: [7.6, .15, 0], back: [0, .15, -7.6], three: [5.3, 2.3, 6.5], 'rear-three': [-5.3, 2.3, -6.5] };
function applyCamera(rt: Runtime, options: RidingViewOptions) {
  const next = options.orthographic ? rt.ortho : rt.perspective;
  if (next !== rt.camera) { rt.controls.dispose(); rt.camera = next; rt.controls = new OrbitControls(next, rt.renderer.domElement); rt.controls.enableDamping = true; rt.controls.minDistance = 2.8; rt.controls.maxDistance = 14; rt.controls.minZoom = .5; rt.controls.maxZoom = 4; }
  rt.camera.zoom = 1; rt.controls.target.set(0, rt.player.definition.frame.ridingY, .12); rt.camera.position.copy(rt.controls.target).add(new T.Vector3(...DIRECTIONS[options.view])); rt.camera.lookAt(rt.controls.target); rt.controls.update(); rt.resize(); rt.render();
}
function applyDisplay(rt: Runtime, options: RidingViewOptions) {
  for (const material of [rt.player.mount.material, rt.player.rider.beautyMaterial]) { material.vertexColors = options.display !== 'clay'; material.color.set(options.display === 'clay' ? '#c2b49c' : '#ffffff'); material.wireframe = options.display === 'wire'; material.needsUpdate = true; }
  rt.player.tack.setDisplay(options.display); rt.player.reins.setDisplay(options.display); rt.player.reins.setEnabled(options.reins);
  rt.player.mount.helper.visible = options.horseSkeleton; rt.player.rider.skeletonHelper.visible = options.riderSkeleton && rt.player.canRide; rt.seatHelper.visible = options.seat && rt.player.canRide; rt.grid.visible = options.grid; rt.player.update(0); rt.render();
}
/** 共用一个Canvas与帧循环；切坐骑保留人物网格和相位，仅重新挂接物种资产。 */
export function RidingViewport({ options, onStats, onPlayback, onError }: Props) {
  const host = useRef<HTMLDivElement>(null), runtime = useRef<Runtime | null>(null), latest = useRef(options), report = useRef(onPlayback), stats = useRef(onStats), error = useRef(onError);
  latest.current = options; report.current = onPlayback; stats.current = onStats; error.current = onError;
  useEffect(() => {
    const element = host.current; if (!element) return; let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (reason) { error.current(String(reason)); return; }
    let player: RidingPlayer; try { player = createRidingPlayer(latest.current.recipe, 'simple', latest.current.mountId); } catch (reason) { renderer.dispose(); error.current(String(reason)); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; element.appendChild(renderer.domElement);
    const scene = new T.Scene(); scene.add(new T.HemisphereLight('#ede9df', '#52646d', 2.1));
    const key = new T.DirectionalLight('#fff0d8', 2.8); key.position.set(-3.5, 6, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3.5, bottom: -3 }); key.shadow.bias = -.0005;
    const fill = new T.DirectionalLight('#b5d7ed', 1.05); fill.position.set(3, 3, -2); scene.add(key, fill);
    const floor = new T.Mesh(new T.CircleGeometry(3.1, 64), new T.MeshStandardMaterial({ color: '#2e4147', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.003; floor.receiveShadow = true; scene.add(floor);
    const grid = new T.GridHelper(5, 20, '#697b7d', '#40585e'); grid.position.y = .002; scene.add(grid);
    const seatHelper = new T.AxesHelper(.22); player.seat.add(seatHelper); scene.add(player.mount.mesh, player.mount.helper, player.rider.skeletonHelper);
    player.select(latest.current.clip); player.setLoop(latest.current.loop); player.seek(latest.current.phase); player.setSaddle(latest.current.saddleId);
    const perspective = new T.PerspectiveCamera(34, 1, .01, 50), ortho = new T.OrthographicCamera(-2, 2, 2, -2, .01, 50), controls = new OrbitControls(ortho, renderer.domElement); controls.enableDamping = true; controls.minZoom = .5; controls.maxZoom = 4; controls.minDistance = 2.8; controls.maxDistance = 14;
    const rt: Runtime = { player, renderer, scene, perspective, ortho, camera: ortho, controls, grid, seatHelper,
      resize() { const width = Math.max(1, element.clientWidth), height = Math.max(1, element.clientHeight), aspect = width / height; renderer.setSize(width, height, false); perspective.aspect = aspect; perspective.updateProjectionMatrix(); const half = Math.max(player.definition.frame.ridingHalf, 1.90 / aspect); ortho.left = -half * aspect; ortho.right = half * aspect; ortho.top = half; ortho.bottom = -half; ortho.updateProjectionMatrix(); }, render() { renderer.render(scene, rt.camera); },
    };
    runtime.current = rt; applyCamera(rt, latest.current); applyDisplay(rt, latest.current); stats.current(player.stats()); report.current(player.status());
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('review')) window.__RIDING_REVIEW__ = {
      mountId: () => player.mountId, seek(phase) { player.seek(phase); rt.render(); report.current(player.status()); }, getStatus: () => player.status(), stats: () => player.stats(), recipe: () => player.rider.data.recipe,
      geometryIds: () => ({ horse: player.mount.mesh.geometry.uuid, rider: player.rider.mesh.geometry.uuid }),
      saddleState: () => ({ ...player.tack.stats(), mountId: player.mountId, canRide: player.canRide, riderVisible: player.rider.mesh.visible, riderSkeletonVisible: player.rider.skeletonHelper.visible, reinsVisible: player.reins.mesh.visible, reinGeometry: player.reins.mesh.geometry.uuid, seat: player.seat.position.toArray(), reinPositions: Array.from(player.reins.mesh.geometry.getAttribute('position').array), points: player.reins.points.map(side => side.map(point => point.toArray())) }),
      matricesFinite: () => [...player.mount.bones, ...player.rider.bones, player.seat].every(bone => bone.matrixWorld.elements.every(Number.isFinite)) && [player.mount.skeleton, player.rider.skeleton].every(skeleton => Array.from(skeleton.boneMatrices).every(Number.isFinite)),
      cameraState: () => ({ position: rt.camera.position.toArray(), target: rt.controls.target.toArray(), projection: rt.camera.projectionMatrix.toArray() }),
      jointPositions: () => ({ seat: player.seat.getWorldPosition(new T.Vector3()).toArray(), horse: Object.fromEntries(player.mount.bones.map(bone => [bone.name, bone.getWorldPosition(new T.Vector3()).toArray()])), rider: Object.fromEntries(player.rider.bones.map(bone => [bone.name, bone.getWorldPosition(new T.Vector3()).toArray()])) }),
    };
    const observer = new ResizeObserver(() => { rt.resize(); rt.render(); }); observer.observe(element);
    let frame = 0, previous = performance.now(), lastReport = 0, stopped = false;
    const animate = (now: number) => { if (stopped) return; const delta = Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now; player.update(latest.current.playing ? delta * latest.current.speed : 0); rt.controls.update(); rt.render(); if (now - lastReport > 80) { report.current(player.status()); lastReport = now; } frame = requestAnimationFrame(animate); }; frame = requestAnimationFrame(animate);
    const lost = (event: Event) => { event.preventDefault(); error.current('WebGL上下文丢失，请刷新后重试。'); }; renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => { stopped = true; cancelAnimationFrame(frame); observer.disconnect(); rt.controls.dispose(); player.dispose(); floor.geometry.dispose(); floor.material.dispose(); grid.geometry.dispose(); seatHelper.geometry.dispose(); for (const helper of [grid, seatHelper]) for (const material of Array.isArray(helper.material) ? helper.material : [helper.material]) material.dispose(); key.shadow.map?.dispose(); renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.dispose(); renderer.domElement.remove(); runtime.current = null; delete window.__RIDING_REVIEW__; };
  }, []);
  useEffect(() => {
    const rt = runtime.current; if (!rt || rt.player.mountId === options.mountId) return;
    try {
      const oldY = rt.player.definition.frame.ridingY;
      if (rt.player.setMount(options.mountId)) {
        rt.scene.add(rt.player.mount.mesh, rt.player.mount.helper); rt.player.seat.add(rt.seatHelper);
        const delta = rt.player.definition.frame.ridingY - oldY; rt.controls.target.y += delta; rt.camera.position.y += delta; rt.controls.update(); rt.resize(); applyDisplay(rt, options); stats.current(rt.player.stats()); report.current(rt.player.status());
      }
    } catch (reason) { error.current(`坐骑切换失败：${String(reason)}`); }
  }, [options.mountId]);
  useEffect(() => { const rt = runtime.current; if (!rt) return; try { if (rt.player.setRecipe(options.recipe)) { rt.scene.add(rt.player.rider.skeletonHelper); applyDisplay(rt, options); stats.current(rt.player.stats()); report.current(rt.player.status()); rt.render(); } } catch (reason) { error.current(`骑手换装失败：${String(reason)}`); } }, [options.recipe]);
  useEffect(() => { const rt = runtime.current; if (!rt) return; try { rt.player.setSaddle(options.saddleId); applyDisplay(rt, options); report.current(rt.player.status()); } catch (reason) { error.current(`鞍具切换失败：${String(reason)}`); } }, [options.saddleId]);
  useEffect(() => { const rt = runtime.current; if (rt) { rt.player.select(options.clip); rt.player.seek(options.phase); report.current(rt.player.status()); rt.render(); } }, [options.clip]);
  useEffect(() => { const rt = runtime.current; if (rt) { rt.player.seek(options.phase); report.current(rt.player.status()); rt.render(); } }, [options.phase, options.seekRevision]);
  useEffect(() => { const rt = runtime.current; if (rt) { rt.player.setLoop(options.loop); report.current(rt.player.status()); } }, [options.loop]);
  useEffect(() => { const rt = runtime.current; if (rt) applyCamera(rt, options); }, [options.view, options.viewRevision, options.orthographic]);
  useEffect(() => { const rt = runtime.current; if (rt) applyDisplay(rt, options); }, [options.display, options.riderSkeleton, options.horseSkeleton, options.seat, options.grid, options.reins]);
  return <div className="horse-viewport riding-viewport" data-testid="riding-viewport" data-mount-id={options.mountId} ref={host}/>;
}
