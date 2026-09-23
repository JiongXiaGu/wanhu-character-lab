import type { LivestockLodId, LivestockLodMode } from './types';

export const LIVESTOCK_REFERENCE_HEIGHT = .54;
export const LOD0_MIN_PIXELS = 70;
export const LOD1_MIN_PIXELS = 26;

/** 正交经营镜头以屏幕像素高度决定全群预览LOD；固定档仅供作者审查。正式Unity端可换成逐实例距离/屏占比策略。 */
export function selectLivestockLod(mode: LivestockLodMode, pixelHeight: number): LivestockLodId {
  if (mode !== 'auto') return mode;
  const pixels = Number.isFinite(pixelHeight) ? pixelHeight : Infinity;
  return pixels >= LOD0_MIN_PIXELS ? 'lod0' : pixels >= LOD1_MIN_PIXELS ? 'lod1' : 'lod2';
}
