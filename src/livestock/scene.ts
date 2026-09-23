import { ACESFilmicToneMapping, CircleGeometry, DirectionalLight, GridHelper, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, OrthographicCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createClipClock } from '../animation/clip-clock';
import { createAnimalActor } from './actor';
import { createCrowd, layoutHalf, previewDuration } from './crowd';
import type { CameraSnapshot, LabOptions, LabStats, LivestockDefinition, Playback } from './types';

export interface LivestockReviewHook {
  snapshot(): LabStats & Playback & { motion: string; mixed: boolean; playing: boolean; seed: number; geometries: number; calls: number; geometryId: number; camera: CameraSnapshot };
  camera(): CameraSnapshot;
}
declare global { interface Window { __LIVESTOCK_REVIEW__?: LivestockReviewHook } }

/** 一个页面只有一个RAF与一个时间游标；换动作、数量和材质都不重建Renderer。 */
export function createLivestockScene(host: HTMLElement, definition: LivestockDefinition, current: { current: LabOptions }, report: (stats: LabStats, playback: Playback) => void, initialCamera?: CameraSnapshot) {
  const cleanup: (() => void)[] = [];
  try {
    const renderer = new WebGLRenderer({ antialias: true, alpha: true }); cleanup.push(() => { renderer.dispose(); renderer.domElement.remove(); });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0, 0); host.appendChild(renderer.domElement);
    const scene = new Scene(), camera = new OrthographicCamera(-1, 1, 1, -1, .01, 1000);
    const controls = new OrbitControls(camera, renderer.domElement); cleanup.push(() => controls.dispose());
    controls.enableDamping = false; controls.minZoom = .2; controls.maxZoom = 15;
    scene.add(new HemisphereLight('#fff0d8', '#526560', 2.2));
    const sun = new DirectionalLight('#fff0d8', 2.6); sun.position.set(-3, 6, 4); scene.add(sun);
    const fill = new DirectionalLight('#b9d2dc', .9); fill.position.set(3, 2, -3); scene.add(fill);
    const floorGeometry = new CircleGeometry(1, 64), floorMaterial = new MeshStandardMaterial({ color: '#938973', roughness: 1 });
    const floor = new Mesh(floorGeometry, floorMaterial); floor.rotation.x = -Math.PI / 2; floor.position.y = -.003; scene.add(floor);
    cleanup.push(() => { floorGeometry.dispose(); floorMaterial.dispose(); });
    const shadowGeometry = new CircleGeometry(.14, 16), shadowMaterial = new MeshBasicMaterial({ color: '#26312b', transparent: true, opacity: .17, depthWrite: false });
    const shadow = new Mesh(shadowGeometry, shadowMaterial); shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, .001, -.035); scene.add(shadow);
    cleanup.push(() => { shadowGeometry.dispose(); shadowMaterial.dispose(); });
    const grid = new GridHelper(2, 20, '#b6b09a', '#a6a28d'); grid.position.y = .002; scene.add(grid);
    cleanup.push(() => { grid.geometry.dispose(); const material = grid.material; if (Array.isArray(material)) material.forEach(m => m.dispose()); else material.dispose(); });
    const actor = createAnimalActor(definition); scene.add(actor.mesh, actor.helper); cleanup.push(() => actor.dispose());
    let crowd: ReturnType<typeof createCrowd> | undefined;
    cleanup.push(() => crowd?.dispose());
    let options = current.current, previous = { ...options }, first = true, alive = true, frameId = 0, previousTime = performance.now(), lastReport = -Infinity, wasFinished = false;
    let duration = previewDuration(definition, options), clock = createClipClock(duration, options.loop); clock.seek(options.phase);
    let half = layoutHalf(options.count), aspect = 1;
    const cameraSnapshot = (): CameraSnapshot => ({ position: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom });
    function resize() {
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight); aspect = width / height;
      const h = half * Math.max(1, 1 / aspect); camera.left = -h * aspect; camera.right = h * aspect; camera.top = h; camera.bottom = -h;
      camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    }
    function fit() {
      half = layoutHalf(options.count) * (options.view === 'farm' ? 1.10 : 1.2);
      const directions = { three: [1.25, .70, 1.5], front: [0, .2, 2], left: [-2, .18, 0], farm: [.28, 1.85, 1.3] };
      const direction = new Vector3(...directions[options.view] as [number, number, number]).normalize();
      controls.target.set(0, options.count === 1 ? .24 : 0, 0); camera.position.copy(controls.target).addScaledVector(direction, half * 4 + 2);
      camera.zoom = 1; camera.lookAt(controls.target); controls.update(); resize();
    }
    fit();
    if (initialCamera) { camera.position.fromArray(initialCamera.position); controls.target.fromArray(initialCamera.target); camera.zoom = initialCamera.zoom; camera.updateProjectionMatrix(); controls.update(); }
    const observer = new ResizeObserver(resize); observer.observe(host); cleanup.push(() => observer.disconnect());
    const stats = (): LabStats => ({ triangles: actor.data.indices.length / 3, logicalVertices: actor.data.positions.length, bones: actor.bones.length, count: options.count,
      modelTriangles: actor.data.indices.length / 3 * options.count, batches: options.count === 1 ? 1 : crowd?.batchCount ?? 0, cachedPoses: crowd?.cachedPoses ?? 0 });
    const playback = (): Playback => ({ phase: clock.phase, time: clock.time, duration, finished: clock.finished });
    const hook: LivestockReviewHook = {
      snapshot: () => ({ ...stats(), ...playback(), motion: options.motion, mixed: options.count > 1 && options.mixed, playing: options.playing, seed: options.seed,
        geometries: renderer.info.memory.geometries, calls: renderer.info.render.calls, geometryId: actor.geometry.id, camera: cameraSnapshot() }),
      camera: cameraSnapshot,
    };
    window.__LIVESTOCK_REVIEW__ = hook;
    cleanup.push(() => { if (window.__LIVESTOCK_REVIEW__ === hook) delete window.__LIVESTOCK_REVIEW__; });
    cleanup.push(() => { alive = false; cancelAnimationFrame(frameId); scene.clear(); });
    function frame(now: number) {
      if (!alive) return;
      options = current.current;
      const nextDuration = previewDuration(definition, options);
      if (nextDuration !== duration) { const phase = clock.phase; duration = nextDuration; clock = createClipClock(duration, options.loop); clock.seek(phase); }
      clock.setLoop(options.loop);
      const seeking = options.seekRevision !== previous.seekRevision;
      if (seeking) clock.seek(options.phase);
      if (options.playing && !seeking) clock.advance(Math.min(.1, Math.max(0, (now - previousTime) / 1000)) * options.speed);
      previousTime = now;
      if (first || options.count !== previous.count || options.seed !== previous.seed) {
        if (options.count > 1) { if (!crowd) { crowd = createCrowd(definition, actor.material); scene.add(crowd.group); } crowd.setLayout(options.count, options.seed); }
        const radius = options.count === 1 ? .49 : layoutHalf(options.count) * Math.SQRT2;
        floor.scale.setScalar(radius); grid.scale.setScalar(options.count === 1 ? .5 : layoutHalf(options.count));
      }
      if (options.count !== previous.count || options.viewRevision !== previous.viewRevision) fit();
      if (first || options.display !== previous.display) {
        actor.material.vertexColors = options.display === 'beauty'; actor.material.color.set(options.display === 'beauty' ? '#ffffff' : '#dad1b9');
        actor.material.wireframe = options.display === 'wire'; actor.material.needsUpdate = true;
      }
      actor.mesh.visible = options.count === 1; actor.helper.visible = options.count === 1 && options.skeleton;
      shadow.visible = options.count === 1; grid.visible = options.grid;
      if (crowd) crowd.group.visible = options.count > 1;
      if (options.count === 1) actor.sample(options.motion, clock.phase); else crowd!.update(clock.time, options);
      controls.update(); renderer.render(scene, camera);
      // 拖动后立即回报，末帧只在进入结束时即时回报，不持续触发逐帧React更新。
      if (now - lastReport >= 150 || seeking || (clock.finished && !wasFinished) || first) { report(stats(), playback()); lastReport = now; }
      wasFinished = clock.finished; previous = { ...options }; first = false; frameId = requestAnimationFrame(frame);
    }
    frameId = requestAnimationFrame(frame);
    return { camera: cameraSnapshot, dispose() { while (cleanup.length) cleanup.pop()!(); } };
  } catch (error) { while (cleanup.length) cleanup.pop()!(); throw error; }
}
