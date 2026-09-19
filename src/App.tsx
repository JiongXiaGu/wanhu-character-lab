import { useState, useCallback } from 'react';
import './labor.css';
import { ACTIONS, WORK_IDS, isWorkId, type WorkSelection } from './character/actions/catalog';
import { CharacterViewport, type Stats, type View, type Display, type PlaybackStatus } from './scene/CharacterViewport';
import { DEFAULT_RECIPE, PRESET_IDS, applyPreset, cleanRecipe, patchSlots, type Recipe, type Motion, type Outfit, type CharacterSlots } from './character/v3/types';
import { MOTION_LABELS } from './character/v3/rig';

const PRESETS: { id:Outfit; name:string; desc:string; glyph:string }[] = [
  { id:'farmer', name:'农户', desc:'短衣 · 草帽 · 布鞋', glyph:'农' },
  { id:'guard', name:'卫兵', desc:'轻甲 · 头盔 · 剑盾', glyph:'卫' },
  { id:'archer', name:'弓手', desc:'短衣 · 箭袋 · 弓', glyph:'弓' },
  { id:'body', name:'基础人体', desc:'连续拓扑 · 无装扮', glyph:'体' },
];
const SLOT_OPTIONS: { [K in keyof CharacterSlots]:readonly { id:CharacterSlots[K]; name:string }[] } = {
  headwear:[{ id:'none',name:'无头饰' },{ id:'farmer_straw_hat',name:'农户草帽' },{ id:'guard_helmet',name:'卫兵轻盔' },{ id:'archer_headband',name:'弓手头巾' }],
  top:[{ id:'body',name:'无上衣' },{ id:'farmer_tunic',name:'农户短衣' },{ id:'guard_light_armor',name:'卫兵轻甲' },{ id:'archer_tunic',name:'弓手短衣' }],
  bottom:[{ id:'body',name:'无下装' },{ id:'work_pants',name:'劳动布裤' },{ id:'guard_pants',name:'卫兵裤' },{ id:'archer_pants',name:'弓手裤' }],
  shoes:[{ id:'body',name:'无鞋' },{ id:'cloth_shoes',name:'布鞋' },{ id:'boots',name:'短靴' }],
  back:[{ id:'none',name:'无背部装备' },{ id:'archer_quiver',name:'箭袋' }],
  leftHand:[{ id:'none',name:'左手空' },{ id:'guard_shield',name:'盾牌' },{ id:'archer_bow',name:'短弓' }],
  rightHand:[{ id:'none',name:'右手空' },{ id:'farmer_hoe',name:'锄头' },{ id:'guard_sword',name:'短剑' }],
};
const qs = new URLSearchParams(location.search);
function enumQuery<T extends string>(key:string, allowed:readonly T[], fallback:T):T {
  const value = qs.get(key) as T | null; return value && allowed.includes(value) ? value : fallback;
}
const initialPhase = () => { const n = Number(qs.get('phase') ?? 0); return Number.isFinite(n) ? Math.max(0,Math.min(1,n)) : 0; };
function initialRecipe():Recipe {
  const outfit = enumQuery('outfit',PRESET_IDS,'farmer'), equipment = qs.get('equipment');
  let recipe = cleanRecipe({ outfit,height:DEFAULT_RECIPE.height,build:DEFAULT_RECIPE.build,palette:DEFAULT_RECIPE.palette,hat:qs.get('hat') === '0' ? false : undefined,equipment:equipment === '0' ? false : equipment === '1' ? true : undefined });
  const slotPatch: Partial<CharacterSlots> = {};
  for (const key of Object.keys(SLOT_OPTIONS) as (keyof CharacterSlots)[]) {
    const value = qs.get(key); if (value) (slotPatch as Record<string,string>)[key] = value;
  }
  if (Object.keys(slotPatch).length) recipe = cleanRecipe({ ...recipe,preset:'custom',slots:{ ...recipe.slots,...slotPatch } });
  return recipe;
}
function exportRecipe(recipe:Recipe) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(recipe,null,2)],{ type:'application/json' }));
  const link = document.createElement('a'); link.href=url; link.download='wanhu-character-recipe.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
