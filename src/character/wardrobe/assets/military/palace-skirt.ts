import { B, type Recipe, type Vec3, type Weight } from '../../../v3/types';
import { face, vertex, orient } from '../../../v3/cage';
import { makeTrouserShell } from '../trouser-shell';

/** 一件下装拥有裤装内衬与六片闭合甲裙。分片不跨中线，不复活旧分片裙裤。 */
export function makePalaceSkirt(recipe:Recipe) {
  const piece=makeTrouserShell(recipe,{thigh:1,knee:1,calf:1,hem:.095,trim:false});
  const c=piece.mesh;
  // 内衬可见区使用主布；封口仍由原下装入口使用secondary封闭。
  for(const f of c.faces)f.color=f.region==='pelvis'?recipe.dyes.secondary:recipe.dyes.primary;
  for(const side of [1,-1] as const){
    const thigh=side===1?B.RightThigh:B.LeftThigh,name=side===1?'Right':'Left';
    for(const [panel,angle] of [['Front',0],['Outer',Math.PI/2],['Back',Math.PI]] as const){
      const rows:number[][]=[];
      const rear=panel==='Back';
      const heights=rear?[.89,.855,.825]:panel==='Outer'?[.928,.805,.635]:[.80,.72,.635],radii=rear?[.119,.118,.116]:[.119,.113,.092],widths=rear?[.067,.068,.070]:[.067,.071,.061];
      const weights:Weight[]=[[thigh,thigh,1],[thigh,thigh,1],[thigh,thigh,1]];
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
