import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHumanTopologyBlueprint } from '../character/createHumanTopologyBlueprint';
import { generateHumanoidGeometry } from '../character/generateHumanoidGeometry';
import type { TopologyStats } from '../character/topology';
import type { BodyParameters } from '../character/types';
import {
  applyBodyRegionColors,
  createRingGuideGroup,
  disposeDebugObject,
} from './createTopologyDebug';
import type {
  DisplayMode,
  ProjectionMode,
  ViewPreset,
} from './viewTypes';

interface CharacterViewportProps {
  parameters: BodyParameters;
  displayMode: DisplayMode;
  projectionMode: ProjectionMode;
  viewPreset: ViewPreset;
  showRings: boolean;
  showGrid: boolean;
  onTopologyStats: (stats: TopologyStats) => void;
}

interface ViewportRuntime {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  perspectiveCamera: THREE.PerspectiveCamera;
  orthographicCamera: THREE.OrthographicCamera;
  activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  mesh: THREE.Mesh;
  wireOverlay: THREE.LineSegments;
  ringGuides: THREE.Group;
  grid: THREE.GridHelper;
  axis: THREE.AxesHelper;
  centerLine: THREE.Line;
  floor: THREE.Mesh;
  shadedMaterial: THREE.MeshStandardMaterial;
  regionMaterial: THREE.MeshStandardMaterial;
  wireMaterial: THREE.MeshBasicMaterial;
  wireOverlayMaterial: THREE.LineBasicMaterial;
  resize: () => void;
}

function readTopologyStats(geometry: THREE.BufferGeometry): TopologyStats {
  const topology = geometry.userData.topology as
    | (TopologyStats & { blueprintVersion?: number })
    | undefined;

  return {
    sections: topology?.sections ?? 0,
    jointPatches: topology?.jointPatches ?? 0,
    rings: topology?.rings ?? 0,
    vertices: topology?.vertices ?? 0,
    triangles: topology?.triangles ?? 0,
  };
}

function configureControls(
  runtime: ViewportRuntime,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  targetY: number,
): void {
  runtime.controls.dispose();
  runtime.controls = new OrbitControls(camera, runtime.renderer.domElement);
  runtime.controls.target.set(0, targetY, 0);
  runtime.controls.enableDamping = true;
  runtime.controls.minDistance = 1.3;
  runtime.controls.maxDistance = 6;
  runtime.controls.enablePan = true;
  runtime.controls.update();
}

function applyViewPreset(
  runtime: ViewportRuntime,
  preset: ViewPreset,
  height: number,
): void {
  const camera = runtime.activeCamera;
  const target = new THREE.Vector3(0, height * 0.5, 0);
  const distance = 3.15;

  camera.up.set(0, 1, 0);

  switch (preset) {
    case 'front':
      camera.position.set(0, target.y, distance);
      break;
    case 'back':
      camera.position.set(0, target.y, -distance);
      break;
    case 'left':
      camera.position.set(-distance, target.y, 0);
      break;
    case 'right':
      camera.position.set(distance, target.y, 0);
      break;
    case 'top':
      camera.position.set(0, height * 2.15, 0.001);
      camera.up.set(0, 0, -1);
      break;
    case 'perspective':
    default:
      camera.position.set(2.35, height * 0.76, 3.15);
      break;
  }

  camera.lookAt(target);
  runtime.controls.target.copy(target);
  runtime.controls.update();
}

function applyDisplayMode(
  runtime: ViewportRuntime,
  displayMode: DisplayMode,
): void {
  runtime.wireOverlay.visible = displayMode === 'overlay';

  switch (displayMode) {
    case 'wireframe':
      runtime.mesh.material = runtime.wireMaterial;
      break;
    case 'regions':
      runtime.mesh.material = runtime.regionMaterial;
      break;
    case 'overlay':
    case 'shaded':
    default:
      runtime.mesh.material = runtime.shadedMaterial;
      break;
  }
}

