// Temporary exact-byte authoring transfer; removed from the generated candidate.
// Only creates a dangling commit. It never moves a ref, merges, or changes settings.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const repo='JiongXiaGu/wanhu-character-lab';
assert.equal(process.env.GITHUB_REPOSITORY,repo);
assert.equal(process.env.GITHUB_HEAD_REF,'c2-court-maid-high-waist-set');
const head=process.env.REVIEW_HEAD_SHA;
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),head);
const parts=Array.from({length:4},(_,i)=>`scripts/.c2-transfer-${i}.txt`);
const payload=JSON.parse(gunzipSync(Buffer.from(parts.map(p=>readFileSync(p,'utf8').trim()).join(''),'base64')).toString('utf8'));
const blob=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
const tree=[];
for(const f of payload.files){
  assert(!f.path.includes('..')&&!f.path.startsWith('/'));
  let bytes;
  if(f.base){
    bytes=readFileSync(f.path);assert.equal(blob(bytes),f.base,`Concurrent source change: ${f.path}`);
    for(const [start,end,text] of [...f.edits].reverse())bytes=Buffer.concat([bytes.subarray(0,start),Buffer.from(text),bytes.subarray(end)]);
  }else{assert(!existsSync(f.path),`New asset already exists: ${f.path}`);bytes=Buffer.from(f.content);}
  assert.equal(blob(bytes),f.sha,`Transfer corruption: ${f.path}`);
  tree.push({path:f.path,mode:'100644',type:'blob',content:bytes.toString('utf8')});
}
tree.push({path:'.github/workflows/build.yml',mode:'100644',type:'blob',sha:payload.build});
for(const path of [...parts,'scripts/.c2-transfer.mjs'])tree.push({path,mode:'100644',type:'blob',sha:null});
async function api(path,body){
  const r=await fetch(`https://api.github.com/repos/${repo}/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(!r.ok)throw new Error(`GitHub ${path}: ${r.status} ${await r.text()}`);return r.json();
}
const pr=await api('pulls/73');assert.equal(pr.head.sha,head,'PR advanced; stop instead of overwriting');
const parent=await api(`git/commits/${head}`);
const t=await api('git/trees',{base_tree:parent.tree.sha,tree});
const commit=await api('git/commits',{message:'feat(c2): author independent court maid jacket and high-waist skirt with motion and visual checks',tree:t.sha,parents:[head]});
mkdirSync('c2-transfer-result',{recursive:true});
writeFileSync('c2-transfer-result/candidate.json',JSON.stringify({parent:head,commit:commit.sha,tree:t.sha,files:payload.files.map(({path,sha})=>({path,sha})),temporaryFilesRemoved:true,buildRestored:payload.build,checks:'NOT tested by this transfer; run exact candidate checks after normal connector ref update'},null,2));
console.log(`C2 dangling candidate ${commit.sha}; no ref updated`);
