import * as THREE from 'three';
import { getRingFrame, ringCenter } from '../character/ringGeometry';
import {
  BODY_REGION_IDS,
  type BodyRegion,
  type BodySection,
  type HumanTopologyBlueprint,
  type JointPatch,
} from '../character/topology';

const REGION_COLORS: Record<BodyRegion, THREE.ColorRepresentation> = {
  torso: 0xb8a58b,
  head: 0xd3b994,
  leftShoulder: 0xd09a62,
  rightShoulder: 0xd09a62,
  leftArm: 0x9fb0bb,
  rightArm: 0x9fb0bb,
  leftLeg: 0x889e91,
  rightLeg: 0x889e91,
  leftFoot: 0x7f8f80,
  rightFoot: 0x7f8f80,
};

const REGION_BY_ID = Object.entries(BODY_REGION_IDS).reduce<
  Record<number, BodyRegion>
>((result, [region, id]) => {
  result[id] = region as BodyRegion;
  return result;
}, {});

type RingSequence = BodySection | JointPatch;

export function applyBodyRegionColors(
  geometry: THREE.BufferGeometry,
): void {
  const bodyRegion = geometry.getAttribute('bodyRegion');
  if (!bodyRegion) return;

  const colors: number[] = [];
  const color = new THREE.Color();

  for (let index = 0; index < bodyRegion.count; index += 1) {
    const regionId = Math.round(bodyRegion.getX(index));
    const region = REGION_BY_ID[regionId] ?? 'torso';
    color.set(REGION_COLORS[region]);
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3),
  );
}

function createRingLoop(
  sequence: RingSequence,
  ringIndex: number,
  material: THREE.LineBasicMaterial,
): THREE.LineLoop {
  const ring = sequence.rings[ringIndex];
  const { center, right, forward } = getRingFrame(sequence, ringIndex);
  const points: THREE.Vector3[] = [];
  const samples = Math.max(sequence.radialSegments, 12);

  for (let segment = 0; segment < samples; segment += 1) {
    const angle = (segment / samples) * Math.PI * 2;
    points.push(
      center
        .clone()
        .addScaledVector(right, Math.cos(angle) * ring.radiusX)
        .addScaledVector(forward, Math.sin(angle) * ring.radiusY),
    );
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineLoop(geometry, material);
}

function createCenterPath(
  sequence: RingSequence,
  material: THREE.LineBasicMaterial,
): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    sequence.rings.map(ringCenter),
  );
  return new THREE.Line(geometry, material);
}

export function createRingGuideGroup(
  blueprint: HumanTopologyBlueprint,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'topology-ring-guides';

  const sectionMaterial = new THREE.LineBasicMaterial({
    color: 0xa6a29a,
    transparent: true,
    opacity: 0.5,
    depthTest: true,
  });
  const patchMaterial = new THREE.LineBasicMaterial({
    color: 0xd6a765,
    transparent: true,
    opacity: 0.9,
    depthTest: true,
  });
  const pathMaterial = new THREE.LineBasicMaterial({
    color: 0x6e777b,
    transparent: true,
    opacity: 0.55,
    depthTest: true,
  });

  const appendSequence = (
    sequence: RingSequence,
    ringMaterial: THREE.LineBasicMaterial,
  ) => {
    for (let index = 0; index < sequence.rings.length; index += 1) {
      group.add(createRingLoop(sequence, index, ringMaterial));
    }
    group.add(createCenterPath(sequence, pathMaterial));
  };

  for (const section of blueprint.sections) {
    appendSequence(section, sectionMaterial);
  }

  for (const patch of blueprint.jointPatches) {
    appendSequence(patch, patchMaterial);
  }

  group.userData.sharedMaterials = [
    sectionMaterial,
    patchMaterial,
    pathMaterial,
  ];

  return group;
}

export function disposeDebugObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (
      child instanceof THREE.Line ||
      child instanceof THREE.LineLoop ||
      child instanceof THREE.LineSegments ||
      child instanceof THREE.Points
    ) {
      child.geometry.dispose();
    }
  });

  const materials = object.userData.sharedMaterials as
    | THREE.Material[]
    | undefined;
  materials?.forEach((material) => material.dispose());
}
