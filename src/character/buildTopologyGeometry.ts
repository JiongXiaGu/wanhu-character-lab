import * as THREE from 'three';
import { getRingFrame } from './ringGeometry';
import {
  BODY_REGION_IDS,
  type BodySection,
  type HumanTopologyBlueprint,
  type JointPatch,
  type SectionOpening,
  type SectionRing,
  type TopologyStats,
} from './topology';

type SurfaceSequence = BodySection | JointPatch;

interface SharedBoundary {
  segments: number;
  indices: number[];
}

interface BuildBuffers {
  positions: number[];
  bodyRegions: number[];
  indices: number[];
  vertexOffset: number;
  totalRings: number;
  sharedBoundaries: Map<string, SharedBoundary>;
}

function createRingVertices(
  sequence: SurfaceSequence,
  ring: SectionRing,
  ringIndex: number,
  regionId: number,
  buffers: BuildBuffers,
): number[] {
  const segments = sequence.radialSegments;

  if (ring.sharedBoundary) {
    const existing = buffers.sharedBoundaries.get(ring.sharedBoundary);
    if (existing) {
      if (existing.segments !== segments) {
        throw new Error(
          `Shared boundary "${ring.sharedBoundary}" segment mismatch: ` +
            `${existing.segments} vs ${segments}.`,
        );
      }
      return existing.indices;
    }
  }

  const { center, right, forward } = getRingFrame(sequence, ringIndex);
  const indices: number[] = [];

  for (let segment = 0; segment < segments; segment += 1) {
    const angle = (segment / segments) * Math.PI * 2;
    const point = center
      .clone()
      .addScaledVector(right, Math.cos(angle) * ring.radiusX)
      .addScaledVector(forward, Math.sin(angle) * ring.radiusY);

    const vertexIndex = buffers.vertexOffset;
    buffers.positions.push(point.x, point.y, point.z);
    buffers.bodyRegions.push(regionId);
    indices.push(vertexIndex);
    buffers.vertexOffset += 1;
  }

  if (ring.sharedBoundary) {
    buffers.sharedBoundaries.set(ring.sharedBoundary, {
      segments,
      indices,
    });
  }

  return indices;
}

function vertexPosition(
  index: number,
  buffers: BuildBuffers,
): THREE.Vector3 {
  const offset = index * 3;
  return new THREE.Vector3(
    buffers.positions[offset],
    buffers.positions[offset + 1],
    buffers.positions[offset + 2],
  );
}

function squaredDistance(
  aIndex: number,
  bIndex: number,
  buffers: BuildBuffers,
): number {
  return vertexPosition(aIndex, buffers).distanceToSquared(
    vertexPosition(bIndex, buffers),
  );
}

