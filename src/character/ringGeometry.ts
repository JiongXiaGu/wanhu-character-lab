import * as THREE from 'three';
import type { BodySection, JointPatch, SectionRing } from './topology';

export type RingSequence = Pick<
  BodySection | JointPatch,
  'id' | 'rings' | 'radialSegments'
>;

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export function ringCenter(ring: SectionRing): THREE.Vector3 {
  return new THREE.Vector3(ring.center[0], ring.center[1], ring.center[2]);
}

export function getRingFrame(
  sequence: RingSequence,
  ringIndex: number,
): {
  center: THREE.Vector3;
  right: THREE.Vector3;
  forward: THREE.Vector3;
} {
  const ring = sequence.rings[ringIndex];
  const center = ringCenter(ring);
  const previous = ringCenter(sequence.rings[Math.max(0, ringIndex - 1)]);
  const next = ringCenter(
    sequence.rings[Math.min(sequence.rings.length - 1, ringIndex + 1)],
  );

  const tangent = new THREE.Vector3().subVectors(next, previous).normalize();
  const reference =
    Math.abs(tangent.dot(Y_AXIS)) > 0.92 ? X_AXIS : Y_AXIS;

  const right = new THREE.Vector3()
    .crossVectors(reference, tangent)
    .normalize();
  const forward = new THREE.Vector3()
    .crossVectors(tangent, right)
    .normalize();

  return { center, right, forward };
}
