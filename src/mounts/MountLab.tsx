import { useCallback, useState } from 'react';
import { readPreviewSession, savePreviewSession } from './preview-session';
import type { HorseDisplay, HorseStats, HorseView } from '../horse/types';
import { isSaddleId, type SaddleId } from '../horse/saddles/catalog';
import { WorkspaceSwitcher } from '../ui/WorkspaceSwitcher';
import { AnimalModeSwitcher } from '../ui/AnimalModeSwitcher';
import { MountSelector } from '../ui/MountSelector';
import { initialMount, initialMountMotion, mountDefinition } from './catalog';
import { MOUNT_FPS, MOUNT_MOTIONS, type MountPlayback, type MountSelection } from './types';
import { MountViewport } from './MountViewport';
import '../horse/horse.css';

const query = new URLSearchParams(location.search), views: [HorseView, string][] = [['front', '正面'], ['left', '左侧'], ['right', '右侧'], ['back', '背面'], ['three', '前侧 ¾'], ['rear-three', '后侧 ¾']];
const resumed = readPreviewSession('horse');
const validPhase = (v: number) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
export default function MountLab() {
  const [mountId, setMountId] = useState(() => initialMount(query)), [saddleId, setSaddleId] = useState<SaddleId>(isSaddleId(query.get('saddle')) ? query.get('saddle') as SaddleId : 'none');
  const [clip, setClip] = useState<MountSelection>(resumed ? resumed.clip as MountSelection : query.get('pose') === 'bind' ? 'bind' : initialMountMotion(query.get('clip')));
  const [playing, setPlaying] = useState(resumed?.playing ?? (!query.has('paused') && query.get('pose') !== 'bind' && clip !== 'bind'));
  const [phase, setPhase] = useState(resumed?.phase ?? validPhase(Number(query.get('phase') ?? 0))), [seekRevision, setSeekRevision] = useState(0);
  const [view, setView] = useState<HorseView>(resumed?.view ?? (views.some(([id]) => id === query.get('view')) ? query.get('view') as HorseView : 'three')), [viewRevision, setViewRevision] = useState(0);
  const [orthographic, setOrthographic] = useState(resumed?.orthographic ?? true), [speed, setSpeed] = useState(resumed?.speed ?? 1), [loop, setLoop] = useState(resumed?.loop ?? true), [display, setDisplay] = useState<HorseDisplay>('beauty');
  const [skeleton, setSkeleton] = useState(false), [grid, setGrid] = useState(false), [error, setError] = useState(''), [stats, setStats] = useState<HorseStats | null>(null);
  const [playback, setPlayback] = useState<MountPlayback>({ clip, phase, time: 0, duration: 0, loop: true, finished: false });
  const report = useCallback((s: MountPlayback) => { setPlayback(s); if (s.finished) setPlaying(false); }, []);
  const definition = mountDefinition(mountId), active = clip === 'bind' ? null : definition.motions[clip];
  const choose = (id: MountSelection) => { setClip(id); setPhase(0); setSeekRevision(v => v + 1); setPlaying(id !== 'bind'); };
  const seek = (p: number) => { setPlaying(false); setPhase(validPhase(p)); setSeekRevision(v => v + 1); };
  const replay = () => { setPhase(0); setSeekRevision(v => v + 1); setPlaying(clip !== 'bind'); };
  return <main className="horse-lab mount-lab">
    <header className="horse-topbar"><div><p>WANHU / MOUNT STUDY</p><h1>坐骑工坊 <span>Mount Lab</span></h1></div><WorkspaceSwitcher active="animal"/><span className="horse-phase-tag">PHASE M6 · 多坐骑</span></header>
    <div className="horse-workspace">
      <section className="horse-stage" aria-label="坐骑本体预览">
        <div className="horse-stage-title"><p>MOUNT / LOW-POLY STUDY</p><h2 data-testid="mount-stage-name">{definition.name}</h2><span className="horse-stage-motion">{active?.label ?? '静态绑定姿态'}</span></div>
        <nav className="horse-cameras" data-testid="horse-cameras" aria-label="坐骑相机">{views.map(([id, label]) => <button key={id} data-testid={'horse-view-' + id} aria-pressed={view === id} onClick={() => { setView(id); setViewRevision(v => v + 1); }}>{label}</button>)}<button data-testid="horse-projection" onClick={() => setOrthographic(v => !v)}>{orthographic ? '正交' : '透视'}</button></nav>
        {error ? <div role="alert" className="horse-error">{error}<button onClick={() => location.reload()}>重新载入</button></div> : <MountViewport options={{ mountId, saddleId, clip, playing, speed, phase, seekRevision, loop, view, viewRevision, orthographic, display, skeleton, grid }} onStats={setStats} onPlayback={report} onError={setError}/>}
        <div className="horse-stage-caption"><span>拖动旋转 · 换坐骑保留动作相位</span><span data-testid="horse-stats">{stats?.triangles ?? '—'} tris · {stats?.logicalVertices ?? '—'} 逻辑点 · {stats?.bones ?? '—'} 骨骼</span></div>
        <section className="horse-transport" aria-label="坐骑动画播放控制"><div className="horse-transport-row">
          <button data-testid="horse-play" disabled={!active} onClick={() => playback.finished ? replay() : setPlaying(v => !v)}>{playing ? 'Ⅱ 暂停' : '▶ 播放'}</button><button data-testid="horse-replay" disabled={!active} onClick={replay}>重播</button>
          <button data-testid="horse-previous" disabled={!active} onClick={() => seek(playback.phase - 1 / (MOUNT_FPS * (playback.duration || 1)))}>上一帧</button><button data-testid="horse-next" disabled={!active} onClick={() => seek(playback.phase + 1 / (MOUNT_FPS * (playback.duration || 1)))}>下一帧</button>
          <label className="horse-loop"><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} aria-label="马动画循环播放"/>循环播放</label><label className="horse-speed">速度<select aria-label="马动画速度" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[.25, .5, 1, 1.5, 2].map(v => <option key={v} value={v}>{v}×</option>)}</select></label>
        </div><label className="horse-timeline"><span>相位</span><input aria-label="马动画相位" type="range" min="0" max="1" step=".001" disabled={!active} value={playback.phase} onChange={e => seek(Number(e.target.value))}/><output>{(playback.phase * 100).toFixed(1)}%</output></label><div className="horse-time" data-testid="horse-time">{playback.time.toFixed(2)} / {playback.duration.toFixed(2)} 秒<span>{active ? playback.finished ? '结束保持' : loop ? '原地循环 · 无场景位移' : '单次播放' : '静态绑定姿态'}</span></div></section>
      </section>
      <aside className="horse-inspector">
        <AnimalModeSwitcher onNavigate={() => savePreviewSession('horse', { clip, phase: playback.phase, playing, speed, loop, view, orthographic })} active="horse" mountId={mountId} saddleId={saddleId}/><MountSelector mountId={mountId} onMountChange={setMountId} saddleId={saddleId} onChange={setSaddleId}/>
        <section><p className="horse-eyebrow">02 / MOTION</p><h2>基础动作</h2><div className="horse-clip-list">{MOUNT_MOTIONS.map(id => <button key={id} data-testid={definition.motions[id].nativeId} data-motion={id} aria-pressed={clip === id} onClick={() => choose(id)}><strong>{definition.motions[id].label}</strong><small>{definition.motions[id].description}</small><span>{definition.motions[id].duration.toFixed(1)} s</span></button>)}</div><button className="horse-bind-button" data-testid="horse-bind" aria-pressed={clip === 'bind'} onClick={() => choose('bind')}>查看静态绑定姿态</button></section>
        <section><p className="horse-eyebrow">03 / INSPECTION</p><h2>模型审查</h2><div className="horse-display-options">{([['beauty', '色块'], ['clay', '素模'], ['wire', '线框']] as [HorseDisplay, string][]).map(([id, label]) => <button key={id} data-testid={'horse-display-' + id} aria-pressed={display === id} onClick={() => setDisplay(id)}>{label}</button>)}</div><div className="horse-toggles"><label><input aria-label="马骨架" type="checkbox" checked={skeleton} onChange={e => setSkeleton(e.target.checked)}/>骨架</label><label><input aria-label="马参考网格" type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)}/>参考网格</label></div><dl><div><dt>种类</dt><dd>{definition.name}</dd></div><div><dt>骨骼／每点权重</dt><dd>{stats?.bones ?? '—'}／≤2</dd></div><div><dt>单位／朝向</dt><dd>米／+Z前</dd></div></dl></section>
        <section className="horse-boundary"><p className="horse-eyebrow">本体预览</p><p>{definition.description}</p><p>无鞍具也能播放四个动作。有鞍无骑手时只显示辔头；持缰动态连接请在骑乘试衣中查看。</p></section>
      </aside>
    </div>
  </main>;
}
