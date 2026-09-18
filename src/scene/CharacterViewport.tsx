import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { generateHumanoidGeometry } from '../character/generateHumanoidGeometry';
import type {
  V2BodyGeometryMetadata,
  V2BodyStats,
} from '../character/v2Topology';
import {
  createAnchorGuideGroup,
  createFaceGroupDebugGeometry,
  disposeV2DebugObject,
} from './createV2Debug';
import type {
  DisplayMode,
  ProjectionMode,
  ViewPreset,
} from './viewTypes';

const BODY_HEIGHT = 1.72;

interface CharacterViewportProps {
  displayMode: DisplayMode;
  projectionMode: ProjectionMode;
  viewPreset: ViewPreset;
  showGuides: boolean;
  showGrid: boolean;
  onTopologyStats: (stats: V2BodyStats) => void;
}

interface ViewportRuntime {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  perspectiveCamera: THREE.PerspectiveCamera;
  orthographicCamera: THREE.OrthographicCamera;
  activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  mesh: THREE.Mesh;
  faceGroupMesh: THREE.Mesh;
  wireOverlay: THREE.LineSegments;
  anchorGuides: THREE.Group;
  grid: THREE.GridHelper;
  axis: THREE.AxesHelper;
  centerLine: THREE.Line;
  floor: THREE.Mesh;
  shadedMaterial: THREE.MeshStandardMaterial;
  faceGroupMaterial: THREE.MeshStandardMaterial;
  wireMaterial: THREE.MeshBasicMaterial;
  wireOverlayMaterial: THREE.LineBasicMaterial;
  resize: () => void;
}

function readV2Stats(
  geometry: THREE.BufferGeometry,
): V2BodyStats {
  const metadata = geometry.userData.v2Body as
    | V2BodyGeometryMetadata
    | undefined;

  return {
    surfaceComponents: metadata?.surfaceComponents ?? 0,
    vertices: metadata?.vertices ?? 0,
    triangles: metadata?.triangles ?? 0,
    faceGroups: metadata?.faceGroups ?? 0,
    anchors: metadata?.anchors ?? 0,
    triangleBudget: metadata?.triangleBudget ?? 550,
    meshValid: metadata?.meshValid ?? false,
  };
}

function configureControls(
  runtime: ViewportRuntime,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
): void {
  runtime.controls.dispose();
  runtime.controls = new OrbitControls(
    camera,
    runtime.renderer.domElement,
  );
  runtime.controls.target.set(0, BODY_HEIGHT * 0.5, 0);
  runtime.controls.enableDamping = true;
  runtime.controls.minDistance = 1.2;
  runtime.controls.maxDistance = 6;
  runtime.controls.enablePan = true;
  runtime.controls.update();
}

function applyViewPreset(
  runtime: ViewportRuntime,
  preset: ViewPreset,
): void {
  const camera = runtime.activeCamera;
  const target = new THREE.Vector3(0, BODY_HEIGHT * 0.5, 0);
  const distance = 3.15;

  camera.up.set(0, 1, 0);

  if (camera instanceof THREE.OrthographicCamera) {
    camera.zoom = preset === 'top' ? 4.2 : 1;
    camera.updateProjectionMatrix();
  }

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
      camera.position.set(0, BODY_HEIGHT * 2.15, 0.001);
      camera.up.set(0, 0, -1);
      break;
    case 'perspective':
    default:
      camera.position.set(2.25, BODY_HEIGHT * 0.78, 3.0);
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
  runtime.mesh.visible = displayMode !== 'regions';
  runtime.faceGroupMesh.visible = displayMode === 'regions';
  runtime.wireOverlay.visible = displayMode === 'overlay';

  runtime.mesh.material =
    displayMode === 'wireframe'
      ? runtime.wireMaterial
      : runtime.shadedMaterial;
}

