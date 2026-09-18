import * as THREE from 'three';
import {
  BODY_FACE_GROUP_IDS,
  type BodyFaceGroup,
  type V2BodyGeometryMetadata,
} from '../character/v2Topology';

const FACE_GROUP_COLORS: Record<
  BodyFaceGroup,
  THREE.ColorRepresentation
> = {
  Head: 0xd2ba99,
  Neck: 0xc6ad8d,
  Shoulder: 0xc79368,
  Chest: 0xb8a58b,
  Back: 0x9d8f7c,
  Abdomen: 0xb09b80,
  Pelvis: 0xa68e73,
  UpperArm: 0x8fa5b1,
  LowerArm: 0x8198a4,
  Hand: 0xaebac0,
  UpperLeg: 0x879b8b,
  LowerLeg: 0x788d7d,
  Foot: 0x6f8074,
};

const GROUP_BY_ID = Object.entries(BODY_FACE_GROUP_IDS).reduce<
  Record<number, BodyFaceGroup>
>((result, [group, id]) => {
  result[id] = group as BodyFaceGroup;
  return result;
}, {});

function readMetadata(
  geometry: THREE.BufferGeometry,
): V2BodyGeometryMetadata {
  const metadata = geometry.userData.v2Body as
    | V2BodyGeometryMetadata
    | undefined;

  if (!metadata) {
    throw new Error('Missing V2 body geometry metadata.');
  }

  return metadata;
}

export function createFaceGroupDebugGeometry(
  source: THREE.BufferGeometry,
): THREE.BufferGeometry {
  const position = source.getAttribute('position');
  const index = source.getIndex();
  const metadata = readMetadata(source);

  if (!position || !index) {
    throw new Error('V2 body geometry is missing position or index data.');
  }

  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();

  const triangleCount = index.count / 3;

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const groupId = metadata.triangleFaceGroups[triangle] ?? 0;
    const group = GROUP_BY_ID[groupId] ?? 'Chest';
    color.set(FACE_GROUP_COLORS[group]);

    for (let corner = 0; corner < 3; corner += 1) {
      const vertexIndex = index.getX(triangle * 3 + corner);

      positions.push(
        position.getX(vertexIndex),
        position.getY(vertexIndex),
        position.getZ(vertexIndex),
      );

      colors.push(color.r, color.g, color.b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

export function createAnchorGuideGroup(
  source: THREE.BufferGeometry,
): THREE.Group {
  const metadata = readMetadata(source);
  const position = source.getAttribute('position');

  if (!position) {
    throw new Error('V2 body geometry is missing position data.');
  }

  const group = new THREE.Group();
  group.name = 'v2-garment-anchor-guides';

  const torsoMaterial = new THREE.LineBasicMaterial({
    color: 0xd7b875,
    transparent: true,
    opacity: 0.9,
    depthTest: true,
  });

  const limbMaterial = new THREE.LineBasicMaterial({
    color: 0x9eb9c4,
    transparent: true,
    opacity: 0.86,
    depthTest: true,
  });

  for (const [anchorId, vertexIndices] of Object.entries(
    metadata.anchorVertexIndices,
  )) {
    const points = vertexIndices.map(
      (vertexIndex) =>
        new THREE.Vector3(
          position.getX(vertexIndex),
          position.getY(vertexIndex),
          position.getZ(vertexIndex),
        ),
    );

    const material =
      anchorId.includes('.L') || anchorId.includes('.R')
        ? limbMaterial
        : torsoMaterial;

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const loop = new THREE.LineLoop(geometry, material);
    loop.name = anchorId;
    group.add(loop);
  }

  group.userData.sharedMaterials = [torsoMaterial, limbMaterial];
  return group;
}

export function disposeV2DebugObject(object: THREE.Object3D): void {
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
