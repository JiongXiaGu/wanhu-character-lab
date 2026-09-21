/** 共享的有限时间游标；不认识人物、动物、Mixer、骨架或业务事件。 */
export function createClipClock(duration: number, initialLoop: boolean) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('动画时长必须为有限正数。');
  let time = 0, loop = initialLoop;
  return {
    get time() { return time; },
    get phase() { return time / duration; },
    get loop() { return loop; },
    get finished() { return !loop && time >= duration; },
    advance(delta: number) {
      if (!Number.isFinite(delta) || delta <= 0) return;
      const next = time + delta;
      time = loop ? next % duration : next >= duration - 1e-6 ? duration : next;
    },
    seek(phase: number) { time = Math.max(0, Math.min(1, Number.isFinite(phase) ? phase : 0)) * duration; },
    replay() { time = 0; },
    setLoop(value: boolean) { loop = value; },
  };
}
