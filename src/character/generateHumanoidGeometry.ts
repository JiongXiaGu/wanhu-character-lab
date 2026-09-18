import * as THREE from 'three';
import { buildV2BaseBodyGeometry } from './buildV2BaseBodyGeometry';

export function generateHumanoidGeometry(): THREE.BufferGeometry {
  return buildV2BaseBodyGeometry();
}
