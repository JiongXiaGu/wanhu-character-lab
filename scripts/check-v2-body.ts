import { buildV2BaseBodyGeometry } from '../src/character/buildV2BaseBodyGeometry';
import type { V2BodyGeometryMetadata } from '../src/character/v2Topology';
import type { V2BodyValidationReport } from '../src/character/validateV2BaseBodyGeometry';

const geometry = buildV2BaseBodyGeometry();

const metadata = geometry.userData.v2Body as
  | (V2BodyGeometryMetadata & {
      validation: V2BodyValidationReport;
    })
  | undefined;

if (!metadata) {
  throw new Error('V2 Base Body metadata is missing.');
}

const report = metadata.validation;

console.log(
  [
    'surface=' + metadata.surfaceComponents,
    'verts=' + metadata.vertices,
    'tris=' + metadata.triangles,
    'groups=' + metadata.faceGroups,
    'anchors=' + metadata.anchors,
    'budget=' + metadata.triangles + '/' + metadata.triangleBudget,
  ].join(' | '),
);

console.log(
  [
    'finite=' + (report.nonFiniteVertices === 0 ? 'OK' : report.nonFiniteVertices),
    'degenerate=' + report.degenerateTriangles,
    'nonManifold=' + report.nonManifoldEdges,
    'windingEdges=' + report.windingEdgeErrors,
    'mirror=' + report.mirrorErrors,
    'invalidGroups=' + report.invalidFaceGroups,
    'invalidAnchors=' + report.invalidAnchors,
    'overBudget=' + report.overBudgetBy,
    'volume=' + report.signedVolume.toFixed(6),
  ].join(' | '),
);

if (!report.valid) {
  geometry.dispose();
  throw new Error('V2 Base Body validation failed.');
}

if (
  metadata.surfaceComponents !== 1 ||
  metadata.vertices > 260 ||
  metadata.triangles > 550
) {
  geometry.dispose();
  throw new Error('V2 Base Body exceeded the locked topology envelope.');
}

geometry.dispose();

console.log('V2 Base Body validation passed.');
