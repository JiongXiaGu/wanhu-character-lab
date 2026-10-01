import { B, type Recipe } from '../../v3/types';
import { armBones, finishTop, sewSleeve, sewTorso, solidBand, torsoChest, torsoNeck, torsoRib } from './top-seams';

/** C2 短襦：独立短身纸样、收口窄长袖和小对襟；只复用有限缝片操作。
 * 不读 bottom / bodyType / 动作。高腰组合靠固定留量，换装不临时改形。
 */
export function makeCourtMaidJacket(recipe:Recipe) {
  const {primary:p,secondary:s,accent:a}=recipe.dyes;
  const front=[p,s,p,s,p,p];
  const torso=sewTorso([
    ['Hem',1.162,.188,.130,[-.047,-.020,.020,.047],[B.Spine,B.Chest,.45]],
    ['HemFacing',1.176,.189,.130,[-.047,-.020,.020,.047],[B.Spine,B.Chest,.4]],
    ['Rib',1.190,.189,.130,[-.041,-.016,.016,.041],torsoRib],
    ['UpperRib',1.247,.204,.127,[-.035,-.013,.013,.035],[B.Spine,B.Chest,.15]],
    ['Chest',1.300,.214,.125,[-.030,-.010,.010,.030],torsoChest],
    ['Shoulder',1.407,.221,.110,[-.030,-.010,.010,.030],torsoChest],
    ['Facing',1.444,.105,.085,[-.041,-.019,.019,.041],[B.Chest,B.Neck,.60]],
    ['Neck',1.460,.066,.061,[-.039,-.018,.018,.039],torsoNeck],
  ],[solidBand(a),front,front,front,front,front,solidBand(s)]);
  // 胸环保持连续，不再把六个胸侧点下挖成台阶。
  // 肩外端小幅落肩，前后肩角同步下降，背侧不做独立鼓壳。
  for(const k of [6,10])torso.mesh.vertices[torso.shoulder[k]].p[1]-=.006;
  for(const k of [0,5,7,9])torso.mesh.vertices[torso.shoulder[k]].p[1]-=.003;
  const cuffs:Record<string,number[]>={};
  for(const side of [1,-1] as const) {
    const [u,l,h]=armBones(side);
    cuffs[side===1?'RightCuff':'LeftCuff']=sewSleeve(torso,side,[
      // 有体积的袖山上提，与肩线顺接；内下缘保持胸侧留量。
      // 袖山一半随胸、上袖一成随胸，逐段释放到上臂；避免收臂时折回衣身。
      ['Shoulder',.290,1.320,0,.050,.063,[B.Chest,u,.50],p],
      ['UpperSleeve',.320,1.250,0,.050,.055,[B.Chest,u,.10],p],
      ['Sleeve',.340,1.189,0,.052,.049,[u,l,1],p],
      ['Elbow',.394,1.101,0,.043,.041,[u,l,.5],p],
      ['ElbowLower',.414,1.066,.002,.047,.043,[u,l,.08],p],
      ['WristFacing',.492,.932,.014,.039,.037,[l,h,.4],p],
      ['Cuff',.508,.904,.014,.036,.034,[l,h,.18],a],
    ]);
  }
  // 静态肘内侧展开权重带：只在作者阶段生成最多双权重。
  for(const v of torso.mesh.vertices)if(/Top\.(Right|Left)\.(Sleeve|Elbow|ElbowLower)\./.test(v.id)){
    const side=v.id.includes('.Right.')?1:-1,[upper,lower]=armBones(side as 1|-1);
    const along=(v.p[0]-side*.394)*side*.570-(v.p[1]-1.101)*.822;
    const half=.045+4*Math.max(0,v.p[2]);
    v.w=[upper,lower,Math.max(0,Math.min(1,.5-along/(2*half)))];
  }
  const piece=finishTop(recipe,torso,cuffs,true);
  // 保留腰部皮肤；不靠扩大 covers 隐藏胸侧破面。
  piece.covers=['upperArm','forearm'];
  for(const v of piece.mesh.vertices)v.id=v.id.replace(/^Top\./,'MaidJacket.');
  return piece;
}
