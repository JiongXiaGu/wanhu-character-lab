import { B, type Cage, type Recipe, type Vec3, type Weight } from '../../../v3/types';
import { bridge, face, vertex, ring, orient } from '../../../v3/cage';
import { KNEE, kneeWeights } from '../../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from '../contract';

// 一条跨过前后中线的腰围，而不是两条裤腿各挂三片板。十边截面保留前、侧、后大面。
const PROFILE = [[.27,1],[.76,.88],[1,0],[.76,-.88],[.27,-1],[-.27,-1],[-.76,-.88],[-1,0],[-.76,.88],[-.27,1]] as const;
const ROWS = [[1.075,.165,.108],[.94,.207,.129],[.855,.223,.139],[.785,.235,.147],[.765,.237,.148]] as const;
const HIP_WEIGHTS = [1,.60,.45,.35,.33] as const;
const REAR_LIFT = [0,0,.012,.034,.035] as const;

function shade(color:string,factor:number):string {
  return '#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(color.slice(i,i+2),16)*factor)).toString(16).padStart(2,'0')).join('');
}

/** 腰起短裙甲与下方两个裤管共用接缝；只生成绑定空间几何和静态双权重。 */
export function makePalaceSkirt(recipe:Recipe):GarmentPiece {
  const c:Cage={vertices:[],faces:[],anchors:{}},openings:Record<string,number[]>={};
  const {primary:cloth,secondary:iron,accent:bronze}=recipe.dyes;
  const roots:number[][]=[];
  const legProfile:readonly (readonly [number,number])[]=[[-.45,.9],[.5,.9],[1,0],[.5,-.9],[-.45,-.9],[-.88,-.52],[-1,0],[-.88,.52]];
  for(const side of [1,-1] as const){
    const right=side===1,name=right?'Right':'Left',thigh=right?B.RightThigh:B.LeftThigh,shin=right?B.RightShin:B.LeftShin,foot=right?B.RightFoot:B.LeftFoot;
    const profile=right?legProfile:legProfile.map(([x,z])=>[-x,-z] as const);
    const rows:readonly [string,number,number,number,Weight][]=[
      ['Entry',.735,.081,.079,[B.Hips,thigh,.16]],
      ['KneeUpper',KNEE.upperY,.064,.061,[thigh,shin,.94]],
      ['Knee',KNEE.centerY,.060,.058,[thigh,shin,.5]],
      ['KneeLower',KNEE.lowerY,.061,.056,[thigh,shin,.06]],
      ['Calf',.29,.066,.064,[shin,shin,1]],
      ['Cuff',.095,.046,.045,[shin,foot,.2]],
    ];
    let previous:number[]=[];
    for(const [label,y,width,depth,weights] of rows){
      const loop=ring(c,`PalaceLiner.${name}.${label}`,[side*.101,y,0],[1,0,0],[0,0,1],profile,width,depth,weights);
      // 裙内的裤腿出口向裆部拱起，不用一张低位平底横穿两腿的运动空间。
      if(label==='Entry')for(const k of [0,4,5,6,7]){
        const frontOrBack=k===0||k===4;
        c.vertices[loop[k]].p[1]=frontOrBack?.835:k===6?.850:.865;
        c.vertices[loop[k]].w=[B.Hips,thigh,frontOrBack?.40:k===6?.35:.50];
      }
      // 复用既有膝前/膝后有限权重操作，不修改原裤装资产或关节坐标。
      if(label.startsWith('Knee')||label==='Calf')for(const i of loop)c.vertices[i].w=kneeWeights(c.vertices[i].p,thigh,shin);
      if(previous.length)bridge(c,previous,loop,label==='KneeUpper'?'thigh':'shin',cloth);else roots.push(loop);
      previous=loop;
    }
    openings[name+'Cuff']=previous;
  }
  const [r,l]=roots,right=[r[4],r[5],r[6],r[7],r[0]],left=[l[0],l[7],l[6],l[5],l[4]];
  for(let k=0;k<4;k++)face(c,[right[k],right[k+1],left[k+1],left[k]],'thigh',iron);
  const entry=[r[0],r[1],r[2],r[3],r[4],l[0],l[1],l[2],l[3],l[4]];
  let previous:number[]=[];
  for(let row=0;row<ROWS.length;row++){
    const [y,width,depth]=ROWS[row];
    const loop=PROFILE.map(([x,z],column)=>{
      const thigh=x>0?B.RightThigh:B.LeftThigh;
      // 腰围随骨盆；下摆渐进跟腿。避免腰随脊柱前倾而裙底抬起时相互折入。
      const weights:Weight=row===0?[B.Hips,B.Hips,1]:[B.Hips,thigh,HIP_WEIGHTS[row]];
      const point:Vec3=[x*width,y+Math.max(0,-z)*REAR_LIFT[row],z*depth];
      return vertex(c,`PalaceSkirt.${row}.${column}`,point,weights);
    });
    if(!row)openings.waist=loop;
    else bridge(c,previous,loop,row===1?'pelvis':'thigh',row===ROWS.length-1?bronze:shade(iron,[1,.96,1.07,.92][row]));
    previous=loop;
  }
  // 裙底向两个裤腿出口回收，形成完整闭合下装；不外叠内裤、不加裙底接触豁免。
  bridge(c,previous,entry,'thigh',iron);
  orient(c);c.anchors={...openings};
  return{id:recipe.slots.bottom,slot:'bottom',version:GARMENT_GEOMETRY_VERSION,mesh:c,covers:['pelvis','thigh','shin'],openings};
}
