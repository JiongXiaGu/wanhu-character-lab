import { Group, Mesh, MeshStandardMaterial } from 'three';
import type { HorseDisplay } from '../types';
import { saddleDefinition, type SaddleId } from './catalog';
import { HORSE_SADDLE_PROFILE } from '../../mounts/horse-profile';
import { mountBone, type MountActor, type SaddleProfile } from '../../mounts/types';

/** 一个鞍具选项，物种自己提供作者网格与坐点。没有增加子槽位或骨骼。 */
export function createSaddleActor(animal: MountActor, initial: SaddleId = 'none', profile: SaddleProfile = HORSE_SADDLE_PROFILE) {
  const back = mountBone(animal, profile.backBone), head = mountBone(animal, profile.headBone);
  const root = new Group(), bridleRoot = new Group(); root.name = 'SaddleRoot'; bridleRoot.name = 'BridleRoot'; back.add(root); head.add(bridleRoot);
  const bitLeft = new Group(), bitRight = new Group(); bitLeft.name = 'LeftBitAnchor'; bitRight.name = 'RightBitAnchor';
  bitLeft.position.fromArray(profile.bitLeft); bitRight.position.fromArray(profile.bitRight); bridleRoot.add(bitLeft, bitRight);
  let id: SaddleId = 'none', meshes: Mesh[] = [], disposed = false, display: HorseDisplay = 'beauty';
  const disposeMeshes = (items: Mesh[]) => items.forEach(mesh => { mesh.removeFromParent(); mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose(); });
  const applyDisplay = () => meshes.forEach(mesh => {
    const material = mesh.material as MeshStandardMaterial; material.vertexColors = display !== 'clay'; material.color.set(display === 'clay' ? '#c2b49c' : '#ffffff'); material.wireframe = display === 'wire'; material.needsUpdate = true;
  });
  const result = {
    root, bridleRoot, bitLeft, bitRight, profile,
    get id() { return id; }, get canRide() { return profile.seat(id) !== null; }, get meshes() { return meshes as readonly Mesh[]; },
    select(next: SaddleId) {
      saddleDefinition(next); if (disposed || id === next) return false;
      const candidates: Mesh[] = [];
      try {
        if (next !== 'none') for (const build of [() => profile.buildSaddle(next), () => profile.buildBridle()]) {
          const geometry = build();
          try { const material = new MeshStandardMaterial({ vertexColors: true, roughness: .94, flatShading: true }); const mesh = new Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; candidates.push(mesh); }
          catch (error) { geometry.dispose(); throw error; }
        }
      } catch (error) { disposeMeshes(candidates); throw error; }
      disposeMeshes(meshes); meshes = candidates; id = next;
      if (meshes.length) { meshes[0].name = `Saddle_${id}`; meshes[1].name = 'Bridle'; root.add(meshes[0]); bridleRoot.add(meshes[1]); }
      root.visible = bridleRoot.visible = id !== 'none'; applyDisplay(); animal.mesh.updateMatrixWorld(true); return true;
    },
    setDisplay(value: HorseDisplay) { display = value; applyDisplay(); },
    stats() { return { id, triangles: meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3, 0), geometries: meshes.map(mesh => mesh.geometry.uuid) }; },
    dispose() { if (disposed) return; disposed = true; disposeMeshes(meshes); meshes = []; root.removeFromParent(); bridleRoot.removeFromParent(); root.clear(); bridleRoot.clear(); },
  };
  root.visible = bridleRoot.visible = false;
  try { result.select(initial); } catch (error) { result.dispose(); throw error; } return result;
}
export type SaddleActor = ReturnType<typeof createSaddleActor>;