interface SlotSelectProps<K extends keyof CharacterSlots> { slot:K; label:string; recipe:Recipe; onChange:(slot:K,value:CharacterSlots[K])=>void }
function SlotSelect<K extends keyof CharacterSlots>({ slot,label,recipe,onChange }:SlotSelectProps<K>) {
  return <label className="slot-row"><span>{label}</span><select aria-label={label} value={recipe.slots[slot]} onChange={e => onChange(slot,e.target.value as CharacterSlots[K])}>{SLOT_OPTIONS[slot].map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>;
}

export default function App() {
  const [workAction,setWorkAction] = useState<WorkSelection>(() => isWorkId(qs.get('action')) ? qs.get('action') as WorkSelection : 'none');
  const [restart,setRestart] = useState(0), [contacts,setContacts] = useState(false);
  const [playback,setPlayback] = useState<PlaybackStatus>({ work:'none',phase:initialPhase(),stage:'',finished:false,eventCount:0,lastEvent:'—',propTriangles:0,maxGripError:0 });
  const [recipe,setRecipe] = useState<Recipe>(initialRecipe);
  const [motion,setMotion] = useState<Motion>(enumQuery('motion',['idle','walk','run','wave','squat','bind'] as const,'idle'));
  const [playing,setPlaying] = useState(!qs.has('paused')), [speed,setSpeed] = useState(1), [phase,setPhase] = useState(initialPhase);
  const [view,setView] = useState<View>(enumQuery('view',['free','front','side','back','top','three'] as const,'free'));
  const [viewRevision,setViewRevision] = useState(0), [orthographic,setOrthographic] = useState(true);
  const [display,setDisplay] = useState<Display>(enumQuery('display',['beauty','cage','triangles','clay'] as const,'beauty'));
  const [skeleton,setSkeleton] = useState(false), [grid,setGrid] = useState(false), [error,setError] = useState(''), [stats,setStats] = useState<Stats|null>(null);
  const updatePlayback = useCallback((value:PlaybackStatus) => { setPlayback(value); if (value.finished) setPlaying(false); },[]);
  const selectAction = (id:WorkSelection) => { setWorkAction(id); setPhase(0); setPlaying(true); setRestart(n => n+1); };
  const replay = () => { setPhase(0); setRestart(n => n+1); setPlaying(true); };
  const activeAction = workAction === 'none' ? null : ACTIONS[workAction];
  const patch = (value:Partial<Recipe>) => setRecipe(current => cleanRecipe({ ...current,...value }));
  const patchSlot = <K extends keyof CharacterSlots>(slot:K,value:CharacterSlots[K]) => setRecipe(current => patchSlots(current,{ [slot]:value } as Partial<CharacterSlots>));
  const selectView = (value:View) => { setView(value); setViewRevision(n => n+1); };
  const selectedPreset = recipe.preset === 'custom' ? null : PRESETS.find(p => p.id === recipe.preset) ?? null;
  return <main className={'studio ' + (activeAction ? 'work-mode' : '')}>
    <header className="topbar"><div className="brand-mark">工</div><div><p className="eyebrow">WANHU / CHARACTER STUDIO</p><h1>万户人物工坊</h1></div><div className="header-right"><span className="status-dot"/>运行时生成 <span className="version">V3.3 · ACTIONS</span><button className="ghost" onClick={() => exportRecipe(recipe)}>导出配方 ↗</button></div></header>
    <div className="workspace">
      <aside className="sidebar">
        <section className="labor-library" aria-label="动作库">
          <div className="section-title"><h2>动作库</h2><span>PHASE 4A / {WORK_IDS.length}</span></div>
          {(['combat','labor'] as const).map(group => <div key={group} className="action-family">
            <h3>{group === 'combat' ? '射箭 · 完整流程与分段' : '搬运与生产'}</h3>
            <div className="labor-grid">{WORK_IDS.filter(id => group === 'combat' ? ACTIONS[id].family === 'combat' : ACTIONS[id].family !== 'combat').map(id => <button key={id} aria-pressed={workAction === id} className={workAction === id ? 'active' : ''} onClick={() => selectAction(id)}>{ACTIONS[id].label}</button>)}</div>
          </div>)}
          <p className="labor-hint">动作不锁职业，换帽子和衣服后仍可播放。基础动作位于预览下方。</p>
          {activeAction && <><label className="switch-row">握点检查<input aria-label="握点检查" type="checkbox" checked={contacts} onChange={e => setContacts(e.target.checked)}/></label><p className="labor-hint">绿：目标 · 金：手掌。临时预览占用 {activeAction.occupied.map(x => ({ leftHand:'左手',rightHand:'右手',back:'背部' }[x])).join('、')}；原配方不变。</p></>}
        </section>
        <div className="section-title"><h2>人物预设</h2><span>01 / PRESET</span></div>
        <div className="outfit-list">{PRESETS.map(preset => <button key={preset.id} className={'outfit ' + (recipe.preset === preset.id ? 'selected' : '')} aria-pressed={recipe.preset === preset.id} onClick={() => setRecipe(current => applyPreset(current,preset.id))}><span className={'outfit-glyph ' + preset.id}>{preset.glyph}</span><span><strong>{preset.name}</strong><small>{preset.desc}</small></span><span className="radio"/></button>)}</div>
        <div className="section-title spaced diy-heading"><div><h2>自定义装扮</h2><span className="diy-subtitle">任意混搭，同一骨架</span></div><span className={'diy-state ' + (recipe.preset === 'custom' ? 'active' : '')}>{recipe.preset === 'custom' ? 'CUSTOM' : 'PRESET'}</span></div>
        <div className="slot-grid">
          <SlotSelect slot="headwear" label="头饰" recipe={recipe} onChange={patchSlot}/><SlotSelect slot="top" label="上衣" recipe={recipe} onChange={patchSlot}/><SlotSelect slot="bottom" label="下装" recipe={recipe} onChange={patchSlot}/><SlotSelect slot="shoes" label="鞋" recipe={recipe} onChange={patchSlot}/><SlotSelect slot="back" label="背部" recipe={recipe} onChange={patchSlot}/><SlotSelect slot="leftHand" label="左手" recipe={recipe} onChange={patchSlot}/><SlotSelect slot="rightHand" label="右手" recipe={recipe} onChange={patchSlot}/>
        </div>
        <button className="clear-equipment" type="button" onClick={() => setRecipe(current => patchSlots(current,{ back:'none',leftHand:'none',rightHand:'none' }))}>清空随身装备</button>
        <div className="section-title spaced"><h2>身材与配色</h2><button className="text-button" onClick={() => patch({ height:1.76,build:.5,palette:0 })}>重置</button></div>
        <label className="slider-label">身高 <output>{recipe.height.toFixed(2)} m</output><input aria-label="身高" type="range" min="1.58" max="1.92" step=".01" value={recipe.height} onChange={e => patch({ height:+e.target.value })}/></label>
        <label className="slider-label">体格 <output>{['偏瘦','匀称','壮实'][recipe.build < .33 ? 0 : recipe.build > .66 ? 2 : 1]}</output><input aria-label="体格" type="range" min="0" max="1" step=".05" value={recipe.build} onChange={e => patch({ build:+e.target.value })}/></label>
        <div className="palette-row"><span>布料色组</span>{['黛蓝','苔绿','赭红'].map((name,index) => <button aria-label={name} title={name} key={name} className={'swatch swatch-' + index + (recipe.palette === index ? ' active' : '')} onClick={() => patch({ palette:index })}/>)}</div>
        <div className="section-title spaced"><h2>检查工具</h2><span>02 / INSPECT</span></div>
        <div className="display-grid">{([['beauty','着色'],['clay','素模'],['cage','结构布线'],['triangles','三角网格']] as [Display,string][]).map(([id,label]) => <button key={id} className={display === id ? 'active' : ''} aria-pressed={display === id} onClick={() => setDisplay(id)}>{label}</button>)}</div>
        <div className="switch-row"><label htmlFor="skeleton">骨骼叠加</label><input id="skeleton" type="checkbox" checked={skeleton} onChange={e => setSkeleton(e.target.checked)}/></div>
        <div className="switch-row"><label htmlFor="grid">地面网格</label><input id="grid" type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)}/></div>
        <div className="metrics"><div><span>人体基模</span><strong>{stats?.bodyTriangles ?? '—'} <small>tris</small></strong></div><div><span>角色面数</span><strong data-testid="triangles">{stats?.triangles ?? '—'} <small>tris</small></strong></div><div><span>骨骼 / 权重</span><strong>{stats?.bones ?? '—'} <small>/ ≤ 2</small></strong></div><div><span>渲染顶点</span><strong>{stats?.gpuVertices ?? '—'}</strong></div></div>
        <p className="build-note">Slot Recipe · 固定 20 骨骼 · GPU 蒙皮<br/>预设只是一键组合，所有槽位可继续 DIY。</p>
      </aside>
      <section className="stage" aria-label="人物预览">
        <div className="stage-heading"><p className="eyebrow">CHARACTER / {recipe.preset.toUpperCase()}</p><h2>{activeAction?.label ?? selectedPreset?.name ?? '自定义角色'}</h2><p>{activeAction ? activeAction.description : recipe.preset === 'custom' ? '职业预设已解锁，可任意混搭头饰、衣物与装备。' : '预设只是起点，修改任意槽位即可进入 DIY。'}</p></div>
        <div className="camera-bar">{([['free','自由'],['front','正面'],['side','侧面'],['back','背面'],['three','三视图']] as [View,string][]).map(([value,label]) => <button key={value} className={view === value ? 'active' : ''} onClick={() => selectView(value)}>{label}</button>)}<button disabled={view === 'three'} title="切换正交 / 透视相机" onClick={() => setOrthographic(value => !value)}>{orthographic ? '正交' : '透视'}</button><button title="保存当前预览截图" aria-label="保存截图" onClick={() => window.__WANHU_CAPTURE__?.()}>截 图</button></div>
        {error ? <div role="alert" className="error-panel">{error}<button onClick={() => location.reload()}>重新加载</button></div> : <CharacterViewport options={{ recipe,workAction,restart,contacts,motion,playing,speed,phase,view,viewRevision,orthographic,display,skeleton,grid }} onPlayback={updatePlayback} onStats={setStats} onError={setError}/>}
        {view === 'three' && <div className="three-labels"><span>FRONT / 正面</span><span>SIDE / 侧面</span><span>BACK / 背面</span></div>}
        <div className="stage-caption"><span>拖动旋转 · 右键平移 · 滚轮缩放</span><span>{activeAction ? `道具 ${playback.propTriangles} tris · 合计 ${(stats?.triangles ?? 0) + playback.propTriangles} tris · 原地动作` : '1 SKINNED MESH · SLOT-BASED RECIPE'}</span></div>
        <section className="motion-panel">
          <div className="motion-head"><span className="eyebrow">MOTION LAB</span><div className="speed"><label htmlFor="speed">速度</label><select id="speed" value={speed} onChange={e => setSpeed(+e.target.value)}>{[.25,.5,1,1.5,2].map(value => <option key={value} value={value}>{value}×</option>)}</select></div></div>
          <div className="motion-actions">{(Object.keys(MOTION_LABELS) as Motion[]).map(value => <button className={!activeAction && motion === value ? 'active' : ''} key={value} onClick={() => { setWorkAction('none'); setMotion(value); setPhase(0); }}>{MOTION_LABELS[value]}</button>)}<button className="play-button" aria-label={playing ? '暂停' : '播放'} onClick={() => playback.finished ? replay() : setPlaying(value => !value)}>{playing ? 'Ⅱ 暂停' : '▶ 播放'}</button></div>
          {activeAction && <div className="work-status" data-testid="work-status"><span><b>{playback.stage}</b> · {activeAction.playback === 'hold' ? '持续保持，不触发放箭' : activeAction.loop ? '循环动作' : '单次动作，完成后保持'}</span><span data-testid="action-event">{playback.lastEvent} / {playback.eventCount}</span><button onClick={replay}>重播动作</button></div>}
          <label className="timeline"><span>逐帧审查</span><input aria-label="动画进度" type="range" min="0" max={activeAction && !activeAction.loop ? '1' : '.999'} step=".001" value={playback.phase} onChange={e => { const next=+e.target.value; setPlaying(false); setPhase(next); setPlayback(current => ({ ...current,phase:next })); }}/><output>{Math.round(playback.phase*100)}%</output></label>
        </section>
      </section>
    </div>
  </main>;
}
