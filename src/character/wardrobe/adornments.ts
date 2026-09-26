import { addHeavyHelmet, isHeavyHeadwear } from './heavy-equipment';
import { addPalaceCaptainHelmet, addFrontierCaptainHelmet, addCityCaptainHelmet } from './captain-equipment';
import { addCityHelmet } from './city-equipment';
import { addPalaceHelmet } from './military-equipment';
import { addFrontierHelmet } from './frontier-equipment';
import { B, rigid, type Cage, type Recipe, type HeadwearId, type Vec3, type Weight } from '../v3/types';
import { add, mul, sub, ring, bridge, face, vertex, OCT, BOX, orient } from '../v3/cage';

/** 只生成绑定空间网格，不读取动画时钟，不创建骨骼。 */
function tone(hex:string,factor:number):string {
  return '#'+[1,3,5].map(i=>Math.round(Math.min(255,parseInt(hex.slice(i,i+2),16)*factor)).toString(16).padStart(2,'0')).join('');
}

function append(target:Cage,piece:Cage){orient(piece);const offset=target.vertices.length;target.vertices.push(...piece.vertices);target.faces.push(...piece.faces.map(f=>({...f,v:f.v.map(i=>i+offset)})));}
function solidBox(c:Cage,id:string,p:Vec3,size:Vec3,color:string):void {
  const a=ring(c,id+'Low',[p[0],p[1]-size[1]/2,p[2]],[1,0,0],[0,0,1],BOX,size[0]/2,size[2]/2,rigid(B.Head));
  const b=ring(c,id+'High',[p[0],p[1]+size[1]/2,p[2]],[1,0,0],[0,0,1],BOX,size[0]/2,size[2]/2,rigid(B.Head));
  bridge(c,a,b,'equipment',color);face(c,[...a].reverse(),'equipment',color);face(c,b,'equipment',color);
}
export function addWardrobeHeadwear(target:Cage,id:HeadwearId,recipe:Recipe):boolean {
  if(isHeavyHeadwear(id)){addHeavyHelmet(target,{...recipe,slots:{...recipe.slots,headwear:id}});return true;}
  if(id==='palace_guard_helmet'){addPalaceHelmet(target,recipe);return true;}
  if(id==='palace_captain_helmet'){addPalaceCaptainHelmet(target,recipe);return true;}
  if(id==='frontier_guard_helmet'){addFrontierHelmet(target,recipe);return true;}
  if(id==='frontier_captain_helmet'){addFrontierCaptainHelmet(target,recipe);return true;}
  if(id==='city_guard_helmet'){addCityHelmet(target,recipe);return true;}
  if(id==='city_captain_helmet'){addCityCaptainHelmet(target,recipe);return true;}
  if(!['cloth_wrap','scholar_cap','jade_pin','archer_headband'].includes(id))return false;
  const c:Cage={vertices:[],faces:[],anchors:{}},w=rigid(B.Head),{primary,accent}=recipe.dyes;
  if(id==='jade_pin'){
    const low=recipe.hairStyle==='low_bun';
    const y=low?1.67:recipe.hairStyle==='double_bun'?1.738:1.80,z=low?-.164:-.035;
    solidBox(c,'JadePin',[0,y,z],[.16,.008,.012],accent);
    solidBox(c,'JadeFinial',[.085,y,z],[.024,.025,.021],'#85b2a0');
  }else if(id==='archer_headband'){
    // 额带保持“只覆盖前额”的造型，但自身改成封闭薄实体；不再留下单层开边。
    const color='#a48760',path=[6,7,0,1,2] as const;
    const point=(name:string,index:number,y:number,width:number,depth:number)=>
      vertex(c,`Headband${name}.${index}`,[OCT[index][0]*width,y,OCT[index][1]*depth],w);
    const outerLow=path.map(i=>point('OuterLow',i,1.695,.103,.099));
    const outerHigh=path.map(i=>point('OuterHigh',i,1.712,.101,.098));
    const innerLow=path.map(i=>point('InnerLow',i,1.697,.096,.092));
    const innerHigh=path.map(i=>point('InnerHigh',i,1.710,.094,.091));
    for(let i=0;i<path.length-1;i++){
      face(c,[outerLow[i],outerLow[i+1],outerHigh[i+1],outerHigh[i]],'equipment',color);
      face(c,[innerLow[i],innerHigh[i],innerHigh[i+1],innerLow[i+1]],'equipment',color);
      face(c,[outerLow[i],innerLow[i],innerLow[i+1],outerLow[i+1]],'equipment',color);
      face(c,[outerHigh[i],outerHigh[i+1],innerHigh[i+1],innerHigh[i]],'equipment',color);
    }
    face(c,[outerLow[0],outerHigh[0],innerHigh[0],innerLow[0]],'equipment',color);
    const last=path.length-1;
    face(c,[outerLow[last],innerLow[last],innerHigh[last],outerHigh[last]],'equipment',color);
  }else{
    const formal=id==='scholar_cap',color=formal?'#303d42':tone(primary,.78);
    const a=ring(c,'WardrobeCapBase',[0,1.711,-.006],[1,0,0],[0,0,1],OCT,.112,.108,w);
    const b=ring(c,'WardrobeCapTop',[0,formal?1.874:1.786,-.012],[1,0,0],[0,0,1],OCT,formal?.069:.097,formal?.086:.088,w);
    bridge(c,a,b,'equipment',color);
    // 帽底复用原Base环并使用帽身同色；头发/头部允许从不可见封面中穿过。
    face(c,[...a].reverse(),'equipment',color);
    face(c,b,'equipment',tone(color,1.07));
    if(formal){
      solidBox(c,'CapTablet',[0,1.761,.109],[.032,.042,.007],accent);
      solidBox(c,'CapWings',[0,1.739,-.120],[.286,.018,.041],color);
    }else solidBox(c,'WrapKnot',[0,1.739,-.115],[.072,.045,.028],tone(primary,.68));
  }
  append(target,c);return true;
}
export function finishHair(c:Cage,recipe:Recipe):void {
  const {hairStyle,hairColor}=recipe;
  const concealed=isHeavyHeadwear(recipe.slots.headwear)||['palace_captain_helmet','frontier_captain_helmet','city_captain_helmet','palace_guard_helmet','frontier_guard_helmet','city_guard_helmet','guard_helmet','cloth_wrap','scholar_cap'].includes(recipe.slots.headwear)||recipe.slots.headwear==='farmer_straw_hat';
  {
    if(!concealed){
      const piece:Cage={vertices:[],faces:[],anchors:{}},w=rigid(B.Head),color=hairColor;
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
