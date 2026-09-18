import * as THREE from 'three';
import type { LowPolyHumanoidBlueprint } from './lowPolyTopology';

export interface LowPolyValidationReport {
  valid: boolean;
  nonFiniteVertices: number;
  degenerateTriangles: number;
  inwardTriangles: number;
  mixedPartTriangles: number;
  overBudgetBy: number;
}

const AREA_EPSILON_SQ = 1e-14;
const WINDING_EPSILON = 1e-10;

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
    };
  }

  let nonFiniteVertices = 0;

  const partSums = new Map<number, THREE.Vector3>();
  const partCounts = new Map<number, number>();

  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    const x = position.getX(vertexIndex);
    const y = position.getY(vertexIndex);
    const z = position.getZ(vertexIndex);

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      nonFiniteVertices += 1;
      continue;
    }

    const partId = Math.round(bodyPart.getX(vertexIndex));
    const sum = partSums.get(partId) ?? new THREE.Vector3();
    sum.add(new THREE.Vector3(x, y, z));
    partSums.set(partId, sum);
    partCounts.set(partId, (partCounts.get(partId) ?? 0) + 1);
  }

  const partCenters = new Map<number, THREE.Vector3>();

  for (const [partId, sum] of partSums) {
    const count = partCounts.get(partId) ?? 1;
    partCenters.set(partId, sum.clone().multiplyScalar(1 / count));
  }

  let degenerateTriangles = 0;
  let inwardTriangles = 0;
  let mixedPartTriangles = 0;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  const faceCenter = new THREE.Vector3();
  const outward = new THREE.Vector3();

  for (let offset = 0; offset < index.count; offset += 3) {
    const ia = index.getX(offset);
    const ib = index.getX(offset + 1);
    const ic = index.getX(offset + 2);

    const partA = Math.round(bodyPart.getX(ia));
    const partB = Math.round(bodyPart.getX(ib));
    const partC = Math.round(bodyPart.getX(ic));

    if (partA !== partB || partA !== partC) {
      mixedPartTriangles += 1;
      continue;
    }

    a.fromBufferAttribute(position as THREE.BufferAttribute, ia);
    b.fromBufferAttribute(position as THREE.BufferAttribute, ib);
    c.fromBufferAttribute(position as THREE.BufferAttribute, ic);

    ab.subVectors(b, a);
    ac.subVectors(c, a);
    faceNormal.crossVectors(ab, ac);

    if (faceNormal.lengthSq() <= AREA_EPSILON_SQ) {
      degenerateTriangles += 1;
      continue;
    }

    const partCenter = partCenters.get(partA);
    if (!partCenter) continue;

    faceCenter
      .copy(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);

    outward.subVectors(faceCenter, partCenter);

    if (faceNormal.dot(outward) < -WINDING_EPSILON) {
      inwardTriangles += 1;
    }
  }

  const triangleCount = index.count / 3;
  const overBudgetBy = Math.max(
    0,
    triangleCount - blueprint.triangleBudget,
  );

  return {
    valid:
      nonFiniteVertices === 0 &&
      degenerateTriangles === 0 &&
      inwardTriangles === 0 &&
      mixedPartTriangles === 0 &&
      overBudgetBy === 0,
    nonFiniteVertices,
    degenerateTriangles,
    inwardTriangles,
    mixedPartTriangles,
    overBudgetBy,
  };
}
