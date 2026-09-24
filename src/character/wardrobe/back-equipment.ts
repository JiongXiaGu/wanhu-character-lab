import { B, rigid, createRecipe, type BackId, type Cage, type Recipe, type Vec3, type Weight } from '../v3/types';
import { add, sub, mul, dot, cross, unit, ring, bridge, face, vertex, orient, BOX, OCT } from '../v3/cage';
import { makeJoints, shapePoint, shapeRigidPoint } from '../v3/body';

/** 一个背部选项就是完整资产；不含物品、职业、额外骨骼或运行时物理。 */
export const BACK_EQUIPMENT_IDS = ['bamboo_basket', 'firewood_bundle', 'book_case'] as const satisfies readonly BackId[];
export type BackEquipmentId = typeof BACK_EQUIPMENT_IDS[number];
export const BACK_EQUIPMENT_VERSION = 'wanhu-back-equipment-v1';
export function isBackEquipment(id: BackId): id is BackEquipmentId {
  return (BACK_EQUIPMENT_IDS as readonly string[]).includes(id);
}
const empty = (): Cage => ({ vertices: [], faces: [], anchors: {} });
const CHEST = rigid(B.Chest);
const prefix = (id: BackEquipmentId) => `Back.${id}.`;

function append(target: Cage, part: Cage) {
  orient(part);
  const offset = target.vertices.length;
  target.vertices.push(...part.vertices);
  target.faces.push(...part.faces.map(f => ({ ...f, v: f.v.map(i => i + offset) })));
}
function box(c: Cage, id: string, p: Vec3, size: Vec3, color: string) {
  const a = ring(c, id + '.Low', add(p, [0, -size[1] / 2, 0]), [1, 0, 0], [0, 0, 1], BOX, size[0] / 2, size[2] / 2, CHEST);
  const b = ring(c, id + '.High', add(p, [0, size[1] / 2, 0]), [1, 0, 0], [0, 0, 1], BOX, size[0] / 2, size[2] / 2, CHEST);
  bridge(c, a, b, 'equipment', color);
  face(c, [...a].reverse(), 'equipment', color); face(c, b, 'equipment', color);
}
function pole(c: Cage, id: string, a: Vec3, b: Vec3, radius: number, color: string, ends: string, sides = 6) {
  const dir = unit(sub(b, a));
  const u = unit(cross(dir, Math.abs(dir[2]) < .9 ? [0, 0, 1] : [0, 1, 0])), v = unit(cross(dir, u));
  const profile = Array.from({ length: sides }, (_, i) => [Math.cos(i * Math.PI * 2 / sides), Math.sin(i * Math.PI * 2 / sides)] as [number, number]);
  const lo = ring(c, id + '.Low', a, u, v, profile, radius, radius, CHEST);
  const hi = ring(c, id + '.High', b, u, v, profile, radius * .87, radius * .87, CHEST);
  bridge(c, lo, hi, 'equipment', color);
  face(c, [...lo].reverse(), 'equipment', ends); face(c, hi, 'equipment', ends);
}
/** 薄实心箍带：四个共享环封闭，不使用透明线条、单面片或密集编织。 */
function band(c: Cage, id: string, y: number, width: number, depth: number, z: number, color: string, height = .018) {
  const loops = [[y-height/2,width,depth],[y+height/2,width,depth],[y+height/2,width-.006,depth-.006],[y-height/2,width-.006,depth-.006]];
  const rings = loops.map(([yy,w,d], i) => ring(c, `${id}.${i}`, [0,yy,z], [1,0,0], [0,0,1], OCT,w,d,CHEST));
  for (let i=0;i<4;i++) bridge(c,rings[i],rings[(i+1)%4],'equipment',color);
}