function bestCyclicMapping(
  previous: readonly number[],
  current: readonly number[],
  buffers: BuildBuffers,
): number[] {
  const count = previous.length;
  let bestScore = Number.POSITIVE_INFINITY;
  let best: number[] = [...current];

  for (const reverse of [false, true]) {
    for (let offset = 0; offset < count; offset += 1) {
      const candidate: number[] = [];
      let score = 0;

      for (let index = 0; index < count; index += 1) {
        const mappedIndex = reverse
          ? (offset - index + count * 2) % count
          : (index + offset) % count;
        const vertexIndex = current[mappedIndex];
        candidate.push(vertexIndex);
        score += squaredDistance(previous[index], vertexIndex, buffers);
      }

      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }

  return best;
}

function connectRings(
  previous: readonly number[],
  current: readonly number[],
  buffers: BuildBuffers,
  align = false,
): void {
  if (previous.length !== current.length) {
    throw new Error('Connected rings must have the same segment count.');
  }

  const mappedCurrent = align
    ? bestCyclicMapping(previous, current, buffers)
    : [...current];

  for (let segment = 0; segment < previous.length; segment += 1) {
    const nextSegment = (segment + 1) % previous.length;

    const a = previous[segment];
    const b = previous[nextSegment];
    const c = mappedCurrent[segment];
    const d = mappedCurrent[nextSegment];

    buffers.indices.push(a, b, c);
    buffers.indices.push(b, d, c);
  }
}

function openingApplies(
  opening: SectionOpening,
  lowerRingId: string,
  upperRingId: string,
): boolean {
  return (
    opening.lowerRing === lowerRingId &&
    opening.upperRing === upperRingId
  );
}

function skippedSegmentsForPair(
  section: BodySection,
  lowerRingId: string,
  upperRingId: string,
): Set<number> {
  const skipped = new Set<number>();

  for (const opening of section.openings ?? []) {
    if (!openingApplies(opening, lowerRingId, upperRingId)) {
      continue;
    }

    for (
      let offset = 0;
      offset < opening.segmentCount;
      offset += 1
    ) {
      skipped.add(
        (opening.segmentStart + offset) % section.radialSegments,
      );
    }
  }

  return skipped;
}

function connectSectionRings(
  section: BodySection,
  lowerRingIndex: number,
  previous: readonly number[],
  current: readonly number[],
  buffers: BuildBuffers,
): void {
  const lowerRing = section.rings[lowerRingIndex];
  const upperRing = section.rings[lowerRingIndex + 1];
  const skipped = skippedSegmentsForPair(
    section,
    lowerRing.id,
    upperRing.id,
  );

  for (let segment = 0; segment < previous.length; segment += 1) {
    if (skipped.has(segment)) {
      continue;
    }

    const nextSegment = (segment + 1) % previous.length;

    const a = previous[segment];
    const b = previous[nextSegment];
    const c = current[segment];
    const d = current[nextSegment];

    buffers.indices.push(a, b, c);
    buffers.indices.push(b, d, c);
  }
}

function openingBoundaryIndices(
  opening: SectionOpening,
  section: BodySection,
  ringIndices: readonly number[][],
): number[] {
  const lowerIndex = section.rings.findIndex(
    (ring) => ring.id === opening.lowerRing,
  );
  const upperIndex = section.rings.findIndex(
    (ring) => ring.id === opening.upperRing,
  );

  if (lowerIndex < 0 || upperIndex !== lowerIndex + 1) {
    throw new Error(
      `Opening "${opening.id}" must reference adjacent rings.`,
    );
  }

  const lower = ringIndices[lowerIndex];
  const upper = ringIndices[upperIndex];
  const boundary: number[] = [];

  for (
    let offset = 0;
    offset <= opening.segmentCount;
    offset += 1
  ) {
    const segment =
      (opening.segmentStart + offset) % section.radialSegments;
    boundary.push(lower[segment]);
  }

  for (
    let offset = opening.segmentCount;
    offset >= 0;
    offset -= 1
  ) {
    const segment =
      (opening.segmentStart + offset) % section.radialSegments;
    boundary.push(upper[segment]);
  }

  return boundary;
}

function registerSectionOpenings(
  section: BodySection,
  ringIndices: readonly number[][],
  buffers: BuildBuffers,
): void {
  for (const opening of section.openings ?? []) {
    const indices = openingBoundaryIndices(
      opening,
      section,
      ringIndices,
    );

    buffers.sharedBoundaries.set(opening.boundary, {
      segments: indices.length,
      indices,
    });
  }
}

function capRing(
  ringIndices: readonly number[],
  ring: SectionRing,
  regionId: number,
  reverse: boolean,
  buffers: BuildBuffers,
): void {
  const centerIndex = buffers.vertexOffset;
  buffers.positions.push(ring.center[0], ring.center[1], ring.center[2]);
  buffers.bodyRegions.push(regionId);
  buffers.vertexOffset += 1;

  for (let segment = 0; segment < ringIndices.length; segment += 1) {
    const nextSegment = (segment + 1) % ringIndices.length;
    const current = ringIndices[segment];
    const next = ringIndices[nextSegment];

    if (reverse) {
      buffers.indices.push(centerIndex, next, current);
    } else {
      buffers.indices.push(centerIndex, current, next);
    }
  }
}

function appendBodySection(
  section: BodySection,
  buffers: BuildBuffers,
): void {
  if (section.rings.length < 2) {
    throw new Error(
      `Body section "${section.id}" requires at least two rings.`,
    );
  }

  const regionId = BODY_REGION_IDS[section.region];
  const ringIndices: number[][] = [];

  for (
    let ringIndex = 0;
    ringIndex < section.rings.length;
    ringIndex += 1
  ) {
    const ring = section.rings[ringIndex];
    const current = createRingVertices(
      section,
      ring,
      ringIndex,
      regionId,
      buffers,
    );
    ringIndices.push(current);

    if (ringIndex > 0) {
      connectSectionRings(
        section,
        ringIndex - 1,
        ringIndices[ringIndex - 1],
        current,
        buffers,
      );
    }

    buffers.totalRings += 1;
  }

  registerSectionOpenings(section, ringIndices, buffers);

  if (section.capStart) {
    capRing(
      ringIndices[0],
      section.rings[0],
      regionId,
      true,
      buffers,
    );
  }

  if (section.capEnd) {
    capRing(
      ringIndices[ringIndices.length - 1],
      section.rings[section.rings.length - 1],
      regionId,
      false,
      buffers,
    );
  }
}

function appendJointPatch(
  patch: JointPatch,
  buffers: BuildBuffers,
): void {
  if (patch.rings.length < 1) {
    throw new Error(
      `Joint patch "${patch.id}" requires at least one generated ring.`,
    );
  }

  const regionId = BODY_REGION_IDS[patch.region];
  const ringIndices: number[][] = [];

  for (
    let ringIndex = 0;
    ringIndex < patch.rings.length;
    ringIndex += 1
  ) {
    const ring = patch.rings[ringIndex];
    const current = createRingVertices(
      patch,
      ring,
      ringIndex,
      regionId,
      buffers,
    );
    ringIndices.push(current);

    if (ringIndex > 0) {
      connectRings(
        ringIndices[ringIndex - 1],
        current,
        buffers,
      );
    }

    buffers.totalRings += 1;
  }

  if (patch.startBoundary) {
    const boundary = buffers.sharedBoundaries.get(
      patch.startBoundary,
    );

    if (!boundary) {
      throw new Error(
        `Joint patch "${patch.id}" cannot find boundary "${patch.startBoundary}".`,
      );
    }

    if (boundary.segments !== patch.radialSegments) {
      throw new Error(
        `Joint patch "${patch.id}" boundary segment mismatch: ` +
          `${boundary.segments} vs ${patch.radialSegments}.`,
      );
    }

    connectRings(
      boundary.indices,
      ringIndices[0],
      buffers,
      true,
    );
  } else if (patch.capStart) {
    capRing(
      ringIndices[0],
      patch.rings[0],
      regionId,
      true,
      buffers,
    );
  }

  if (patch.capEnd) {
    capRing(
      ringIndices[ringIndices.length - 1],
      patch.rings[patch.rings.length - 1],
      regionId,
      false,
      buffers,
    );
  }
}

export function buildTopologyGeometry(
  blueprint: HumanTopologyBlueprint,
): THREE.BufferGeometry {
  const buffers: BuildBuffers = {
    positions: [],
    bodyRegions: [],
    indices: [],
    vertexOffset: 0,
    totalRings: 0,
    sharedBoundaries: new Map(),
  };

  for (const section of blueprint.sections) {
    appendBodySection(section, buffers);
  }

  for (const patch of blueprint.jointPatches) {
    appendJointPatch(patch, buffers);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(buffers.positions, 3),
  );
  geometry.setAttribute(
    'bodyRegion',
    new THREE.Float32BufferAttribute(buffers.bodyRegions, 1),
  );
  geometry.setIndex(buffers.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const stats: TopologyStats = {
    sections: blueprint.sections.length,
    jointPatches: blueprint.jointPatches.length,
    rings: buffers.totalRings,
    vertices: buffers.positions.length / 3,
    triangles: buffers.indices.length / 3,
  };

  geometry.userData.topology = {
    blueprintVersion: blueprint.version,
    sharedBoundaries: buffers.sharedBoundaries.size,
    ...stats,
  };

  return geometry;
}
