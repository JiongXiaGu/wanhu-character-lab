import { B, rigid, type Recipe } from '../../../v3/types';
import { armBones, finishTop, sewSleeve, sewTorso, solidBand, torsoChest, torsoNeck, torsoRib, torsoWaist, type TorsoRow } from '../top-seams';

/** 边军独立版型：加厚低胸、收肩、立起护领；不调用宫卫作者工厂或叠一层相交甲壳。 */
export function makeFrontierTop(recipe:Recipe) {
  const {primary:cloth,secondary:iron,accent:binding}=recipe.dyes;
  const cuts=[-.064,-.018,.018,.064] as const;
  const tone=(hex:string,k:number)=>'#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)*k)).toString(16).padStart(2,'0')).join('');
  const seam=tone(iron,.74),plate=tone(iron,1.10),dark=tone(iron,.91);
  const band=(color:string)=>[color,color,seam,color,color,color];
  const rows:TorsoRow[]=[
    ['Hem',1.035,.174,.119,cuts,torsoWaist],
    ['Belt',1.080,.178,.122,[-.065,-.039,.039,.065],torsoWaist],
    ['BeltTop',1.107,.185,.131,[-.065,-.039,.039,.065],torsoWaist],
    ['Rib',1.180,.205,.150,cuts,torsoRib],
    ['Plate',1.231,.218,.161,cuts,[B.Spine,B.Chest,.14]],
    ['Chest',1.286,.222,.161,cuts,torsoChest],
    ['Shoulder',1.407,.227,.135,cuts,torsoChest],
    ['Collar',1.477,.098,.087,[-.046,-.014,.014,.046],torsoNeck],
    ['Neck',1.503,.070,.068,[-.030,-.010,.010,.030],torsoNeck],
  ];
  const torso=sewTorso(rows,[
    band(dark),[cloth,cloth,binding,cloth,cloth,cloth],
    band(plate),band(dark),band(plate),band(iron),[iron,cloth,cloth,cloth,iron,iron],solidBand(iron),
  ]);
  const cuffs:Record<string,number[]>={};
  for(const side of [1,-1] as const){
    const [upper,fore,hand]=armBones(side);
    cuffs[side===1?'RightCuff':'LeftCuff']=sewSleeve(torso,side,[
      ['ShoulderRoot',.241,1.330,0,.089,.084,[B.Chest,upper,.30],iron],
      ['ShoulderEdge',.272,1.274,0,.084,.081,[B.Chest,upper,.08],iron],
      ['ShoulderBinding',.287,1.252,0,.081,.079,rigid(upper),binding],
      ['Liner',.307,1.234,0,.065,.063,rigid(upper),cloth],
      ['ElbowUpper',.374,1.136,0,.057,.055,[upper,fore,.90],cloth],
      ['Elbow',.394,1.101,0,.051,.052,[upper,fore,.50],cloth],
      ['Bracer',.414,1.066,.002,.055,.052,[upper,fore,.08],iron],
      ['Cuff',.508,.904,.014,.037,.037,[fore,hand,.18],iron],
    ]);
  }
  // 只收紧腋侧三点，外侧保留边军厚而收敛的短护肩。每点仍最多两骨。
  const centers={ShoulderRoot:[.241,1.330,.089],ShoulderEdge:[.272,1.274,.084],ShoulderBinding:[.287,1.252,.081]} as const;
  for(const v of torso.mesh.vertices){
    const match=/^Top\.(Right|Left)\.(ShoulderRoot|ShoulderEdge|ShoulderBinding)\.(\d+)$/.exec(v.id);
    if(!match||Number(match[3])>2)continue;
    const side=match[1]==='Right'?1:-1,[x,y,width]=centers[match[2] as keyof typeof centers],factor=.060/width;
    v.p[0]=side*x+(v.p[0]-side*x)*factor;v.p[1]=y+(v.p[1]-y)*factor;
  }
  return finishTop(recipe,torso,cuffs,true);
}
