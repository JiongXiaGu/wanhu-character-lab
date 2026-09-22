import { useEffect, useRef } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHorseActor, type HorseActor } from './skinning';
import { createHorsePlayer, type HorsePlayback, type HorsePlayer } from './player';
import { createSaddleActor, type SaddleActor } from './saddles/saddle-actor';
import type { SaddleId } from './saddles/catalog';
import type { HorseClipId, HorseDisplay, HorseStats, HorseView } from './types';

export interface HorseViewOptions {
  clip: HorseClipId | 'bind'; playing: boolean; speed: number; phase: number; seekRevision: number; saddleId?: SaddleId;
  loop: boolean; view: HorseView; viewRevision: number; orthographic: boolean; display: HorseDisplay; skeleton: boolean; grid: boolean;
}
interface Props { options: HorseViewOptions; onStats: (stats: HorseStats) => void; onPlayback: (status: HorsePlayback) => void; onError: (error: string) => void }
interface Runtime {
  actor: HorseActor; tack: SaddleActor; player: HorsePlayer; renderer: T.WebGLRenderer; scene: T.Scene;
  perspective: T.PerspectiveCamera; ortho: T.OrthographicCamera; camera: T.PerspectiveCamera | T.OrthographicCamera;
  controls: OrbitControls; grid: T.GridHelper; resize: () => void; render: () => void;
}
export interface HorseReview {
  stats: HorseStats; seek: (phase: number) => void; getStatus: () => HorsePlayback; geometryId: () => string;
  cameraState: () => unknown; jointPositions: () => Record<string, number[]>; matricesFinite: () => boolean; saddleState: () => unknown;
}
declare global { interface Window { __HORSE_REVIEW__?: HorseReview } }
const DIRECTIONS: Record<HorseView, [number, number, number]> = {
  front: [0, .18, 6], left: [-6, .18, 0], right: [6, .18, 0], back: [0, .18, -6], three: [4.6, 2.1, 5.2], 'rear-three': [-4.6, 2.1, -5.2],
};
function applyCamera(runtime: Runtime, options: HorseViewOptions) {
  const next = options.orthographic ? runtime.ortho : runtime.perspective;
  if (next !== runtime.camera) {
    runtime.controls.dispose(); runtime.camera = next; runtime.controls = new OrbitControls(next, runtime.renderer.domElement);
    runtime.controls.enableDamping = true; runtime.controls.minDistance = 2.6; runtime.controls.maxDistance = 12; runtime.controls.minZoom = .5; runtime.controls.maxZoom = 4;
  }
  runtime.camera.zoom = 1; runtime.controls.target.set(0, 1.13, .15);
  runtime.camera.position.copy(runtime.controls.target).add(new T.Vector3(...DIRECTIONS[options.view]));
  runtime.camera.lookAt(runtime.controls.target); runtime.camera.updateProjectionMatrix(); runtime.controls.update(); runtime.resize(); runtime.render();
}
/** 马匹本体可单独换鞍；无骑手时只显示鞍座和辔头，不生成悬空缰绳。 */
export function HorseViewport({ options, onStats, onPlayback, onError }: Props) {
  const host = useRef<HTMLDivElement>(null), runtime = useRef<Runtime | null>(null), latest = useRef(options);
  const report = useRef(onPlayback), stats = useRef(onStats), error = useRef(onError);
  latest.current = options; report.current = onPlayback; stats.current = onStats; error.current = onError;
  useEffect(() => {
    const element = host.current; if (!element) return;
    let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
    catch (reason) { error.current(`无法创建马匹WebGL预览：${String(reason)}`); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; element.appendChild(renderer.domElement);
    const scene = new T.Scene(); scene.add(new T.HemisphereLight('#ede9df', '#52646d', 2.1));
    const key = new T.DirectionalLight('#fff0d8', 2.8); key.position.set(-3.5, 5, 5); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); key.shadow.bias = -.0005;
    const fill = new T.DirectionalLight('#b5d7ed', 1.05); fill.position.set(3, 2, -2); scene.add(key, fill);
    const floor = new T.Mesh(new T.CircleGeometry(3.1, 64), new T.MeshStandardMaterial({ color: '#2e4147', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.003; floor.receiveShadow = true; scene.add(floor);
    const grid = new T.GridHelper(5, 20, '#697b7d', '#40585e'); grid.position.y = .002; scene.add(grid);
    const perspective = new T.PerspectiveCamera(34, 1, .01, 50), ortho = new T.OrthographicCamera(-2, 2, 2, -2, .01, 50);
    let actor: HorseActor, tack: SaddleActor;
    try { actor = createHorseActor(); }
    catch (reason) { renderer.dispose(); renderer.domElement.remove(); floor.geometry.dispose(); floor.material.dispose(); grid.geometry.dispose(); (grid.material as T.Material).dispose(); error.current(String(reason)); return; }
    try { tack = createSaddleActor(actor, latest.current.saddleId ?? 'none'); }
    catch (reason) { actor.dispose(); renderer.dispose(); renderer.domElement.remove(); floor.geometry.dispose(); floor.material.dispose(); grid.geometry.dispose(); (grid.material as T.Material).dispose(); error.current(String(reason)); return; }
    scene.add(actor.mesh, actor.helper);
    const player = createHorsePlayer(actor); player.select(latest.current.clip); player.setLoop(latest.current.loop); player.seek(latest.current.phase);
    const controls = new OrbitControls(ortho, renderer.domElement); controls.enableDamping = true;
    controls.minZoom = .5; controls.maxZoom = 4; controls.minDistance = 2.6; controls.maxDistance = 12;
    const rt: Runtime = { actor, tack, player, renderer, scene, perspective, ortho, camera: ortho, controls, grid,
      resize() {
        const width = Math.max(1, element.clientWidth), height = Math.max(1, element.clientHeight), aspect = width / height;
        renderer.setSize(width, height, false); perspective.aspect = aspect; perspective.updateProjectionMatrix();
        const half = Math.max(1.48, 1.72 / aspect); ortho.left = -half * aspect; ortho.right = half * aspect; ortho.top = half; ortho.bottom = -half; ortho.updateProjectionMatrix();
      }, render() { renderer.render(scene, rt.camera); },
    };
    runtime.current = rt; applyCamera(rt, latest.current); stats.current(actor.stats);
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('review')) window.__HORSE_REVIEW__ = {
      stats: actor.stats, seek(phase) { player.seek(phase); rt.render(); report.current(player.status()); },
      getStatus: () => player.status(), geometryId: () => actor.mesh.geometry.uuid, saddleState: () => tack.stats(),
      cameraState: () => ({ position: rt.camera.position.toArray(), target: rt.controls.target.toArray(), projection: rt.camera.projectionMatrix.toArray() }),
      jointPositions: () => Object.fromEntries(actor.bones.map(bone => [bone.name, bone.getWorldPosition(new T.Vector3()).toArray()])),
      matricesFinite: () => actor.bones.every(bone => bone.matrixWorld.elements.every(Number.isFinite)) && Array.from(actor.skeleton.boneMatrices).every(Number.isFinite),
    };
    const observer = new ResizeObserver(() => { rt.resize(); rt.render(); }); observer.observe(element);
    let frame = 0, previous = performance.now(), lastReport = 0, stopped = false;
    const animate = (now: number) => {
      if (stopped) return;
      const delta = Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now;
      player.update(latest.current.playing ? delta * latest.current.speed : 0); rt.controls.update(); rt.render();
      if (now - lastReport > 80) { report.current(player.status()); lastReport = now; } frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const lost = (event: Event) => { event.preventDefault(); error.current('WebGL上下文丢失，请刷新后重试。'); }; renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      stopped = true; cancelAnimationFrame(frame); observer.disconnect(); rt.controls.dispose(); tack.dispose(); player.dispose(); actor.dispose(); floor.geometry.dispose(); floor.material.dispose(); grid.geometry.dispose();
      for (const material of Array.isArray(grid.material) ? grid.material : [grid.material]) material.dispose();
      key.shadow.map?.dispose(); renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.dispose(); renderer.domElement.remove(); runtime.current = null; delete window.__HORSE_REVIEW__;
    };
  }, []);
  useEffect(() => { const rt = runtime.current; if (!rt) return;
    try { rt.tack.select(options.saddleId ?? 'none'); rt.tack.setDisplay(options.display); rt.render(); } catch (reason) { error.current(String(reason)); }
  }, [options.saddleId]);
  useEffect(() => { const rt = runtime.current; if (rt) { rt.player.select(options.clip); rt.player.setLoop(options.loop); rt.player.seek(options.phase); report.current(rt.player.status()); rt.render(); } }, [options.clip]);
  useEffect(() => { const rt = runtime.current; if (rt) { rt.player.seek(options.phase); report.current(rt.player.status()); rt.render(); } }, [options.phase, options.seekRevision]);
  useEffect(() => { runtime.current?.player.setLoop(options.loop); }, [options.loop]);
  useEffect(() => { const rt = runtime.current; if (rt) applyCamera(rt, options); }, [options.view, options.viewRevision, options.orthographic]);
  useEffect(() => { const rt = runtime.current; if (!rt) return;
    rt.actor.material.vertexColors = options.display !== 'clay'; rt.actor.material.color.set(options.display === 'clay' ? '#c2b49c' : '#ffffff');
    rt.actor.material.wireframe = options.display === 'wire'; rt.actor.material.needsUpdate = true;
    rt.tack.setDisplay(options.display); rt.actor.helper.visible = options.skeleton; rt.grid.visible = options.grid; rt.render();
  }, [options.display, options.skeleton, options.grid]);
  return <div className="horse-viewport" ref={host} data-testid="horse-viewport" />;
}
