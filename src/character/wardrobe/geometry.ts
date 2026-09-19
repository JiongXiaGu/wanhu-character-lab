import { B, rigid, type Cage, type Recipe, type TopId, type BottomId, type HeadwearId, type Vec3, type Weight, type GarmentDyes } from '../v3/types';
import { add, mul, sub, ring, bridge, face, vertex, OCT, BOX, orient } from '../v3/cage';

/** 只生成绑定空间网格，不读取动画时钟，不创建骨骼。 */
export const NEW_TOPS:readonly TopId[]=['rough_tunic','cross_jacket','layered_vest','ceremony_robe'];
export const NEW_BOTTOMS:readonly BottomId[]=['loose_trousers','work_wrap','pleated_skirt','robe_skirt'];
export const BODY_HIDE_VERSION='wanhu-garment-hide-v1';
export const GARMENT_GEOMETRY_VERSION='wanhu-garment-geometry-v2';
export function garmentColors(recipe:Recipe):GarmentDyes {
  const [primary,accent]=[['#415e68','#d4c5a5'],['#626854','#d7c9b2'],['#785549','#d7c8ae']][recipe.palette];
  return recipe.dyes??{primary,secondary:'#596363',accent};
}
function tone(hex:string,factor:number):string {
  return '#'+[1,3,5].map(i=>Math.round(Math.min(255,parseInt(hex.slice(i,i+2),16)*factor)).toString(16).padStart(2,'0')).join('');
}
function resizeLoop(c:Cage,name:string,factor:number){
  const loop=c.anchors[name];if(!loop)return;
  const center=mul(loop.reduce((a,i)=>add(a,c.vertices[i].p),[0,0,0] as Vec3),1/loop.length);
  for(const i of loop)c.vertices[i].p=add(center,mul(sub(c.vertices[i].p,center),factor));
}
/** BodyDerived.Replace：身体源网格不动，只改变可见衣面及其颜色。 */
export function styleGarmentSurface(c:Cage,recipe:Recipe):void {
  const {top,bottom}=recipe.slots, colors=garmentColors(recipe);
  if(NEW_TOPS.includes(top)){
    const formal=top==='ceremony_robe',longSleeve=top!=='rough_tunic';
    for(const f of c.faces){
      if(['torso','upperArm'].includes(f.region))f.color=colors.primary;
      if(longSleeve&&f.region==='forearm')f.color=top==='layered_vest'?colors.secondary:colors.primary;
      if(top==='layered_vest'&&f.region==='upperArm')f.color=colors.secondary;
    }
    for(const side of ['Right','Left']){
      resizeLoop(c,side+'Deltoid',formal?1.14:1.03);
      if(longSleeve){
        resizeLoop(c,side+'ElbowUpper',formal?1.30:1.12);
        resizeLoop(c,side+'Elbow',formal?1.40:1.12);
        resizeLoop(c,side+'ElbowLower',formal?1.70:1.23);
        // Wrist 不放大：手部与袖口共边，放大会错误地拉大手掌。
      }
    }
  }
  if(NEW_BOTTOMS.includes(bottom)){
    for(const f of c.faces)if(['pelvis','thigh','shin'].includes(f.region))f.color=colors.secondary;
    for(const side of ['Right','Left']){
      resizeLoop(c,side+'Thigh',1.16);resizeLoop(c,side+'KneeUpper',1.19);
      resizeLoop(c,side+'Knee',1.10);resizeLoop(c,side+'Calf',1.12);
    }
  }
}
function append(target:Cage,piece:Cage){
  orient(piece);
  const offset=target.vertices.length;target.vertices.push(...piece.vertices);
  target.faces.push(...piece.faces.map(f=>({...f,v:f.v.map(i=>i+offset)})));
}
interface HemShape { end:number; width:number; depth:number; color:string; trim:string; pleats?:boolean; wrap?:boolean; outer?:number; start?:number; under?:HemShape }
/** 所有衣层共用高度参数，不能各按自己的摆长生成不同权重。 */
function hemRadius(s:HemShape,y:number):[number,number] {
  const t=Math.max(0,Math.min(1,(1.067-y)/(1.067-s.end)));
  let width=.166+(s.width-.166)*Math.min(1,t*1.25)+(s.outer??0);
  let depth=.112+(s.depth-.112)*t+(s.outer??0)*.7;
  if(s.under){
    const [uw,ud]=hemRadius(s.under,y),clearance=.018*Math.min(1,(1.067-y)/.16);
    const pleatFactor=s.under.pleats?1.025:1;
    width=Math.max(width,uw*pleatFactor+clearance);
    depth=Math.max(depth,ud*pleatFactor+clearance);
  }
  return [width,depth];
}
/** 左右独立有厚度裳片；长裙前后搭接，短衣保留开衩，不把双腿焊进一个裙筒。 */
function hem(target:Cage,id:string,s:HemShape):void {
  const count=s.pleats?12:8;
  for(const side of [1,-1]){
    const c:Cage={vertices:[],faces:[],anchors:{}};
    const start=s.start??1.067;
    const rows=[start,...[.90,.80,.67,.56,.449,.293].filter(y=>y<start-1e-6&&y>s.end+1e-6),s.end];
    if(s.under?.start&&s.under.start>s.end&&s.under.start<start&&!rows.some(y=>Math.abs(y-s.under!.start!)<1e-6))rows.push(s.under.start);
    rows.sort((a,b)=>b-a);
    const layers:number[][][]=[];
    for(let layer=0;layer<2;layer++){
      const loops:number[][]=[];
      for(let row=0;row<rows.length;row++){
        const t=Math.max(0,Math.min(1,(1.067-rows[row])/.857));
        const [width,depth]=hemRadius(s,rows[row]);
        const loop:number[]=[];
        for(let i=0;i<=count;i++){
          // 约三厘米的交叠消除原正反面贯通细缝；前后仍可随两侧腿分开。
          // 右片稍外、左片稍内，厚度壁之间留距，不能用重合面或 DoubleSide 填缝。
          const lap=s.wrap?.055:0;
          const a=-lap+i*(Math.PI+lap*2)/count;
          const fold=s.pleats&&row>0?(i%2===0?1.025:.985):1;
          const x=side*(Math.sin(a)*(width-layer*.004)*fold+(s.wrap?0:.007*t));
          const z=Math.cos(a)*(depth+(s.wrap?side*.006:0)-layer*.004)*fold;
          const leg=side>0?B.RightThigh:B.LeftThigh;
          const w:Weight=rows[row]>1.06?[B.Hips,B.Spine,.7]:[B.Hips,leg,1-t*.62];
          loop.push(vertex(c,`${id}.${side}.${layer}.${row}.${i}`,[x,rows[row],z],w));
        }
        loops.push(loop);
      }
      layers.push(loops);
    }
    for(let layer=0;layer<2;layer++)for(let r=0;r<rows.length-1;r++)for(let i=0;i<count;i++){
      const color=layer===1?tone(s.color,.78):s.pleats&&i%2===0?tone(s.color,.97):s.color;
      face(c,[layers[layer][r][i],layers[layer][r][i+1],layers[layer][r+1][i+1],layers[layer][r+1][i]],'detail',color);
    }
    for(const r of [0,rows.length-1])for(let i=0;i<count;i++)
      face(c,[layers[0][r][i],layers[0][r][i+1],layers[1][r][i+1],layers[1][r][i]],'detail',s.trim);
    for(const i of [0,count])for(let r=0;r<rows.length-1;r++)
      face(c,[layers[0][r][i],layers[0][r+1][i],layers[1][r+1][i],layers[1][r][i]],'detail',s.trim);
    // 下缘是一条有限宽度的面带，不以 DoubleSide 遮掩反面。
    const last=layers[0].at(-1)!.map((idx,i)=>{const v=c.vertices[idx];return vertex(c,`${id}.${side}.bandBase.${i}`,[v.p[0]*1.002,v.p[1],v.p[2]*1.002],[...v.w]);});
    const band=last.map((idx,i)=>{const v=c.vertices[idx];return vertex(c,`${id}.${side}.band.${i}`,[v.p[0]*1.0015,v.p[1]+.022,v.p[2]*1.0015],[...v.w]);});
    for(let i=0;i<count;i++)face(c,[last[i],last[i+1],band[i+1],band[i]],'detail',s.trim);
    append(target,c);
  }
}
export function addGarmentSilhouettes(c:Cage,recipe:Recipe):void {
  const {primary,secondary,accent}=garmentColors(recipe),{top,bottom}=recipe.slots;
  const tops:Record<string,HemShape>={
    rough_tunic:{end:.865,width:.188,depth:.128,color:primary,trim:tone(primary,.92)},
    cross_jacket:{end:.80,width:.215,depth:.145,color:primary,trim:accent},
    layered_vest:{end:.67,width:.248,depth:.163,color:primary,trim:accent,outer:.007},
    ceremony_robe:{end:.56,width:.27,depth:.176,color:primary,trim:accent,outer:.012},
  };
  const bottoms:Record<string,HemShape>={
    work_wrap:{end:.67,width:.226,depth:.154,color:secondary,trim:tone(secondary,1.13)},
    pleated_skirt:{end:.29,width:.30,depth:.20,color:secondary,trim:accent,pleats:true,wrap:true},
    robe_skirt:{end:.21,width:.28,depth:.185,color:secondary,trim:accent,wrap:true},
  };
  const upper=tops[top],lower=bottoms[bottom];
  if(upper&&lower){
    // 上层盖住的下装不重复生成，接口保留 3.5cm 搭接；宽度考虑褶面最大凸起。
    if(lower.end<upper.end){lower.start=upper.end+.035;upper.under=lower;}
    else {upper.start=lower.end+.035;lower.under=upper;}
  }
  if(upper)hem(c,'GarmentTop',upper);
  if(lower){
    hem(c,'GarmentBottom',lower);
    // 稳定 region 掩码：腰髋已由裳片替换。保留开衩可见的内衬裤与小腿。
    c.faces=c.faces.filter(f=>f.region!=='pelvis');
  }
}
function solidBox(c:Cage,id:string,p:Vec3,size:Vec3,color:string):void {
  const a=ring(c,id+'Low',[p[0],p[1]-size[1]/2,p[2]],[1,0,0],[0,0,1],BOX,size[0]/2,size[2]/2,rigid(B.Head));
  const b=ring(c,id+'High',[p[0],p[1]+size[1]/2,p[2]],[1,0,0],[0,0,1],BOX,size[0]/2,size[2]/2,rigid(B.Head));
  bridge(c,a,b,'equipment',color);face(c,[...a].reverse(),'equipment',color);face(c,b,'equipment',color);
}
export function addWardrobeHeadwear(target:Cage,id:HeadwearId,recipe:Recipe):boolean {
  if(!['cloth_wrap','scholar_cap','jade_pin'].includes(id))return false;
  const c:Cage={vertices:[],faces:[],anchors:{}},w=rigid(B.Head),{primary,accent}=garmentColors(recipe);
  if(id==='jade_pin'){
    const low=recipe.hairStyle==='low_bun'||((!recipe.hairStyle||recipe.hairStyle==='auto')&&recipe.bodyType==='female');
    const y=low?1.67:recipe.hairStyle==='double_bun'?1.738:1.80,z=low?-.164:-.035;
    solidBox(c,'JadePin',[0,y,z],[.16,.008,.012],accent);
    solidBox(c,'JadeFinial',[.085,y,z],[.024,.025,.021],'#85b2a0');
  }else{
    const formal=id==='scholar_cap',color=formal?'#303d42':'#303d42';
    const capColor=formal?color:tone(primary,.78);
    const a=ring(c,'WardrobeCapBase',[0,1.711,-.006],[1,0,0],[0,0,1],OCT,.112,.108,w);
    const b=ring(c,'WardrobeCapTop',[0,formal?1.874:1.786,-.012],[1,0,0],[0,0,1],OCT,formal?.069:.097,formal?.086:.088,w);
    bridge(c,a,b,'equipment',capColor);face(c,[...a].reverse(),'equipment',capColor);face(c,b,'equipment',tone(capColor,1.07));
    if(formal){
      solidBox(c,'CapTablet',[0,1.761,.109],[.032,.042,.007],accent);
      solidBox(c,'CapWings',[0,1.739,-.086],[.286,.018,.041],capColor);
    }else solidBox(c,'WrapKnot',[0,1.739,-.115],[.072,.045,.028],tone(primary,.68));
  }
  append(target,c);return true;
}
export function finishHair(c:Cage,recipe:Recipe):void {
  const {hairStyle,hairColor}=recipe;
  const concealed=['guard_helmet','cloth_wrap','scholar_cap'].includes(recipe.slots.headwear)||recipe.slots.headwear==='farmer_straw_hat';
  if(hairStyle&&hairStyle!=='auto'){
    c.faces=c.faces.filter(f=>!f.v.some(i=>/^(Bun|FemaleBun|FemaleHairPin)/.test(c.vertices[i].id)));
    if(!concealed){
      const piece:Cage={vertices:[],faces:[],anchors:{}},w=rigid(B.Head),color=hairColor??'#282b29';
      const bun=(id:string,p:Vec3,width:number,depth:number,height:number)=>{
        const a=ring(piece,id+'Low',[p[0],p[1]-height/2,p[2]],[1,0,0],[0,0,1],OCT,width*.60,depth*.65,w);
        const b=ring(piece,id+'Mid',p,[1,0,0],[0,0,1],OCT,width,depth,w);
        const d=ring(piece,id+'Top',[p[0],p[1]+height/2,p[2]],[1,0,0],[0,0,1],OCT,width*.66,depth*.67,w);
        bridge(piece,a,b,'detail',color);bridge(piece,b,d,'detail',color);face(piece,[...a].reverse(),'detail',color);face(piece,d,'detail',color);
      };
      if(hairStyle==='topknot')bun('CustomHairTop',[0,1.794,-.030],.042,.040,.079);
      if(hairStyle==='low_bun')bun('CustomHairLow',[0,1.661,-.131],.051,.047,.084);
      if(hairStyle==='double_bun')for(const side of [-1,1])bun('CustomHairSide'+side,[side*.080,1.739,-.052],.039,.034,.066);
      append(c,piece);
    }
  }
  if(hairColor)for(const f of c.faces)if(f.v.every(i=>/Hair|Bun|Brow/.test(c.vertices[i].id)&&!c.vertices[i].id.includes('Pin')))f.color=hairColor;
}
