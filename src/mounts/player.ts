import { LoopOnce, type AnimationAction } from 'three';
import { createClipClock } from '../animation/clip-clock';
import { MOUNT_FPS, MOUNT_MOTIONS, type MountActor, type MountDefinition, type MountPlayback, type MountSelection } from './types';

/** 坐骑是唯一时钟；UI使用动作语义，资源仍保留各动物自己的片段ID。 */
export function createMountPlayer(actor: MountActor, definition: MountDefinition) {
  const clips = definition.bakeClips(); let selected: MountSelection = 'bind', action: AnimationAction | undefined;
  let loop = true, disposed = false, clock = createClipClock(1, loop);
  const sync = () => { if (disposed) return; if (action) { action.enabled = true; action.time = clock.time; } actor.sync(); };
  return {
    clips,
    select(id: MountSelection) {
      if (id !== 'bind' && !MOUNT_MOTIONS.includes(id)) throw new Error(`未知坐骑动作：${id}`);
      if (disposed) return;
      action?.stop(); actor.reset(); selected = id; clock = createClipClock(id === 'bind' ? 1 : definition.motions[id].duration, loop);
      action = id === 'bind' ? undefined : actor.mixer.clipAction(clips.get(id)!);
      if (action) { action.reset().setLoop(LoopOnce, 1).setEffectiveWeight(1).play(); action.clampWhenFinished = true; action.paused = true; } sync();
    },
    update(delta: number) { if (selected !== 'bind') clock.advance(delta); sync(); },
    seek(phase: number) { clock.seek(phase); sync(); },
    step(direction: -1 | 1) { clock.seek(clock.phase + direction / (MOUNT_FPS * (selected === 'bind' ? 1 : definition.motions[selected].duration))); sync(); },
    replay() { clock.replay(); sync(); }, setLoop(value: boolean) { loop = value; clock.setLoop(value); },
    status(): MountPlayback { return { clip: selected, phase: selected === 'bind' ? 0 : clock.phase, time: selected === 'bind' ? 0 : clock.time, duration: selected === 'bind' ? 0 : definition.motions[selected].duration, loop, finished: selected !== 'bind' && clock.finished }; },
    dispose() { if (disposed) return; disposed = true; action?.stop(); for (const clip of clips.values()) actor.mixer.uncacheClip(clip); },
  };
}
export type MountPlayer = ReturnType<typeof createMountPlayer>;
