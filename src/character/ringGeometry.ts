import * as THREE from 'three';
import type { BodySection, JointPatch, SectionRing } from './topology';

export type RingSequence = Pick<
  BodySection | JointPatch,
  'id' | 'rings' | 'radialSegments'
>;

const WORLD_DEPTH = new THREE.Vector3(0, 0, 1);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function ringCenter(ring: SectionRing): THREE.Vector3 {
  return new THREE.Vector3(ring.center[0], ring.center[1], ring.center[2]);
}

function ringTangent(
  sequence: RingSequence,
  ringIndex: number,
): THREE.Vector3 {
  const ring = sequence.rings[ringIndex];

  if (ring.tangent) {
    return new THREE.Vector3(
      ring.tangent[0],
      ring.tangent[1],
      ring.tangent[2],
    ).normalize();
  }

  const previous = ringCenter(
    sequence.rings[Math.max(0, ringIndex - 1)],
  );
  const next = ringCenter(
    sequence.rings[Math.min(sequence.rings.length - 1, ringIndex + 1)],
  );

  return new THREE.Vector3().subVectors(next, previous).normalize();
}

export function getRingFrame(
  sequence: RingSequence,
  ringIndex: number,
): {
  center: THREE.Vector3;
  right: THREE.Vector3;
  forward: THREE.Vector3;
} {
  const center = ringCenter(sequence.rings[ringIndex]);
  const tangent = ringTangent(sequence, ringIndex);

  // Keep the semantic axes stable across the body:
  // radiusX = lateral width, radiusY = front/back depth.
  // For the mostly-XY humanoid centerlines, world Z is a stable depth axis.
  const forward = WORLD_DEPTH.clone()
    .addScaledVector(tangent, -WORLD_DEPTH.dot(tangent));

  if (forward.lengthSq() < 1e-6) {
    forward
      .copy(WORLD_UP)
      .addScaledVector(tangent, -WORLD_UP.dot(tangent));
  }

  forward.normalize();

  const right = new THREE.Vector3()
    .crossVectors(tangent, forward)
    .normalize();

  return { center, right, forward };
}