export function CharacterViewport({
  displayMode,
  projectionMode,
  viewPreset,
  showGuides,
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

    scene.add(
      new THREE.HemisphereLight(0xf5efe5, 0x2b3237, 2.05),
    );

    const keyLight = new THREE.DirectionalLight(0xfff0d8, 3.15);
    keyLight.position.set(2.5, 4, 3);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x9fb5c2, 1.35);
    rimLight.position.set(-3, 2, -2);
    scene.add(rimLight);

    const shadedMaterial = new THREE.MeshStandardMaterial({
      color: 0xc6b29b,
      roughness: 0.82,
      metalness: 0,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const faceGroupMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0,
      flatShading: true,
    });

    const wireMaterial = new THREE.MeshBasicMaterial({
      color: 0xd8c69f,
      wireframe: true,
    });

    const wireOverlayMaterial = new THREE.LineBasicMaterial({
      color: 0x4d4437,
      transparent: true,
      opacity: 0.92,
      depthTest: true,
      depthWrite: false,
    });

    const geometry = generateHumanoidGeometry();
    onTopologyStats(readV2Stats(geometry));

    const mesh = new THREE.Mesh(geometry, shadedMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const faceGroupGeometry =
      createFaceGroupDebugGeometry(geometry);
    const faceGroupMesh = new THREE.Mesh(
      faceGroupGeometry,
      faceGroupMaterial,
    );
    faceGroupMesh.visible = false;
    scene.add(faceGroupMesh);

    const wireOverlay = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      wireOverlayMaterial,
    );
    wireOverlay.renderOrder = 3;
    scene.add(wireOverlay);

    const anchorGuides = createAnchorGuideGroup(geometry);
    anchorGuides.visible = showGuides;
    scene.add(anchorGuides);

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

    const grid = new THREE.GridHelper(
      4,
      20,
      0x596166,
      0x30373b,
    );
    grid.position.y = 0.002;
    scene.add(grid);

    const axis = new THREE.AxesHelper(0.32);
    axis.position.set(-0.95, 0.004, -0.95);
    scene.add(axis);

    const centerLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 2.25, 0),
      ]),
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
      controls: new OrbitControls(
        initialCamera,
        renderer.domElement,
      ),
      perspectiveCamera,
      orthographicCamera,
      activeCamera: initialCamera,
      mesh,
      faceGroupMesh,
      wireOverlay,
      anchorGuides,
      grid,
      axis,
      centerLine,
      floor,
      shadedMaterial,
      faceGroupMaterial,
      wireMaterial,
      wireOverlayMaterial,
      resize: () => {},
    } satisfies ViewportRuntime;

    runtime.controls.target.set(0, BODY_HEIGHT * 0.5, 0);
    runtime.controls.enableDamping = true;
    runtime.controls.minDistance = 1.2;
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

    applyViewPreset(runtime, viewPreset);
    applyDisplayMode(runtime, displayMode);

    grid.visible = showGrid;
    axis.visible = showGrid;
    floor.visible = showGrid;
    centerLine.visible = showGrid;

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
      faceGroupMesh.geometry.dispose();
      wireOverlay.geometry.dispose();
      disposeV2DebugObject(anchorGuides);

      shadedMaterial.dispose();
      faceGroupMaterial.dispose();
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

    const nextCamera =
      projectionMode === 'orthographic'
        ? runtime.orthographicCamera
        : runtime.perspectiveCamera;

    if (runtime.activeCamera !== nextCamera) {
      nextCamera.position.copy(runtime.activeCamera.position);
      nextCamera.quaternion.copy(runtime.activeCamera.quaternion);
      runtime.activeCamera = nextCamera;
      configureControls(runtime, nextCamera);
      runtime.resize();
    }

    applyViewPreset(runtime, viewPreset);
  }, [projectionMode, viewPreset]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    applyDisplayMode(runtime, displayMode);
  }, [displayMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.anchorGuides.visible = showGuides;
  }, [showGuides]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    runtime.grid.visible = showGrid;
    runtime.axis.visible = showGrid;
    runtime.floor.visible = showGrid;
    runtime.centerLine.visible = showGrid;
  }, [showGrid]);

  return <div ref={hostRef} className="character-viewport" />;
}
