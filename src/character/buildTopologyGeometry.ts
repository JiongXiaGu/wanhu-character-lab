import * as THREE from 'three';
import type {
  BodyRegion,
  BodySection,
  HumanTopologyBlueprint,
  SectionRing,
  TopologyStats,
} from './topology';

const REGION_IDS: Record<BodyRegion, number> = {
  torso: 0,
  head: 1,
  leftArm: 2,
  rightArm: 3,
  leftLeg: 4,
  rightLeg: 5,
  leftFoot: 6,
  rightFoot: 7,
};

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function toVector3(ring: SectionRing): THREE.Vector3 {
  return new THREE.Vector3(ring.center[0], ring.center[1], ring.center[2]);
}

function getRingFrame(
  section: BodySection,
  ringIndex: number,
): { center: THREE.Vector3; right: THREE.Vector3; forward: THREE.Vector3 } {
  const ring = section.rings[ringIndex];
  const center = toVector3(ring);
  const previous = toVector3(section.rings[Math.max(0, ringIndex - 1)]);
  const next = toVector3(
    section.rings[Math.min(section.rings.length - 1, ringIndex + 1)],
  );

  const tangent = new THREE.Vector3().subVectors(next, previous).normalize();
  const reference = Math.abs(tangent.dot(Y_AXIS)) > 0.92 ? X_AXIS : Y_AXIS;

  const right = new THREE.Vector3()
    .crossVectors(reference, tangent)
    .normalize();
  const forward = new THREE.Vector3()
    .crossVectors(tangent, right)
    .normalize();

  return { center, right, forward };
}

export function buildTopologyGeometry(
  blueprint: HumanTopologyBlueprint,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const bodyRegions: number[] = [];
  const indices: number[] = [];

  let vertexOffset = 0;
  let totalRings = 0;

  for (const section of blueprint.sections) {
    if (section.rings.length < 2) {
      throw new Error(`Body section "${section.id}" requires at least two rings.`);
    }

    const segments = section.radialSegments;
    const sectionStart = vertexOffset;
    const regionId = REGION_IDS[section.region];

    for (let ringIndex = 0; ringIndex < section.rings.length; ringIndex += 1) {
      const ring = section.rings[ringIndex];
      const { center, right, forward } = getRingFrame(section, ringIndex);

      for (let segment = 0; segment < segments; segment += 1) {
        const angle = (segment / segments) * Math.PI * 2;
        const point = center
          .clone()
          .addScaledVector(right, Math.cos(angle) * ring.radiusX)
          .addScaledVector(forward, Math.sin(angle) * ring.radiusY);

        positions.push(point.x, point.y, point.z);
        bodyRegions.push(regionId);
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

          indices.push(a, b, c);
          indices.push(b, d, c);
        }
      }

      vertexOffset += segments;
      totalRings += 1;
    }

    if (section.capStart) {
      const startRing = section.rings[0];
      const centerIndex = vertexOffset;
      positions.push(
        startRing.center[0],
        startRing.center[1],
        startRing.center[2],
      );
      bodyRegions.push(regionId);
      vertexOffset += 1;

      for (let segment = 0; segment < segments; segment += 1) {
        const nextSegment = (segment + 1) % segments;
        indices.push(
          centerIndex,
          sectionStart + nextSegment,
          sectionStart + segment,
        );
      }
    }

    if (section.capEnd) {
      const endRing = section.rings[section.rings.length - 1];
      const endRingStart =
        sectionStart + (section.rings.length - 1) * segments;
      const centerIndex = vertexOffset;

      positions.push(endRing.center[0], endRing.center[1], endRing.center[2]);
      bodyRegions.push(regionId);
      vertexOffset += 1;

      for (let segment = 0; segment < segments; segment += 1) {
        const nextSegment = (segment + 1) % segments;
        indices.push(
          centerIndex,
          endRingStart + segment,
          endRingStart + nextSegment,
        );
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    'bodyRegion',
    new THREE.Float32BufferAttribute(bodyRegions, 1),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const stats: TopologyStats = {
    sections: blueprint.sections.length,
    rings: totalRings,
    vertices: positions.length / 3,
    triangles: indices.length / 3,
  };

  geometry.userData.topology = {
    blueprintVersion: blueprint.version,
    ...stats,
  };

  return geometry;
}
