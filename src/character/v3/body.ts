import { KNEE, kneeWeights } from './leg-deformation';
import { makeSkinPelvis, connectSkinThigh } from './skin-pelvis';
import { femalePoint } from './proportions';
import { B, BODY_HEIGHT, rigid, type Cage, type Joint, type Recipe, type Vec3, type Weight } from './types';
import { OCT, HEX, LEG, ring, bridge, face, orient } from './cage';

/** 固定低模皮肤。腰以下使用有限宽度裆底，衣裤仍是独立资产，不复制此皮肤。 */
export function makeBody(): Cage {
  const c: Cage = { vertices: [], faces: [], anchors: {} };
  const rows: [string, number, number, number, Weight][] = [
    ['Waist',1.055,.142,.083,[B.Hips,B.Spine,.35]],
    ['Rib',1.18,.177,.105,[B.Spine,B.Chest,.35]],
    ['Chest',1.3,.202,.113,rigid(B.Chest)],
    ['Shoulder',1.395,.211,.098,rigid(B.Chest)],
    ['NeckBase',1.455,.06,.053,[B.Chest,B.Neck,.35]],
    ['NeckTop',1.51,.057,.055,[B.Neck,B.Head,.3]],
    ['Jaw',1.545,.076,.079,rigid(B.Head)],
    ['Cheek',1.63,.098,.092,rigid(B.Head)],
    ['Forehead',1.72,.097,.09,rigid(B.Head)],
    ['Crown',1.755,.069,.065,rigid(B.Head)],
  ];
  const loops = rows.map(([id,y,w,d,skin]) => ring(c,id,[0,y,id==='Jaw'?.013:id==='Cheek'?.008:0],[1,0,0],[0,0,1],OCT,w,d,skin));
  loops.forEach((loop,i) => { c.anchors[rows[i][0]] = loop; });
  for (let r=0;r<loops.length-1;r++) for (let j=0;j<8;j++) {
    if (r===2 && [1,2,5,6].includes(j)) continue;
    face(c,[loops[r][j],loops[r][(j+1)%8],loops[r+1][(j+1)%8],loops[r+1][j]],r<4?'torso':r<6?'neck':'head');
  }
  face(c,[...loops.at(-1)!],'head');
  const legRoots = makeSkinPelvis(c,loops[0]);
  for (const side of [1,-1]) {
    const right=side===1, prefix=right?'Right':'Left';
    const upper=right?B.RightUpperArm:B.LeftUpperArm, lower=right?B.RightForearm:B.LeftForearm, hand=right?B.RightHand:B.LeftHand;
    const chest=loops[2], shoulder=loops[3];
    const socket=right?[chest[1],chest[2],chest[3],shoulder[3],shoulder[2],shoulder[1]]:[chest[7],chest[6],chest[5],shoulder[5],shoulder[6],shoulder[7]];
    c.anchors[`${prefix}Armhole`]=socket;
    socket.forEach((idx,i)=>{c.vertices[idx].w=[B.Chest,upper,i<3?.87:.62];});
    const u:Vec3=[side*.866,.5,0];
    const armRows:[string,Vec3,number,number,Weight][]=[
      ['Deltoid',[side*.25,1.302,0],.065,.061,[B.Chest,upper,.16]],
      ['ElbowUpper',[side*.374,1.136,0],.047,.046,[upper,lower,.9]],
      ['Elbow',[side*.394,1.101,0],.039,.04,[upper,lower,.5]],
      ['ElbowLower',[side*.414,1.066,.002],.046,.042,[upper,lower,.08]],
      ['Wrist',[side*.503,.912,.014],.027,.027,[lower,hand,.18]],
      ['Fingers',[side*.546,.832,.025],.035,.023,rigid(hand)],
    ];
    let prev=socket;
    armRows.forEach(([id,center,w,d,skin],i)=>{
      const next=ring(c,`${prefix}${id}`,center,u,[0,0,1],HEX,w,d,skin);
      bridge(c,prev,next,i<2?'upperArm':i<5?'forearm':'hand');
      c.anchors[`${prefix}${id}`]=next;prev=next;
    });
    face(c,[...prev],'hand');
    const thigh=right?B.RightThigh:B.LeftThigh, shin=right?B.RightShin:B.LeftShin, foot=right?B.RightFoot:B.LeftFoot;
    const root=legRoots[right?0:1];
    c.anchors[`${prefix}LegRoot`]=root;
    const legRows:[string,number,number,number,number,Weight][]=[
      ['Thigh',.805,.091,.078,0,[B.Hips,thigh,.12]],
      ['KneeUpper',KNEE.upperY,.058,.057,0,[thigh,shin,.94]],
      ['Knee',KNEE.centerY,.055,.055,0,[thigh,shin,.5]],
      ['KneeLower',KNEE.lowerY,.056,.052,0,[thigh,shin,.06]],
      ['Calf',.293,.062,.063,-.008,rigid(shin)],
      ['Ankle',.105,.04,.039,0,[shin,foot,.2]],
      ['Instep',.064,.052,.104,.05,rigid(foot)],
      ['Sole',0,.054,.109,.053,rigid(foot)],
    ];
    prev=root;
    legRows.forEach(([id,y,w,d,z,skin],i)=>{
      const profile=right?LEG:LEG.map(([x,zz])=>[-x,-zz] as [number,number]);
      const next=ring(c,`${prefix}${id}`,[side*.101,y,z],[1,0,0],[0,0,1],profile,w,d,skin);
      if(id.startsWith('Knee')||id==='Calf')for(const vi of next)c.vertices[vi].w=kneeWeights(c.vertices[vi].p,thigh,shin);
      if(i===0)connectSkinThigh(c,root,next);else bridge(c,prev,next,i<2?'thigh':i<6?'shin':'foot');
      c.anchors[`${prefix}${id}`]=next;prev=next;
    });
    face(c,[...prev],'foot');
  }
  orient(c);
  return c;
}
export function shapePoint(p:Vec3,recipe:Recipe):Vec3 {
  if(recipe.bodyType==='female')p=femalePoint(p);
  const h=BODY_HEIGHT[recipe.bodyType]/1.76;
  return[p[0]*h,p[1]*h,p[2]*h];
}
export function makeJoints(recipe:Recipe):Joint[] {
  const j:Joint[]=[];
  const put=(name:string,parent:number,p:Vec3)=>j.push({name,parent,p:shapePoint(p,recipe)});
  put('Root',-1,[0,0,0]);put('Hips',0,[0,.929,0]);put('Spine',1,[0,1.07,0]);put('Chest',2,[0,1.24,0]);put('Neck',3,[0,1.457,0]);put('Head',4,[0,1.52,0]);
  for(const s of [1,-1]){
    const name=s===1?'Right':'Left',clav=j.length;
    put(`${name}Clavicle`,3,[s*.08,1.36,0]);put(`${name}UpperArm`,clav,[s*.211,1.365,0]);
    put(`${name}Forearm`,clav+1,[s*.394,1.101,0]);put(`${name}Hand`,clav+2,[s*.503,.912,.014]);
  }
  for(const s of [1,-1]){
    const name=s===1?'Right':'Left',t=j.length;
    put(`${name}Thigh`,1,[s*.101,.929,0]);put(`${name}Shin`,t,[s*.101,KNEE.centerY,0]);put(`${name}Foot`,t+1,[s*.101,.105,0]);
  }
  return j;
}
/** 工具只按固定绑定锚点与等比尺寸映射，避免把直杆套进身体的非线性比例场。 */
export function shapeRigidPoint(p:Vec3,bone:number,recipe:Recipe,baseJoints:Joint[],targetJoints:Joint[]):Vec3 {
  if(recipe.bodyType==='male')return shapePoint(p,recipe);
  const origin=baseJoints[bone].p,target=targetJoints[bone].p,h=BODY_HEIGHT[recipe.bodyType]/1.76,head=bone===B.Head;
  return[target[0]+(p[0]-origin[0])*h*(head?.96:1),target[1]+(p[1]-origin[1])*h,target[2]+(p[2]-origin[2])*h*(head?.98:1)];
}
