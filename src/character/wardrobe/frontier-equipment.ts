import { B, rigid, type Cage, type Recipe } from '../v3/types';
import { OCT, ring, bridge, face, vertex, orient } from '../v3/cage';

export const FRONTIER_EQUIPMENT_VERSION='wanhu-frontier-equipment-v1';

/** 低圆盔顶、宽后颈护片和暗赤包边；没有宫廷高缨，全部刚性随原Head。 */
export function addFrontierHelmet(target:Cage,recipe:Recipe):void {
  const c:Cage={vertices:[],faces:[],anchors:{}},w=rigid(B.Head),{secondary:iron,accent:binding}=recipe.dyes;
  const rows=[['Base',1.704,.142,.143],['Brow',1.732,.143,.144],['Dome',1.783,.127,.134],['Crown',1.831,.086,.090],['Ridge',1.852,.025,.031]] as const;
  const loops=rows.map(([id,y,x,z])=>ring(c,`FrontierHelmet.Shell.${id}`,[0,y,-.009],[1,0,0],[0,0,1],OCT,x,z,w));
  for(let i=0;i<loops.length-1;i++)bridge(c,loops[i],loops[i+1],'equipment',i===0?binding:iron);
  face(c,loops[0],'equipment',iron);face(c,loops.at(-1)!,'equipment',iron);
  // 半环护颈自有四条边界并完全封口；不依赖发片遮洞，不改身体或头部绑定。
  const strips:number[][]=[];
  for(const [label,y,radius] of [['OuterTop',1.720,.151],['OuterLow',1.535,.177],['InnerLow',1.540,.163],['InnerTop',1.720,.139]] as const){
    strips.push([2,3,4,5,6].map(i=>vertex(c,`FrontierHelmet.Neck.${label}.${i}`,[OCT[i][0]*radius,y,OCT[i][1]*radius-.009],w)));
  }
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)face(c,[strips[i][j],strips[i][j+1],strips[(i+1)%4][j+1],strips[(i+1)%4][j]],'equipment',i===1?binding:iron);
  face(c,strips.map(s=>s[0]),'equipment',iron);face(c,strips.map(s=>s[4]).reverse(),'equipment',iron);
  orient(c);const offset=target.vertices.length;
  target.vertices.push(...c.vertices);
  target.faces.push(...c.faces.map(f=>({...f,v:f.v.map(i=>i+offset)})));
}
