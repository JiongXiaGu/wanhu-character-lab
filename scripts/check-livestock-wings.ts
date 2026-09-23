import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { FrontSide, Matrix4, Vector3 } from 'three';
import { LIVESTOCK } from '../src/livestock/catalog';
import { createAnimalActor } from '../src/livestock/actor';
import type { AnimalMeshData, LivestockLodId } from '../src/livestock/types';

/** 仅WingL/R使用零厚片面契约；其它体壳继续由原检查执行闭合、连通和绕序门槛。 */
export function assertPoultryWingTopology(data: AnimalMeshData, lod: LivestockLodId): Set<number> {
  const parts = data.parts.filter(p => p.name.startsWith('Wing'));
  const vertices = new Set<number>();
  if (lod !== 'lod0') {
    assert.equal(parts.length, 0, `${lod}不能恢复独立翅块`);
    assert(!data.bones.some(b => b === 6 || b === 7), `${lod}翼区必须并入Body`);
    return vertices;
  }
  assert.deepEqual(parts.map(p => p.name).sort(), ['WingL', 'WingR']);
  for (const part of parts) {
    const side = part.name === 'WingL' ? -1 : 1;
    assert.equal(part.count, 4, '每片恰好4个逻辑点');
    const own = new Set(Array.from({ length: part.count }, (_, i) => part.start + i));
    const faces: number[][] = [];
    for (const i of own) {
      assert(!vertices.has(i)); vertices.add(i);
      assert.equal(data.bones[i], side < 0 ? 6 : 7);
      assert(data.positions[i].every(Number.isFinite));
    }
    for (let i = 0; i < data.indices.length; i += 3) {
      const tri = data.indices.slice(i, i + 3);
      if (!tri.some(v => own.has(v))) continue;
      assert(tri.every(v => own.has(v)), '翅片不能偷偷连接或豁免主体面');
      assert.equal(new Set(tri).size, 3);
      faces.push(tri);
    }
    assert.equal(faces.length, 4, '每侧2正向+2反向，共4面');
    const normals = faces.map(tri => {
      const [a,b,c] = tri.map(i => new Vector3(...data.positions[i]));
      const n = b.sub(a).cross(c.sub(a)); assert(n.lengthSq() > 1e-12, '翅片退化面');
      return n.normalize();
    });
    const outward = faces.map((_, i) => i).filter(i => normals[i].x * side > .65);
    assert.equal(outward.length, 2, '每侧必须有两张朝身体外侧的正面');
    for (const i of outward) {
      const n = normals[i];
      assert(n.x * side > Math.abs(n.y), '翅片主法线必须朝左右侧面，不能重新变成背顶片');
    }
    for (let i = 0; i < faces.length; i++) {
      const [a,b,c] = faces[i];
      const reverse = faces.findIndex(([x,y,z], j) => j !== i && ((x===a&&y===c&&z===b)||(x===c&&y===b&&z===a)||(x===b&&y===a&&z===c)));
      assert(reverse >= 0, '反面必须使用同一组位置，禁止另造厚度顶点');
      assert(normals[i].dot(normals[reverse]) < -.999999);
    }
    const uniqueEdges = new Map<string, number>();
    outward.forEach(i => {
      const tri=faces[i];
      for (let k = 0; k < 3; k++) {
        const a=tri[k], b=tri[(k+1)%3], key=`${Math.min(a,b)}/${Math.max(a,b)}`;
        uniqueEdges.set(key,(uniqueEdges.get(key)??0)+1);
      }
    });
    assert.equal([...uniqueEdges.values()].filter(n => n === 1).length, 4);
    assert.equal([...uniqueEdges.values()].filter(n => n === 2).length, 1);
  }
  const left = parts.find(p => p.name === 'WingL')!, right = parts.find(p => p.name === 'WingR')!;
  for (let i=0;i<4;i++) {
    const a=data.positions[left.start+i], b=data.positions[right.start+i];
    assert(Math.abs(a[0]+b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])<1e-9, '两侧作者翅片必须镜像');
    assert.equal(data.colors[left.start+i],data.colors[right.start+i]);
  }
  return vertices;
}

/** 从原Body三角面在YZ平面求左右最外侧X；直接验证侧面贴体，而不是再测背部高度。 */
function sideSurface(data: AnimalMeshData) {
  const main = data.parts.find(p => p.name === 'Body' || p.name === 'BodyNeckHeadBill')!;
  const faces: { a: readonly number[]; b: readonly number[]; c: readonly number[]; d: number }[] = [];
  for(let i=0;i<data.indices.length;i+=3) {
    const ids=data.indices.slice(i,i+3);
    if(!ids.every(j=>j>=main.start&&j<main.start+main.count&&data.bones[j]===1)) continue;
    const [a,b,c]=ids.map(j=>data.positions[j]);
    const d=(b[1]-c[1])*(a[2]-c[2])+(c[2]-b[2])*(a[1]-c[1]);
    if(Math.abs(d)>1e-12) faces.push({a,b,c,d});
  }
  return (side:number,y:number,z:number) => {
    let x=side>0 ? -Infinity : Infinity;
    for(const {a,b,c,d} of faces) {
      const u=((b[1]-c[1])*(z-c[2])+(c[2]-b[2])*(y-c[1]))/d;
      const v=((c[1]-a[1])*(z-c[2])+(a[2]-c[2])*(y-c[1]))/d, w=1-u-v;
      if(Math.min(u,v,w)<-1e-8) continue;
      const px=u*a[0]+v*b[0]+w*c[0];
      x=side>0 ? Math.max(x,px) : Math.min(x,px);
    }
    return x;
  };
}

