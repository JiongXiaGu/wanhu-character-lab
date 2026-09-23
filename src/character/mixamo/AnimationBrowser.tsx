import {useMemo,useState} from 'react';
import {MOTION_CLIPS,type MotionSelection,type MotionSource} from '../motion/catalog';
import './animation-browser.css';

const KEY='wanhu.motion-favorites.v1';
type SourceFilter='all'|MotionSource;
const SOURCE_LABEL:Record<SourceFilter,string>={all:'全部', 'mixamo-fbx':'FBX', bvh:'BVH'};

export function AnimationBrowser({value,onSelect}:{value:MotionSelection;onSelect:(v:MotionSelection)=>void}){
 const [search,setSearch]=useState(''),[category,setCategory]=useState('全部'),[source,setSource]=useState<SourceFilter>('all'),[onlyFavorites,setOnlyFavorites]=useState(false);
 const [favorites,setFavorites]=useState<string[]>(()=>{try{const a=JSON.parse(localStorage.getItem(KEY)??'[]');return Array.isArray(a)?a.filter((v):v is string=>typeof v==='string'&&MOTION_CLIPS.some(c=>c.id===v)):[];}catch{return[];}});
 const categories=['全部',...new Set(MOTION_CLIPS.map(c=>c.category))];
 const filtered=useMemo(()=>MOTION_CLIPS.filter(c=>(source==='all'||c.source===source)&&(category==='全部'||c.category===category)&&(!onlyFavorites||favorites.includes(c.id))&&`${c.label} ${c.category} ${c.file} ${c.filename} ${c.id} ${c.source}`.toLowerCase().includes(search.trim().toLowerCase())),[search,category,source,onlyFavorites,favorites]);
 const index=filtered.findIndex(c=>c.id===value),firstBvh=MOTION_CLIPS.find(c=>c.source==='bvh');
 const toggle=(id:string)=>setFavorites(a=>{const next=a.includes(id)?a.filter(v=>v!==id):[...a,id];try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* 收藏存储不可用不影响播放。 */}return next;});
 return <section className="animation-library" aria-label="外部动作库">
  <div className="section-title"><h2>动作试衣库</h2><span data-testid="animation-count">{filtered.length} / {MOTION_CLIPS.length}</span></div>
  <input type="search" aria-label="搜索动画" placeholder="名称、分类、FBX 或 BVH 文件名" value={search} onChange={e=>setSearch(e.target.value)}/>
  <div className="animation-source-tabs" aria-label="动作来源">{(['all','mixamo-fbx','bvh'] as SourceFilter[]).map(id=><button key={id} aria-pressed={source===id} className={source===id?'active':''} onClick={()=>setSource(id)}>{SOURCE_LABEL[id]}</button>)}</div>
  <div className="animation-filters"><select aria-label="动画分类" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select><button aria-pressed={onlyFavorites} onClick={()=>setOnlyFavorites(v=>!v)}>{onlyFavorites?'已收藏':'只看收藏'}</button></div>
  <div className="animation-quick">{[['pilot-switches','坐姿'],['shooting-arrow','射箭'],['jogging','慢跑']].map(([id,label])=><button key={id} data-testid={'quick-'+id} onClick={()=>onSelect(id)}>{label}</button>)}{firstBvh&&<button data-testid="quick-bvh" onClick={()=>onSelect(firstBvh.id)}>BVH 验证</button>}</div>
  <div className="animation-list" role="list" aria-label="动画搜索结果">{filtered.map(c=><div role="listitem" key={c.id} className={c.id===value?'selected':''}><button className="animation-choice" data-testid={(c.source==='bvh'?'bvh-':'mixamo-')+c.id} aria-pressed={value===c.id} onClick={()=>onSelect(c.id)}><span className="animation-choice-title"><strong>{c.label}</strong><em className={'motion-badge '+(c.source==='bvh'?'bvh':'fbx')}>{c.source==='bvh'?'BVH':'FBX'}</em></span><small title={c.filename}>{c.category} · {c.file}</small></button><button className="animation-star" aria-label={'收藏 '+c.file} aria-pressed={favorites.includes(c.id)} onClick={()=>toggle(c.id)}>{favorites.includes(c.id)?'★':'☆'}</button></div>)}{!filtered.length&&<p className="hint">没有匹配动作。清除搜索或切换来源、分类。</p>}</div>
  <div className="animation-navigation"><button disabled={index<=0} onClick={()=>onSelect(filtered[index-1].id)}>上一个</button><button disabled={!filtered.length||index>=filtered.length-1} onClick={()=>onSelect(filtered[index+1].id)}>下一个</button><button onClick={()=>onSelect('none')}>静态试衣</button></div>
  <p className="hint">FBX 来自「动画参考」，BVH 来自「动画参考_BVH」；重启开发服务或重新构建后自动注册。来源标签只说明输入格式，不代表服装适配已通过。</p>
 </section>;
}
