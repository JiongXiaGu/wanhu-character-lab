import { B, rigid, type Cage, type Recipe, type TopId, type BottomId, type HeadwearId, type Vec3, type Weight, type GarmentDyes } from '../v3/types';
import { add, mul, sub, ring, bridge, face, vertex, OCT, BOX, orient } from '../v3/cage';

/** 只生成绑定空间网格，不读取动画时钟，不创建骨骼。 */
export const NEW_TOPS:readonly TopId[]=['rough_tunic','cross_jacket','layered_vest','ceremony_robe'];
export const NEW_BOTTOMS:readonly BottomId[]=['loose_trousers','work_wrap','pleated_skirt','robe_skirt'];
export const BODY_HIDE_VERSION='wanhu-garment-hide-v1';
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
interface HemShape { end:number; width:number; depth:number; color:string; trim:string; pleats?:boolean; outer?:number }
/** 左右独立有厚度裳片；前后留窄开衩，不能将两腿硬绑在同一个裙筒。 */
function hem(target:Cage,id:string,s:HemShape):void {
  const count=s.pleats?12:8;
  for(const side of [1,-1]){
    const c:Cage={vertices:[],faces:[],anchors:{}};
    const rows=[1.067,.90,(.90+s.end)*.5,s.end];
    const layers:number[][][]=[];
    for(let layer=0;layer<2;layer++){
      const loops:number[][]=[];
      for(let row=0;row<rows.length;row++){
        const t=(1.067-rows[row])/(1.067-s.end);
        const width=.166+(s.width-.166)*Math.min(1,t*1.25)+(s.outer??0);
        const depth=.112+(s.depth-.112)*t+(s.outer??0)*.7;
        const loop:number[]=[];
        for(let i=0;i<=count;i++){
          const a=i*Math.PI/count;
          const fold=s.pleats&&row>0?(i%2===0?1.025:.985):1;
          const x=side*(Math.sin(a)*(width-layer*.004)*fold+.007*t);
          const z=Math.cos(a)*(depth-layer*.004)*fold;
          const leg=side>0?B.RightThigh:B.LeftThigh;
          const w:Weight=row===0?[B.Hips,B.Spine,.7]:[B.Hips,leg,Math.max(.42,1-t*.58)];
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
  if(NEW_TOPS.includes(top)){
    const shape:Record<string,HemShape>={
      rough_tunic:{end:.865,width:.188,depth:.128,color:primary,trim:tone(primary,.92)},
      cross_jacket:{end:.80,width:.215,depth:.145,color:primary,trim:accent},
      layered_vest:{end:.67,width:.248,depth:.163,color:primary,trim:accent,outer:.007},
      ceremony_robe:{end:.56,width:.27,depth:.176,color:primary,trim:accent,outer:.012},
    };
    hem(c,'GarmentTop',shape[top]);
  }
  if(['work_wrap','pleated_skirt','robe_skirt'].includes(bottom)){
    const shape:Record<string,HemShape>={
      work_wrap:{end:.67,width:.226,depth:.154,color:secondary,trim:tone(secondary,1.13)},
      pleated_skirt:{end:.29,width:.30,depth:.20,color:secondary,trim:accent,pleats:true},
      robe_skirt:{end:.21,width:.28,depth:.185,color:secondary,trim:accent},
    };
    hem(c,'GarmentBottom',shape[bottom]);
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
    const low=recipe.hairStyle==='low_bun'||(!recipe.hairStyle&&recipe.bodyType==='female');
    const y=low?1.67:recipe.hairStyle==='double_bun'?1.738:1.80,z=low?-.164:-.035;
    solidBox(c,'JadePin',[0,y,z],[.16,.008,.012],accent);
    solidBox(c,'JadeFinial',[.085,y,z],[.024,.025,.021],'#85b2a0');
  }else{
    const formal=id==='scholar_cap',color=formal?'#303d42':tone(primary,.78);
    const a=ring(c,'WardrobeCapBase',[0,1.711,-.006],[1,0,0],[0,0,1],OCT,.112,.108,w);
    const b=ring(c,'WardrobeCapTop',[0,formal?1.874:1.786,-.012],[1,0,0],[0,0,1],OCT,formal?.069:.097,formal?.086:.088,w);
    bridge(c,a,b,'equipment',color);face(c,[...a].reverse(),'equipment',color);face(c,b,'equipment',tone(color,1.07));
    if(formal){
      solidBox(c,'CapTablet',[0,1.761,.109],[.032,.042,.007],accent);
      solidBox(c,'CapWings',[0,1.739,-.086],[.286,.018,.041],color);
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
