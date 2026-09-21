import { B, type Weight } from '../../v3/types';
import { KNEE } from '../../v3/leg-deformation';
export type LegRow=readonly [name:string,y:number,width:number,depth:number,weights:Weight,color:'primary'|'secondary'|'accent'];

/** 两种独立裤腿制作表。膝关节位置/梯度不改变，差异集中在外侧余量、裤脚和束口。 */
export function straightClothRows(thigh:number,shin:number,foot:number):readonly LegRow[]{
  return[
    ['Thigh',.805,.091,.087,[B.Hips,thigh,.28],'secondary'],
    ['KneeUpper',KNEE.upperY,.071,.061,[thigh,shin,.94],'secondary'],
    ['Knee',KNEE.centerY,.067,.058,[thigh,shin,.5],'secondary'],
    ['KneeLower',KNEE.lowerY,.069,.056,[thigh,shin,.06],'secondary'],
    ['Calf',.29,.073,.064,[shin,shin,1],'secondary'],
    ['HemFacing',.123,.066,.055,[shin,foot,.12],'secondary'],
    ['Cuff',.095,.066,.055,[shin,foot,.2],'accent'],
  ];
}
export function boundActionRows(thigh:number,shin:number,foot:number):readonly LegRow[]{
  return[
    ['Thigh',.805,.091,.087,[B.Hips,thigh,.28],'secondary'],
    ['KneeUpper',KNEE.upperY,.067,.061,[thigh,shin,.94],'secondary'],
    ['Knee',KNEE.centerY,.062,.058,[thigh,shin,.5],'secondary'],
    ['KneeLower',KNEE.lowerY,.061,.056,[thigh,shin,.06],'secondary'],
    ['Calf',.29,.056,.060,[shin,shin,1],'secondary'],
    ['BindingTop',.188,.050,.047,[shin,shin,1],'secondary'],
    ['BindingEdge',.165,.047,.045,[shin,shin,1],'primary'],
    ['Cuff',.095,.046,.045,[shin,foot,.2],'accent'],
  ];
}
