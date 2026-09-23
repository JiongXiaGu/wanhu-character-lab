import type { Habitat, HabitatDefinition, LivestockDefinition } from './types';

export const motionSurface = (definition: LivestockDefinition, motion: string): Habitat => definition.motions.find(m => m.id === motion)?.surface ?? 'land';
export function habitatDefinition(definition: LivestockDefinition, surface: Habitat): HabitatDefinition {
  const profile = definition.habitats.find(h => h.id === surface);
  if (!profile) throw new Error(`${definition.id}不支持环境：${surface}`);
  return profile;
}
/** 同时归一化环境与动作；水面动作不能落到鸡或陆地动作池。显式合法环境优先。 */
export function resolveHabitat(definition: LivestockDefinition, surface: unknown, motion: unknown) {
  const candidate = definition.motions.find(m => m.id === motion);
  const profile = definition.habitats.find(h => h.id === surface)
    ?? (surface == null && candidate ? definition.habitats.find(h => h.id === (candidate.surface ?? 'land')) : undefined)
    ?? definition.habitats[0];
  return { surface: profile.id, motion: candidate && (candidate.surface ?? 'land') === profile.id ? candidate.id : profile.defaultMotion };
}
export function mixedChoice(profile: HabitatDefinition, pick: number) {
  const total = profile.mixed.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.max(0, Math.min(.999999, pick)) * total;
  for (const item of profile.mixed) { cursor -= item.weight; if (cursor < 0) return item; }
  return profile.mixed[profile.mixed.length - 1];
}
/** 同一水位，实例等比缩放后仍以作者吃水线对齐；浮动只由动作Root提供。 */
export function surfaceOffset(profile: HabitatDefinition, scale: number) { return profile.id === 'water' ? (profile.waterline ?? 0) * (1 - scale) : 0; }
