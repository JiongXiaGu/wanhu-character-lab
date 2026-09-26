import { B, type Cage, type Recipe, type Vec3, type Weight } from '../../../v3/types';
import { bridge, face, vertex, orient } from '../../../v3/cage';
import { kneeWeights } from '../../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from '../contract';

const PROFILE = [[.27,1],[.76,.88],[1,0],[.76,-.88],[.27,-1],[-.27,-1],[-.76,-.88],[-1,0],[-.76,.88],[-.27,1]] as const;
const ROWS = [
  ['Waist',1.205,.195,.132,1],['Yoke',1.105,.220,.140,.72],
  ['Hip',.980,.254,.158,.60],['Upper',.850,.275,.174,.38],
  ['Middle',.720,.292,.185,.18],['KneeUpper',.580,.303,.190,0],
  ['Knee',.489,.310,.190,0],['KneeLower',.449,.314,.190,0],
  ['Lower',.380,.318,.188,0],['Hem',.345,.320,.186,0],
] as const;
const LEG = [[-.45,.9],[.5,.9],[1,0],[.5,-.9],[-.45,-.9],[-.88,-.52],[-1,0],[-.88,.52]] as const;
const shade=(color:string,factor:number)=>'#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(color.slice(i,i+2),16)*factor)).toString(16).padStart(2,'0')).join('');

export function makeHeavyArmorSkirt(recipe: Recipe): GarmentPiece {
  const c: Cage = { vertices: [], faces: [], anchors: {} }, openings: Record<string, number[]> = {};
  const { primary: cloth, secondary: iron, accent: binding } = recipe.dyes;
  let previous: number[] = [];
  // 外部十圈长裳保持原轮廓；内部裆口不能决定可见裙长。
  for (let row=0; row<ROWS.length; row++) {
    const [label,y,width,depth,hip]=ROWS[row];
    const loop=PROFILE.map(([x,z],column)=>{
      const thigh=x>0?B.RightThigh:B.LeftThigh, shin=x>0?B.RightShin:B.LeftShin;
      const point: Vec3=[x*width,y,z*depth*(row>=3&&z>0?.72:1)];
      const weights: Weight=row===0?[B.Hips,B.Hips,1]:row<5?
        [B.Hips,thigh,hip+(1-hip)*.16*(1-z)]:kneeWeights(point,thigh,shin);
      return vertex(c,`HeavyArmorSkirt.${label}.${column}`,point,weights);
    });
    if (!row) openings.waist=loop;
    else bridge(c,previous,loop,row<3?'pelvis':'thigh',label==='Yoke'||label==='Hem'?binding:shade(iron,row%2?1.16:.96));
    previous=loop;
  }
  const hem=previous, roots:number[][]=[];
  for (const side of [1,-1] as const) {
    const name=side===1?'Right':'Left', thigh=side===1?B.RightThigh:B.LeftThigh;
    const shin=side===1?B.RightShin:B.LeftShin, foot=side===1?B.RightFoot:B.LeftFoot;
    previous=[];
    // 低位跨腿平底改为高拱内裆，内腿具有真实膝上/膝/膝下过渡。
    for (const [label,y,width,depth] of [
      ['Opening',.655,.073,.077],['KneeUpper',.529,.064,.061],
      ['Knee',.489,.060,.058],['KneeLower',.449,.061,.056],
      ['Calf',.270,.065,.062],['Cuff',.095,.046,.045],
    ] as const) {
      const loop=LEG.map(([x,z],column)=>{
        const point:Vec3=[side*(.101+x*width),y,side*z*depth];
        let weights:Weight=label==='Cuff'?[shin,foot,.2]:kneeWeights(point,thigh,shin);
        if(label==='Opening') {
          const inner=column===0||column>=4;
          point[1]=inner?(column===0||column===4?.835:column===6?.850:.865):y;
          weights=[B.Hips,thigh,inner?(column===0||column===4?.40:column===6?.35:.50):.12];
        }
        return vertex(c,`HeavyArmorLiner.${name}.${label}.${column}`,point,weights);
      });
      if(previous.length) bridge(c,previous,loop,'shin',label==='Cuff'?cloth:iron); else roots.push(loop);
      previous=loop;
    }
    openings[name+'Cuff']=previous;
  }
  const [r,l]=roots, right=[r[4],r[5],r[6],r[7],r[0]], left=[l[0],l[7],l[6],l[5],l[4]];
  for(let k=0;k<4;k++) face(c,[right[k],right[k+1],left[k+1],left[k]],'thigh',iron);
  bridge(c,hem,[r[0],r[1],r[2],r[3],r[4],l[0],l[1],l[2],l[3],l[4]],'thigh',iron);
  orient(c);
  // 固定作者对角线，避免前回折面使用原来横切两腿的三角扇；不依赖动作相位。
  const frontReturn=c.faces.find(f=>f.v.some(i=>c.vertices[i].id==='HeavyArmorLiner.Left.Opening.4')&&f.v.some(i=>c.vertices[i].id==='HeavyArmorSkirt.Hem.0'));
  if(frontReturn) frontReturn.v.push(frontReturn.v.shift()!);
  c.anchors={...openings};
  return { id:recipe.slots.bottom,slot:'bottom',version:GARMENT_GEOMETRY_VERSION,mesh:c,covers:['pelvis','thigh','shin'],openings };
}
