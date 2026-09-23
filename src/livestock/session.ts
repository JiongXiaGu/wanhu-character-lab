import { CROWD_COUNTS, LIVESTOCK_LOD_IDS } from './types';
import type { CameraSnapshot, CrowdCount, LabOptions, LivestockLodMode, LivestockView } from './types';
import { LIVESTOCK } from './catalog';

const KEY = 'wanhu.livestock.preview.v1';
const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
export const clampPhase = (value: unknown) => Math.max(0, Math.min(1, finite(value, 0)));
export function readLivestockSession(query: URLSearchParams): { options: LabOptions; camera?: CameraSnapshot } {
  let stored: Record<string, unknown> = {};
  if (query.get('preview') === 'resume') try { const value = JSON.parse(sessionStorage.getItem(KEY) ?? '{}'); if (value && typeof value === 'object' && value.version === 1) stored = value; } catch { /* 坏缓存或存储禁用不影响工作台。 */ }
  const rawCount = query.has('count') ? Number(query.get('count')) : stored.count;
  const count: CrowdCount = CROWD_COUNTS.includes(rawCount as CrowdCount) ? rawCount as CrowdCount : 1;
  const rawMotion = query.get('clip') ?? stored.motion, motion = LIVESTOCK[0].motions.some(m => m.id === rawMotion) ? String(rawMotion) : 'idle';
  const rawView = query.get('view') ?? stored.view, view: LivestockView = ['three', 'front', 'left', 'farm'].includes(String(rawView)) ? rawView as LivestockView : count > 1 ? 'farm' : 'three';
  const rawLod = query.get('lod') ?? stored.lod;
  const lod: LivestockLodMode = rawLod === 'auto' || LIVESTOCK_LOD_IDS.includes(rawLod as any) ? rawLod as LivestockLodMode : 'auto';
  const options: LabOptions = {
    count, motion, view, lod, mixed: query.has('mixed') ? query.get('mixed') === '1' : typeof stored.mixed === 'boolean' ? stored.mixed : count > 1,
    playing: query.has('paused') ? false : typeof stored.playing === 'boolean' ? stored.playing : true,
    loop: query.has('loop') ? query.get('loop') !== '0' : typeof stored.loop === 'boolean' ? stored.loop : true,
    speed: Math.max(.25, Math.min(2, finite(stored.speed, 1))), phase: clampPhase(query.has('phase') ? Number(query.get('phase')) : stored.phase),
    seed: Math.floor(finite(query.has('seed') ? Number(query.get('seed')) : stored.seed, 731)) >>> 0,
    seekRevision: 0, viewRevision: 0, display: 'beauty', skeleton: false, grid: false,
  };
  const raw = stored.camera as CameraSnapshot | undefined;
  const validVector = (v: unknown): v is number[] => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1000);
  const camera = !query.has('count') && !query.has('view') && raw && validVector(raw.position) && validVector(raw.target) && Number.isFinite(raw.zoom) && raw.zoom >= .2 && raw.zoom <= 15 ? raw : undefined;
  return { options, camera };
}
/** 只在明确离开本栏目时保存；不写人物配方或坐骑的时钟缓存。 */
export function saveLivestockSession(options: LabOptions, phase: number, camera?: CameraSnapshot) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ version: 1, ...options, phase: clampPhase(phase), camera })); } catch { /* 临时存储不可用时仍允许导航。 */ }
}
