import { B, rigid, type Cage, type Recipe } from '../v3/types';
import { BOX, bridge, face, orient, ring, vertex } from '../v3/cage';

export const OFFICIAL_CAP_ID = 'official_winged_cap' as const;
export const OFFICIAL_CAP_VERSION = 'c3-official-winged-cap-v1';
export const OFFICIAL_CAP_TRIANGLES = 84;

/** 方圆角帽身；不是 scholar_cap 的缩放或加长横条。 */
const CAP_PROFILE = [
  [.70, 1], [1, .70], [1, -.70], [.70, -1],
  [-.70, -1], [-1, -.70], [-1, .70], [-.70, 1],
] as const;
const shade = (hex: string, factor: number): string => '#'+[1,3,5]
  .map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*factor).toString(16).padStart(2,'0')).join('');

/**
 * C3 绑定空间作者资产：一个封闭帽身、左右两个封闭薄翅。
 * 留量直接写入作者坐标；固定男女的映射仍由原人物装配完成。
 * 只读取染色，不读取职业、动画、相机或发型；全部刚性绑定 Head。
 */
export function makeOfficialCap(recipe: Recipe): Cage {
  const c: Cage = {vertices:[],faces:[],anchors:{}};
  const weight = rigid(B.Head);
  const cloth = shade(recipe.dyes.primary,.36);
  const roofColor = shade(recipe.dyes.primary,.43);
  const edgeColor = shade(recipe.dyes.secondary,.22);
  const baseY = 1.716, centerZ = -.009, width = .140, depth = .134, taper = .48;
  const base = ring(c,'OfficialCap.Shell.Base',[0,baseY,centerZ],[1,0,0],[0,0,1],CAP_PROFILE,width,depth,weight);
  const bandDy = .025, bandScale = 1-taper*bandDy;
  const band = ring(c,'OfficialCap.Shell.Band',[0,baseY+bandDy,centerZ],[1,0,0],[0,0,1],CAP_PROFILE,width*bandScale,depth*bandScale,weight);
  // 斜屋顶与同一缓收锥体相交：保持侧面共面及凸帽壳包覆，不把四边面扭成鞍面。
  const roof = CAP_PROFILE.map(([x,z],i)=>{
    const dz=z*depth;
    const dy=(.138-.20*dz)/(1-.20*dz*taper);
    const scale=1-taper*dy;
    return vertex(c,`OfficialCap.Shell.Roof.${i}`,[x*width*scale,baseY+dy,centerZ+dz*scale],[...weight]);
  });
  bridge(c,base,band,'equipment',cloth);
  bridge(c,band,roof,'equipment',cloth);
  // 只使用既有 Shell 帽底制作接口；帽侧、帽顶和薄翅仍完整检查帽发贯穿。
  face(c,[...base].reverse(),'equipment',cloth);
  face(c,roof,'equipment',roofColor);

  for(const [side,name] of [[-1,'Right'],[1,'Left']] as const){
    const root = ring(c,`OfficialCap.${name}Wing.Root`,[side*.124,1.768,-.117],[0,1,0],[0,0,1],BOX,.015,.020,weight);
    const middle = ring(c,`OfficialCap.${name}Wing.Middle`,[side*.280,1.781,-.147],[0,1,0],[0,0,1],BOX,.011,.019,weight);
    const tip = ring(c,`OfficialCap.${name}Wing.Tip`,[side*.335,1.786,-.155],[0,1,0],[0,0,1],BOX,.008,.014,weight);
    bridge(c,root,middle,'equipment',cloth);
    bridge(c,middle,tip,'equipment',cloth);
    face(c,[...root].reverse(),'equipment',cloth);
    face(c,tip,'equipment',edgeColor);
  }
  orient(c);
  return c;
}

export function addOfficialCap(target: Cage, recipe: Recipe): void {
  const piece=makeOfficialCap(recipe),offset=target.vertices.length;
  target.vertices.push(...piece.vertices);
  target.faces.push(...piece.faces.map(f=>({...f,v:f.v.map(i=>i+offset)})));
}
