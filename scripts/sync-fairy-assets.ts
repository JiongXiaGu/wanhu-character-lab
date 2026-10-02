import {canonicalAuthoredNormal} from '../src/character/v3/authored-normals';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {shapePoint,makeJoints} from '../src/character/v3/body';
import {createRecipe,type Vec3} from '../src/character/v3/types';

// 只发布约定的两件仙裙；网页运行时不读取Blend，不增加通用外部Mesh导入器。
const args=process.argv.slice(2),option=(key:string,fallback:string)=>{const at=args.indexOf(key);return at<0?fallback:args[at+1];};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sourcePackage=option('--source-package','D:/Works/Unity/JiongXiaXia.WanHu/Packages/com.jiongxiaxia.wanhu-character-animal-content');
const blender=option('--blender','D:/Program Files/Blender Foundation/Blender 5.2/blender.exe');
const temporary=mkdtempSync(join(tmpdir(),'wanhu-fairy-web-'));
try {
 const rawPath=option('--input',join(temporary,'raw.json'));
 const jacketSource=option('--jacket-source','');
 if(!args.includes('--input')){
  const result=spawnSync(blender,['--background','--factory-startup','--python-exit-code','1','--python',join(sourcePackage,'Tools/export-fairy-web.py'),'--','--output',rawPath,...(jacketSource?['--jacket-source',jacketSource]:[])],{encoding:'utf8'});
  if(result.status!==0)throw new Error('Blender发布失败：'+result.stderr+result.stdout);
 }
 const raw=JSON.parse(readFileSync(rawPath,'utf8'));
 assert.equal(raw.version,1);assert.equal(raw.coordinateSpace,'female-bind-y-up');
 const female=createRecipe({bodyType:'female'}),joints=makeJoints(female);
 const invert=(point:Vec3):Vec3=>{
  const y=point[1]*1.76/1.66;
  const solve=(axis:0|2,target:number,x=0)=>{
   let low=-2,high=2;
   for(let n=0;n<64;n++){const mid=(low+high)/2;const sample:Vec3=axis===0?[mid,y,0]:[x,y,mid];if(shapePoint(sample,female)[axis]<target)low=mid;else high=mid;}
   return(low+high)/2;
  };
  const x=solve(0,point[0]);return[x,y,solve(2,point[2],x)];
 };
 let maxRoundtripError=0;
 for(const [index,piece] of raw.pieces.entries()){
  assert.equal(piece.id,index===0?'fairy_jacket':'fairy_long_skirt');
  assert.equal(raw.sourceMode,jacketSource?'candidate':'published');
  const source=readFileSync(index===0&&jacketSource?jacketSource:join(sourcePackage,piece.source));
  assert.equal(createHash('sha256').update(source).digest('hex'),piece.sourceSha256,'作者源在发布过程中发生变化');
  assert.equal(piece.joints.length,20);
  piece.joints.forEach((joint:{name:string;p:Vec3},i:number)=>{assert.equal(joint.name,joints[i].name);assert(Math.hypot(...joint.p.map((n,a)=>n-joints[i].p[a]))<1e-5,'网页与作者骨架绑定位置不符');});
  piece.sourceFemalePositions=piece.vertices.map((v:{p:Vec3})=>[...v.p]);
  piece.vertices.forEach((v:{p:Vec3;w:number[]})=>{v.p=invert(v.p);const actual=shapePoint(v.p,female);const expected=piece.sourceFemalePositions[piece.vertices.indexOf(v)];maxRoundtripError=Math.max(maxRoundtripError,Math.hypot(...actual.map((n,i)=>n-expected[i])));assert(v.w.length===3&&v.w[2]>=0&&v.w[2]<=1);});
  piece.faces.forEach((face:{v:number[];normals?:Vec3[];sourceFemaleNormals?:Vec3[]})=>{
   if(!face.normals)return;
   assert.equal(face.normals.length,face.v.length);
   face.sourceFemaleNormals=face.normals.map(normal=>[...normal]);
   face.normals=face.normals.map((normal,i)=>canonicalAuthoredNormal(normal,piece.vertices[face.v[i]].p,female));
  });
  assert.equal(piece.faces.reduce((n:number,f:{v:number[]})=>n+f.v.length-2,0),piece.triangles);
 }
 assert(maxRoundtripError<1e-9,'女体型坐标回导不一致');
 const hex=(rgb:number[])=>'#'+rgb.slice(0,3).map(n=>Math.round(255*(n<=.0031308?12.92*n:1.055*Math.pow(n,1/2.4)-.055)).toString(16).padStart(2,'0')).join('');
 raw.defaultDyes={primary:hex(raw.pieces[0].palette['8']),secondary:hex(raw.pieces[1].palette['8']),accent:hex(raw.pieces[1].palette['10'])};
 raw.coordinateSpace='web-canonical';raw.maxFemaleRoundtripError=maxRoundtripError;
 raw.shapeSourceSha256=createHash('sha256').update(readFileSync(join(root,'src/character/v3/proportions.ts'))).digest('hex');
 const destination=join(root,'src/character/wardrobe/assets/published/fairy.generated.json');
 mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,JSON.stringify(raw,null,2)+String.fromCharCode(10),'utf8');
 console.log('FAIRY_WEB_SYNC',JSON.stringify({sourceMode:raw.sourceMode,pieces:raw.pieces.map((p:{id:string;triangles:number})=>({id:p.id,triangles:p.triangles})),maxRoundtripError}));
}finally{rmSync(temporary,{recursive:true,force:true});}
