import { useCallback, useState } from 'react';
import { createRecipe, patchSlots, type Recipe, type CharacterSlots } from '../character/v3/types';
import { SLOT_OPTIONS } from '../character/wardrobe/catalog';
import type { HorseDisplay, HorseView } from '../horse/types';
import { HORSE_FPS } from '../horse/animation';
import { WorkspaceSwitcher } from '../ui/WorkspaceSwitcher';
import { AnimalModeSwitcher } from '../ui/AnimalModeSwitcher';
import { RidingViewport } from './RidingViewport';
import { RiderWardrobe } from './RiderWardrobe';
import { RIDING_CLIPS, isRidingSelection, ridingDefinition, type RidingPlayback, type RidingSelection, type RidingStats } from './types';
import '../horse/horse.css';
import './riding.css';

const query = new URLSearchParams(location.search);
const views: [HorseView, string][] = [['front', '正面'], ['left', '左侧'], ['right', '右侧'], ['back', '背面'], ['three', '前侧 ¾'], ['rear-three', '后侧 ¾']];
const validPhase = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
function initialRecipe(): Recipe {
  let recipe = createRecipe({ bodyType: query.get('bodyType') === 'female' ? 'female' : 'male' });
  for (const key of ['top', 'bottom', 'headwear', 'shoes'] as const) {
    const value = query.get(key);
    if (value && SLOT_OPTIONS[key].some(option => option.id === value)) recipe = patchSlots(recipe, { [key]: value } as Partial<CharacterSlots>);
  }
  return recipe;
}
export default function RidingLab() {
  const initial = query.get('clip');
  const [clip, setClip] = useState<RidingSelection>(isRidingSelection(initial) ? initial : 'Rider_Idle');
  const [recipe, setRecipe] = useState<Recipe>(initialRecipe);
  const [playing, setPlaying] = useState(!query.has('paused') && initial !== 'pose');
  const [phase, setPhase] = useState(validPhase(Number(query.get('phase') ?? 0))), [seekRevision, setSeekRevision] = useState(0);
  const [speed, setSpeed] = useState(1), [loop, setLoop] = useState(true);
  const [view, setView] = useState<HorseView>(views.some(([id]) => id === query.get('view')) ? query.get('view') as HorseView : 'three');
  const [viewRevision, setViewRevision] = useState(0), [orthographic, setOrthographic] = useState(true), [display, setDisplay] = useState<HorseDisplay>('beauty');
  const [riderSkeleton, setRiderSkeleton] = useState(false), [horseSkeleton, setHorseSkeleton] = useState(false), [seat, setSeat] = useState(false), [grid, setGrid] = useState(false);
  const [stats, setStats] = useState<RidingStats | null>(null), [error, setError] = useState('');
  const [playback, setPlayback] = useState<RidingPlayback>({ clip, phase, horsePhase: phase, riderPhase: phase, time: 0, duration: 0, loop: true, finished: false });
  const report = useCallback((value: RidingPlayback) => { setPlayback(value); if (value.finished) setPlaying(false); }, []);
  const active = clip === 'pose' ? null : ridingDefinition(clip);
  const selectClip = (next: RidingSelection) => { setClip(next); setPhase(0); setSeekRevision(value => value + 1); setPlaying(next !== 'pose'); };
  const seek = (next: number) => { setPlaying(false); setPhase(validPhase(next)); setSeekRevision(value => value + 1); };
  const replay = () => { setPhase(0); setSeekRevision(value => value + 1); setPlaying(clip !== 'pose'); };
  return <main className="horse-lab riding-lab">
    <header className="horse-topbar"><div><p>WANHU / RIDING STUDY</p><h1>骑乘试衣 <span>Riding Lab</span></h1></div><WorkspaceSwitcher active="animal"/><span className="horse-phase-tag">PHASE M2 · 人与马</span></header>
    <div className="horse-workspace">
      <section className="horse-stage" aria-label="骑乘预览">
        <div className="horse-stage-title"><div><p>RIDER / SHARED PHASE</p><h2>人与马</h2><span className="horse-stage-motion">{recipe.bodyType === 'female' ? '女性' : '男性'}骑手 · {active?.label ?? '静态骑姿'}</span></div></div>
        <nav className="horse-cameras" data-testid="riding-cameras" aria-label="骑乘相机">{views.map(([id, label]) => <button key={id} data-testid={'riding-view-' + id} aria-pressed={view === id} onClick={() => { setView(id); setViewRevision(value => value + 1); }}>{label}</button>)}<button data-testid="riding-projection" onClick={() => setOrthographic(value => !value)}>{orthographic ? '正交' : '透视'}</button></nav>
        {error ? <div role="alert" className="horse-error">{error}<button onClick={() => location.reload()}>重新载入</button></div> : <RidingViewport
          options={{ recipe, clip, playing, speed, phase, seekRevision, loop, view, viewRevision, orthographic, display, riderSkeleton, horseSkeleton, seat, grid }} onStats={setStats} onPlayback={report} onError={setError}/>}
        <div className="horse-stage-caption"><span>拖动旋转 · 滚轮缩放 · 马背自动跟随</span><span data-testid="riding-stats">人物 {stats?.rider.triangles ?? '—'} tris / {stats?.rider.bones ?? '—'} 骨骼 · 马 {stats?.horse.triangles ?? '—'} tris / {stats?.horse.bones ?? '—'} 骨骼</span></div>
        <section className="horse-transport" aria-label="骑乘播放控制">
          <div className="horse-transport-row">
            <button data-testid="riding-play" disabled={!active} onClick={() => playback.finished ? replay() : setPlaying(value => !value)}>{playing ? 'Ⅱ 暂停' : '▶ 播放'}</button>
            <button data-testid="riding-replay" disabled={!active} onClick={replay}>重播</button>
            <button data-testid="riding-previous" disabled={!active} onClick={() => seek(playback.phase - 1 / (HORSE_FPS * (playback.duration || 1)))}>上一帧</button>
            <button data-testid="riding-next" disabled={!active} onClick={() => seek(playback.phase + 1 / (HORSE_FPS * (playback.duration || 1)))}>下一帧</button>
            <label className="horse-loop"><input aria-label="骑乘循环播放" type="checkbox" checked={loop} onChange={event => setLoop(event.target.checked)}/>循环播放</label>
            <label className="horse-speed">速度<select aria-label="骑乘速度" value={speed} onChange={event => setSpeed(Number(event.target.value))}>{[.25, .5, 1, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
          </div>
          <label className="horse-timeline"><span>相位</span><input aria-label="骑乘相位" type="range" min="0" max="1" step=".001" disabled={!active} value={playback.phase} onChange={event => seek(Number(event.target.value))}/><output>{(playback.phase * 100).toFixed(1)}%</output></label>
          <div className="horse-time" data-testid="riding-time">{playback.time.toFixed(2)} / {playback.duration.toFixed(2)} 秒<span>{!active ? '静态跨坐 · 不是站立绑定姿态' : playback.finished ? '结束保持 · 人与马同步' : loop ? '同步循环 · 无场景位移' : '单次播放 · 结束保持'}</span></div>
        </section>
      </section>
      <aside className="horse-inspector riding-inspector">
        <AnimalModeSwitcher active="riding"/><RiderWardrobe recipe={recipe} setRecipe={setRecipe}/>
        <section><p className="horse-eyebrow">02 / MOTION</p><h2>骑乘动作</h2><div className="horse-clip-list">{RIDING_CLIPS.map(definition => <button key={definition.id} data-testid={definition.id} aria-pressed={clip === definition.id} onClick={() => selectClip(definition.id)}><strong>{definition.label}</strong><small>{definition.description}</small><span>{ridingDefinition(definition.id).duration.toFixed(1)} s</span></button>)}</div><button className="horse-bind-button" data-testid="riding-pose" aria-pressed={clip === 'pose'} onClick={() => selectClip('pose')}>查看静态骑姿</button></section>
        <section><p className="horse-eyebrow">03 / INSPECTION</p><h2>结构检查</h2><div className="horse-display-options">{([['beauty', '色块'], ['clay', '素模'], ['wire', '线框']] as [HorseDisplay, string][]).map(([id, label]) => <button key={id} aria-pressed={display === id} onClick={() => setDisplay(id)}>{label}</button>)}</div>
          <div className="riding-checks"><label><input type="checkbox" aria-label="骑手骨架" checked={riderSkeleton} onChange={event => setRiderSkeleton(event.target.checked)}/>骑手骨架</label><label><input type="checkbox" aria-label="坐骑骨架" checked={horseSkeleton} onChange={event => setHorseSkeleton(event.target.checked)}/>马骨架</label><label><input type="checkbox" aria-label="骑乘挂点" checked={seat} onChange={event => setSeat(event.target.checked)}/>骑乘挂点</label><label><input type="checkbox" aria-label="骑乘参考网格" checked={grid} onChange={event => setGrid(event.target.checked)}/>参考网格</label></div>
        </section>
        <section className="horse-boundary"><p className="horse-eyebrow">当前范围</p><p>男女共用现有V5换装。静态跨坐、停驻、步行和奔跑是骑乘候选；上身姿态为本项目烘焙轨道，不是新增的Mixamo资源。</p><p>没有上下马、马鞍缰绳、实时IK、地形适配或玩家移动。当前骑乘不包含吃草；马匹本体页面仍保留四个动作。</p></section>
      </aside>
    </div>
  </main>;
}
