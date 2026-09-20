import {mkdirSync,readdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {registerMixamo} from './lib/register-mixamo';
const entries=registerMixamo();
// 生成目录后才加载提取器；避免读取旧模块快照。
const {extractMixamo}=await import('./lib/mixamo-fbx');
const directory=resolve('public/mixamo');mkdirSync(directory,{recursive:true});
const expected=new Set(entries.map(e=>e.id+'.json'));expected.add('inventory.json');
for(const name of readdirSync(directory))if(name.endsWith('.json')&&!expected.has(name))rmSync(resolve(directory,name));
const inventory=[],failures:string[]=[];
for(const def of entries){
 try{
  const sha=createHash('sha256').update(readFileSync(resolve('动画参考',def.filename))).digest('hex');
  const path=resolve(directory,def.id+'.json');let data;
  if(existsSync(path)){try{const cached=JSON.parse(readFileSync(path,'utf8'));if(cached.source?.sha256===sha&&cached.source?.extractorVersion==='v2-catalog')data=cached;}catch{/* 损坏缓存重新提取。 */}}
  if(!data){data=extractMixamo(def.id);data.source.extractorVersion='v2-catalog';writeFileSync(path,JSON.stringify(data));}
  inventory.push({...def,duration:data.duration,frames:data.times.length,bytes:Buffer.byteLength(JSON.stringify(data)),...data.source});
  console.log(`MIXAMO ${def.id}: ${data.times.length} frames / ${data.duration.toFixed(3)}s / ${def.filename}`);
 }catch(error){failures.push(def.filename+': '+String(error));console.error(failures.at(-1));}
}
writeFileSync(resolve(directory,'inventory.json'),JSON.stringify({schema:'wanhu-motion-inventory-v2',totalFiles:entries.length,prepared:inventory.length,clips:inventory,failures},null,2));
if(failures.length)throw new Error(`${failures.length} FBX 提取失败，详见 inventory.json。未忽略任何文件。`);
console.log(`Prepared all ${inventory.length} FBX clips; source meshes/textures excluded.`);
