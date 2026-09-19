import * as T from 'three';
import {ACTIONS,type WorkId} from './catalog';
import type {Recipe,Vec3} from '../v3/types';
class GeometryBatch {
  p:number[]=[];n:number[]=[];c:number[]=[];
  add(geometry:T.BufferGeometry,color:string,position:Vec3,rotation?:T.Quaternion) {
    const g=geometry.index?geometry.toNonIndexed():geometry,mat=new T.Matrix4().compose(new T.Vector3(...position),rotation??new T.Quaternion(),new T.Vector3(1,1,1));g.applyMatrix4(mat);
    const col=new T.Color(color),p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++){this.p.push(p.getX(i),p.getY(i),p.getZ(i));this.n.push(n.getX(i),n.getY(i),n.getZ(i));this.c.push(col.r,col.g,col.b);}g.dispose();if(g!==geometry)geometry.dispose();
  }
  box(center:Vec3,size:Vec3,color:string){this.add(new T.BoxGeometry(...size),color,center);}
  beam(a:Vec3,b:Vec3,width:number,color:string){const d=new T.Vector3(...b).sub(new T.Vector3(...a));this.add(new T.BoxGeometry(width,d.length(),width),color,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));}
  cylinder(a:Vec3,b:Vec3,r:number,color:string,n=6){const d=new T.Vector3(...b).sub(new T.Vector3(...a));this.add(new T.CylinderGeometry(r,r,d.length(),n,1,false),color,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));}
  mesh(scale:number,material:T.Material){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(this.n,3));g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));g.scale(scale,scale,scale);g.computeBoundingSphere();const m=new T.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;return m;}
}
export interface WorkProps {group:T.Group;object:T.Group;wheel:T.Object3D|null;debug:T.Group;triangles:number;dispose:()=>void}
/** 所有实验道具运行时建模，车轮是道具自己的节点，不增加人体 Bone ID。 */
export function createWorkProps(id:WorkId,recipe:Recipe):WorkProps {
  const group=new T.Group(),object=new T.Group(),debug=new T.Group();group.name='WorkScene';object.name='WorkObject';group.add(object,debug);
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.92}),h=recipe.height/1.76,b=new GeometryBatch();let wheel:T.Object3D|null=null;
  const kind=ACTIONS[id].prop,wood='#967047',end='#bf9a64',dark='#533e2b',rope='#b6a175';
  if(kind==='crate') {
    b.box([0,0,0],[.38,.32,.30],wood);
    for(const x of [-.151,.151]){b.box([x,0,.156],[.045,.34,.018],end);b.box([x,0,-.156],[.045,.34,.018],end);}
    for(const y of [-.108,0,.108]){b.box([0,y,.151],[.30,.006,.006],dark);b.box([0,y,-.151],[.30,.006,.006],dark);}
    for(const x of [-.196,.196])b.box([x,.113,-.052],[.015,.027,.092],dark);
  } else if(kind==='timber') {
    b.cylinder([0,0,-.48],[0,0,.49],.078,wood,8);b.cylinder([0,0,.487],[0,0,.498],.073,end,8);
    for(const z of [-.30,.30])b.cylinder([0,0,z-.015],[0,0,z+.015],.080,dark,8);
  } else if(kind==='firewood') {
    for(let i=0;i<5;i++){const x=(i-2)*.066,dy=(i%2)*.04;b.cylinder([x,-.27-dy,0],[x,.29+dy,.015],.041,i%2?wood:dark,6);b.cylinder([x,.29+dy,.015],[x,.303+dy,.015],.037,end,6);}
    for(const y of [-.15,.15])b.beam([-.18,y,.06],[.18,y,.06],.018,rope);
    for(const x of [-.145,.145]){b.beam([x,-.22,.045],[x,.30,.14],.025,dark);b.beam([x,.30,.14],[x,.25,.33],.021,rope);b.beam([x,.25,.33],[x,-.19,.355],.019,rope);}
  } else if(kind==='wheelbarrow') {
    // 槽体、支架、两个把手，靠前单轮。把手末端是固定交互坐标。
    b.box([0,.60,.94],[.54,.07,.65],wood);
    for(const x of [-.27,.27])b.box([x,.744,.94],[.045,.25,.72],wood);
    for(const z of [.60,1.28])b.box([0,.744,z],[.58,.25,.04],end);
    for(const x of [-.245,.245]){b.beam([x,.955,.22],[x,.52,1.21],.055,dark);b.cylinder([x,.955,.22],[x,.955,.36],.033,end,6);b.beam([x,.57,.66],[x,.17,.57],.04,dark);}
    b.beam([-.31,.225,1.30],[.31,.225,1.30],.045,dark);
    for(const x of [-.22,.22])b.beam([x,.57,1.19],[x,.225,1.30],.045,dark);
    const w=new GeometryBatch();w.cylinder([-.044,0,0],[.044,0,0],.225,dark,12);w.cylinder([-.048,0,0],[.048,0,0],.184,wood,12);
    for(const x of [-.052,.052])for(const ang of [0,Math.PI/3,Math.PI*2/3]){const y=Math.cos(ang)*.178,z=Math.sin(ang)*.178;w.beam([x,-y,-z],[x,y,z],.022,end);}
    wheel=w.mesh(h,material);wheel.position.set(0,.225*h,1.30*h);object.add(wheel);
    // 货物：低矮木箱不挡住车把。
    b.box([0,.72,.93],[.35,.19,.45],'#a89467');
  } else if(kind==='hoe') {
    b.cylinder([0,.03,0],[0,1.40,0],.017,'#aa8354',6);
    b.box([0,0,.068],[.205,.04,.16],'#6e7c77');b.box([0,.026,.015],[.053,.05,.065],'#4e5b59');
    for(const y of [.99,1.19])b.cylinder([0,y-.024,0],[0,y+.024,0],.019,dark,6);
    const soil=new GeometryBatch();soil.box([.04,.005,.92],[.65,.01,.65],'#72604b');group.add(soil.mesh(h,material));
  } else {
    b.cylinder([0,0,0],[0,.35,0],.019,wood,6);b.box([0,.34,0],[.17,.08,.072],'#75837b');
    const bench=new GeometryBatch();bench.box([0,.805,.65],[.72,.07,.72],wood);
    for(const x of [-.28,.28])for(const z of [.37,.93])bench.box([x,.386,z],[.056,.772,.056],dark);
    bench.box([.09,.858,.51],[.49,.034,.20],end);group.add(bench.mesh(h,material));
  }
  object.add(b.mesh(h,material));let triangles=0;group.traverse(o=>{if(o instanceof T.Mesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  return {group,object,wheel,debug,triangles,dispose(){group.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments)o.geometry.dispose();});material.dispose();group.removeFromParent();}};
}
