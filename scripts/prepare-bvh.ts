import {mkdirSync,readdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {basename,join,resolve} from 'node:path';
import {extractBvh} from './lib/bvh';

const SOURCE='动画参考_BVH',OUT=resolve('public/bvh'),CATALOG='src/character/bvh/catalog.generated.ts';
function scan(relative=''):string[]{
  return readdirSync(join(SOURCE,relative),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?scan(join(relative,entry.name)):/\.bvh$/i.test(entry.name)?[join(relative,entry.name).replaceAll('\\','/')]:[]).sort();
}
function entry(filename:string){
  const stem=basename(filename).replace(/\.bvh$/i,''),ascii=stem.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),hash=createHash('sha256').update(filename).digest('hex').slice(0,8);
  return {id:`bvh-${ascii||'motion'}-${hash}`,label:stem.replaceAll('_',' ').trim(),file:stem,filename,category:'BVH验证',loop:false,ground:true,source:'bvh' as const};
}
const entries=scan().map(entry);
mkdirSync(OUT,{recursive:true});
const expected=new Set(entries.map(e=>e.id+'.json'));expected.add('inventory.json');
for(const name of readdirSync(OUT))if(name.endsWith('.json')&&!expected.has(name))rmSync(resolve(OUT,name));
const inventory=[],failures:string[]=[];
for(const def of entries){
  try{
    const source=readFileSync(resolve(SOURCE,def.filename),'utf8'),sha=createHash('sha256').update(source).digest('hex'),path=resolve(OUT,def.id+'.json');
    let data;
    if(existsSync(path)){try{const cached=JSON.parse(readFileSync(path,'utf8'));if(cached.source?.sha256===sha&&cached.source?.extractorVersion==='v1-bvh-humanoid')data=cached;}catch{/* 损坏缓存重新提取。 */}}
    if(!data){data=extractBvh(def.id,def.filename,SOURCE);writeFileSync(path,JSON.stringify(data));}
    inventory.push({...def,duration:data.duration,frames:data.times.length,fps:data.fps,bytes:Buffer.byteLength(JSON.stringify(data)),headCorrection:data.source.headCorrection});
    console.log(`BVH ${def.id}: ${data.times.length} frames / ${data.duration.toFixed(3)}s / ${def.filename}`);
  }catch(error){failures.push(def.filename+': '+String(error));console.error(failures.at(-1));}
}
writeFileSync(CATALOG,'/** 自动生成；勿手写。来源：动画参考_BVH/。 */\nexport const GENERATED_BVH_CLIPS='+JSON.stringify(entries,null,2)+' as const;\n');
writeFileSync(resolve(OUT,'inventory.json'),JSON.stringify({schema:'wanhu-bvh-inventory-v1',totalFiles:entries.length,prepared:inventory.length,clips:inventory,failures},null,2));
if(failures.length)throw new Error(`${failures.length} BVH 提取失败，详见 public/bvh/inventory.json。`);
console.log(`Prepared all ${inventory.length} BVH clips.`);
