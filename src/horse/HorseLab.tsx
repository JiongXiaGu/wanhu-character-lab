import { useCallback, useState } from 'react';
import { HORSE_CLIPS, HORSE_FPS, horseClipDefinition, isHorseClip } from './animation';
import { HorseViewport } from './HorseViewport';
import type { HorsePlayback } from './player';
import type { HorseClipId, HorseDisplay, HorseStats, HorseView } from './types';
import { WorkspaceSwitcher } from '../ui/WorkspaceSwitcher';
import './horse.css';

const query = new URLSearchParams(location.search);
const views: [HorseView, string][] = [['front', '正面'], ['left', '左侧'], ['right', '右侧'], ['back', '背面'], ['three', '前侧 ¾'], ['rear-three', '后侧 ¾']];
const validPhase = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
export default function HorseLab() {
  const initial = query.get('clip');
  const [clip, setClip] = useState<HorseClipId | 'bind'>(query.get('pose') === 'bind' ? 'bind' : isHorseClip(initial) ? initial : 'Horse_Idle');
  const [playing, setPlaying] = useState(!query.has('paused') && query.get('pose') !== 'bind');
  const [phase, setPhase] = useState(validPhase(Number(query.get('phase') ?? 0))), [seekRevision, setSeekRevision] = useState(0);
  const [view, setView] = useState<HorseView>(views.some(([id]) => id === query.get('view')) ? query.get('view') as HorseView : 'three');
  const [viewRevision, setViewRevision] = useState(0), [orthographic, setOrthographic] = useState(true);
  const [speed, setSpeed] = useState(1), [loop, setLoop] = useState(true), [display, setDisplay] = useState<HorseDisplay>('beauty');
  const [skeleton, setSkeleton] = useState(false), [grid, setGrid] = useState(false), [error, setError] = useState('');
  const [stats, setStats] = useState<HorseStats | null>(null);
  const [playback, setPlayback] = useState<HorsePlayback>({ clip, phase, time: 0, duration: 0, loop: true, finished: false });
  const report = useCallback((status: HorsePlayback) => { setPlayback(status); if (status.finished) setPlaying(false); }, []);
  const selectClip = (id: HorseClipId | 'bind') => { setClip(id); setPhase(0); setSeekRevision(n => n + 1); setPlaying(id !== 'bind'); };
  const seek = (next: number) => { setPlaying(false); setPhase(validPhase(next)); setSeekRevision(n => n + 1); };
  const replay = () => { setPhase(0); setSeekRevision(n => n + 1); setPlaying(clip !== 'bind'); };
  const active = clip === 'bind' ? null : horseClipDefinition(clip);
  return <main className="horse-lab">
    <header className="horse-topbar">
      <div><p>WANHU / ANIMAL STUDY</p><h1>马匹实验 <span>Horse Lab</span></h1></div>
      <WorkspaceSwitcher active="animal"/>
      <span className="horse-phase-tag">PHASE M1 · 马本体</span>
    </header>
    <div className="horse-workspace">
      <section className="horse-stage" aria-label="马匹预览">
        <div className="horse-stage-title"><div><p>CHESTNUT / LOW-POLY STUDY</p><h2>栗色马</h2><span className="horse-stage-motion">{active?.label ?? '静态绑定姿态'}</span></div></div>
        <nav className="horse-cameras" data-testid="horse-cameras" aria-label="马匹相机">
          {views.map(([id, label]) => <button key={id} data-testid={'horse-view-' + id} aria-pressed={view === id} onClick={() => { setView(id); setViewRevision(n => n + 1); }}>{label}</button>)}
          <button data-testid="horse-projection" onClick={() => setOrthographic(value => !value)}>{orthographic ? '正交' : '透视'}</button>
        </nav>
        {error ? <div role="alert" className="horse-error">{error}<button onClick={() => location.reload()}>重新载入</button></div> :
          <HorseViewport options={{ clip, playing, speed, phase, seekRevision, loop, view, viewRevision, orthographic, display, skeleton, grid }} onStats={setStats} onPlayback={report} onError={setError} />}
        <div className="horse-stage-caption"><span>拖动旋转 · 滚轮缩放</span><span data-testid="horse-stats">{stats?.triangles ?? '—'} tris · {stats?.logicalVertices ?? '—'} 逻辑点 · {stats?.bones ?? '—'} 骨骼</span></div>
        <section className="horse-transport" aria-label="马动画播放控制">
          <div className="horse-transport-row">
            <button data-testid="horse-play" disabled={!active} onClick={() => playback.finished ? replay() : setPlaying(value => !value)}>{playing ? 'Ⅱ 暂停' : '▶ 播放'}</button>
            <button data-testid="horse-replay" disabled={!active} onClick={replay}>重播</button>
            <button data-testid="horse-previous" disabled={!active} onClick={() => seek(playback.phase - 1 / (HORSE_FPS * (playback.duration || 1)))}>上一帧</button>
            <button data-testid="horse-next" disabled={!active} onClick={() => seek(playback.phase + 1 / (HORSE_FPS * (playback.duration || 1)))}>下一帧</button>
            <label className="horse-loop"><input type="checkbox" checked={loop} onChange={event => setLoop(event.target.checked)} aria-label="马动画循环播放" />循环播放</label>
            <label className="horse-speed">速度<select aria-label="马动画速度" value={speed} onChange={event => setSpeed(Number(event.target.value))}>{[.25, .5, 1, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
          </div>
          <label className="horse-timeline"><span>相位</span><input aria-label="马动画相位" type="range" min="0" max="1" step=".001" disabled={!active} value={playback.phase} onChange={event => seek(Number(event.target.value))} /><output>{(playback.phase * 100).toFixed(1)}%</output></label>
          <div className="horse-time" data-testid="horse-time">{playback.time.toFixed(2)} / {playback.duration.toFixed(2)} 秒 <span>{active ? playback.finished ? '结束保持' : loop ? '原地循环 · 无场景位移' : '单次播放 · 结束保持' : '绑定姿态 · 不播放动画'}</span></div>
        </section>
      </section>
      <aside className="horse-inspector">
        <section><p className="horse-eyebrow">01 / MOTION</p><h2>基础动作</h2><div className="horse-clip-list">
          {HORSE_CLIPS.map(definition => <button key={definition.id} data-testid={definition.id} aria-pressed={clip === definition.id} onClick={() => selectClip(definition.id)}><strong>{definition.label}</strong><small>{definition.description}</small><span>{definition.duration.toFixed(1)} s</span></button>)}
        </div><button className="horse-bind-button" data-testid="horse-bind" aria-pressed={clip === 'bind'} onClick={() => selectClip('bind')}>查看静态绑定姿态</button></section>
        <section><p className="horse-eyebrow">02 / INSPECTION</p><h2>模型审查</h2>
          <div className="horse-display-options">{([['beauty', '色块'], ['clay', '素模'], ['wire', '线框']] as [HorseDisplay, string][]).map(([id, label]) => <button key={id} data-testid={'horse-display-' + id} aria-pressed={display === id} onClick={() => setDisplay(id)}>{label}</button>)}</div>
          <div className="horse-toggles"><label><input type="checkbox" checked={skeleton} onChange={event => setSkeleton(event.target.checked)} aria-label="马骨架" />骨架</label><label><input type="checkbox" checked={grid} onChange={event => setGrid(event.target.checked)} aria-label="马参考网格" />参考网格</label></div>
          <dl><div><dt>逻辑顶点</dt><dd>{stats?.logicalVertices ?? '—'}</dd></div><div><dt>三角形</dt><dd>{stats?.triangles ?? '—'}</dd></div><div><dt>骨骼 / 每点权重</dt><dd>{stats?.bones ?? '—'} / ≤ 2</dd></div><div><dt>单位 / 朝向</dt><dd>米 / +Z 前</dd></div></dl>
        </section>
        <section className="horse-boundary"><p className="horse-eyebrow">本轮验收范围</p><p>只看马的轮廓、蒙皮和四个基础动作。没有人物骑乘、马具、实时 IK 或地形适配。</p><p>这是低模原地动画实验；蹄部可能存在有限滑动，不能视作完整移动系统。</p></section>
      </aside>
    </div>
  </main>;
}
