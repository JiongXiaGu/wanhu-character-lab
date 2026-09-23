import { useCallback, useState } from 'react';
import { WorkspaceSwitcher } from '../ui/WorkspaceSwitcher';
import { AnimalModeSwitcher } from '../ui/AnimalModeSwitcher';
import { isMountId } from '../mounts/catalog';
import { isSaddleId } from '../horse/saddles/catalog';
import { LIVESTOCK } from './catalog';
import { CROWD_COUNTS } from './types';
import type { CrowdCount, LabOptions, LabStats, LivestockLodMode, LivestockView, Playback } from './types';
import { clampPhase, readLivestockSession, saveLivestockSession } from './session';
import { LivestockViewport } from './LivestockViewport';
import '../horse/horse.css';
import './livestock.css';

const query = new URLSearchParams(location.search), resumed = readLivestockSession(query);
const views: [LivestockView, string][] = [['three', '前侧 ¾'], ['front', '正面'], ['left', '侧面'], ['farm', '经营俯视']];
const rawMount = query.get('mount'), rawSaddle = query.get('saddle');
const mountId = isMountId(rawMount) ? rawMount : 'horse_chestnut', saddleId = isSaddleId(rawSaddle) ? rawSaddle : 'none';
const lodModes: [LivestockLodMode, string][] = [['auto', '自动'], ['lod0', 'LOD0'], ['lod1', 'LOD1'], ['lod2', 'LOD2']];

