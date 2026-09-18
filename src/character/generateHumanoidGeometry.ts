import * as THREE from 'three';
import { buildLowPolyGeometry } from './buildLowPolyGeometry';
import { createLowPolyHumanoidBlueprint } from './createLowPolyHumanoidBlueprint';
import type { BodyParameters } from './types';

export function generateHumanoidGeometry(
  parameters: BodyParameters,
): THREE.BufferGeometry {
  return buildLowPolyGeometry(
    createLowPolyHumanoidBlueprint(parameters),
  );
}
