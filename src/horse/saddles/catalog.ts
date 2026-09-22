export const HORSES = [{ id: 'chestnut', name: '栗色马' }] as const;
export type HorseId = typeof HORSES[number]['id'];
export const SADDLE_IDS = ['none', 'simple', 'travel'] as const;
export type SaddleId = typeof SADDLE_IDS[number];
export type Point = readonly [number, number, number];
export const SADDLE_VERSION = 'wanhu-saddles-m3-v1';
export interface SaddleDefinition {
  id: SaddleId; name: string; description: string;
  /** Spine局部坐面。none没有坐面，也不保存重复的mountable字段。 */
  seat: Point | null;
}
export const SADDLES: readonly SaddleDefinition[] = [
  { id: 'none', name: '无马鞍', description: '自由马 · 无马鞍、辔头与缰绳', seat: null },
  { id: 'simple', name: '普通马鞍', description: '日常鞍座 · 含辔头、缰绳和简化脚蹬', seat: [0, .41, .12] },
  { id: 'travel', name: '旅行马鞍', description: '双侧行囊与后卷毯 · 一整套切换', seat: [0, .425, .12] },
];
export function isSaddleId(value: unknown): value is SaddleId { return typeof value === 'string' && SADDLE_IDS.includes(value as SaddleId); }
export function saddleDefinition(id: SaddleId): SaddleDefinition {
  const definition = SADDLES.find(value => value.id === id);
  if (!definition) throw new Error(`未知马鞍：${String(id)}`);
  return definition;
}
export function canRide(id: SaddleId) { return saddleDefinition(id).seat !== null; }
