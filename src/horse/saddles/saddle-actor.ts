import { Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { HorseActor } from '../skinning';
import type { HorseDisplay } from '../types';
import { HORSE_JOINTS, horseBone } from '../rig';
import { buildBridle, buildSaddle, BIT_BIND } from './assets';
import { saddleDefinition, type SaddleId } from './catalog';

/** 一个可选资产，分别跟随背骨和头骨；不进入人物配方或马Skeleton调色板。 */
export function createSaddleActor(horse: HorseActor, initial: SaddleId = 'none') {
  const root = new Group(), bridleRoot = new Group(); root.name = 'SaddleRoot'; bridleRoot.name = 'BridleRoot';
  horse.bones[horseBone('Spine')].add(root); horse.bones[horseBone('Head')].add(bridleRoot);
  const bitLeft = new Group(), bitRight = new Group(); bitLeft.name = 'LeftBitAnchor'; bitRight.name = 'RightBitAnchor';
  const headBind = new Vector3(...HORSE_JOINTS[horseBone('Head')].bindWorld);
  bitLeft.position.fromArray(BIT_BIND.left).sub(headBind); bitRight.position.fromArray(BIT_BIND.right).sub(headBind); bridleRoot.add(bitLeft, bitRight);
  let id: SaddleId = 'none', meshes: Mesh[] = [], disposed = false, display: HorseDisplay = 'beauty';
  const disposeMeshes = (items: Mesh[]) => items.forEach(mesh => { mesh.removeFromParent(); mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose(); });
  const applyDisplay = () => meshes.forEach(mesh => {
    const material = mesh.material as MeshStandardMaterial; material.vertexColors = display !== 'clay'; material.color.set(display === 'clay' ? '#c2b49c' : '#ffffff'); material.wireframe = display === 'wire'; material.needsUpdate = true;
  });
  const result = {
    root, bridleRoot, bitLeft, bitRight,
    get id() { return id; }, get meshes() { return meshes as readonly Mesh[]; },
    select(next: SaddleId) {
      saddleDefinition(next); if (disposed || id === next) return false;
      const candidates: Mesh[] = [];
      try {
        // 逐件接管候选资源，后一件构建失败时能释放前一件；成功之前旧马具不动。
        if (next !== 'none') for (const build of [() => buildSaddle(next), buildBridle]) {
          const geometry = build();
          try {
            const material = new MeshStandardMaterial({ vertexColors: true, roughness: .94, flatShading: true });
            const mesh = new Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; candidates.push(mesh);
          } catch (error) { geometry.dispose(); throw error; }
        }
      } catch (error) { disposeMeshes(candidates); throw error; }
      disposeMeshes(meshes); meshes = candidates; id = next;
      if (meshes.length) { meshes[0].name = `Saddle_${id}`; meshes[1].name = 'Bridle'; root.add(meshes[0]); bridleRoot.add(meshes[1]); }
      root.visible = bridleRoot.visible = id !== 'none'; applyDisplay(); horse.mesh.updateMatrixWorld(true); return true;
    },
    setDisplay(value: HorseDisplay) { display = value; applyDisplay(); },
    stats() { return { id, triangles: meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3, 0), geometries: meshes.map(mesh => mesh.geometry.uuid) }; },
    dispose() { if (disposed) return; disposed = true; disposeMeshes(meshes); meshes = []; root.removeFromParent(); bridleRoot.removeFromParent(); root.clear(); bridleRoot.clear(); },
  };
  root.visible = bridleRoot.visible = false;
  try { result.select(initial); } catch (error) { result.dispose(); throw error; } return result;
}
export type SaddleActor = ReturnType<typeof createSaddleActor>;
