import type { Recipe } from '../character/v3/types';
import { parseRecipeFile } from '../character/wardrobe/catalog';
import type { HorseView } from '../horse/types';

type Mode = 'horse' | 'riding';
type Point = [number, number, number];
export interface PreviewCamera { position: Point; target: Point; zoom: number }
export interface PreviewSession {
  clip: string; phase: number; playing: boolean; speed: number; loop: boolean;
  view: HorseView; orthographic: boolean; recipe?: Recipe; camera?: PreviewCamera;
}
const KEY = 'wanhu.mount.preview.v1.';
type Capture = () => { phase: number; camera: PreviewCamera };
const captures = new Map<Mode, Capture>();
/** 只注册当前活跃预览，销毁时撤销；不持有隐藏Canvas，不借用review全局钩子。 */
export function registerPreviewCapture(mode: Mode, capture: Capture): () => void {
  captures.set(mode, capture);
  return () => { if (captures.get(mode) === capture) captures.delete(mode); };
}
/** 仅明确点击本体/骑乘链接时保存。真实时钟和Orbit相机由活跃Viewport同步补齐。 */
export function savePreviewSession(mode: Mode, value: PreviewSession): void {
  try { sessionStorage.setItem(KEY + mode, JSON.stringify({ ...value, ...captures.get(mode)?.() })); }
  catch { /* 浏览器禁用临时存储时仍允许普通导航，不写人物工坊localStorage。 */ }
}
const point = (value: unknown): value is Point => Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100);
/** 只有模式链接带preview=resume才恢复；普通深链仍严格使用显式URL参数。缓存不是V5存档。 */
export function readPreviewSession(mode: Mode): PreviewSession | null {
  if (typeof window === 'undefined' || new URLSearchParams(location.search).get('preview') !== 'resume') return null;
  try {
    const raw = sessionStorage.getItem(KEY + mode); if (!raw || raw.length > 65536) return null;
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const clips = mode === 'horse' ? ['bind', 'idle', 'walk', 'run', 'eat'] : ['pose', 'Rider_Idle', 'Rider_Walk', 'Rider_Run'];
    const views = ['front', 'left', 'right', 'back', 'three', 'rear-three'];
    if (typeof value.clip !== 'string' || !clips.includes(value.clip) || typeof value.phase !== 'number' || !Number.isFinite(value.phase) || value.phase < 0 || value.phase > 1) return null;
    if (typeof value.playing !== 'boolean' || typeof value.loop !== 'boolean' || typeof value.orthographic !== 'boolean') return null;
    if (typeof value.speed !== 'number' || ![.25, .5, 1, 1.5, 2].includes(value.speed) || typeof value.view !== 'string' || !views.includes(value.view)) return null;
    const result: PreviewSession = { clip: value.clip, phase: value.phase, playing: value.playing, speed: value.speed, loop: value.loop, view: value.view as HorseView, orthographic: value.orthographic };
    if (value.camera !== undefined) {
      const camera = value.camera as Record<string, unknown>;
      if (!camera || !point(camera.position) || !point(camera.target) || typeof camera.zoom !== 'number' || !Number.isFinite(camera.zoom) || camera.zoom < .5 || camera.zoom > 4) return null;
      if (camera.position.every((n, i) => Math.abs(n - (camera.target as Point)[i]) < 1e-8)) return null;
      result.camera = { position: [...camera.position], target: [...camera.target], zoom: camera.zoom };
    }
    if (mode === 'riding' && value.recipe !== undefined) result.recipe = parseRecipeFile(JSON.stringify(value.recipe));
    return result;
  } catch { return null; }
}
