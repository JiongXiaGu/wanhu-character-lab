import { B, rigid, type Cage, type Recipe } from '../v3/types';
import { OCT, ring, bridge, face, vertex, orient } from '../v3/cage';

export const CITY_EQUIPMENT_VERSION='wanhu-city-equipment-v1';

/** 城市独立低檐盔：宽而短的实体盔檐、低盔顶和短后片；不是宫卫/边军盔换色。 */
export function addCityHelmet(target:Cage,recipe:Recipe):void {
  const c:Cage={vertices:[],faces:[],anchors:{}},w=rigid(B.Head);
  const {primary:cloth,secondary:iron,accent:binding}=recipe.dyes;
  const rows=[
    ['Base',1.704,.142,.140],['BrimLow',1.706,.183,.177],
    ['BrimHigh',1.720,.183,.177],['Brow',1.737,.144,.141],
    ['Dome',1.775,.128,.128],['Crown',1.811,.076,.075],['Ridge',1.828,.024,.027],
  ] as const;
  const loops=rows.map(([id,y,x,z])=>ring(c,`CityHelmet.Shell.${id}`,[0,y,-.006],[1,0,0],[0,0,1],OCT,x,z,w));
  for(let i=0;i<loops.length-1;i++)bridge(c,loops[i],loops[i+1],'equipment',i===1?binding:i===2?cloth:iron);
  face(c,loops[0],'equipment',iron);face(c,loops.at(-1)!,'equipment',iron);
  // 短后片自有厚度和封边，不延伸为边军长护颈。四条半环组成闭合小壳。
  const strips:number[][]=[];
  for(const [label,y,radius] of [['OuterTop',1.706,.149],['OuterLow',1.645,.157],['InnerLow',1.650,.144],['InnerTop',1.706,.136]] as const){
    strips.push([2,3,4,5,6].map(i=>vertex(c,`CityHelmet.Neck.${label}.${i}`,[OCT[i][0]*radius,y,OCT[i][1]*radius-.006],w)));
  }
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)face(c,[strips[i][j],strips[i][j+1],strips[(i+1)%4][j+1],strips[(i+1)%4][j]],'equipment',i===1?binding:iron);
  face(c,strips.map(s=>s[0]),'equipment',iron);face(c,strips.map(s=>s[4]).reverse(),'equipment',iron);
  orient(c);const offset=target.vertices.length;
  target.vertices.push(...c.vertices);target.faces.push(...c.faces.map(f=>({...f,v:f.v.map(i=>i+offset)})));
}
