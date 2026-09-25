import { makePalaceTop } from './military/palace-top';
import { makeWorkVest } from './work-vest';
import { makeShortJacket } from './short-jacket';
import { makeWorkShirt } from './work-shirt';
import { makeCrossShirt } from './cross-shirt';
import { makeHalfSleeve } from './half-sleeve';
import { sealGarmentInterfaces } from './seal-interfaces';
import { B, rigid, type Cage, type Recipe, type Vec3, type Weight } from '../../v3/types';
import { OCT, HEX, ring, bridge, face, orient } from '../../v3/cage';
import { TOP_PATTERNS } from '../patterns';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

/** 所有保留上衣的领口、袖口和腰口均以衣身主布色封闭；已封资产不重复处理。 */
export function makeTop(recipe:Recipe):GarmentPiece|undefined {
  const piece=makeAuthoredTop(recipe);
  return piece?sealGarmentInterfaces(piece,recipe.dyes.primary):undefined;
}

/** 作者层保留独立版型；封口不改变人体、衣身坐标、权重或装饰色区。 */
function makeAuthoredTop(recipe:Recipe):GarmentPiece|undefined {
  const id=recipe.slots.top;
  if(id==='body')return;
  const pattern=TOP_PATTERNS[id];
  if(!pattern)throw new Error('上衣资产未注册：'+id);
  if(pattern.asset==='palace-top')return makePalaceTop(recipe);
  if(pattern.asset==='work-vest')return makeWorkVest(recipe);
  if(pattern.asset==='short-jacket')return makeShortJacket(recipe);
  if(pattern.asset==='work-shirt')return makeWorkShirt(recipe);
  if(pattern.asset==='cross-shirt')return makeCrossShirt(recipe);
  if(pattern.asset==='half-sleeve')return makeHalfSleeve(recipe);
  if(pattern.asset!=='classic')throw new Error('未知上衣构造器');
  const c:Cage={vertices:[],faces:[],anchors:{}}, {primary,accent}=recipe.dyes;
  const rows:[string,number,number,number,Weight][]=[
    ['Hem',pattern.hem,.161,.104,[B.Hips,B.Spine,.35]],
    ['Belt',1.083,.162,.104,[B.Hips,B.Spine,.35]],
    ['Rib',1.18,.186,.119,[B.Spine,B.Chest,.35]],
    ['Chest',1.30,.213,.125,rigid(B.Chest)],
    ['Shoulder',1.405,.221,.110,rigid(B.Chest)],
    ['Neck',1.455,.065,.059,[B.Chest,B.Neck,.35]],
  ];
  const loops=rows.map(([name,y,width,depth,w])=>ring(c,'Top.'+name,[0,y,0],[1,0,0],[0,0,1],OCT,width*(name==='Neck'?1:pattern.width),depth,w));
  for(let row=0;row<loops.length-1;row++)for(let j=0;j<8;j++){
    if(row===3&&[1,2,5,6].includes(j))continue;
    face(c,[loops[row][j],loops[row][(j+1)%8],loops[row+1][(j+1)%8],loops[row+1][j]],'torso',row===0?accent:primary);
  }
  const openings:Record<string,number[]>={waist:loops[0],neck:loops.at(-1)!};
  for(const side of [1,-1]){
    const right=side===1,name=right?'Right':'Left';
    const upper=right?B.RightUpperArm:B.LeftUpperArm,lower=right?B.RightForearm:B.LeftForearm,hand=right?B.RightHand:B.LeftHand;
    const chest=loops[3],shoulder=loops[4];
    const socket=right?[chest[1],chest[2],chest[3],shoulder[3],shoulder[2],shoulder[1]]:[chest[7],chest[6],chest[5],shoulder[5],shoulder[6],shoulder[7]];
    socket.forEach((v,i)=>c.vertices[v].w=[B.Chest,upper,i<3?.87:.62]);
    const arm:[string,Vec3,number,number,Weight][]=[
      ['Shoulder',[side*.25,1.302,0],.078,.074,[B.Chest,upper,.16]],
      ['Sleeve',[side*.374,1.136,0],.057,.055,[upper,lower,.9]],
    ];
    if(pattern.sleeve==='short')arm.push(['Cuff',[side*.382,1.121,0],.057*pattern.cuff,.055,[upper,lower,.75]]);
    else arm.push(
      ['Elbow',[side*.394,1.101,0],.049,.049,[upper,lower,.5]],
      ['ElbowLower',[side*.414,1.066,.002],.052,.049,[upper,lower,.08]],
      ['Cuff',[side*.508, .904,.014],.034*pattern.cuff,.034,[lower,hand,.18]],
    );
    let prev=socket;
    for(let row=0;row<arm.length;row++){
      const [label,center,width,depth,w]=arm[row];
      const next=ring(c,`Top.${name}.${label}`,center,[side*.866,.5,0],[0,0,1],HEX,width,depth,w);
      const color=label==='Cuff'?accent:primary;
      bridge(c,prev,next,row<2?'upperArm':'forearm',color);prev=next;
    }
    openings[name+'Cuff']=prev;
  }
  orient(c);c.anchors={...openings};
  return {id,slot:'top',version:GARMENT_GEOMETRY_VERSION,mesh:c,covers:pattern.sleeve==='short'?['torso','upperArm']:['torso','upperArm','forearm'],openings};
}
