import * as THREE from 'three';
import { getRingFrame } from './ringGeometry';
import {
  BODY_REGION_IDS,
  type BodySection,
  type HumanTopologyBlueprint,
  type JointPatch,
  type TopologyStats,
} from './topology';

type SurfaceSequence = BodySection | JointPatch;

interface BuildBuffers {
  positions: number[];
  bodyRegions: number[];
  indices: number[];
  vertexOffset: number;
  totalRings: number;
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

  const segments = sequence.radialSegments;
  const sectionStart = buffers.vertexOffset;
  const regionId = BODY_REGION_IDS[sequence.region];

  for (
    let ringIndex = 0;
    ringIndex < sequence.rings.length;
    ringIndex += 1
  ) {
    const ring = sequence.rings[ringIndex];
    const { center, right, forward } = getRingFrame(sequence, ringIndex);

    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const point = center
        .clone()
        .addScaledVector(right, Math.cos(angle) * ring.radiusX)
        .addScaledVector(forward, Math.sin(angle) * ring.radiusY);

      buffers.positions.push(point.x, point.y, point.z);
      buffers.bodyRegions.push(regionId);
    }

    if (ringIndex > 0) {
      const previousRingStart =
        sectionStart + (ringIndex - 1) * segments;
      const currentRingStart = sectionStart + ringIndex * segments;

      for (let segment = 0; segment < segments; segment += 1) {
        const nextSegment = (segment + 1) % segments;

        const a = previousRingStart + segment;
        const b = previousRingStart + nextSegment;
        const c = currentRingStart + segment;
        const d = currentRingStart + nextSegment;

        buffers.indices.push(a, b, c);
        buffers.indices.push(b, d, c);
      }
    }

    buffers.vertexOffset += segments;
    buffers.totalRings += 1;
  }

  if (sequence.capStart) {
    const startRing = sequence.rings[0];
    const centerIndex = buffers.vertexOffset;

    buffers.positions.push(
      startRing.center[0],
      startRing.center[1],
      startRing.center[2],
    );
    buffers.bodyRegions.push(regionId);
    buffers.vertexOffset += 1;

    for (let segment = 0; segment < segments; segment += 1) {
      const nextSegment = (segment + 1) % segments;
      buffers.indices.push(
        centerIndex,
        sectionStart + nextSegment,
        sectionStart + segment,
      );
    }
  }

  if (sequence.capEnd) {
    const endRing = sequence.rings[sequence.rings.length - 1];
    const endRingStart =
      sectionStart + (sequence.rings.length - 1) * segments;
    const centerIndex = buffers.vertexOffset;

    buffers.positions.push(
      endRing.center[0],
      endRing.center[1],
      endRing.center[2],
    );
    buffers.bodyRegions.push(regionId);
    buffers.vertexOffset += 1;

    for (let segment = 0; segment < segments; segment += 1) {
      const nextSegment = (segment + 1) % segments;
      buffers.indices.push(
        centerIndex,
        endRingStart + segment,
        endRingStart + nextSegment,
      );
    }
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
    ...stats,
  };

  return geometry;
}
