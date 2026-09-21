import { type Recipe } from '../../v3/types';
import { face, orient } from '../../v3/cage';
import { sewTorso, sewSleeve, finishTop, solidBand, torsoWaist, torsoRib, torsoChest, torsoNeck, type TorsoRow } from './top-seams';
import type { GarmentPiece } from './contract';

/** 无袖对襟短褂：宽肩带保持，领口／双袖窿／腰口在试验款中直接用 Cap 封死。 */
export function makeWorkVest(recipe:Recipe):GarmentPiece {
  const {primary,secondary,accent}=recipe.dyes;
  const rows:readonly TorsoRow[]=[
    ['Hem',1.045,.176,.108,[-.022,-.009,.009,.022],torsoWaist],
    ['HemFacing',1.068,.174,.109,[-.022,-.009,.009,.022],torsoWaist],
    ['Rib',1.18,.192,.120,[-.025,-.010,.010,.025],torsoRib],
    ['Chest',1.30,.214,.124,[-.036,-.020,.020,.036],torsoChest],
    ['Shoulder',1.402,.222,.111,[-.050,-.030,.030,.050],torsoChest],
    ['Neck',1.455,.070,.061,[-.035,-.019,.019,.035],torsoNeck],
  ];
  // 中央布片与两侧包边共享索引；没有额外悬浮门襟。
  const placket=[primary,accent,secondary,accent,primary,primary];
  const torso=sewTorso(rows,[solidBand(accent),placket,placket,placket,placket]);
  // 不生成袖筒；人体手臂继续保留，并直接穿过袖窿 Cap。
  const cuffs={RightCuff:sewSleeve(torso,1,[]),LeftCuff:sewSleeve(torso,-1,[])};
  const piece=finishTop(recipe,torso,cuffs,false);
  piece.covers=['torso'];
  const sealedInterfaces={...piece.openings};
  // torso 环前襟有多枚共线切点；把扇形根移到后中点，避免 n-gon 默认扇分产生退化三角形。
  const capOrder=(loop:number[])=>[...loop.slice(8),...loop.slice(0,8)];
  face(piece.mesh,capOrder(sealedInterfaces.waist),'torso',secondary);
  face(piece.mesh,capOrder(sealedInterfaces.neck),'torso',accent);
  face(piece.mesh,[...sealedInterfaces.RightCuff],'upperArm',secondary);
  face(piece.mesh,[...sealedInterfaces.LeftCuff],'upperArm',secondary);
  piece.openings={};
  piece.sealedInterfaces=sealedInterfaces;
  orient(piece.mesh);
  piece.mesh.anchors={...sealedInterfaces};
  return piece;
}
