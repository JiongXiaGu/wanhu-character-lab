import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
for(const path of ['src/character/actions','src/character/v3/actions.ts','scripts/check-actions.ts','scripts/review-actions.ts','src/labor.css','src/character/bvh','scripts/lib/bvh.ts','scripts/prepare-bvh.ts','scripts/check-bvh.ts','Documentation/BVH动作接入.md'])
 assert(!existsSync(path),`Retired path was restored: ${path}`);
function files(path:string):string[]{return readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(path,entry.name)):[join(path,entry.name)]);}
for(const file of files('src')){const source=readFileSync(file,'utf8');assert(!/MOTION_LABELS|makeClips|setMotion|createWorkPlayer|WorkStatus|workAction|character\/actions/.test(source),`${file}: procedural dependency remains`);assert(!/['"]bvh['"]|character\/bvh/.test(source),`${file}: BVH runtime residue remains`);}
const pkg=JSON.parse(readFileSync('package.json','utf8'));assert(!pkg.scripts['check:actions']);assert(!pkg.scripts['review:actions']);assert(!Object.keys(pkg.scripts).some(k=>/bvh/i.test(k)));
const app=readFileSync('src/App.tsx','utf8');assert(!app.includes('程序动作对照'));assert(app.includes('绑定姿态（静态）'));assert(app.includes("review?'jogging':'none'"));assert(app.includes('[GLB]'));
console.log('PASS external motion runtime: procedural/BVH paths absent; Mixamo FBX + XR Animator GLB remain; static fitting default preserved.');
