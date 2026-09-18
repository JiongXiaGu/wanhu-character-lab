import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { generateHumanoidGeometry } from '../character/generateHumanoidGeometry';
import type { TopologyStats } from '../character/topology';
import type { BodyParameters } from '../character/types';

interface CharacterViewportProps {
  parameters: BodyParameters;
  wireframe: boolean;
  onTopologyStats: (stats: TopologyStats) => void;
}

function readTopologyStats(geometry: THREE.BufferGeometry): TopologyStats {
  const topology = geometry.userData.topology as
    | (TopologyStats & { blueprintVersion?: number })
    | undefined;

  return {
    sections: topology?.sections ?? 0,
    rings: topology?.rings ?? 0,
    vertices: topology?.vertices ?? 0,
    triangles: topology?.triangles ?? 0,
  };
}

export function CharacterViewport({
  parameters,
  wireframe,
  onTopologyStats,
}: CharacterViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171b1e);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    camera.position.set(2.35, 1.35, 3.15);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.88, 0);
    controls.enableDamping = true;
    controls.minDistance = 1.8;
    controls.maxDistance = 6;

    scene.add(new THREE.HemisphereLight(0xf5efe5, 0x2b3237, 2.1));

    const keyLight = new THREE.DirectionalLight(0xfff0d8, 3.2);
    keyLight.position.set(2.5, 4, 3);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x9fb5c2, 1.5);
    rimLight.position.set(-3, 2, -2);
    scene.add(rimLight);

    const material = new THREE.MeshStandardMaterial({
      color: 0xc6b29b,
      roughness: 0.82,
      metalness: 0,
      wireframe,
    });
    materialRef.current = material;

    const geometry = generateHumanoidGeometry(parameters);
    onTopologyStats(readTopologyStats(geometry));

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshRef.current = mesh;

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

    const grid = new THREE.GridHelper(4, 20, 0x4a5155, 0x2b3134);
    grid.position.y = 0.001;
    scene.add(grid);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      mesh.geometry.dispose();
      material.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      meshRef.current = null;
      materialRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const nextGeometry = generateHumanoidGeometry(parameters);
    const previousGeometry = mesh.geometry;
    mesh.geometry = nextGeometry;
    previousGeometry.dispose();
    onTopologyStats(readTopologyStats(nextGeometry));
  }, [parameters, onTopologyStats]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.wireframe = wireframe;
      materialRef.current.needsUpdate = true;
    }
  }, [wireframe]);

  return <div ref={hostRef} className="character-viewport" />;
}
