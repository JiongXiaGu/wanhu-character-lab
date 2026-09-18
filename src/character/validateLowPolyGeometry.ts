import * as THREE from 'three';
import type {
  LowPolyHumanoidBlueprint,
  LowPolyPart,
  PrismProfile,
  PrismSection,
} from './lowPolyTopology';

export interface LowPolyValidationReport {
  valid: boolean;
  nonFiniteVertices: number;
  degenerateTriangles: number;
  inwardTriangles: number;
  mixedPartTriangles: number;
  overBudgetBy: number;
  structureMismatch: boolean;
  inwardByPart: Record<string, number>;
}

const AREA_EPSILON_SQ = 1e-14;
const WINDING_EPSILON = 1e-10;

// Validate winding against each local prism segment instead of a whole-part centroid.
// This stays valid for bent limbs, feet and asymmetric front/back silhouettes.
const PROFILE_VERTEX_COUNTS: Record<PrismProfile, number> = {
  box4: 4,
  hex6: 6,
  oct8: 8,
};

function sectionCenter(section: PrismSection): THREE.Vector3 {
  return new THREE.Vector3(
    section.center[0],
    section.center[1],
    section.center[2],
  );
}

export function validateLowPolyGeometry(
  geometry: THREE.BufferGeometry,
  blueprint: LowPolyHumanoidBlueprint,
): LowPolyValidationReport {
  const position = geometry.getAttribute('position');
  const bodyPart = geometry.getAttribute('bodyPart');
  const index = geometry.getIndex();

  if (!position || !bodyPart || !index) {
    return {
      valid: false,
      nonFiniteVertices: position ? 0 : 1,
      degenerateTriangles: 0,
      inwardTriangles: 0,
      mixedPartTriangles: 0,
      overBudgetBy: 0,
      structureMismatch: true,
      inwardByPart: {},
    };
  }

  let nonFiniteVertices = 0;

  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    const x = position.getX(vertexIndex);
    const y = position.getY(vertexIndex);
    const z = position.getZ(vertexIndex);

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      nonFiniteVertices += 1;
    }
  }

  let degenerateTriangles = 0;
  let inwardTriangles = 0;
  let mixedPartTriangles = 0;
  const inwardByPart: Record<string, number> = {};
  let triangleCursor = 0;
  let expectedVertexCount = 0;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  const faceCenter = new THREE.Vector3();
  const expectedOutward = new THREE.Vector3();

  const validateTriangle = (
    part: LowPolyPart,
    expectedDirection: THREE.Vector3,
  ) => {
    const offset = triangleCursor * 3;

    if (offset + 2 >= index.count) {
      triangleCursor += 1;
      return;
    }

    const ia = index.getX(offset);
    const ib = index.getX(offset + 1);
    const ic = index.getX(offset + 2);

    const expectedPartId = part.boneId;
    const partA = Math.round(bodyPart.getX(ia));
    const partB = Math.round(bodyPart.getX(ib));
    const partC = Math.round(bodyPart.getX(ic));

    if (
      partA !== expectedPartId ||
      partB !== expectedPartId ||
      partC !== expectedPartId
    ) {
      mixedPartTriangles += 1;
    }

    a.fromBufferAttribute(position as THREE.BufferAttribute, ia);
    b.fromBufferAttribute(position as THREE.BufferAttribute, ib);
    c.fromBufferAttribute(position as THREE.BufferAttribute, ic);

    ab.subVectors(b, a);
    ac.subVectors(c, a);
    faceNormal.crossVectors(ab, ac);

    if (faceNormal.lengthSq() <= AREA_EPSILON_SQ) {
      degenerateTriangles += 1;
      triangleCursor += 1;
      return;
    }

    if (
      expectedDirection.lengthSq() > WINDING_EPSILON &&
      faceNormal.dot(expectedDirection) < -WINDING_EPSILON
    ) {
      inwardTriangles += 1;
      inwardByPart[part.id] = (inwardByPart[part.id] ?? 0) + 1;
    }

    triangleCursor += 1;
  };

  for (const part of blueprint.parts) {
    const ringSize = PROFILE_VERTEX_COUNTS[part.profile];
    expectedVertexCount += ringSize * part.sections.length;

    for (
      let sectionIndex = 1;
      sectionIndex < part.sections.length;
      sectionIndex += 1
    ) {
      const previousCenter = sectionCenter(
        part.sections[sectionIndex - 1],
      );
      const currentCenter = sectionCenter(
        part.sections[sectionIndex],
      );
      const localCenter = previousCenter
        .clone()
        .add(currentCenter)
        .multiplyScalar(0.5);

      for (let edge = 0; edge < ringSize; edge += 1) {
        for (let half = 0; half < 2; half += 1) {
          const offset = triangleCursor * 3;

          if (offset + 2 >= index.count) {
            triangleCursor += 1;
            continue;
          }

          const ia = index.getX(offset);
          const ib = index.getX(offset + 1);
          const ic = index.getX(offset + 2);

          a.fromBufferAttribute(position as THREE.BufferAttribute, ia);
          b.fromBufferAttribute(position as THREE.BufferAttribute, ib);
          c.fromBufferAttribute(position as THREE.BufferAttribute, ic);

          faceCenter
            .copy(a)
            .add(b)
            .add(c)
            .multiplyScalar(1 / 3);

          expectedOutward.subVectors(faceCenter, localCenter);
          validateTriangle(part, expectedOutward);
        }
      }
    }

    if (part.capStart) {
      const start = sectionCenter(part.sections[0]);
      const next = sectionCenter(part.sections[1]);
      expectedOutward.subVectors(start, next).normalize();

      for (let triangle = 0; triangle < ringSize - 2; triangle += 1) {
        validateTriangle(part, expectedOutward);
      }
    }

    if (part.capEnd) {
      const lastIndex = part.sections.length - 1;
      const end = sectionCenter(part.sections[lastIndex]);
      const previous = sectionCenter(part.sections[lastIndex - 1]);
      expectedOutward.subVectors(end, previous).normalize();

      for (let triangle = 0; triangle < ringSize - 2; triangle += 1) {
        validateTriangle(part, expectedOutward);
      }
    }
  }

  const triangleCount = index.count / 3;
  const overBudgetBy = Math.max(
    0,
    triangleCount - blueprint.triangleBudget,
  );

  const structureMismatch =
    expectedVertexCount !== position.count ||
    triangleCursor * 3 !== index.count;

  return {
    valid:
      nonFiniteVertices === 0 &&
      degenerateTriangles === 0 &&
      inwardTriangles === 0 &&
      mixedPartTriangles === 0 &&
      overBudgetBy === 0 &&
      !structureMismatch,
    nonFiniteVertices,
    degenerateTriangles,
    inwardTriangles,
    mixedPartTriangles,
    overBudgetBy,
    structureMismatch,
    inwardByPart,
  };
}
