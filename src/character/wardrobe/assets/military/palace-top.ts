import { B, rigid, type Recipe } from '../../../v3/types';
import { armBones, finishTop, sewSleeve, sewTorso, solidBand, torsoChest, torsoNeck, torsoRib, torsoWaist, type TorsoRow } from '../top-seams';

/** 宫卫上甲自有胸甲截面、横向甲带及阶梯护肩；不是普通短衣外贴一层壳。 */
export function makePalaceTop(recipe:Recipe) {
  const {primary:cloth,secondary:iron,accent:bronze}=recipe.dyes;
  const cuts=[-.060,-.012,.012,.060] as const;
  const tone=(hex:string,k:number)=>'#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)*k)).toString(16).padStart(2,'0')).join('');
  const seam=tone(iron,.70),plate=tone(iron,1.22),dark=tone(iron,.90);
  const band=(color:string)=>[color,color,seam,color,color,color];
  const rows:TorsoRow[]=[
    ['Hem',1.035,.170,.110,cuts,torsoWaist],
    ['Belt',1.080,.171,.112,[-.065,-.039,.039,.065],torsoWaist],
    ['BeltTop',1.107,.177,.117,[-.065,-.039,.039,.065],torsoWaist],
    ['Rib',1.180,.195,.135,cuts,torsoRib],
    ['Plate',1.241,.212,.143,cuts,[B.Spine,B.Chest,.14]],
    ['Chest',1.300,.225,.143,cuts,torsoChest],
    ['Shoulder',1.414,.241,.126,cuts,torsoChest],
    ['Collar',1.452,.098,.078,[-.046,-.014,.014,.046],torsoNeck],
    ['Neck',1.465,.067,.063,[-.030,-.010,.010,.030],torsoNeck],
  ];
  const torso=sewTorso(rows,[
    band(dark),[cloth,cloth,bronze,cloth,cloth,cloth],
    band(plate),band(dark),band(plate),band(iron),[iron,cloth,cloth,cloth,iron,iron],solidBand(cloth),
  ]);
  const cuffs:Record<string,number[]>={};
  for(const side of [1,-1] as const){
    const [upper,fore,hand]=armBones(side);
    cuffs[side===1?'RightCuff':'LeftCuff']=sewSleeve(torso,side,[
      ['PauldronRoot',.246,1.337,0,.108,.079,[B.Chest,upper,.30],iron],
      ['PauldronEdge',.280,1.279,0,.102,.077,[B.Chest,upper,.08],iron],
      ['PauldronRim',.292,1.259,0,.098,.075,rigid(upper),bronze],
      ['Liner',.307,1.234,0,.065,.063,rigid(upper),cloth],
      ['ElbowUpper',.374,1.136,0,.057,.055,[upper,fore,.90],cloth],
      ['Elbow',.394,1.101,0,.051,.052,[upper,fore,.50],cloth],
      ['Bracer',.414,1.066,.002,.055,.052,[upper,fore,.08],iron],
      ['Cuff',.508,.904,.014,.037,.037,[fore,hand,.18],iron],
    ]);
  }
  // 护肩只扩张向外、向上的三点，腋下不能等比膨胀后压入胸甲。
  const centers={PauldronRoot:[.246,1.337,.108],PauldronEdge:[.280,1.279,.102],PauldronRim:[.292,1.259,.098]} as const;
  for(const v of torso.mesh.vertices){
    const match=/^Top\.(Right|Left)\.(PauldronRoot|PauldronEdge|PauldronRim)\.(\d+)$/.exec(v.id);
    if(!match||Number(match[3])>2)continue;
    const side=match[1]==='Right'?1:-1,[x,y,width]=centers[match[2] as keyof typeof centers],factor=.062/width;
    v.p[0]=side*x+(v.p[0]-side*x)*factor;v.p[1]=y+(v.p[1]-y)*factor;
  }
  return finishTop(recipe,torso,cuffs,true);
}