/** 统一男性作者空间；载荷只通过 Chest 的刚性绑定映射到当前男女基模。 */
function makePayload(id: BackEquipmentId, recipe: Recipe): Cage {
  const c=empty(), p=prefix(id)+'Payload.';
  if(id==='bamboo_basket') {
    // 开口容器仍是一张闭合厚壳：外壁→厚口沿→内壁→内底，底面不冒充篓口。
    const specs = [[1.045,.105,.071],[1.245,.142,.091],[1.435,.165,.108],[1.435,.153,.096],[1.065,.096,.062]];
    const loops=specs.map(([y,w,d],i)=>ring(c,p+'Bowl.'+i,[0,y,-.302],[1,0,0],[0,0,1],OCT,w,d,CHEST));
    const colors=['#ac8751','#bc995e','#d1b276','#897043'];
    for(let i=0;i<4;i++) bridge(c,loops[i],loops[i+1],'equipment',colors[i]);
    face(c,[...loops[0]].reverse(),'equipment','#8d6f43');face(c,loops[4],'equipment','#897043');
    band(c,p+'LowerBinding',1.155,.129,.084,-.302,'#765738',.022);
    band(c,p+'UpperBinding',1.343,.158,.103,-.302,'#947341',.022);
    // 两条背侧承重竹条，给侧视明确的受力连接。
    for(const s of [-1,1]) box(c,p+'Upright'+s,[s*.088,1.241,-.207],[.018,.348,.017],'#887045');
  } else if(id==='firewood_bundle') {
    const logs:[number,number,number,number,number][]=[
      [-.090,-.265,1.055,1.425,.042],[-.010,-.257,1.020,1.458,.043],[.075,-.264,1.055,1.409,.043],
      [-.060,-.333,1.025,1.398,.044],[.028,-.334,1.048,1.445,.046],
    ];
    logs.forEach(([x,z,lo,hi,r],i)=>pole(c,p+'Log'+i,[x-.024,lo,z],[x+.034,hi,z-.011],r,['#73503a','#806044','#654731'][i%3],'#c4a16c'));
    band(c,p+'TieLow',1.155,.148,.102,-.297,'#b6a27a',.022);
    band(c,p+'TieHigh',1.335,.155,.102,-.307,'#b6a27a',.022);
    box(c,p+'Knot',[.012,1.335,-.414],[.050,.032,.022],'#b6a27a');
  } else {
    // 小型木框书笈：封闭书箱、染色布盖、固定书册；不加高棚、悬旗或子槽位。
    box(c,p+'Case',[0,1.245,-.270],[.245,.350,.158],'#806146');
    box(c,p+'ClothFlap',[0,1.408,-.287],[.230,.049,.144],recipe.dyes.primary);
    box(c,p+'Shelf',[0,1.057,-.282],[.283,.024,.198],'#5e4736');
    for(const s of [-1,1]) {
      box(c,p+'Frame'+s,[s*.131,1.245,-.344],[.021,.401,.026],'#534435');
      box(c,p+'Foot'+s,[s*.091,1.064,-.194],[.022,.072,.021],'#534435');
    }
    box(c,p+'Crossbar',[0,1.350,-.364],[.279,.022,.021],'#9b7c4d');
    box(c,p+'Closure',[0,1.338,-.363],[.024,.109,.009],recipe.dyes.accent);
    // 顶部露出一本浅纸色册页；整体低于后髻，近景不靠细字贴图。
    box(c,p+'BookPages',[-.035,1.451,-.270],[.120,.037,.092],'#d6c6a2');
    box(c,p+'BookCover',[-.035,1.474,-.270],[.127,.010,.101],recipe.dyes.primary);
  }
  return c;
}

