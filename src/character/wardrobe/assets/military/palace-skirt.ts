import { B, type Recipe, type Vec3, type Weight } from '../../../v3/types';
import { face, vertex, orient } from '../../../v3/cage';
import { makeTrouserShell } from '../trouser-shell';

/** 一件下装拥有裤装内衬与六片闭合甲裙。分片不跨中线，不复活旧分片裙裤。 */
export function makePalaceSkirt(recipe:Recipe) {
  const piece=makeTrouserShell(recipe,{thigh:1,knee:1,calf:1,hem:.095,trim:false});
  const c=piece.mesh;
  // 内衬可见区使用主布；封口仍由原下装入口使用secondary封闭。
  for(const f of c.faces)f.color=f.region==='pelvis'||f.v.every(i=>/\.(Root|Thigh)\./.test(c.vertices[i].id))?recipe.dyes.secondary:recipe.dyes.primary;
  for(const side of [1,-1] as const){
    const thigh=side===1?B.RightThigh:B.LeftThigh,name=side===1?'Right':'Left';
    for(const [panel,angle] of [['Front',0],['Outer',Math.PI/2],['Back',Math.PI]] as const){
      const rows:number[][]=[];
      const rear=panel==='Back',outer=panel==='Outer';
      const heights=rear?[.89,.855,.825]:outer?[.928,.805,.635]:[.80,.72,.635],radii=rear?[.116,.113,.110]:outer?[.115,.111,.097]:[.103,.099,.083],widths=rear?[.067,.068,.070]:[.067,.071,.061];
      // 外侧长片的上缘随髋部悬挂，向下逐渐随大腿；与相邻裤壳的髋部影响衔接。
      // 原整片刚性Thigh会在内收步态中横切Hips/Thigh混合的裤腿。只改新甲片，不改裤壳/动作/检测。
      // 双面厚度9毫米之外保留制作间距；全部权重一次写入，仍只使用现有两个骨骼。
      const weights:Weight[]=outer
        ? [[B.Hips,thigh,.526],[B.Hips,thigh,.28],[B.Hips,thigh,.108]]
        : [[thigh,thigh,1],[thigh,thigh,1],[thigh,thigh,1]];
      const normal:Vec3=[side*Math.sin(angle),0,Math.cos(angle)];
      const tangent:Vec3=[side*Math.cos(angle),0,-Math.sin(angle)];
      for(let row=0;row<3;row++){
        const loop:number[]=[];
        // 横截面四点构成有厚度的薄甲片；外层和内层共用所有缝边。
        for(const [t,d] of [[-1,0],[1,0],[1,-.009],[-1,-.009]]){
          const p:Vec3=[side*.101+normal[0]*(radii[row]+d)+tangent[0]*widths[row]*t,heights[row],normal[2]*(radii[row]+d)+tangent[2]*widths[row]*t];
          loop.push(vertex(c,`PalaceTasset.${name}.${panel}.${row}.${loop.length}`,p,[...weights[row]]));
        }
        rows.push(loop);
      }
      for(let row=0;row<2;row++)for(let j=0;j<4;j++)face(c,[rows[row][j],rows[row][(j+1)%4],rows[row+1][(j+1)%4],rows[row+1][j]],'thigh',recipe.dyes.secondary);
      face(c,[...rows[0]].reverse(),'thigh',recipe.dyes.secondary);
      face(c,rows[2],'thigh',recipe.dyes.accent);
    }
  }
  orient(c);
  return piece;
}
