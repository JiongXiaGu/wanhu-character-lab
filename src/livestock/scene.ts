import { ACESFilmicToneMapping, CircleGeometry, DirectionalLight, GridHelper, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, OrthographicCamera, Plane, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createClipClock } from '../animation/clip-clock';
import { createAnimalActor } from './actor';
import { livestockDefinition } from './catalog';
import { habitatDefinition } from './habitat';
import { createPreviewWater } from './water';
import { createCrowd, layoutHalf, previewDuration } from './crowd';
import { LIVESTOCK_REFERENCE_HEIGHT, selectLivestockLod } from './lod';
import type { CameraSnapshot, LabOptions, LabStats, LivestockDefinition, LivestockLodId, Playback } from './types';

export interface LivestockReviewHook {
  snapshot(): LabStats & Playback & { animal: string; surface: string; waterLevel: number; waterClipped: boolean; rendererId: string; motion: string; mixed: boolean; playing: boolean; seed: number; geometries: number; calls: number; geometryId: number; camera: CameraSnapshot };
  camera(): CameraSnapshot;
}
declare global { interface Window { __LIVESTOCK_REVIEW__?: LivestockReviewHook } }

/** 一个页面只有一个RAF与一个时间游标；LOD切换只换作者几何/姿态缓存，不重建Renderer。 */
export function createLivestockScene(host: HTMLElement, initialDefinition: LivestockDefinition, current: { current: LabOptions }, report: (stats: LabStats, playback: Playback) => void, initialCamera?: CameraSnapshot) {
  const cleanup: (() => void)[] = [];
  try {
    const renderer = new WebGLRenderer({ antialias: true, alpha: true }); cleanup.push(() => { renderer.dispose(); renderer.domElement.remove(); });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.localClippingEnabled = true;
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

    function makeActors(definition: LivestockDefinition) {
      const candidates = new Map<LivestockLodId, ReturnType<typeof createAnimalActor>>();
      try { for (const lod of definition.lods) candidates.set(lod.id, createAnimalActor(definition, lod.id)); }
      catch (error) { for (const actor of candidates.values()) actor.dispose(); throw error; }
      return candidates;
    }
    let definition = initialDefinition, actors = makeActors(definition);
    for (const actor of actors.values()) scene.add(actor.mesh, actor.helper);
    cleanup.push(() => { for (const actor of actors.values()) actor.dispose(); actors.clear(); });
    // 只放大超出原鸡鸭构图的物种；固定参考身高不会随低头动作抖动。
    const singleScale = () => Math.max(1, (definition.referenceHeight ?? 0) / .53);
    // 长身物种的单只地盘也覆盖鼻端；只在创建／换物种时读作者点，家禽原半径不变。
    const groundRadius = () => Math.max(.49 * singleScale(), ...actors.get('lod0')!.data.positions.map(([x, , z]) => Math.hypot(x, z) + .04));
    let singleGroundRadius = groundRadius();
    // 有限水盘只展示水面；共用水位裁切防止低视角看到水盘边缘下露出的蹼足，不改作者网格。
    const waterClip = new Plane(new Vector3(0, 1, 0), 0), waterClips = [waterClip];
    const water = createPreviewWater(); scene.add(water.mesh, water.ripple); cleanup.push(() => water.dispose());
    let crowd: ReturnType<typeof createCrowd> | undefined;
    cleanup.push(() => crowd?.dispose());

    let options = current.current, previous = { ...options }, first = true, alive = true, frameId = 0, previousTime = performance.now(), lastReport = -Infinity, wasFinished = false;
    let duration = previewDuration(definition, options), clock = createClipClock(duration, options.loop); clock.seek(options.phase);
    let half = layoutHalf(options.count, definition.previewSpacing), aspect = 1;
    const cameraSnapshot = (): CameraSnapshot => ({ position: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom });
    function resize() {
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight); aspect = width / height;
      const h = half * Math.max(1, 1 / aspect); camera.left = -h * aspect; camera.right = h * aspect; camera.top = h; camera.bottom = -h;
      camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    }
    function fit() {
      half = layoutHalf(options.count, definition.previewSpacing) * (options.count === 1 ? singleScale() : 1) * (options.view === 'farm' ? 1.10 : 1.2);
      const directions = { three: [1.25, .70, 1.5], front: [0, .2, 2], left: [-2, .18, 0], farm: [.28, 1.85, 1.3] };
      const direction = new Vector3(...directions[options.view] as [number, number, number]).normalize();
      controls.target.set(0, options.count === 1 ? .24 * singleScale() : 0, 0); camera.position.copy(controls.target).addScaledVector(direction, half * 4 + 2);
      camera.zoom = 1; camera.lookAt(controls.target); controls.update(); resize();
    }
    function pixelHeight() {
      const visibleWorldHeight = Math.max(.001, (camera.top - camera.bottom) / Math.max(.001, camera.zoom));
      return Math.max(0, host.clientHeight) * (definition.referenceHeight ?? LIVESTOCK_REFERENCE_HEIGHT) / visibleWorldHeight;
    }
    function resolvedLod() { return selectLivestockLod(options.lod, pixelHeight()); }
    fit();
    if (initialCamera) { camera.position.fromArray(initialCamera.position); controls.target.fromArray(initialCamera.target); camera.zoom = initialCamera.zoom; camera.updateProjectionMatrix(); controls.update(); }
    const observer = new ResizeObserver(resize); observer.observe(host); cleanup.push(() => observer.disconnect());
    const stats = (): LabStats => {
      const lod = resolvedLod(), actor = actors.get(lod)!;
      return { triangles: actor.data.indices.length / 3, logicalVertices: actor.data.positions.length, bones: actor.bones.length, count: options.count,
        modelTriangles: actor.data.indices.length / 3 * options.count, batches: options.count === 1 ? 1 : crowd?.batchCount ?? 0, cachedPoses: crowd?.cachedPoses ?? 0,
        lod, pixelHeight: pixelHeight() };
    };
    const playback = (): Playback => ({ phase: clock.phase, time: clock.time, duration, finished: clock.finished });
    const hook: LivestockReviewHook = {
      snapshot: () => {
        const lod = resolvedLod(), actor = actors.get(lod)!;
        return { ...stats(), ...playback(), animal: definition.id, surface: options.surface, waterLevel: habitatDefinition(definition, options.surface).waterline ?? 0, waterClipped: !!actor.material.clippingPlanes?.length, rendererId: renderer.domElement.dataset.rendererId!, motion: options.motion, mixed: options.count > 1 && options.mixed, playing: options.playing, seed: options.seed,
          geometries: renderer.info.memory.geometries, calls: renderer.info.render.calls, geometryId: actor.geometry.id, camera: cameraSnapshot() };
      },
      camera: cameraSnapshot,
    };
    renderer.domElement.dataset.rendererId = crypto.randomUUID();
    window.__LIVESTOCK_REVIEW__ = hook;
    cleanup.push(() => { if (window.__LIVESTOCK_REVIEW__ === hook) delete window.__LIVESTOCK_REVIEW__; });
    cleanup.push(() => { alive = false; cancelAnimationFrame(frameId); scene.clear(); });

    function frame(now: number) {
      if (!alive) return;
      options = current.current;
      const changedSpecies = options.animal !== definition.id;
      if (changedSpecies) {
        // 候选完整创建成功后再释放旧物种，不重建Renderer、相机或覆盖旧物种作者数据。
        const previousScale = singleScale(), previousLayout = layoutHalf(options.count, definition.previewSpacing);
        const next = livestockDefinition(options.animal), candidates = makeActors(next);
        crowd?.dispose(); crowd = undefined;
        for (const actor of actors.values()) actor.dispose();
        definition = next; actors = candidates; singleGroundRadius = groundRadius();
        for (const actor of actors.values()) scene.add(actor.mesh, actor.helper);
        if (options.count === 1 && singleScale() !== previousScale) {
          // 保留方向、平移偏好与zoom，只补偿物种身高和正交范围；鸡鸭之间仍完全不动相机。
          const lift = .24 * (singleScale() - previousScale);
          half *= singleScale() / previousScale;
          controls.target.y += lift; camera.position.y += lift; controls.update(); resize();
        }
        if (options.count > 1 && layoutHalf(options.count, definition.previewSpacing) !== previousLayout) {
          half *= layoutHalf(options.count, definition.previewSpacing) / previousLayout; resize();
        }
      }
      const nextDuration = previewDuration(definition, options);
      if (nextDuration !== duration) { const phase = clock.phase; duration = nextDuration; clock = createClipClock(duration, options.loop); clock.seek(phase); }
      clock.setLoop(options.loop);
      const seeking = options.seekRevision !== previous.seekRevision;
      if (seeking) clock.seek(options.phase);
      if (options.playing && !seeking) clock.advance(Math.min(.1, Math.max(0, (now - previousTime) / 1000)) * options.speed);
      previousTime = now;
      if (first || changedSpecies || options.count !== previous.count || options.seed !== previous.seed) {
        if (options.count > 1) { if (!crowd) { crowd = createCrowd(definition, actors.get('lod0')!.material); scene.add(crowd.group); } crowd.setLayout(options.count, options.seed); }
        const radius = options.count === 1 ? singleGroundRadius : layoutHalf(options.count, definition.previewSpacing) * Math.SQRT2;
        floor.scale.setScalar(radius); shadow.scale.setScalar(singleScale()); grid.scale.setScalar(options.count === 1 ? .5 * singleScale() : layoutHalf(options.count, definition.previewSpacing));
      }
      if (options.count !== previous.count || options.viewRevision !== previous.viewRevision) fit();
      if (first || changedSpecies || options.display !== previous.display) {
        for (const actor of actors.values()) {
          actor.material.vertexColors = options.display === 'beauty'; actor.material.color.set(options.display === 'beauty' ? '#ffffff' : '#dad1b9');
          actor.material.wireframe = options.display === 'wire'; actor.material.needsUpdate = true;
        }
      }
      const lod = resolvedLod(), actor = actors.get(lod)!;
      for (const [id, candidate] of actors) {
        candidate.mesh.visible = options.count === 1 && id === lod;
        candidate.helper.visible = options.count === 1 && options.skeleton && id === lod;
      }
      const profile = habitatDefinition(definition, options.surface), onWater = profile.id === 'water';
      const waterY = profile.waterline ?? 0, radius = options.count === 1 ? singleGroundRadius : layoutHalf(options.count, definition.previewSpacing) * Math.SQRT2;
      waterClip.constant = -waterY;
      if (first || changedSpecies || options.surface !== previous.surface) {
        for (const candidate of actors.values()) { candidate.material.clippingPlanes = onWater ? waterClips : null; candidate.material.needsUpdate = true; }
      }
      water.update(onWater, waterY, radius, clock.phase * 6, options.count === 1);
      floor.visible = !onWater; shadow.visible = !onWater && options.count === 1;
      grid.position.y = (onWater ? waterY : 0) + .002;
      grid.visible = options.grid || (onWater && options.waterline);
      if (crowd) crowd.group.visible = options.count > 1;
      if (options.count === 1) actor.sample(options.motion, clock.phase); else crowd!.update(clock.time, options, lod);
      controls.update(); renderer.render(scene, camera);
      if (now - lastReport >= 150 || seeking || options.lod !== previous.lod || changedSpecies || options.surface !== previous.surface || (clock.finished && !wasFinished) || first) { report(stats(), playback()); lastReport = now; }
      wasFinished = clock.finished; previous = { ...options }; first = false; frameId = requestAnimationFrame(frame);
    }
    frameId = requestAnimationFrame(frame);
    return { camera: cameraSnapshot, dispose() { while (cleanup.length) cleanup.pop()!(); } };
  } catch (error) { while (cleanup.length) cleanup.pop()!(); throw error; }
}
