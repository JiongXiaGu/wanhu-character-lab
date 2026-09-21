import { type Recipe } from '../../v3/types';
import { sewTorso, sewSleeve, finishTop, solidBand, torsoWaist, torsoRib, torsoChest, torsoNeck, type TorsoRow } from './top-seams';
import type { GarmentPiece } from './contract';

/** 无袖对襟短褂：宽肩带和袖窿本身是边界，没有假装成背心的内层长袖。 */
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
  // 不生成袖筒，仅声明真实袖窿；保留源人体完整肩臂皮肤。
  const cuffs={RightCuff:sewSleeve(torso,1,[]),LeftCuff:sewSleeve(torso,-1,[])};
  const piece=finishTop(recipe,torso,cuffs,false);
  piece.covers=['torso'];
  return piece;
}
