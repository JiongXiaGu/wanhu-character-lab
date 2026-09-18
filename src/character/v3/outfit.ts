import {B, rigid, cleanRecipe, type Cage, type Recipe, type Region, type Vec3, type Weight, type CharacterData} from './types';
import {add,mul,sub,unit,cross,dot,ring,bridge,face,vertex,cloneCage,triCount,OCT,BOX} from './cage';
import {makeBody,makeJoints,shapePoint} from './body';
const SKIN='#c8956e', HAIR='#282b29', INK='#272b2b';
const palettes=[['#415e68','#d4c5a5','#574637'],['#626854','#d7c9b2','#534637'],['#785549','#d7c8ae','#4d4033']];
function patch(c:Cage,id:string,points:Vec3[],w:Weight,color:string,region:Region='detail') { face(c,points.map((p,i)=>vertex(c,`${id}.${i}`,p,[...w])),region,color); }
function box(c:Cage,id:string,p:Vec3,s:Vec3,w:Weight,color:string) {
  const ids:number[]=[];for(const z of [-1,1])for(const y of [-1,1])for(const x of [-1,1])ids.push(vertex(c,`${id}.${ids.length}`,add(p,[x*s[0]/2,y*s[1]/2,z*s[2]/2]),[...w]));
  for(const ix of [[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]])face(c,ix.map(i=>ids[i]),'equipment',color);
}
function tube(c:Cage,id:string,points:Vec3[],r:number,w:Weight,color:string,n=4) {
  let prev:number[]|undefined;
  const profile=Array.from({length:n},(_,i)=>[Math.cos(i*Math.PI*2/n),Math.sin(i*Math.PI*2/n)] as [number,number]);
  for(let i=0;i<points.length;i++){const dir=unit(sub(points[Math.min(i+1,points.length-1)],points[Math.max(0,i-1)]));const u=unit(cross(dir,Math.abs(dir[2])<.9?[0,0,1]:[0,1,0]));const v=unit(cross(dir,u));const loop=ring(c,`${id}.${i}`,points[i],u,v,profile,r,r,w);if(prev)bridge(c,prev,loop,'equipment',color);else face(c,[...loop].reverse(),'equipment',color);prev=loop;}if(prev)face(c,prev,'equipment',color);
}
function frontSample(c:Cage,x:number,y:number):{z:number;w:Weight} {
  let best=-Infinity,weights:Weight=rigid(B.Chest);
  for(const f of c.faces){if(!['torso','neck','pelvis'].includes(f.region))continue;for(let i=1;i<f.v.length-1;i++){
    const verts=[c.vertices[f.v[0]],c.vertices[f.v[i]],c.vertices[f.v[i+1]]], [a,b,d]=verts.map(v=>v.p);
    const det=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1]);if(Math.abs(det)<1e-10)continue;
    const u=((b[1]-d[1])*(x-d[0])+(d[0]-b[0])*(y-d[1]))/det,v=((d[1]-a[1])*(x-d[0])+(a[0]-d[0])*(y-d[1]))/det;
    if(u< -1e-6||v< -1e-6||u+v>1.000001)continue;const z=u*a[2]+v*b[2]+(1-u-v)*d[2];if(z<=best)continue;best=z;
    const sums=new Map<number,number>();[u,v,1-u-v].forEach((factor,k)=>{const w=verts[k].w;sums.set(w[0],(sums.get(w[0])??0)+factor*w[2]);sums.set(w[1],(sums.get(w[1])??0)+factor*(1-w[2]));});
    const ranked=[...sums].sort((a,b)=>b[1]-a[1]),first=ranked[0],second=ranked[1]??first;weights=[first[0],second[0],first[0]===second[0]?1:first[1]/(first[1]+second[1])];
  }}
  return {z:(Number.isFinite(best)?best:.065)+.007,w:weights};
}
function ribbon(c:Cage,id:string,points:[number,number][],width:number,color:string) {
  // 曲线先细分再投影，避免一片长条跨越胸前几个平面后埋入衣服。
  const samples:[number,number][]=[];
  for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.025);for(let k=0;k<n;k++)samples.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}
  if(points.length)samples.push(points.at(-1)!);
  for(let i=0;i<samples.length-1;i++){const a=samples[i],b=samples[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),ux=-dy/len*width/2,uy=dx/len*width/2;const pts:[[number,number],[number,number],[number,number],[number,number]]=[[a[0]-ux,a[1]-uy],[b[0]-ux,b[1]-uy],[b[0]+ux,b[1]+uy],[a[0]+ux,a[1]+uy]];const ids=pts.map(([x,y],k)=>{const sample=frontSample(c,x,y);return vertex(c,`${id}.${i}.${k}`,[x,y,sample.z],sample.w);});const normal=cross(sub(c.vertices[ids[1]].p,c.vertices[ids[0]].p),sub(c.vertices[ids[2]].p,c.vertices[ids[0]].p));face(c,normal[2]>0?ids:ids.reverse(),'detail',color);}
}
function faceDetails(c:Cage,hat:boolean) {
  const head=rigid(B.Head);
  for(const side of [-1,1]) {
    const x=.037*side;
    // 眼睛贴在斜向面颊上，而不是漂浮在一个统一的 Z 平面。
    const surface=(xx:number,y:number):Vec3=>[xx,y,.101-Math.abs(xx)*.22];
    patch(c,`Eye${side}`,[surface(x-.011,1.655),surface(x+.011,1.655),surface(x+.011,1.666),surface(x-.011,1.666)],head,INK);
    patch(c,`Brow${side}`,[surface(x-.015,1.677),surface(x+.015,1.677),surface(x+.012,1.683),surface(x-.012,1.683)],head,HAIR);
    box(c,`Ear${side}`,[side*.099,1.625,0],[.016,.040,.030],head,SKIN);
  }
  const nose=[[-.012,1.646,.102],[.012,1.646,.102],[0,1.615,.123],[0,1.612,.096]] as Vec3[];
  const n=nose.map((p,i)=>vertex(c,`Nose.${i}`,p,head));for(const tri of [[0,2,1],[0,3,2],[1,2,3]])face(c,tri.map(i=>n[i]),'detail','#bd8963');
  patch(c,'Mouth',[[-.015,1.595,.102],[.015,1.595,.102],[.010,1.599,.102],[-.010,1.599,.102]],head,'#895f4c');
  const lower=OCT.map(([x,z],i)=>vertex(c,`Hairline.${i}`,[x*.102,z>.6?1.697:z<-.6?1.573:1.655,z*.096],head));
  const top=ring(c,'HairCrown',[0,1.759,-.003],[1,0,0],[0,0,1],OCT,.073,.070,head);
  bridge(c,lower,top,'detail',HAIR);face(c,[...top],'detail',HAIR);
  if(!hat) {const bun=ring(c,'BunBase',[0,1.755,-.025],[1,0,0],[0,0,1],BOX,.027,.027,head);const cap=ring(c,'BunCap',[0,1.808,-.025],[1,0,0],[0,0,1],BOX,.020,.02,head);bridge(c,bun,cap,'detail',HAIR);face(c,cap,'detail',HAIR);}
}
function hat(c:Cage,outfit:Recipe['outfit']) {
  const skin=rigid(B.Head);
  if(outfit==='farmer') {
    const profile=Array.from({length:12},(_,i)=>[Math.sin(i*Math.PI/6),Math.cos(i*Math.PI/6)] as [number,number]);
    const rim=ring(c,'StrawBrim',[0,1.72,0],[1,0,0],[0,0,1],profile,.255,.255,skin);
    const peak=vertex(c,'StrawPeak',[0,1.89,0],skin),bottom=vertex(c,'StrawInside',[0,1.816,0],skin);
    for(let i=0;i<12;i++){const j=(i+1)%12;face(c,[peak,rim[j],rim[i]],'equipment',i%3===0?'#c4a76a':'#baa071');face(c,[bottom,rim[i],rim[j]],'equipment','#8c754d');}
  } else if(outfit==='guard') {
    const low=ring(c,'HelmetBrim',[0,1.69,-.006],[1,0,0],[0,0,1],OCT,.11,.103,skin), high=ring(c,'HelmetCrown',[0,1.805,-.008],[1,0,0],[0,0,1],OCT,.062,.06,skin);bridge(c,low,high,'equipment','#66716c');face(c,high,'equipment','#778078');
  } else if(outfit==='archer') {
    const a=ring(c,'HeadbandA',[0,1.695,0],[1,0,0],[0,0,1],OCT,.103,.099,skin),b=ring(c,'HeadbandB',[0,1.712,0],[1,0,0],[0,0,1],OCT,.101,.098,skin);bridge(c,a,b,'equipment','#a48760');
  }
}
function belt(c:Cage,color:string) {
  const a=ring(c,'BeltBottom',[0,1.05,0],[1,0,0],[0,0,1],OCT,.158,.097,[B.Hips,B.Spine,.35]);
  const b=ring(c,'BeltTop',[0,1.10,0],[1,0,0],[0,0,1],OCT,.162,.103,[B.Spine,B.Hips,.75]);bridge(c,a,b,'detail',color);
  box(c,'BeltKnot',[.08,1.076,.097],[.035,.05,.023],[B.Spine,B.Hips,.7],color);
  patch(c,'SashTail',[[.07,.95,.109],[.105,.945,.109],[.097,1.08,.11],[.067,1.08,.11]],[B.Hips,B.Spine,.6],color);
}
function equipment(c:Cage,outfit:Recipe['outfit']) {
  if(outfit==='guard') {
    const w=rigid(B.RightHand), x=.541,y=.846,z=.023;
    box(c,'SwordGrip',[x,y-.025,z],[.024,.12,.025],w,'#514435');box(c,'SwordGuard',[x,y-.095,z],[.125,.018,.035],w,'#ad986c');
    const ids=[[x-.025,y-.11,z],[x,y-.11,z+.011],[x+.025,y-.11,z],[x,y-.66,z]].map((p,i)=>vertex(c,`Blade.${i}`,p as Vec3,w));face(c,[ids[0],ids[3],ids[1]],'equipment','#adb8b4');face(c,[ids[1],ids[3],ids[2]],'equipment','#d0d7cb');face(c,[ids[0],ids[2],ids[3]],'equipment','#788783');
    const sw=rigid(B.LeftHand),center:Vec3=[-.56,.87,.088];const edge=OCT.map(([xx,yy],i)=>vertex(c,`Shield.${i}`,add(center,[xx*.20,yy*.25,0]),sw));const boss=vertex(c,'ShieldBoss',add(center,[0,0,.058]),sw);for(let i=0;i<8;i++)face(c,[boss,edge[i],edge[(i+1)%8]],'equipment',i%2?'#6f4937':'#79503a');face(c,[...edge].reverse(),'equipment','#463b31');box(c,'ShieldBossCap',add(center,[0,0,.052]),[.05,.055,.025],sw,'#9d9d86');
  } else if(outfit==='archer') {
    const w=rigid(B.LeftHand),center:Vec3=[-.55,.86,.02];
    const pts:Vec3[]=[[-.075,.34,0],[.012,.24,0],[.05,.11,0],[0,0,0],[.05,-.11,0],[.012,-.24,0],[-.075,-.34,0]].map(p=>add(center,p as Vec3));tube(c,'Bow',pts,.014,w,'#956d42');tube(c,'Bowstring',[pts[0],pts.at(-1)!],.002,w,'#d6c9ad',3);
    const chest=rigid(B.Chest);tube(c,'Quiver',[[-.13,1.00,-.14],[-.13,1.37,-.16]],.058,chest,'#604739',6);
    for(let i=0;i<3;i++){const x=-.16+i*.028;tube(c,`Arrow${i}`,[[x,1.22,-.16],[x,1.48,-.16]],.005,chest,'#b39969',3);patch(c,`Fletch${i}`,[[x-.014,1.45,-.17],[x+.014,1.45,-.17],[x+.009,1.49,-.17],[x-.009,1.49,-.17]],chest,'#cbc8ad');}
  } else if(outfit==='farmer') {
    const w=rigid(B.RightHand);tube(c,'HoeHandle',[[.54,.26,.025],[.54,1.09,.025]],.012,w,'#9b764a');box(c,'HoeBlade',[.60,1.08,.025],[.15,.024,.055],w,'#707977');
  }
}
export function makeCharacter(input:Partial<Recipe>):CharacterData {
  const recipe=cleanRecipe(input),body=makeBody(),c=cloneCage(body);const [cloth,trim,leather]=palettes[recipe.palette];
  const dressed=recipe.outfit!=='body', armor=recipe.outfit==='guard';
  for(const f of c.faces) {
    f.color=SKIN;
    if(dressed)f.color= ['torso','upperArm'].includes(f.region)?(armor?'#566561':recipe.outfit==='archer'?'#756247':cloth):['pelvis','thigh'].includes(f.region)?'#3c4445':f.region==='shin'?'#8d8b77':f.region==='foot'?'#414441':SKIN;
    else if(f.region==='pelvis')f.color='#566265';
  }
  if(dressed) {
    for(const [name,loop] of Object.entries(c.anchors)) {
      let factor=1;
      if(['Hip','Waist','Rib','Chest','Shoulder'].includes(name))factor=1.055;
      if(/Deltoid|ElbowUpper/.test(name))factor=1.17;
      if(/Thigh/.test(name))factor=1.12;
      if(/Knee|Calf/.test(name))factor=1.07;
      if(factor===1)continue;
      const center=mul(loop.reduce((p,i)=>add(p,c.vertices[i].p),[0,0,0] as Vec3),1/loop.length);
      for(const id of loop){const v=c.vertices[id];v.p=add(center,mul(sub(v.p,center),factor));}
    }
    belt(c,leather);
    ribbon(c,'CrossCollar',[[-.049,1.45],[.073,1.32],[.097,1.20]],.023,trim);
    ribbon(c,'InnerCollar',[[.049,1.45],[-.024,1.371]],.020,trim);
    // 短衣与裤子为 BodyDerived.Replace；这些面替代裸体，不叠加一个完整身体。
    if(armor) {
      for(const yy of [1.16,1.215,1.27]) ribbon(c,`Lamellar${yy}`,[[-.113,yy],[.113,yy]],.008,'#a6a88c');
      ribbon(c,'ChestTie',[[-.08,1.39],[-.08,1.15]],.012,'#aa8a61');
    } else if(recipe.outfit==='archer') ribbon(c,'QuiverStrap',[[-.1,1.42],[.115,1.15]],.035,leather);
  }
  faceDetails(c,recipe.hat&&dressed);
  if(recipe.hat&&dressed)hat(c,recipe.outfit);
  if(recipe.equipment&&dressed)equipment(c,recipe.outfit);
  for(const v of c.vertices)v.p=shapePoint(v.p,recipe);
  for(const v of body.vertices)v.p=shapePoint(v.p,recipe);
  const replacedTriangles=dressed?body.faces.filter(f=>['torso','upperArm','pelvis','thigh','shin','foot'].includes(f.region)).reduce((n,f)=>n+f.v.length-2,0):0;
  return {body,surface:c,joints:makeJoints(recipe),recipe,replacedTriangles,bodyTriangles:triCount(body)};
}
