import { LoopOnce, type AnimationAction } from 'three';
import { makeCharacter } from '../character/v3/outfit';
import { makeActor, type Actor } from '../character/v3/rig';
import { triCount } from '../character/v3/cage';
import type { Recipe } from '../character/v3/types';
import { createSaddleActor } from '../horse/saddles/saddle-actor';
import type { SaddleId } from '../horse/saddles/catalog';
import { mountDefinition } from '../mounts/catalog';
import { createMountPlayer } from '../mounts/player';
import type { MountId } from '../mounts/types';
import { createReins } from './reins';
import { createRiderSeat } from './rider-seat';
import { bakeRiderClips } from './rider-pose';
import { ridingDefinition, type RidingSelection, type RidingPlayback, type RidingStats } from './types';

function createRiderSampler(actor: Actor, mountId: MountId) {
  const clips = bakeRiderClips(actor.data, mountId); let action: AnimationAction | undefined, phase = 0, selected: RidingSelection = 'pose';
  return { clips,
    select(id: RidingSelection) { action?.stop(); selected = id; action = actor.mixer.clipAction(clips.get(id)!); action.reset().setLoop(LoopOnce, 1).setEffectiveWeight(1).play(); action.clampWhenFinished = true; action.paused = true; },
    sample(value: number) { phase = selected === 'pose' ? 0 : value; if (action) { action.enabled = true; action.time = phase * action.getClip().duration; } actor.update(0); },
    get phase() { return phase; },
    dispose() { action?.stop(); for (const clip of clips.values()) actor.mixer.uncacheClip(clip); },
  };
}
function createMountBundle(id: MountId, saddleId: SaddleId, rider: Actor) {
  const definition = mountDefinition(id), cleanup: (() => void)[] = [];
  try {
    const actor = definition.createActor(); cleanup.push(() => actor.dispose());
    const player = createMountPlayer(actor, definition); cleanup.push(() => player.dispose());
    const attachment = createRiderSeat(actor, definition); cleanup.push(() => attachment.dispose());
    const tack = createSaddleActor(actor, saddleId, definition.saddle); cleanup.push(() => tack.dispose());
    const reins = createReins(actor, tack, rider, definition.reins); cleanup.push(() => reins.dispose());
    let disposed = false;
    return { definition, actor, player, attachment, tack, reins, dispose() { if (disposed) return; disposed = true; cleanup.reverse().forEach(dispose => dispose()); } };
  } catch (error) { cleanup.reverse().forEach(dispose => dispose()); throw error; }
}
/** 一套骑手网格，切动物重建坐骑及其配套资产，重新烘焙骑姿但绝不重新绑定人物。 */
export function createRidingPlayer(recipe: Recipe, saddleId: SaddleId = 'simple', mountId: MountId = 'horse_chestnut') {
  mountDefinition(mountId);
  let rider = makeActor(makeCharacter(recipe));
  let bundle: ReturnType<typeof createMountBundle>, sampler: ReturnType<typeof createRiderSampler>;
  try { bundle = createMountBundle(mountId, saddleId, rider); }
  catch (error) { rider.dispose(); throw error; }
  try { sampler = createRiderSampler(rider, mountId); }
  catch (error) { bundle.dispose(); rider.dispose(); throw error; }
  let selected: RidingSelection = 'pose', disposed = false, recipeKey = JSON.stringify(recipe);
  const sync = () => {
    if (disposed) return;
    bundle.player.update(0); sampler.sample(selected === 'pose' ? 0 : bundle.player.status().phase);
    rider.mesh.visible = bundle.tack.canRide; if (!rider.mesh.visible) rider.skeletonHelper.visible = false;
    bundle.actor.mesh.updateMatrixWorld(true); rider.skeletonHelper.updateMatrixWorld(true); bundle.reins.update(selected);
  };
  bundle.attachment.setSaddle(saddleId); bundle.attachment.attach(rider); bundle.player.select('bind'); sampler.select('pose'); sync();
  return {
    get mountId() { return bundle.definition.id; }, get definition() { return bundle.definition; },
    get mount() { return bundle.actor; }, get mountPlayer() { return bundle.player; },
    // 旧马专项脚本的只读别名，不限制当前坐骑种类或骨骼数量。
    get horse() { return bundle.actor; }, get horsePlayer() { return bundle.player; },
    get tack() { return bundle.tack; }, get reins() { return bundle.reins; }, get seat() { return bundle.attachment.seat; }, get riderRoot() { return bundle.attachment.root; },
    get rider() { return rider; }, get riderClips() { return sampler.clips; }, get selection() { return selected; }, get canRide() { return bundle.tack.canRide; },
    select(id: RidingSelection) {
      if (disposed || !bundle.tack.canRide || id === selected) return;
      selected = id; bundle.player.select(id === 'pose' ? 'bind' : ridingDefinition(id, bundle.definition.id).motion); sampler.select(id); sync();
    },
    setMount(id: MountId) {
      mountDefinition(id); if (disposed || id === bundle.definition.id) return false;
      const status = bundle.player.status(), next = createMountBundle(id, bundle.tack.id, rider);
      let nextSampler: ReturnType<typeof createRiderSampler>;
      try {
        nextSampler = createRiderSampler(rider, id);
        next.player.select(selected === 'pose' ? 'bind' : ridingDefinition(selected, id).motion); next.player.setLoop(status.loop); next.player.seek(status.phase);
        next.actor.mesh.position.copy(bundle.actor.mesh.position); next.actor.mesh.quaternion.copy(bundle.actor.mesh.quaternion); next.actor.mesh.scale.copy(bundle.actor.mesh.scale);
        next.attachment.setSaddle(bundle.tack.id);
      } catch (error) { next.dispose(); throw error; }
      // 候选成功后才释放旧动物；人物原inverse bind/网格与外观保持。
      sampler.dispose(); rider.mesh.removeFromParent(); bundle.dispose(); bundle = next; sampler = nextSampler;
      bundle.attachment.attach(rider); sampler.select(selected); sync(); return true;
    },
    setSaddle(id: SaddleId) { if (disposed || !bundle.tack.select(id)) return false; bundle.attachment.setSaddle(id); sync(); return true; },
    setRecipe(next: Recipe) {
      if (disposed || JSON.stringify(next) === recipeKey) return false;
      const candidate = makeActor(makeCharacter(next)); let nextSampler: ReturnType<typeof createRiderSampler>;
      try { nextSampler = createRiderSampler(candidate, bundle.definition.id); }
      catch (error) { candidate.dispose(); throw error; }
      sampler.dispose(); rider.mesh.removeFromParent(); rider.wire.removeFromParent(); rider.skeletonHelper.removeFromParent(); rider.dispose();
      rider = candidate; sampler = nextSampler; recipeKey = JSON.stringify(next); bundle.attachment.attach(rider); bundle.reins.setRider(rider); sampler.select(selected); sync(); return true;
    },
    update(delta: number) { if (!disposed) { bundle.player.update(bundle.tack.canRide ? delta : 0); sync(); } },
    seek(phase: number) { if (!disposed && bundle.tack.canRide) { bundle.player.seek(phase); sync(); } },
    step(direction: -1 | 1) { if (!disposed && bundle.tack.canRide) { bundle.player.step(direction); sync(); } },
    replay() { if (!disposed && bundle.tack.canRide) { bundle.player.replay(); sync(); } },
    setLoop(value: boolean) { if (!disposed) { bundle.player.setLoop(value); sync(); } },
    status(): RidingPlayback { const status = bundle.player.status(); return { clip: selected, phase: status.phase, time: status.time, duration: status.duration, horsePhase: status.phase, riderPhase: sampler.phase, loop: status.loop, finished: status.finished }; },
    stats(): RidingStats { return { horse: bundle.actor.stats, rider: { triangles: triCount(rider.data.surface), logicalVertices: rider.data.surface.vertices.length, gpuVertices: rider.mesh.geometry.getAttribute('position').count, bones: rider.bones.length } }; },
    dispose() {
      if (disposed) return; disposed = true; sampler.dispose(); rider.mesh.removeFromParent(); rider.wire.removeFromParent(); rider.skeletonHelper.removeFromParent(); bundle.dispose(); rider.dispose();
    },
  };
}
export type RidingPlayer = ReturnType<typeof createRidingPlayer>;
