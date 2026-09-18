import * as THREE from 'three';
import { buildTopologyGeometry } from './buildTopologyGeometry';
import { createHumanTopologyBlueprint } from './createHumanTopologyBlueprint';
import type { BodyParameters } from './types';

export function generateHumanoidGeometry(
  parameters: BodyParameters,
): THREE.BufferGeometry {
  const blueprint = createHumanTopologyBlueprint(parameters);
  return buildTopologyGeometry(blueprint);
}