export function CharacterViewport({
  parameters,
  displayMode,
  projectionMode,
  viewPreset,
  showRings,
  showGrid,
  onTopologyStats,
}: CharacterViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ViewportRuntime | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15191c);

    const perspectiveCamera = new THREE.PerspectiveCamera(
      38,
      1,
      0.01,
      100,
    );
    const orthographicCamera = new THREE.OrthographicCamera(
      -1.2,
      1.2,
      1.2,
      -1.2,
      0.01,
      100,
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xf5efe5, 0x2b3237, 2.05));

    const keyLight = new THREE.DirectionalLight(0xfff0d8, 3.15);
    keyLight.position.set(2.5, 4, 3);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x9fb5c2, 1.35);
    rimLight.position.set(-3, 2, -2);
    scene.add(rimLight);

    const shadedMaterial = new THREE.MeshStandardMaterial({
      color: 0xc6b29b,
      roughness: 0.8,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const regionMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const wireMaterial = new THREE.MeshBasicMaterial({
      color: 0xd8c69f,
      wireframe: true,
    });

    const wireOverlayMaterial = new THREE.LineBasicMaterial({
      color: 0x5d5140,
      transparent: true,
      opacity: 0.88,
      depthTest: true,
      depthWrite: false,
    });

    const blueprint = createHumanTopologyBlueprint(parameters);
    const geometry = generateHumanoidGeometry(parameters);
    applyBodyRegionColors(geometry);
    onTopologyStats(readTopologyStats(geometry));

    const mesh = new THREE.Mesh(geometry, shadedMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const wireOverlay = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      wireOverlayMaterial,
    );
    wireOverlay.renderOrder = 3;
    scene.add(wireOverlay);

    const ringGuides = createRingGuideGroup(blueprint);
    scene.add(ringGuides);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 64),
      new THREE.MeshStandardMaterial({
        color: 0x242a2e,
        roughness: 1,
      }),
    );
    floor.rotation.x = -Math.PI * 0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(4, 20, 0x596166, 0x30373b);
    grid.position.y = 0.002;
    scene.add(grid);

    const axis = new THREE.AxesHelper(0.32);
    axis.position.set(-0.95, 0.004, -0.95);
    scene.add(axis);

    const centerLineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 2.25, 0),
    ]);
    const centerLine = new THREE.Line(
      centerLineGeometry,
      new THREE.LineBasicMaterial({
        color: 0x8a7858,
        transparent: true,
        opacity: 0.34,
      }),
    );
    scene.add(centerLine);

    const initialCamera =
      projectionMode === 'orthographic'
        ? orthographicCamera
        : perspectiveCamera;

    const runtime = {
      scene,
      renderer,
      controls: new OrbitControls(initialCamera, renderer.domElement),
      perspectiveCamera,
      orthographicCamera,
      activeCamera: initialCamera,
      mesh,
      wireOverlay,
      ringGuides,
      grid,
      axis,
      centerLine,
      floor,
      shadedMaterial,
      regionMaterial,
      wireMaterial,
      wireOverlayMaterial,
      resize: () => {},
    } satisfies ViewportRuntime;

    runtime.controls.target.set(0, parameters.height * 0.5, 0);
    runtime.controls.enableDamping = true;
    runtime.controls.minDistance = 1.3;
    runtime.controls.maxDistance = 6;
    runtime.controls.enablePan = true;

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      const aspect = width / height;

      perspectiveCamera.aspect = aspect;
      perspectiveCamera.updateProjectionMatrix();

      const orthoHalfHeight = 1.08;
      orthographicCamera.left = -orthoHalfHeight * aspect;
      orthographicCamera.right = orthoHalfHeight * aspect;
      orthographicCamera.top = orthoHalfHeight;
      orthographicCamera.bottom = -orthoHalfHeight;
      orthographicCamera.updateProjectionMatrix();

      renderer.setSize(width, height, false);
    };

    runtime.resize = resize;
    runtimeRef.current = runtime;

    applyViewPreset(runtime, viewPreset, parameters.height);
    applyDisplayMode(runtime, displayMode);
    ringGuides.visible = showRings;
    grid.visible = showGrid;
    axis.visible = showGrid;

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      runtime.controls.update();
      renderer.render(scene, runtime.activeCamera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      runtime.controls.dispose();

      mesh.geometry.dispose();
      wireOverlay.geometry.dispose();
      disposeDebugObject(ringGuides);

      shadedMaterial.dispose();
      regionMaterial.dispose();
      wireMaterial.dispose();
      wireOverlayMaterial.dispose();

      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      axis.geometry.dispose();
      (axis.material as THREE.Material).dispose();
      centerLine.geometry.dispose();
      (centerLine.material as THREE.Material).dispose();

      renderer.dispose();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    const blueprint = createHumanTopologyBlueprint(parameters);
    const nextGeometry = generateHumanoidGeometry(parameters);
    applyBodyRegionColors(nextGeometry);

    const previousGeometry = runtime.mesh.geometry;
    runtime.mesh.geometry = nextGeometry;
    previousGeometry.dispose();

    const previousWireGeometry = runtime.wireOverlay.geometry;
    runtime.wireOverlay.geometry = new THREE.WireframeGeometry(nextGeometry);
    previousWireGeometry.dispose();

    runtime.scene.remove(runtime.ringGuides);
    disposeDebugObject(runtime.ringGuides);
    runtime.ringGuides = createRingGuideGroup(blueprint);
    runtime.ringGuides.visible = showRings;
    runtime.scene.add(runtime.ringGuides);

    onTopologyStats(readTopologyStats(nextGeometry));
    runtime.controls.target.set(0, parameters.height * 0.5, 0);
    runtime.controls.update();
  }, [parameters, onTopologyStats, showRings]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    const nextCamera =
      projectionMode === 'orthographic'
        ? runtime.orthographicCamera
        : runtime.perspectiveCamera;

    if (runtime.activeCamera !== nextCamera) {
      nextCamera.position.copy(runtime.activeCamera.position);
      nextCamera.quaternion.copy(runtime.activeCamera.quaternion);
      runtime.activeCamera = nextCamera;
      configureControls(runtime, nextCamera, parameters.height * 0.5);
      runtime.resize();
    }

    applyViewPreset(runtime, viewPreset, parameters.height);
  }, [projectionMode, viewPreset, parameters.height]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    applyDisplayMode(runtime, displayMode);
  }, [displayMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.ringGuides.visible = showRings;
  }, [showRings]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.grid.visible = showGrid;
    runtime.axis.visible = showGrid;
  }, [showGrid]);

  return <div ref={hostRef} className="character-viewport" />;
}
