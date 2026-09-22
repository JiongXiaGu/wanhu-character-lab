import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { B } from '../character/v3/types';
import { shapePoint } from '../character/v3/body';
import type { Actor } from '../character/v3/rig';
import type { HorseDisplay } from '../horse/types';
import type { SaddleActor } from '../horse/saddles/saddle-actor';
import { HORSE_REIN_PROFILE } from '../mounts/horse-profile';
import { mountBone, type MountActor, type ReinProfile } from '../mounts/types';
import type { RidingSelection } from './types';

export const REIN_SEGMENTS = 12;
export const REIN_RADIUS = .006;
/** 固定双绳缓冲；嘴环、导向及掌心各自有所有者，不使用马的固定骨索引。 */
export function createReins(animal: MountActor, tack: SaddleActor, initialRider: Actor, profile: ReinProfile = HORSE_REIN_PROFILE) {
  const guideBone = mountBone(animal, profile.guideBone), grips = [new Group(), new Group()], guide = new Group();
  grips[0].name = 'LeftReinGrip'; grips[1].name = 'RightReinGrip'; guide.name = 'ReinNeckGuide'; guideBone.add(guide);
  const count = (REIN_SEGMENTS + 1) * 4 * 2, positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), indices: number[] = [];
  for (let side = 0; side < 2; side++) {
    const base = side * (REIN_SEGMENTS + 1) * 4;
    for (let i = 0; i < REIN_SEGMENTS; i++) for (let j = 0; j < 4; j++) { const a = base + i * 4 + j, b = base + (i + 1) * 4 + j, c = base + (i + 1) * 4 + (j + 1) % 4, d = base + i * 4 + (j + 1) % 4; indices.push(a, c, b, a, d, c); }
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2); const end = base + REIN_SEGMENTS * 4; indices.push(end, end + 1, end + 2, end, end + 2, end + 3);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage)); geometry.setAttribute('normal', new BufferAttribute(normals, 3).setUsage(DynamicDrawUsage)); geometry.setIndex(indices);
  const material = new MeshStandardMaterial({ color: '#493729', roughness: .96 }), mesh = new Mesh(geometry, material); mesh.name = 'Reins'; mesh.castShadow = true; mesh.frustumCulled = false; animal.mesh.add(mesh);
  const points = [Array.from({ length: REIN_SEGMENTS + 1 }, () => new Vector3()), Array.from({ length: REIN_SEGMENTS + 1 }, () => new Vector3())];
  const inverse = new Matrix4(), start = new Vector3(), end = new Vector3(), middle = new Vector3(), c1 = new Vector3(), c2 = new Vector3();
  const tangent = new Vector3(), normal = new Vector3(), binormal = new Vector3(), radial = new Vector3(), up = new Vector3(0, 1, 0);
  let disposed = false, enabled = true;
  const bindRider = (rider: Actor) => {
    for (let i = 0; i < 2; i++) { const sign = i === 0 ? -1 : 1, index = i === 0 ? B.LeftHand : B.RightHand; grips[i].position.fromArray(shapePoint([sign * .528, .864, .020], rider.data.recipe)).sub(new Vector3(...rider.data.joints[index].p)); rider.bones[index].add(grips[i]); }
  };
  bindRider(initialRider);
  return { mesh, grips, guide, points, setRider: bindRider,
    setEnabled(value: boolean) { enabled = value; mesh.visible = enabled && tack.id !== 'none'; },
    setDisplay(value: HorseDisplay) { material.color.set(value === 'clay' ? '#c2b49c' : '#493729'); material.wireframe = value === 'wire'; },
    update(selection: RidingSelection) {
      if (disposed) return; mesh.visible = enabled && tack.id !== 'none'; if (tack.id === 'none') return;
      inverse.copy(animal.mesh.matrixWorld).invert(); const sag = (selection === 'Rider_Run' ? .025 : selection === 'Rider_Walk' ? .043 : .060) * profile.sagScale;
      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? -1 : 1, bit = side === 0 ? tack.bitLeft : tack.bitRight;
        start.setFromMatrixPosition(bit.matrixWorld).applyMatrix4(inverse); end.setFromMatrixPosition(grips[side].matrixWorld).applyMatrix4(inverse);
        middle.set(sign * profile.guide[0], profile.guide[1], profile.guide[2]).applyMatrix4(guide.matrixWorld).applyMatrix4(inverse);
        c1.lerpVectors(start, middle, .75); c2.lerpVectors(end, middle, .75);
        c1.x = sign * Math.max(sign * c1.x, sign * middle.x + profile.sideClearance); c2.x = sign * Math.max(sign * c2.x, sign * middle.x + profile.sideClearance);
        for (let i = 0; i <= REIN_SEGMENTS; i++) { const t = i / REIN_SEGMENTS, u = 1 - t, point = points[side][i]; point.copy(start).multiplyScalar(u * u * u).addScaledVector(c1, 3 * u * u * t).addScaledVector(c2, 3 * u * t * t).addScaledVector(end, t * t * t); point.y -= sag * Math.sin(Math.PI * t) ** 2; }
        for (let i = 0; i <= REIN_SEGMENTS; i++) {
          tangent.subVectors(points[side][Math.min(REIN_SEGMENTS, i + 1)], points[side][Math.max(0, i - 1)]).normalize(); normal.crossVectors(tangent, up);
          if (normal.lengthSq() < 1e-8) normal.set(1, 0, 0); else normal.normalize(); binormal.crossVectors(tangent, normal).normalize();
          for (let j = 0; j < 4; j++) { const angle = j * Math.PI / 2, index = ((side * (REIN_SEGMENTS + 1) + i) * 4 + j) * 3; radial.copy(normal).multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle)); normals[index] = radial.x; normals[index + 1] = radial.y; normals[index + 2] = radial.z; positions[index] = points[side][i].x + radial.x * REIN_RADIUS; positions[index + 1] = points[side][i].y + radial.y * REIN_RADIUS; positions[index + 2] = points[side][i].z + radial.z * REIN_RADIUS; }
        }
      }
      geometry.attributes.position.needsUpdate = true; geometry.attributes.normal.needsUpdate = true;
    },
    dispose() { if (disposed) return; disposed = true; grips.forEach(grip => grip.removeFromParent()); guide.removeFromParent(); mesh.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
