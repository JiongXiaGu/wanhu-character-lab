import * as THREE from 'three';
import {
  BODY_PART_IDS,
  type BodyPartId,
  type LowPolyHumanoidBlueprint,
} from '../character/lowPolyTopology';

const PART_COLORS: Record<BodyPartId, THREE.ColorRepresentation> = {
  torso: 0xb9a88d,
  pelvis: 0xa68e73,
  head: 0xd2ba99,
  neck: 0xc6ad8d,
  leftUpperArm: 0x8fa5b1,
  leftLowerArm: 0x8198a4,
  leftHand: 0xaebac0,
  rightUpperArm: 0x8fa5b1,
  rightLowerArm: 0x8198a4,
  rightHand: 0xaebac0,
  leftUpperLeg: 0x879b8b,
  leftLowerLeg: 0x788d7d,
  leftFoot: 0x6f8074,
  rightUpperLeg: 0x879b8b,
  rightLowerLeg: 0x788d7d,
  rightFoot: 0x6f8074,
};

const PART_BY_ID = Object.entries(BODY_PART_IDS).reduce<
  Record<number, BodyPartId>
>((result, [part, id]) => {
  result[id] = part as BodyPartId;
  return result;
}, {});

export function applyBodyPartColors(
  geometry: THREE.BufferGeometry,
): void {
  const bodyPart = geometry.getAttribute('bodyPart');
  if (!bodyPart) return;

  const colors: number[] = [];
  const color = new THREE.Color();

  for (let index = 0; index < bodyPart.count; index += 1) {
    const partId = Math.round(bodyPart.getX(index));
    const part = PART_BY_ID[partId] ?? 'torso';
    color.set(PART_COLORS[part]);
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3),
  );
}

export function createPartGuideGroup(
  blueprint: LowPolyHumanoidBlueprint,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'low-poly-part-guides';

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xd2b77f,
    transparent: true,
    opacity: 0.68,
    depthTest: true,
  });

  const pointMaterial = new THREE.PointsMaterial({
    color: 0xf1d49b,
    size: 0.018,
    sizeAttenuation: true,
    depthTest: true,
  });

  for (const part of blueprint.parts) {
    const points = part.sections.map(
      (section) =>
        new THREE.Vector3(
          section.center[0],
          section.center[1],
          section.center[2],
        ),
    );

    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        lineMaterial,
      ),
    );

    group.add(
      new THREE.Points(
        new THREE.BufferGeometry().setFromPoints(points),
        pointMaterial,
      ),
    );
  }

  group.userData.sharedMaterials = [lineMaterial, pointMaterial];
  return group;
}

export function disposeDebugObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (
      child instanceof THREE.Line ||
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
