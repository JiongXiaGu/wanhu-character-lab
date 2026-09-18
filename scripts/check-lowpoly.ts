import { buildLowPolyGeometry } from '../src/character/buildLowPolyGeometry';
import { createLowPolyHumanoidBlueprint } from '../src/character/createLowPolyHumanoidBlueprint';
import type { BodyParameters } from '../src/character/types';
import type { LowPolyValidationReport } from '../src/character/validateLowPolyGeometry';

const CASES: Record<string, BodyParameters> = {
  default: {
    height: 1.72,
    build: 0.45,
    shoulderWidth: 0.43,
    headScale: 1,
  },
  tallThin: {
    height: 1.95,
    build: 0,
    shoulderWidth: 0.36,
    headScale: 0.92,
  },
  shortHeavy: {
    height: 1.5,
    build: 1,
    shoulderWidth: 0.54,
    headScale: 1.08,
  },
  broadAverage: {
    height: 1.78,
    build: 0.62,
    shoulderWidth: 0.51,
    headScale: 1,
  },
};

let failed = false;

for (const [name, parameters] of Object.entries(CASES)) {
  const blueprint = createLowPolyHumanoidBlueprint(parameters);
  const geometry = buildLowPolyGeometry(blueprint);
  const lowPoly = geometry.userData.lowPoly as {
    triangles: number;
    vertices: number;
    validation: LowPolyValidationReport;
  };

  const report = lowPoly.validation;

  console.log(
    [
      name.padEnd(14),
      `${lowPoly.triangles} tris`.padEnd(11),
      `${lowPoly.vertices} verts`.padEnd(12),
      `inward=${report.inwardTriangles}`,
      `degenerate=${report.degenerateTriangles}`,
      `mixed=${report.mixedPartTriangles}`,
      `overBudget=${report.overBudgetBy}`,
      `structure=${report.structureMismatch ? 'BAD' : 'OK'}`,
    ].join(' | '),
  );

  if (!report.valid) {
    failed = true;
  }

  geometry.dispose();
}

if (failed) {
  throw new Error('Low-poly mesh validation failed.');
}

console.log('Low-poly mesh validation passed.');
