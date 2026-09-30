// Temporary exact-byte transfer. Creates only content blobs; no tree/ref/settings writes.
// The connected GitHub tool with repository/workflow scope creates the actual commit.
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
async function api(path,body){
 const r=await fetch(`https://api.github.com/repos/${repo}/${path}`,{method:'POST',headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw new Error(`GitHub ${path}: ${r.status} ${await r.text()}`);return r.json();
}
for(const f of payload.files){
 assert(!f.path.includes('..')&&!f.path.startsWith('/'));
 let bytes;
 if(f.base){
  bytes=readFileSync(f.path);assert.equal(blob(bytes),f.base,`Concurrent source change: ${f.path}`);
  for(const [start,end,text] of [...f.edits].reverse())bytes=Buffer.concat([bytes.subarray(0,start),Buffer.from(text),bytes.subarray(end)]);
 }else{assert(!existsSync(f.path),`New asset already exists: ${f.path}`);bytes=Buffer.from(f.content);}
 assert.equal(blob(bytes),f.sha,`Transfer corruption: ${f.path}`);
 const stored=await api('git/blobs',{content:bytes.toString('utf8'),encoding:'utf-8'});assert.equal(stored.sha,f.sha);
 tree.push({path:f.path,mode:'100644',type:'blob',sha:stored.sha});
}
tree.push({path:'.github/workflows/build.yml',mode:'100644',type:'blob',sha:payload.build});
for(const path of [...parts,'scripts/.c2-transfer.mjs'])tree.push({path,mode:'100644',type:'blob',sha:null});
mkdirSync('c2-transfer-result',{recursive:true});
writeFileSync('c2-transfer-result/candidate.json',JSON.stringify({parent:head,treeElements:tree,checks:'NO branch update or candidate checks performed; use connected GitHub tool to create tree/commit and fast-forward PR'},null,2));
console.log('C2 content blobs transferred and verified; no tree/ref updated');
