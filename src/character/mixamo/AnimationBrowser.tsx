import {useMemo,useState} from 'react';
import {MIXAMO_CLIPS,type MixamoSelection} from './catalog';
import './animation-browser.css';
const KEY='wanhu.motion-favorites.v1';
export function AnimationBrowser({value,onSelect}:{value:MixamoSelection;onSelect:(v:MixamoSelection)=>void}){
 const [search,setSearch]=useState(''),[category,setCategory]=useState('全部'),[onlyFavorites,setOnlyFavorites]=useState(false);
 const [favorites,setFavorites]=useState<string[]>(()=>{try{const a=JSON.parse(localStorage.getItem(KEY)??'[]');return Array.isArray(a)?a.filter((v):v is string=>typeof v==='string'&&MIXAMO_CLIPS.some(c=>c.id===v)):[];}catch{return[];}});
 const categories=['全部',...new Set(MIXAMO_CLIPS.map(c=>c.category))];
 const filtered=useMemo(()=>MIXAMO_CLIPS.filter(c=>(category==='全部'||c.category===category)&&(!onlyFavorites||favorites.includes(c.id))&&`${c.label} ${c.category} ${c.file} ${c.filename} ${c.id}`.toLowerCase().includes(search.trim().toLowerCase())),[search,category,onlyFavorites,favorites]);
 const index=filtered.findIndex(c=>c.id===value);
 const toggle=(id:string)=>setFavorites(a=>{const next=a.includes(id)?a.filter(v=>v!==id):[...a,id];try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* 收藏存储不可用不影响播放。 */}return next;});
 return <section className="animation-library" aria-label="FBX动画库">
  <div className="section-title"><h2>动作试衣库</h2><span data-testid="animation-count">{filtered.length} / {MIXAMO_CLIPS.length}</span></div>
  <input type="search" aria-label="搜索动画" placeholder="名称、中文分类或 FBX 文件名" value={search} onChange={e=>setSearch(e.target.value)}/>
  <div className="animation-filters"><select aria-label="动画分类" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select><button aria-pressed={onlyFavorites} onClick={()=>setOnlyFavorites(v=>!v)}>{onlyFavorites?'已收藏':'只看收藏'}</button></div>
  <div className="animation-quick">{[['pilot-switches','坐姿'],['shooting-arrow','射箭'],['jogging','慢跑']].map(([id,label])=><button key={id} data-testid={'quick-'+id} onClick={()=>onSelect(id)}>{label}</button>)}<button onClick={()=>{setCategory('劳动');setSearch('');setOnlyFavorites(false);}}>劳动动作</button></div>
  <div className="animation-list" role="list" aria-label="动画搜索结果">{filtered.map(c=><div role="listitem" key={c.id} className={c.id===value?'selected':''}><button className="animation-choice" data-testid={'mixamo-'+c.id} aria-pressed={value===c.id} onClick={()=>onSelect(c.id)}><strong>{c.label}</strong><small title={c.filename}>{c.file}</small></button><button className="animation-star" aria-label={'收藏 '+c.file} aria-pressed={favorites.includes(c.id)} onClick={()=>toggle(c.id)}>{favorites.includes(c.id)?'★':'☆'}</button></div>)}{!filtered.length&&<p className="hint">没有匹配动作。清除搜索或切换分类。</p>}</div>
  <div className="animation-navigation"><button disabled={index<=0} onClick={()=>onSelect(filtered[index-1].id)}>上一个</button><button disabled={!filtered.length||index>=filtered.length-1} onClick={()=>onSelect(filtered[index+1].id)}>下一个</button><button onClick={()=>onSelect('none')}>静态试衣</button></div>
  <p className="hint">新增 FBX 在重启开发服务或构建时自动注册。动作分类是测试索引，不代表服装适配已通过。</p>
 </section>;
}
