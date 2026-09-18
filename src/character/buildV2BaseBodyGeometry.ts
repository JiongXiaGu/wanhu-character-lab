import * as THREE from 'three';
import { V2_BASE_BODY_TEMPLATE } from './createV2BaseBodyTemplate';
import {
  BODY_FACE_GROUP_IDS,
  type BodyFaceGroup,
  type V2BaseBodyTemplate,
  type V2BodyGeometryMetadata,
  type V2BodyStats,
} from './v2Topology';
import { validateV2BaseBodyGeometry } from './validateV2BaseBodyGeometry';

interface BoundaryEdge {
  count: number;
  a: string;
  b: string;
  group: BodyFaceGroup;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function backGroup(group: BodyFaceGroup): BodyFaceGroup {
  if (
    group === 'Chest' ||
    group === 'Abdomen'
  ) {
    return 'Back';
  }

  return group;
}

export function buildV2BaseBodyGeometry(
  template: V2BaseBodyTemplate = V2_BASE_BODY_TEMPLATE,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const semanticIds: number[] = [];
  const surfaceSides: number[] = [];
  const indices: number[] = [];
  const triangleFaceGroups: number[] = [];

  const semanticVertexIndices: Record<
    string,
    { front: number; back: number }
  > = {};

  const planarIndexById = new Map<string, number>();

  template.planarVertices.forEach((vertex, planarIndex) => {
    planarIndexById.set(vertex.id, planarIndex);

    const front = positions.length / 3;
    positions.push(vertex.x, vertex.y, vertex.frontDepth);
    semanticIds.push(planarIndex);
    surfaceSides.push(0);

    const back = positions.length / 3;
    positions.push(vertex.x, vertex.y, -vertex.backDepth);
    semanticIds.push(planarIndex);
    surfaceSides.push(1);

    semanticVertexIndices[vertex.id] = { front, back };
  });

  const boundaryEdges = new Map<string, BoundaryEdge>();

  const appendTriangle = (
    a: number,
    b: number,
    c: number,
    group: BodyFaceGroup,
  ) => {
    indices.push(a, b, c);
    triangleFaceGroups.push(BODY_FACE_GROUP_IDS[group]);
  };

  for (const triangle of template.planarTriangles) {
    const ia = planarIndexById.get(triangle.a);
    const ib = planarIndexById.get(triangle.b);
    const ic = planarIndexById.get(triangle.c);

    if (ia === undefined || ib === undefined || ic === undefined) {
      throw new Error(
        `V2 triangle references an unknown semantic vertex: ${triangle.a}, ${triangle.b}, ${triangle.c}`,
      );
    }

    const fa = ia * 2;
    const fb = ib * 2;
    const fc = ic * 2;
    const ba = fa + 1;
    const bb = fb + 1;
    const bc = fc + 1;

    // Front faces point toward +Z; back faces reverse winding.
    appendTriangle(fa, fb, fc, triangle.group);
    appendTriangle(ba, bc, bb, backGroup(triangle.group));

    const triangleEdges = [
      [triangle.a, triangle.b],
      [triangle.b, triangle.c],
      [triangle.c, triangle.a],
    ] as const;

    for (const [a, b] of triangleEdges) {
      const key = edgeKey(a, b);
      const existing = boundaryEdges.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        boundaryEdges.set(key, {
          count: 1,
          a,
          b,
          group: triangle.group,
        });
      }
    }
  }

  for (const edge of boundaryEdges.values()) {
    if (edge.count !== 1) {
      continue;
    }

    const a = semanticVertexIndices[edge.a];
    const b = semanticVertexIndices[edge.b];

    if (!a || !b) {
      throw new Error(
        `V2 boundary references an unknown semantic vertex: ${edge.a}, ${edge.b}`,
      );
    }

    // Planar triangles are CCW, so their interior is on the left side
    // of a boundary edge. These two triangles face outward to the right.
    appendTriangle(a.front, a.back, b.front, edge.group);
    appendTriangle(b.front, a.back, b.back, edge.group);
  }

  if (positions.length / 3 > 0xffff) {
    throw new Error(
      `V2 Base Body exceeded UInt16 vertex range: ${positions.length / 3}`,
    );
  }

  const anchorVertexIndices: Record<string, readonly number[]> = {};

  for (const anchor of template.anchorLoops) {
    const front: number[] = [];
    const back: number[] = [];

    for (const semanticId of anchor.planarVertexIds) {
      const pair = semanticVertexIndices[semanticId];

      if (!pair) {
        throw new Error(
          `Anchor "${anchor.id}" references missing semantic vertex "${semanticId}".`,
        );
      }

      front.push(pair.front);
      back.push(pair.back);
    }

    anchorVertexIndices[anchor.id] = [
      ...front,
      ...back.reverse(),
    ];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    'semanticId',
    new THREE.Uint16BufferAttribute(semanticIds, 1),
  );
  geometry.setAttribute(
    'surfaceSide',
    new THREE.Uint8BufferAttribute(surfaceSides, 1),
  );
  geometry.setIndex(
    new THREE.Uint16BufferAttribute(indices, 1),
  );

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const validation = validateV2BaseBodyGeometry(
    geometry,
    template,
    triangleFaceGroups,
    anchorVertexIndices,
  );

  const stats: V2BodyStats = {
    surfaceComponents: validation.surfaceComponents,
    vertices: positions.length / 3,
    triangles: indices.length / 3,
    faceGroups: new Set(triangleFaceGroups).size,
    anchors: template.anchorLoops.length,
    triangleBudget: template.triangleBudget,
    meshValid: validation.valid,
  };

  const metadata: V2BodyGeometryMetadata & {
    validation: typeof validation;
  } = {
    templateVersion: template.version,
    triangleFaceGroups,
    anchorVertexIndices,
    semanticVertexIndices,
    validation,
    ...stats,
  };

  geometry.userData.v2Body = metadata;

  return geometry;
}
