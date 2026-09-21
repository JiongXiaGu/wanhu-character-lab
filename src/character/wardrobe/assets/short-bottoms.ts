import { B, type Cage, type Recipe, type Vec3, type Weight } from '../../v3/types';
import { ring, bridge, face, vertex, orient } from '../../v3/cage';
import { kneeWeights } from '../../v3/leg-deformation';
import { GARMENT_GEOMETRY_VERSION, type GarmentPiece } from './contract';

/**
 * 短裤与短下裳各有制作轮廓。两者保留有限宽裆底；短下裳是有中间行走开衩的
 * A 字分片裙裤，不是连续布料裙。无需独立内衬槽位或每帧补偿。
 */
export function makeShortBottom(recipe:Recipe):GarmentPiece {
  const id=recipe.slots.bottom;
  if(id!=='short_trousers'&&id!=='short_skirt')throw new Error('未知短下装：'+id);
  const skirt=id==='short_skirt', c:Cage={vertices:[],faces:[],anchors:{}};
  const {primary,secondary,accent}=recipe.dyes;
  const profile:[number,number][]=[[-.45,.9],[.5,.9],[1,0],[.5,-.9],[-.45,-.9],[-.88,-.52],[-1,0],[-.88,.52]];
  const roots:number[][]=[],openings:Record<string,number[]>={},sealedInterfaces:Record<string,number[]>={};
  for(const side of [1,-1]){
    const name=side===1?'Right':'Left',thigh=side===1?B.RightThigh:B.LeftThigh,shin=side===1?B.RightShin:B.LeftShin;
    const directed=side===1?profile:profile.map(([x,z])=>[-x,-z] as [number,number]);
    const root=ring(c,`Shorts.${name}.Root`,[side*.101,.94,0],[1,0,0],[0,0,1],directed,.09,.094,[B.Hips,thigh,.55]);
    for(const k of [5,6,7]){c.vertices[root[k]].p[1]=k===6?.855:.882;c.vertices[root[k]].w=[B.Hips,thigh,k===6?.35:.5];}
    roots.push(root);let prev=root;
    const rows:readonly [string,number,number,number][] = skirt ? [
      ['PleatHigh',.805,.108,.110],['Flare',.650,.146,.124],
      ['HemFacing',.542,.165,.136],['Hem',.511,.165,.136],
    ] : [
      ['Thigh',.805,.098,.092],['CuffFacing',.550,.087,.081],['Cuff',.507,.087,.081],
    ];
    for(let r=0;r<rows.length;r++){
      const [label,y,width,depth]=rows[r];
      const w:Weight=r===0?[B.Hips,thigh,.28]:[thigh,shin,1];
      const next=ring(c,`Shorts.${name}.${label}`,[side*.101,y,0],[1,0,0],[0,0,1],directed,width,depth,w);
      if(skirt){
        // 扇形前后衣片向外展开，内侧开衩不横跨另一条腿；不是整条裤腿等比放大。
        const x=[.014,.101+.5*width,.101+width,.101+.5*width,.014,.006,.003,.006];
        const z=[.92*depth,.98*depth,0,-.98*depth,-.92*depth,-.52*depth,0,.52*depth];
        for(let k=0;k<8;k++)c.vertices[next[k]].p=[side*x[k],y,side*z[k]] as Vec3;
      }
      const inner:readonly [number,number][]=skirt?
        [[.089,.087],[.077,.082],[.075,.090],[.075,.090]]:
        [[.089,.087],[.075,.090],[.075,.090]];
      const [innerWidth,innerDepth]=inner[r];
      for(const k of [0,4,5,6,7])c.vertices[next[k]].p=[side*(.101+profile[k][0]*innerWidth),y,side*profile[k][1]*innerDepth];
      if(r>0)for(const vi of next)c.vertices[vi].w=kneeWeights(c.vertices[vi].p,thigh,shin);
      // 两圈裤口一起加宽，不做单独外翻片；原梯度向整圈基准收敛35%。
      // 保留深蹲膝后让位，降低坐姿尖翘；全部是制作期静态权重。
      if(!skirt&&r>0)for(const vi of next){const v=c.vertices[vi];
        v.p[0]=side*.101+(v.p[0]-side*.101)*1.1;v.p[2]*=1.1;
        v.w[2]=v.w[2]*.65+(r===rows.length-1?.60:.80)*.35;
      }
      if(skirt&&r<rows.length-1){
        // 褶面色区在自身衣片上；不叠放会与腿互相穿插的装饰薄片。
        for(let k=0;k<8;k++)face(c,[prev[k],prev[(k+1)%8],next[(k+1)%8],next[k]],'thigh',[0,3].includes(k)?primary:secondary);
      }else bridge(c,prev,next,'thigh',r===rows.length-1?accent:secondary);
      prev=next;
    }
    if(!skirt){
      // 试验款不再制作内缩裤脚断面，直接用现有 Cuff 八边环封底。
      // 小腿允许穿过该不可见 Cap；正常镜头只需要避免看到裤筒背面或背景。
      face(c,[...prev],'thigh',accent);
      sealedInterfaces[name+'Cuff']=prev;
    }else openings[name+'Cuff']=prev;
  }
  const [rightRoot,leftRoot]=roots;
  const r=[rightRoot[4],rightRoot[5],rightRoot[6],rightRoot[7],rightRoot[0]],l=[leftRoot[0],leftRoot[7],leftRoot[6],leftRoot[5],leftRoot[4]];
  for(let i=0;i<4;i++)face(c,[r[i],r[i+1],l[i+1],l[i]],'pelvis',secondary);
  const perimeter=[rightRoot[0],rightRoot[1],rightRoot[2],rightRoot[3],rightRoot[4],leftRoot[0],leftRoot[1],leftRoot[2],leftRoot[3],leftRoot[4]];
  const waist=perimeter.map((vi,i)=>{const p=c.vertices[vi].p;return vertex(c,`Shorts.Waist.${i}`,[p[0]*.79,1.075,p[2]*.97],[B.Hips,B.Spine,.35]);});
  const band=perimeter.map((vi,i)=>{const p=c.vertices[vi].p;return vertex(c,`Shorts.WaistFacing.${i}`,[p[0]*.84,1.047,p[2]*.98],[B.Hips,B.Spine,.35]);});
  bridge(c,waist,band,'pelvis',primary);bridge(c,band,perimeter,'pelvis',secondary);
  if(skirt)openings.waist=waist;
  else{face(c,[...waist],'pelvis',primary);sealedInterfaces.waist=waist;}
  orient(c);c.anchors={...openings,...sealedInterfaces};
  // short_trousers 的 Cuff/waist 均封底；源 shin 仍保留并直接穿过裤脚 Cap。
  return{id,slot:'bottom',version:GARMENT_GEOMETRY_VERSION,mesh:c,covers:['pelvis','thigh'],openings,...(!skirt?{sealedInterfaces}:{})};
}
