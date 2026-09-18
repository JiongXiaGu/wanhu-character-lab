import * as THREE from 'three';
import { getRingFrame } from './ringGeometry';
import {
  BODY_REGION_IDS,
  type BodySection,
  type HumanTopologyBlueprint,
  type JointPatch,
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

function connectRings(
  previous: readonly number[],
  current: readonly number[],
  buffers: BuildBuffers,
): void {
  if (previous.length !== current.length) {
    throw new Error('Connected rings must have the same segment count.');
  }

  const segments = previous.length;

  for (let segment = 0; segment < segments; segment += 1) {
    const nextSegment = (segment + 1) % segments;

    const a = previous[segment];
    const b = previous[nextSegment];
    const c = current[segment];
    const d = current[nextSegment];

    buffers.indices.push(a, b, c);
    buffers.indices.push(b, d, c);
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

function appendSequence(
  sequence: SurfaceSequence,
  buffers: BuildBuffers,
): void {
  if (sequence.rings.length < 2) {
    throw new Error(
      `Topology sequence "${sequence.id}" requires at least two rings.`,
    );
  }

  const regionId = BODY_REGION_IDS[sequence.region];
  const ringVertexIndices: number[][] = [];

  for (
    let ringIndex = 0;
    ringIndex < sequence.rings.length;
    ringIndex += 1
  ) {
    const ring = sequence.rings[ringIndex];
    const current = createRingVertices(
      sequence,
      ring,
      ringIndex,
      regionId,
      buffers,
    );

    ringVertexIndices.push(current);

    if (ringIndex > 0) {
      connectRings(
        ringVertexIndices[ringIndex - 1],
        current,
        buffers,
      );
    }

    buffers.totalRings += 1;
  }

  if (sequence.capStart) {
    capRing(
      ringVertexIndices[0],
      sequence.rings[0],
      regionId,
      true,
      buffers,
    );
  }

  if (sequence.capEnd) {
    capRing(
      ringVertexIndices[ringVertexIndices.length - 1],
      sequence.rings[sequence.rings.length - 1],
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
    appendSequence(section, buffers);
  }

  for (const patch of blueprint.jointPatches) {
    appendSequence(patch, buffers);
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
