import { B, rigid, type Recipe } from '../../../v3/types';
import { armBones, finishTop, sewSleeve, sewTorso, solidBand, torsoChest, torsoNeck, torsoRib, torsoWaist, type TorsoRow } from '../top-seams';

/** 城市布面短甲：窄肩、浅胸、低领与宽腰带共用一张连续衣壳，不套用宫卫或边军工厂。 */
export function makeCityTop(recipe:Recipe) {
  const {primary:cloth,secondary:iron,accent:belt}=recipe.dyes;
  const cuts=[-.060,-.019,.019,.060] as const;
  const tone=(hex:string,k:number)=>'#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)*k)).toString(16).padStart(2,'0')).join('');
  const seam=tone(cloth,.76),panel=tone(cloth,1.08);
  const rows:TorsoRow[]=[
    ['Hem',1.060,.168,.112,cuts,torsoWaist],
    ['Belt',1.087,.179,.122,[-.063,-.035,.035,.063],torsoWaist],
    ['BeltTop',1.120,.179,.122,[-.063,-.035,.035,.063],torsoWaist],
    ['Rib',1.188,.183,.122,cuts,torsoRib],
    ['Chest',1.300,.203,.125,cuts,torsoChest],
    ['Shoulder',1.398,.214,.108,cuts,torsoChest],
    ['Collar',1.432,.095,.072,[-.044,-.014,.014,.044],torsoNeck],
    ['Neck',1.465,.067,.061,[-.028,-.010,.010,.028],torsoNeck],
  ];
  const torso=sewTorso(rows,[
    solidBand(cloth),[belt,belt,iron,belt,belt,belt],
    [cloth,panel,seam,panel,cloth,cloth],
    [cloth,panel,seam,panel,cloth,cloth],
    [cloth,panel,seam,panel,cloth,cloth],
    [iron,cloth,seam,cloth,iron,cloth],solidBand(cloth),
  ]);
  const cuffs:Record<string,number[]>={};
  for(const side of [1,-1] as const){
    const [upper,fore,hand]=armBones(side);
    cuffs[side===1?'RightCuff':'LeftCuff']=sewSleeve(torso,side,[
      ['ShoulderRoot',.245,1.308,0,.062,.061,[B.Chest,upper,.18],iron],
      ['ShoulderEdge',.292,1.257,0,.063,.062,rigid(upper),cloth],
      ['ElbowUpper',.374,1.136,0,.057,.055,[upper,fore,.90],cloth],
      ['Elbow',.394,1.101,0,.051,.052,[upper,fore,.50],cloth],
      ['Bracer',.414,1.066,.002,.053,.051,[upper,fore,.08],iron],
      ['Wrist',.493,.929,.013,.038,.038,[fore,hand,.45],iron],
      ['Cuff',.508,.904,.014,.036,.036,[fore,hand,.18],belt],
    ]);
  }
  return finishTop(recipe,torso,cuffs,true);
}
