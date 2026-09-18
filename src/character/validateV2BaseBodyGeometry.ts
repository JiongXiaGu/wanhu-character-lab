import * as THREE from 'three';
import type { V2BaseBodyTemplate } from './v2Topology';

export interface V2BodyValidationReport {
  valid: boolean;
  nonFiniteVertices: number;
  degenerateTriangles: number;
  nonManifoldEdges: number;
  windingEdgeErrors: number;
  surfaceComponents: number;
  mirrorErrors: number;
  invalidFaceGroups: number;
  invalidAnchors: number;
  overBudgetBy: number;
  signedVolume: number;
}

const AREA_EPSILON_SQ = 1e-14;
const MIRROR_EPSILON = 1e-6;

function undirectedEdgeKey(a: number, b: number): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function directedEdgeKey(a: number, b: number): string {
  return `${a}>${b}`;
}

export function validateV2BaseBodyGeometry(
  geometry: THREE.BufferGeometry,
  template: V2BaseBodyTemplate,
  triangleFaceGroups: readonly number[],
  anchorVertexIndices: Readonly<Record<string, readonly number[]>>,
): V2BodyValidationReport {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();

  if (!position || !index) {
    return {
      valid: false,
      nonFiniteVertices: 1,
      degenerateTriangles: 0,
      nonManifoldEdges: 1,
      windingEdgeErrors: 0,
      surfaceComponents: 0,
      mirrorErrors: 0,
      invalidFaceGroups: 0,
      invalidAnchors: 0,
      overBudgetBy: 0,
      signedVolume: 0,
    };
  }

  let nonFiniteVertices = 0;

  for (let vertex = 0; vertex < position.count; vertex += 1) {
    if (
      !Number.isFinite(position.getX(vertex)) ||
      !Number.isFinite(position.getY(vertex)) ||
      !Number.isFinite(position.getZ(vertex))
    ) {
      nonFiniteVertices += 1;
    }
  }

  const undirectedEdges = new Map<string, number>();
  const directedEdges = new Map<string, number>();
  const adjacency = new Map<number, Set<number>>();

  let degenerateTriangles = 0;
  let signedVolume = 0;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();

  for (let offset = 0; offset < index.count; offset += 3) {
    const ia = index.getX(offset);
    const ib = index.getX(offset + 1);
    const ic = index.getX(offset + 2);

    a.fromBufferAttribute(position as THREE.BufferAttribute, ia);
    b.fromBufferAttribute(position as THREE.BufferAttribute, ib);
    c.fromBufferAttribute(position as THREE.BufferAttribute, ic);

    ab.subVectors(b, a);
    ac.subVectors(c, a);
    cross.crossVectors(ab, ac);

    if (cross.lengthSq() <= AREA_EPSILON_SQ) {
      degenerateTriangles += 1;
    }

    signedVolume += a.dot(
      new THREE.Vector3().crossVectors(b, c),
    ) / 6;

    const edges = [
      [ia, ib],
      [ib, ic],
      [ic, ia],
    ] as const;

    for (const [from, to] of edges) {
      const undirected = undirectedEdgeKey(from, to);
      const directed = directedEdgeKey(from, to);

      undirectedEdges.set(
        undirected,
        (undirectedEdges.get(undirected) ?? 0) + 1,
      );
      directedEdges.set(
        directed,
        (directedEdges.get(directed) ?? 0) + 1,
      );

      const fromNeighbors = adjacency.get(from) ?? new Set<number>();
      fromNeighbors.add(to);
      adjacency.set(from, fromNeighbors);

      const toNeighbors = adjacency.get(to) ?? new Set<number>();
      toNeighbors.add(from);
      adjacency.set(to, toNeighbors);
    }
  }

  let nonManifoldEdges = 0;
  let windingEdgeErrors = 0;

  for (const [key, count] of undirectedEdges) {
    if (count !== 2) {
      nonManifoldEdges += 1;
      continue;
    }

    const [aText, bText] = key.split('|');
    const edgeA = Number(aText);
    const edgeB = Number(bText);

    const forward = directedEdges.get(
      directedEdgeKey(edgeA, edgeB),
    ) ?? 0;
    const backward = directedEdges.get(
      directedEdgeKey(edgeB, edgeA),
    ) ?? 0;

    if (forward !== 1 || backward !== 1) {
      windingEdgeErrors += 1;
    }
  }

  let surfaceComponents = 0;
  const visited = new Set<number>();

  for (let start = 0; start < position.count; start += 1) {
    if (visited.has(start)) {
      continue;
    }

    surfaceComponents += 1;
    const stack = [start];
    visited.add(start);

    while (stack.length > 0) {
      const current = stack.pop()!;
      const neighbors = adjacency.get(current);

      if (!neighbors) {
        continue;
      }

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
  }

  const semanticIndex = new Map<string, number>();

  template.planarVertices.forEach((vertex, indexValue) => {
    semanticIndex.set(vertex.id, indexValue);
  });

  let mirrorErrors = 0;

  for (const pair of template.mirrorPairs) {
    const leftIndex = semanticIndex.get(pair.left);
    const rightIndex = semanticIndex.get(pair.right);

    if (leftIndex === undefined || rightIndex === undefined) {
      mirrorErrors += 1;
      continue;
    }

    const left = template.planarVertices[leftIndex];
    const right = template.planarVertices[rightIndex];

    if (
      Math.abs(left.x + right.x) > MIRROR_EPSILON ||
      Math.abs(left.y - right.y) > MIRROR_EPSILON ||
      Math.abs(left.frontDepth - right.frontDepth) > MIRROR_EPSILON ||
      Math.abs(left.backDepth - right.backDepth) > MIRROR_EPSILON
    ) {
      mirrorErrors += 1;
    }
  }

  const maxFaceGroupId = 12;
  const invalidFaceGroups = triangleFaceGroups.filter(
    (group) =>
      !Number.isInteger(group) ||
      group < 0 ||
      group > maxFaceGroupId,
  ).length;

  let invalidAnchors = 0;

  for (const anchor of template.anchorLoops) {
    const indices = anchorVertexIndices[anchor.id];

    if (
      !indices ||
      indices.length < 4 ||
      indices.some(
        (vertexIndex) =>
          vertexIndex < 0 ||
          vertexIndex >= position.count,
      )
    ) {
      invalidAnchors += 1;
    }
  }

  const triangleCount = index.count / 3;
  const overBudgetBy = Math.max(
    0,
    triangleCount - template.triangleBudget,
  );

  const valid =
    nonFiniteVertices === 0 &&
    degenerateTriangles === 0 &&
    nonManifoldEdges === 0 &&
    windingEdgeErrors === 0 &&
    surfaceComponents === 1 &&
    mirrorErrors === 0 &&
    invalidFaceGroups === 0 &&
    invalidAnchors === 0 &&
    overBudgetBy === 0 &&
    signedVolume > 0;

  return {
    valid,
    nonFiniteVertices,
    degenerateTriangles,
    nonManifoldEdges,
    windingEdgeErrors,
    surfaceComponents,
    mirrorErrors,
    invalidFaceGroups,
    invalidAnchors,
    overBudgetBy,
    signedVolume,
  };
}
