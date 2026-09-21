import { LoopOnce, type AnimationAction } from 'three';
import { createClipClock } from '../animation/clip-clock';
import { bakeHorseClips, HORSE_FPS, horseClipDefinition } from './animation';
import type { HorseActor } from './skinning';
import type { HorseClipId } from './types';

export interface HorsePlayback { clip: HorseClipId | 'bind'; phase: number; time: number; duration: number; loop: boolean; finished: boolean }
/** Three.js标准Mixer只采样烘焙轨道，共用clip-clock，不包含四足或地面求解。 */
export function createHorsePlayer(actor: HorseActor) {
  const clips = bakeHorseClips();
  let selected: HorseClipId | 'bind' = 'bind', action: AnimationAction | undefined;
  let loop = true, clock = createClipClock(1, loop), disposed = false;
  const sync = () => { if (disposed) return; if (action) { action.enabled = true; action.time = clock.time; } actor.sync(); };
  const player = {
    clips,
    select(id: HorseClipId | 'bind') {
      if (disposed) return;
      action?.stop(); actor.reset(); selected = id;
      clock = createClipClock(id === 'bind' ? 1 : horseClipDefinition(id).duration, loop);
      action = id === 'bind' ? undefined : actor.mixer.clipAction(clips.get(id)!);
      if (action) {
        action.reset().setLoop(LoopOnce, 1).setEffectiveWeight(1).play();
        action.clampWhenFinished = true; action.paused = true;
      }
      sync();
    },
    update(delta: number) { if (selected !== 'bind') clock.advance(delta); sync(); },
    seek(phase: number) { clock.seek(phase); sync(); },
    step(direction: -1 | 1) { clock.seek(clock.phase + direction / (HORSE_FPS * (selected === 'bind' ? 1 : horseClipDefinition(selected).duration))); sync(); },
    replay() { clock.replay(); sync(); },
    setLoop(value: boolean) { loop = value; clock.setLoop(value); },
    status(): HorsePlayback { return { clip: selected, phase: selected === 'bind' ? 0 : clock.phase,
      time: selected === 'bind' ? 0 : clock.time, duration: selected === 'bind' ? 0 : horseClipDefinition(selected).duration,
      loop, finished: selected !== 'bind' && clock.finished }; },
    dispose() { disposed = true; action?.stop(); clips.forEach(clip => actor.mixer.uncacheClip(clip)); },
  };
  return player;
}
export type HorsePlayer = ReturnType<typeof createHorsePlayer>;
