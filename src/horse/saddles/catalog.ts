export const SADDLE_IDS = ['none', 'simple', 'travel'] as const;
export type SaddleId = typeof SADDLE_IDS[number];
export type Point = readonly [number, number, number];
export const SADDLE_VERSION = 'wanhu-saddles-m3-v1';
export interface SaddleDefinition {
  id: SaddleId; name: string; description: string;
  /** 原马的作者坐面；其他坐骑由自己的SaddleProfile提供，不共用此偏移。 */
  seat: Point | null;
}
export const SADDLES: readonly SaddleDefinition[] = [
  { id: 'none', name: '无鞍具', description: '未装鞍具 · 不显示骑手、辔头与缰绳', seat: null },
  { id: 'simple', name: '普通鞍具', description: '日常骑乘 · 整套鞍座、辔头与简化脚蹬', seat: [0, .41, .12] },
  { id: 'travel', name: '旅行鞍具', description: '双侧行囊与后卷毯 · 按种类适配整套外形', seat: [0, .425, .12] },
];
export function isSaddleId(value: unknown): value is SaddleId { return typeof value === 'string' && SADDLE_IDS.includes(value as SaddleId); }
export function saddleDefinition(id: SaddleId): SaddleDefinition { const definition = SADDLES.find(value => value.id === id); if (!definition) throw new Error(`未知鞍具：${String(id)}`); return definition; }
export function canRide(id: SaddleId) { return saddleDefinition(id).seat !== null; }
