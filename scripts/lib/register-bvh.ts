import {createHash} from 'node:crypto';
import {existsSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

export function scanBvhFiles(root='动画参考_BVH',relative=''):string[]{
  if(!existsSync(join(root,relative)))return [];
  return readdirSync(join(root,relative),{withFileTypes:true})
    .flatMap(entry=>entry.isDirectory()?scanBvhFiles(root,join(relative,entry.name)):/\.bvh$/i.test(entry.name)?[join(relative,entry.name).replaceAll('\\','/')]:[])
    .sort((a,b)=>a.localeCompare(b,'zh-CN'));
}
function labelFor(filename:string){
  return filename.split('/').at(-1)!.replace(/\.bvh$/i,'').replaceAll('_',' ').replace(/\s+/g,' ').trim();
}
export function registerBvh(root='动画参考_BVH'){
  const files=scanBvhFiles(root);
  const entries=files.map(filename=>({
    id:'bvh-'+createHash('sha256').update(filename).digest('hex').slice(0,8),
    label:labelFor(filename),
    file:filename.split('/').at(-1)!.replace(/\.bvh$/i,''),
    filename,
    category:'BVH验证',
    loop:false,
    ground:true,
  }));
  writeFileSync('src/character/bvh/catalog.generated.ts',
    '/** 自动生成；勿手写。来源：动画参考_BVH/。 */\nexport const GENERATED_BVH_CLIPS='+JSON.stringify(entries,null,2)+' as const;\n');
  return entries;
}