interface SurfaceSample { p: Vec3; w: Weight; normal: Vec3 }
/** 创建时对已完成男女映射的真实衣面取样；不在动画帧中投影或拟合。 */
function sampleSurface(c: Cage, origin: Vec3, direction: Vec3): SurfaceSample {
  const dir=unit(direction); let best=-Infinity, result:SurfaceSample|undefined;
  for(const f of c.faces) {
    if(f.region!=='torso'&&f.region!=='neck') continue;
    for(let k=1;k<f.v.length-1;k++) {
      const vs=[c.vertices[f.v[0]],c.vertices[f.v[k]],c.vertices[f.v[k+1]]];
      const a=vs[0].p,e1=sub(vs[1].p,a),e2=sub(vs[2].p,a),h=cross(dir,e2),det=dot(e1,h);
      if(Math.abs(det)<1e-10)continue;
      const s=sub(origin,a),u=dot(s,h)/det,q=cross(s,e1),v=dot(dir,q)/det,t=dot(e2,q)/det;
      if(u < -1e-7 || v < -1e-7 || u+v>1.0000001 || t < 0 || t > .5 || t<=best)continue;
      const sums=new Map<number,number>();
      [1-u-v,u,v].forEach((f,i)=>{const w=vs[i].w;sums.set(w[0],(sums.get(w[0])??0)+f*w[2]);sums.set(w[1],(sums.get(w[1])??0)+f*(1-w[2]));});
      const ranked=[...sums].filter(([,weight])=>weight>1e-7).sort((a,b)=>b[1]-a[1]);
      const [first,second=ranked[0]]=ranked;
      const w:Weight=[first[0],second[0],first[0]===second[0]?1:first[1]/(first[1]+second[1])];
      best=t; result={p:add(origin,mul(dir,t+.009)),normal:dir,w};
    }
  }
  if(!result)throw new Error('背具肩带无法采样当前衣面');
  return result;
}
function makeHarness(surface:Cage,id:BackEquipmentId,recipe:Recipe,mapRigid:(p:Vec3)=>Vec3):Cage {
  const c=empty(),scale=recipe.bodyType==='female'?1.66/1.76:1;
  const radial=(p:Vec3)=>{const at=shapePoint(p,recipe);return sampleSurface(surface,[0,at[1],0],[at[0],0,at[2]]);};
  const shoulder=(x:number,z:number)=>sampleSurface(surface,shapePoint([x,1.27,z],recipe),[0,1,0]);
  for(const side of [-1,1]) {
    const anchor=(p:Vec3):SurfaceSample=>({p:mapRigid(p),w:[...CHEST],normal:[0,0,-1]});
    const x=side*.107;
    const path:SurfaceSample[]=[
      anchor([x,1.385,-.203]),radial([x,1.404,-.075]),shoulder(x,-.035),shoulder(x,.025),
      radial([x,1.394,.082]),radial([x,1.320,.110]),radial([x,1.240,.105]),
      radial([side*.175,1.201,.049]),radial([side*.170,1.192,-.040]),anchor([x,1.181,-.203]),
    ];
    const loops=path.map((s,i)=>{
      const tangent=unit(sub(path[Math.min(i+1,path.length-1)].p,path[Math.max(i-1,0)].p));
      const width=unit(cross(tangent,s.normal));
      return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b],j)=>vertex(c,`${prefix(id)}Harness.${side}.${i}.${j}`,
        add(s.p,add(mul(width,a*.014*scale),mul(s.normal,b*.0025*scale))),[...s.w]));
    });
    for(let i=0;i<loops.length-1;i++)bridge(c,loops[i],loops[i+1],'equipment','#766044');
    face(c,[...loops[0]].reverse(),'equipment','#766044');face(c,loops.at(-1)!,'equipment','#766044');
  }
  return c;
}

/** 在 outfit 完成男女基模映射后装配。旧箭袋与手持物的生成/映射保持原样。 */
export function addBackEquipment(surface:Cage,recipe:Recipe):void {
  const id=recipe.slots.back;if(!isBackEquipment(id))return;
  const baseJoints=makeJoints(createRecipe({bodyType:'male'})),targetJoints=makeJoints(recipe);
  const mapRigid=(p:Vec3)=>shapeRigidPoint(p,B.Chest,recipe,baseJoints,targetJoints);
  const payload=makePayload(id,recipe);
  for(const v of payload.vertices)v.p=mapRigid(v.p);
  // 仅创建时按实际衣面后沿收紧深度；载荷仍是刚体，不变形、不逐帧拟合。
  const rearIndices=new Set(surface.faces.filter(f=>f.region==='torso').flatMap(f=>f.v));
  const rearZ=Math.min(...[...rearIndices].map(i=>surface.vertices[i].p[2]));
  const frontZ=Math.max(...payload.vertices.map(v=>v.p[2]));
  const shift=rearZ-.012*(recipe.bodyType==='female'?1.66/1.76:1)-frontZ;
  if(!Number.isFinite(shift))throw new Error('背具缺少可用衣面后沿');
  for(const v of payload.vertices)v.p[2]+=shift;
  // 肩带采样必须发生在追加背具之前，避免把装备自己误当成衣面。
  const harness=makeHarness(surface,id,recipe,p=>add(mapRigid(p),[0,0,shift]));
  append(surface,payload);append(surface,harness);
}
