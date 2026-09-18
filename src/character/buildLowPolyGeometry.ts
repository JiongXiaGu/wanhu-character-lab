import * as THREE from 'three';
import {
  BODY_PART_IDS,
  type LowPolyHumanoidBlueprint,
  type LowPolyPart,
  type LowPolyStats,
  type PrismProfile,
  type PrismSection,
} from './lowPolyTopology';
import { validateLowPolyGeometry } from './validateLowPolyGeometry';

const WORLD_DEPTH = new THREE.Vector3(0, 0, 1);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const PROFILE_POINTS: Record<PrismProfile, readonly [number, number][]> = {
  box4: [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ],
  hex6: [
    [-0.55, -1],
    [0.55, -1],
    [1, 0],
    [0.55, 1],
    [-0.55, 1],
    [-1, 0],
  ],
  oct8: [
    [-0.55, -1],
    [0.55, -1],
    [1, -0.45],
    [1, 0.45],
    [0.55, 1],
    [-0.55, 1],
    [-1, 0.45],
    [-1, -0.45],
  ],
};

interface BuildBuffers {
  positions: number[];
  partIds: number[];
  boneIds: number[];
  indices: number[];
  vertexOffset: number;
  crossSections: number;
}

function sectionCenter(section: PrismSection): THREE.Vector3 {
  return new THREE.Vector3(
    section.center[0],
    section.center[1],
    section.center[2],
  );
}

function sectionFrame(
  part: LowPolyPart,
  sectionIndex: number,
): {
  center: THREE.Vector3;
  right: THREE.Vector3;
  forward: THREE.Vector3;
} {
  const center = sectionCenter(part.sections[sectionIndex]);
  const previous = sectionCenter(
    part.sections[Math.max(0, sectionIndex - 1)],
  );
  const next = sectionCenter(
    part.sections[Math.min(part.sections.length - 1, sectionIndex + 1)],
  );

  const tangent = new THREE.Vector3().subVectors(next, previous).normalize();

  const forward = WORLD_DEPTH.clone()
    .addScaledVector(tangent, -WORLD_DEPTH.dot(tangent));

  if (forward.lengthSq() < 1e-6) {
    forward
      .copy(WORLD_UP)
      .addScaledVector(tangent, -WORLD_UP.dot(tangent));
  }

  forward.normalize();

  const right = new THREE.Vector3()
    .crossVectors(tangent, forward)
    .normalize();

  return { center, right, forward };
}

function appendSection(
  part: LowPolyPart,
  sectionIndex: number,
  buffers: BuildBuffers,
): number[] {
  const section = part.sections[sectionIndex];
  const { center, right, forward } = sectionFrame(part, sectionIndex);
  const profile = PROFILE_POINTS[part.profile];
  const vertexIndices: number[] = [];
  const partId = BODY_PART_IDS[part.id];

  for (const [x, z] of profile) {
    const point = center
      .clone()
      .addScaledVector(right, x * section.halfWidth)
      .addScaledVector(forward, z * section.halfDepth);

    vertexIndices.push(buffers.vertexOffset);
    buffers.positions.push(point.x, point.y, point.z);
    buffers.partIds.push(partId);
    buffers.boneIds.push(part.boneId);
    buffers.vertexOffset += 1;
  }

  buffers.crossSections += 1;
  return vertexIndices;
}

function connectSections(
  previous: readonly number[],
  current: readonly number[],
  buffers: BuildBuffers,
): void {
  if (previous.length !== current.length) {
    throw new Error('Low-poly part sections must use the same profile.');
  }

  for (let index = 0; index < previous.length; index += 1) {
    const next = (index + 1) % previous.length;

    const a = previous[index];
    const b = previous[next];
    const c = current[index];
    const d = current[next];

    // THREE.FrontSide expects the exterior side to be counter-clockwise.
    // The profile loop is ordered so its direct normal points toward -tangent.
    // For the side wall, tangent x profile-edge gives the outward normal.
    buffers.indices.push(a, c, b);
    buffers.indices.push(b, c, d);
  }
}

function capBoundary(
  boundary: readonly number[],
  reverse: boolean,
  buffers: BuildBuffers,
): void {
  if (boundary.length < 3) return;

  // Triangulate the convex profile as a fan from an existing boundary vertex.
  // This uses N-2 triangles and no extra center vertex.
  for (let index = 1; index < boundary.length - 1; index += 1) {
    if (reverse) {
      buffers.indices.push(
        boundary[0],
        boundary[index + 1],
        boundary[index],
      );
    } else {
      buffers.indices.push(
        boundary[0],
        boundary[index],
        boundary[index + 1],
      );
    }
  }
}

function appendPart(
  part: LowPolyPart,
  buffers: BuildBuffers,
): void {
  if (part.sections.length < 2) {
    throw new Error(`Low-poly part "${part.id}" requires at least two sections.`);
  }

  const sectionIndices: number[][] = [];

  for (
    let sectionIndex = 0;
    sectionIndex < part.sections.length;
    sectionIndex += 1
  ) {
    const current = appendSection(part, sectionIndex, buffers);
    sectionIndices.push(current);

    if (sectionIndex > 0) {
      connectSections(
        sectionIndices[sectionIndex - 1],
        current,
        buffers,
      );
    }
  }

  // Direct profile order points toward -part tangent, so it is correct for
  // the start cap. The end cap must use the opposite winding.
  if (part.capStart) {
    capBoundary(sectionIndices[0], false, buffers);
  }

  if (part.capEnd) {
    const last = sectionIndices.length - 1;
    capBoundary(sectionIndices[last], true, buffers);
  }
}

export function buildLowPolyGeometry(
  blueprint: LowPolyHumanoidBlueprint,
): THREE.BufferGeometry {
  const buffers: BuildBuffers = {
    positions: [],
    partIds: [],
    boneIds: [],
    indices: [],
    vertexOffset: 0,
    crossSections: 0,
  };

  for (const part of blueprint.parts) {
    appendPart(part, buffers);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(buffers.positions, 3),
  );
  if (buffers.vertexOffset > 0xffff) {
    throw new Error(
      `Low-poly geometry exceeded UInt16 index range: ${buffers.vertexOffset} vertices.`,
    );
  }

  geometry.setAttribute(
    'bodyPart',
    new THREE.Uint8BufferAttribute(buffers.partIds, 1),
  );
  geometry.setAttribute(
    'boneIndex',
    new THREE.Uint8BufferAttribute(buffers.boneIds, 1),
  );
  geometry.setIndex(
    new THREE.Uint16BufferAttribute(buffers.indices, 1),
  );

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const validation = validateLowPolyGeometry(geometry, blueprint);

  const stats: LowPolyStats = {
    parts: blueprint.parts.length,
    crossSections: buffers.crossSections,
    vertices: buffers.positions.length / 3,
    triangles: buffers.indices.length / 3,
    triangleBudget: blueprint.triangleBudget,
    meshValid: validation.valid,
  };

  geometry.userData.lowPoly = {
    blueprintVersion: blueprint.version,
    validation,
    ...stats,
  };

  return geometry;
}