export default function LivestockLab() {
  const [options, setOptions] = useState<LabOptions>(resumed.options), [stats, setStats] = useState<LabStats | null>(null);
  const [playback, setPlayback] = useState<Playback>({ phase: options.phase, time: 0, duration: 3, finished: false }), [error, setError] = useState('');
  const definition = LIVESTOCK[0], mixed = options.count > 1 && options.mixed, active = definition.motions.find(m => m.id === options.motion)!;
  const report = useCallback((s: LabStats, p: Playback) => {
    setStats(s); setPlayback(p); if (p.finished) setOptions(value => value.playing ? { ...value, playing: false } : value);
  }, []);
  const chooseMotion = (motion: string) => setOptions(value => ({ ...value, motion, mixed: false, playing: true, phase: 0, seekRevision: value.seekRevision + 1 }));
  const chooseCount = (count: CrowdCount) => setOptions(value => ({ ...value, count, mixed: count > 1 && value.count === 1 ? true : value.mixed, view: count > 1 ? 'farm' : 'three', viewRevision: value.viewRevision + 1 }));
  const seek = (phase: number) => {
    const target = clampPhase(phase);
    // 受控滑杆必须在同一输入事件中确认值，不能等下一帧报告再恢复到旧值。
    setPlayback(value => ({ ...value, phase: target, time: target * value.duration, finished: !options.loop && target >= 1 }));
    setOptions(value => ({ ...value, playing: false, phase: target, seekRevision: value.seekRevision + 1 }));
  };
  const replay = () => setOptions(value => ({ ...value, playing: true, phase: 0, seekRevision: value.seekRevision + 1 }));
  const save = () => saveLivestockSession(options, playback.phase, window.__LIVESTOCK_REVIEW__?.camera());
  return <main className="horse-lab livestock-lab">
    <header className="horse-topbar"><div><p>WANHU / LIVESTOCK STUDY</p><h1>家畜工坊 <span>Livestock Lab</span></h1></div><WorkspaceSwitcher active="animal"/><span className="horse-phase-tag">L2 · 三档 LOD</span></header>
    <div className="horse-workspace">
      <section className="horse-stage" aria-label="家畜模型与群体预览">
        <div className="horse-stage-title"><p>SMALL ANIMAL / LARGE SCENE</p><h2>{definition.name}</h2><span className="horse-stage-motion">{options.count === 1 ? '单只检查' : `${options.count} 只群体预览`} · {mixed ? '日常混合' : active.label}{stats ? ` · ${stats.lod.toUpperCase()}` : ''}</span></div>
        <nav className="horse-cameras" aria-label="家畜相机">{views.map(([view, label]) => <button key={view} data-testid={`livestock-view-${view}`} aria-pressed={options.view === view} onClick={() => setOptions(value => ({ ...value, view, viewRevision: value.viewRevision + 1 }))}>{label}</button>)}<button onClick={() => setOptions(value => ({ ...value, viewRevision: value.viewRevision + 1 }))}>适配画面</button></nav>
        {error ? <div className="horse-error" role="alert">{error}<button onClick={() => location.reload()}>重新载入</button></div> : <LivestockViewport options={options} camera={resumed.camera} onReport={report} onError={setError}/>}
        <div className="horse-stage-caption"><span>拖动旋转 · 滚轮缩放 · 正交相机</span><span data-testid="livestock-stats">{stats ? `${stats.lod.toUpperCase()} · ${stats.triangles} tris / 只 · ${stats.logicalVertices} 逻辑点 · 约 ${stats.pixelHeight.toFixed(0)} px 高` : '正在生成模型…'}</span></div>
        <section className="horse-transport" aria-label="家畜动画控制">
          <div className="horse-transport-row"><button className="livestock-play" data-testid="livestock-play" onClick={() => playback.finished ? replay() : setOptions(value => ({ ...value, playing: !value.playing }))}>{options.playing ? 'Ⅱ 暂停' : '▶ 播放'}</button><button onClick={replay}>重播</button>
            <button aria-label="家畜上一帧" onClick={() => seek(playback.phase - 1 / (30 * playback.duration))}>上一帧</button><button aria-label="家畜下一帧" onClick={() => seek(playback.phase + 1 / (30 * playback.duration))}>下一帧</button>
            <label className="horse-loop"><input aria-label="家畜循环播放" type="checkbox" checked={options.loop} onChange={event => setOptions(value => ({ ...value, loop: event.target.checked }))}/>循环播放</label>
            <label className="horse-speed">速度<select aria-label="家畜播放速度" value={options.speed} onChange={event => setOptions(value => ({ ...value, speed: Number(event.target.value) }))}>{[.25, .5, 1, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
          </div>
          <label className="horse-timeline"><span>{mixed ? '观察时间' : '动作相位'}</span><input aria-label="家畜动画相位" type="range" min="0" max="1" step=".001" value={Number(playback.phase.toFixed(3))} onChange={event => seek(Number(event.target.value))}/><output>{(playback.phase * 100).toFixed(1)}%</output></label>
          <div className="horse-time" data-testid="livestock-time">{playback.time.toFixed(2)} / {playback.duration.toFixed(2)} 秒<span>{playback.finished ? '结束保持' : mixed ? '混合动作 · 共用观察时钟' : options.loop ? '循环播放' : '单次播放'}</span></div>
        </section>
      </section>
      <aside className="horse-inspector">
        <AnimalModeSwitcher active="livestock" mountId={mountId} saddleId={saddleId} onNavigate={save}/>
        <section className="livestock-selector"><p className="horse-eyebrow">01 / LIVESTOCK</p><h2>家畜</h2><label><span>种类</span><select aria-label="家畜种类" value={definition.id} onChange={() => {}}>{LIVESTOCK.map(value => <option key={value.id} value={value.id}>鸡 · {value.name}</option>)}</select></label><p>成年母鸡 · 不可骑乘 · 三档作者 LOD</p></section>
        <section><p className="horse-eyebrow">02 / MOTION</p><h2>基础动作</h2><div className="livestock-motions">{definition.motions.map(motion => <button key={motion.id} data-testid={`livestock-motion-${motion.id}`} aria-pressed={!mixed && options.motion === motion.id} onClick={() => chooseMotion(motion.id)}><strong>{motion.label}</strong><span>{motion.duration.toFixed(1)} s</span><small>{motion.description}</small></button>)}</div></section>
        <section><p className="horse-eyebrow">03 / CROWD</p><h2>群体预览</h2><div className="livestock-counts" aria-label="家畜数量">{CROWD_COUNTS.map(count => <button key={count} data-testid={`livestock-count-${count}`} aria-pressed={options.count === count} onClick={() => chooseCount(count)}>{count}</button>)}</div>
          <div className="livestock-crowd-controls"><label><input aria-label="家畜日常混合" type="checkbox" checked={mixed} disabled={options.count === 1} onChange={event => setOptions(value => ({ ...value, mixed: event.target.checked, phase: 0, seekRevision: value.seekRevision + 1 }))}/>日常混合</label><button data-testid="livestock-reshuffle" disabled={options.count === 1} onClick={() => setOptions(value => ({ ...value, seed: (value.seed + 1) >>> 0 }))}>重新散布</button></div>
          <p className="livestock-help">{mixed ? '停驻、行走、啄食错峰分布。点击上方动作可切换为统一检查。' : options.count > 1 ? '统一动作，循环时错开相位；关闭循环后同步检查单次动作。' : '切换数量后自动适配经营俯视。自动LOD会根据屏幕尺寸降档。'}</p>
          <div className="livestock-summary" data-testid="livestock-crowd-summary"><div><strong>{options.count}</strong><span>只</span></div><div><strong>{stats?.modelTriangles.toLocaleString() ?? '—'}</strong><span>当前模型三角形</span></div><div><strong>{stats?.batches ?? '—'}</strong><span>鸡绘制批次</span></div></div>
        </section>
        <section className="livestock-lod"><p className="horse-eyebrow">04 / LOD</p><h2>细节层级</h2>
          <div className="livestock-lod-modes">{lodModes.map(([lod, label]) => <button key={lod} data-testid={`livestock-lod-${lod}`} aria-pressed={options.lod === lod} onClick={() => setOptions(value => ({ ...value, lod }))}>{label}</button>)}</div>
          <p className="livestock-help">{options.lod === 'auto' ? `当前自动选择 ${stats?.lod.toUpperCase() ?? '—'}；≥70px 用 LOD0，26–69px 用 LOD1，更小用 LOD2。` : `固定 ${options.lod.toUpperCase()} 仅用于作者审查，不随缩放自动切换。`}</p>
          <div className="livestock-lod-budget">{definition.lods.map(lod => <div key={lod.id} data-active={stats?.lod === lod.id}><strong>{lod.label}</strong><span>{lod.triangles} tris</span><small>{lod.description}</small></div>)}</div>
        </section>
        <details className="livestock-inspection"><summary>模型审查<span>色块 / 素模 / 线框</span></summary><div className="horse-display-options">{([['beauty', '色块'], ['clay', '素模'], ['wire', '线框']] as const).map(([display, label]) => <button key={display} aria-pressed={options.display === display} onClick={() => setOptions(value => ({ ...value, display }))}>{label}</button>)}</div><div className="horse-toggles"><label><input aria-label="家畜骨架" type="checkbox" checked={options.skeleton} disabled={options.count !== 1} onChange={event => setOptions(value => ({ ...value, skeleton: event.target.checked }))}/>骨架</label><label><input aria-label="家畜参考网格" type="checkbox" checked={options.grid} onChange={event => setOptions(value => ({ ...value, grid: event.target.checked }))}/>网格</label></div><p className="livestock-help">三档共用同一 8 骨动作语义；骨架只在单只模式显示。</p></details>
        <p className="livestock-boundary">本页自动LOD按正交镜头中的屏幕高度整群切换，适合验证经营俯视预算；正式 Unity 仍应按逐实例距离/屏占比、剔除和动画降频另行实现。</p>
      </aside>
    </div>
  </main>;
}