const reports: object[]=[];
for(const definition of LIVESTOCK) {
  if(!['chicken_brown','duck_domestic_brown'].includes(definition.id)) continue;
  for(const lod of definition.lods) {
    const actor=createAnimalActor(definition,lod.id), data=actor.data;
    const wings=assertPoultryWingTopology(data,lod.id);
    assert.equal(actor.material.side,FrontSide); assert.equal(actor.geometry.groups.length,0);
    assert.equal(data.indices.length/3,lod.triangles); assert.equal(data.positions.length,lod.logicalVertices);
    if(lod.id!=='lod0') {
      reports.push({animal:definition.id,lod:lod.id,independentWingTriangles:0});
      actor.dispose(); continue;
    }
    const partFaces = new Map<string, number[][]>();
    for(const part of data.parts.filter(p=>p.name.startsWith('Wing'))) {
      const side=part.name==='WingL'?-1:1;
      const own=new Set(Array.from({length:part.count},(_,i)=>part.start+i));
      const faces:number[][]=[];
      for(let i=0;i<data.indices.length;i+=3) {
        const ids=data.indices.slice(i,i+3);
        if(!ids.every(j=>own.has(j))) continue;
        const [a,b,c]=ids.map(j=>new Vector3(...data.positions[j]));
        const n=b.sub(a).cross(c.sub(a)).normalize();
        if(n.x*side>.65) faces.push(ids);
      }
      assert.equal(faces.length,2);
      partFaces.set(part.name,faces);
    }
    const firstRender=new Map<number,number>();
    data.indices.forEach((j,i)=>{if(wings.has(j)&&!firstRender.has(j))firstRender.set(j,i);});
    const surface=sideSurface(data), source=actor.geometry.getAttribute('position');
    let poses=0,minClearance=Infinity,maxClearance=-Infinity,minSideNormal=Infinity;
    const maxGap=definition.id==='chicken_brown'?.007:.008;
    for(const motion of definition.motions) for(let f=0;f<=240;f++) {
      actor.sample(motion.id,f/240); poses++;
      const toBody=new Matrix4().makeTranslation(...definition.joints[1].position).multiply(actor.bones[1].matrixWorld.clone().invert());
      const points=new Map<number,Vector3>();
      for(const [logical,render] of firstRender) {
        const p=actor.mesh.applyBoneTransform(render,new Vector3().fromBufferAttribute(source,render)).applyMatrix4(toBody);
        assert(p.toArray().every(Number.isFinite)); points.set(logical,p);
      }
      for(const [name,faces] of partFaces) {
        const side=name==='WingL'?-1:1;
        for(const tri of faces) {
          const [a,b,c]=tri.map(i=>points.get(i)!);
          const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
          minSideNormal=Math.min(minSideNormal,normal.x*side);
          assert(normal.x*side>.65 && normal.x*side>Math.abs(normal.y),`${definition.id}/${motion.id}/${f}翅片离开身体侧面`);
          for(let i=0;i<=8;i++) for(let j=0;j<=8-i;j++) {
            const p=a.clone().multiplyScalar(1-(i+j)/8).addScaledVector(b,i/8).addScaledVector(c,j/8);
            const sx=surface(side,p.y,p.z); assert(Number.isFinite(sx),'翅片超出身体侧面投影');
            const gap=side*(p.x-sx);
            minClearance=Math.min(minClearance,gap); maxClearance=Math.max(maxClearance,gap);
            assert(gap>.0001&&gap<maxGap,`${definition.id}/${motion.id}/${f}侧翅不贴体：${gap}`);
          }
        }
      }
    }
    const brokenBones={...data,bones:data.bones.map((b,i)=>i===[...wings][0]?1:b)};
    assert.throws(()=>assertPoultryWingTopology(brokenBones,'lod0'));
    const brokenFaces={...data,indices:[...data.indices]};
    const first=data.indices.findIndex(j=>wings.has(j)), t=first-first%3;
    [brokenFaces.indices[t+1],brokenFaces.indices[t+2]]=[brokenFaces.indices[t+2],brokenFaces.indices[t+1]];
    assert.throws(()=>assertPoultryWingTopology(brokenFaces,'lod0'));
    assert.throws(()=>assertPoultryWingTopology(data,'lod2'));
    reports.push({animal:definition.id,lod:lod.id,poses,wingVertices:wings.size,independentWingTriangles:8,minClearance,maxClearance,minSideNormal,thickness:0,faultInjections:3});
    actor.dispose();
  }
}
const dir=process.env.LIVESTOCK_CHECK_DIR??'/tmp/wanhu-livestock-checks'; mkdirSync(dir,{recursive:true});
const report={result:'passed',sourceSHA:process.env.REVIEW_HEAD_SHA??'local',reports};
writeFileSync(`${dir}/wings-numeric.json`,JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2));
