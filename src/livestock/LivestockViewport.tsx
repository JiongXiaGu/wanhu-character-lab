import { useEffect, useRef } from 'react';
import { createLivestockScene } from './scene';
import { LIVESTOCK } from './catalog';
import type { CameraSnapshot, LabOptions, LabStats, Playback } from './types';

export function LivestockViewport({ options, camera, onReport, onError }: { options: LabOptions; camera?: CameraSnapshot; onReport: (stats: LabStats, playback: Playback) => void; onError: (message: string) => void }) {
  const host = useRef<HTMLDivElement>(null), current = useRef(options), callbacks = useRef({ onReport, onError });
  current.current = options; callbacks.current = { onReport, onError };
  useEffect(() => {
    if (!host.current) return;
    try { const scene = createLivestockScene(host.current, LIVESTOCK[0], current, (stats, playback) => callbacks.current.onReport(stats, playback), camera); return () => scene.dispose(); }
    catch (error) { callbacks.current.onError(error instanceof Error ? error.message : String(error)); }
  }, []);
  return <div ref={host} className="horse-viewport livestock-viewport" data-testid="livestock-viewport" aria-label="家畜三维预览"/>;
}
