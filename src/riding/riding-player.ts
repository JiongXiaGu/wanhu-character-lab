import { LoopOnce, type AnimationAction } from 'three';
import { makeCharacter } from '../character/v3/outfit';
import { makeActor, type Actor } from '../character/v3/rig';
import { triCount } from '../character/v3/cage';
import type { Recipe } from '../character/v3/types';
import { createHorseActor } from '../horse/skinning';
import { createHorsePlayer } from '../horse/player';
import { createSaddleActor } from '../horse/saddles/saddle-actor';
import { canRide, type SaddleId } from '../horse/saddles/catalog';
import { createReins } from './reins';
import { createRiderSeat } from './rider-seat';
import { bakeRiderClips } from './rider-pose';
import { ridingDefinition, type RidingSelection, type RidingPlayback, type RidingStats } from './types';

function createRiderSampler(actor: Actor) {
  const clips = bakeRiderClips(actor.data);
  let action: AnimationAction | undefined, phase = 0, selected: RidingSelection = 'pose';
  return {
    clips,
    select(id: RidingSelection) {
      action?.stop(); selected = id; action = actor.mixer.clipAction(clips.get(id)!);
      action.reset().setLoop(LoopOnce, 1).setEffectiveWeight(1).play(); action.clampWhenFinished = true; action.paused = true;
    },
    sample(value: number) { phase = selected === 'pose' ? 0 : value; if (action) { action.enabled = true; action.time = phase * action.getClip().duration; } actor.update(0); },
    get phase() { return phase; },
    dispose() { action?.stop(); for (const clip of clips.values()) actor.mixer.uncacheClip(clip); },
  };
}
export function createRidingPlayer(recipe: Recipe, saddleId: SaddleId = 'simple') {
  const horse = createHorseActor(), horsePlayer = createHorsePlayer(horse), attachment = createRiderSeat(horse);
  let rider: Actor, sampler: ReturnType<typeof createRiderSampler>, tack: ReturnType<typeof createSaddleActor>, reins: ReturnType<typeof createReins>;
  try { rider = makeActor(makeCharacter(recipe)); }
  catch (error) { attachment.dispose(); horsePlayer.dispose(); horse.dispose(); throw error; }
  try { sampler = createRiderSampler(rider); }
  catch (error) { rider.dispose(); attachment.dispose(); horsePlayer.dispose(); horse.dispose(); throw error; }
  try { tack = createSaddleActor(horse, saddleId); }
  catch (error) { sampler.dispose(); rider.dispose(); attachment.dispose(); horsePlayer.dispose(); horse.dispose(); throw error; }
  try { reins = createReins(horse, tack, rider); }
  catch (error) { tack.dispose(); sampler.dispose(); rider.dispose(); attachment.dispose(); horsePlayer.dispose(); horse.dispose(); throw error; }
  let selected: RidingSelection = 'pose', disposed = false, recipeKey = JSON.stringify(recipe);
  const sync = () => {
    if (disposed) return;
    // 马→骑手→末端挂点→缰绳：同帧完成，不能读取前一帧的手或马嘴位置。
    horsePlayer.update(0); sampler.sample(selected === 'pose' ? 0 : horsePlayer.status().phase);
    rider.mesh.visible = canRide(tack.id); if (!rider.mesh.visible) rider.skeletonHelper.visible = false;
    horse.mesh.updateMatrixWorld(true); rider.skeletonHelper.updateMatrixWorld(true); reins.update(selected);
  };
  attachment.setSaddle(saddleId); attachment.attach(rider); horsePlayer.select('bind'); sampler.select('pose'); sync();
  const result = {
    horse, horsePlayer, tack, reins, seat: attachment.seat, riderRoot: attachment.root,
    get rider() { return rider; }, get riderClips() { return sampler.clips; }, get selection() { return selected; },
    get canRide() { return canRide(tack.id); },
    select(id: RidingSelection) {
      if (disposed || !canRide(tack.id) || id === selected) return;
      selected = id; horsePlayer.select(id === 'pose' ? 'bind' : ridingDefinition(id).horse); sampler.select(id); sync();
    },
    setSaddle(id: SaddleId) {
      if (disposed || !tack.select(id)) return false;
      attachment.setSaddle(id); sync(); return true;
    },
    setRecipe(next: Recipe) {
      if (disposed || JSON.stringify(next) === recipeKey) return false;
      const candidate = makeActor(makeCharacter(next)); let nextSampler: ReturnType<typeof createRiderSampler>;
      try { nextSampler = createRiderSampler(candidate); nextSampler.select(selected); }
      catch (error) { candidate.dispose(); throw error; }
      sampler.dispose(); rider.mesh.removeFromParent(); rider.wire.removeFromParent(); rider.skeletonHelper.removeFromParent(); rider.dispose();
      rider = candidate; sampler = nextSampler; recipeKey = JSON.stringify(next);
      attachment.attach(rider); reins.setRider(rider); sync(); return true;
    },
    update(delta: number) { if (!disposed) { horsePlayer.update(canRide(tack.id) ? delta : 0); sync(); } },
    seek(phase: number) { if (!disposed && canRide(tack.id)) { horsePlayer.seek(phase); sync(); } },
    step(direction: -1 | 1) { if (!disposed && canRide(tack.id)) { horsePlayer.step(direction); sync(); } },
    replay() { if (!disposed && canRide(tack.id)) { horsePlayer.replay(); sync(); } },
    setLoop(value: boolean) { if (!disposed) { horsePlayer.setLoop(value); sync(); } },
    status(): RidingPlayback {
      const status = horsePlayer.status();
      return { clip: selected, phase: status.phase, time: status.time, duration: status.duration,
        horsePhase: status.phase, riderPhase: sampler.phase, loop: status.loop, finished: status.finished };
    },
    stats(): RidingStats {
      return { horse: horse.stats, rider: { triangles: triCount(rider.data.surface), logicalVertices: rider.data.surface.vertices.length,
        gpuVertices: rider.mesh.geometry.getAttribute('position').count, bones: rider.bones.length } };
    },
    dispose() {
      if (disposed) return; disposed = true;
      reins.dispose(); tack.dispose(); sampler.dispose(); rider.mesh.removeFromParent(); rider.wire.removeFromParent(); rider.skeletonHelper.removeFromParent(); rider.dispose();
      attachment.dispose(); horsePlayer.dispose(); horse.dispose();
    },
  };
  return result;
}
export type RidingPlayer = ReturnType<typeof createRidingPlayer>;
