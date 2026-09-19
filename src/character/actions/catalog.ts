/** 动作内容协议：不依赖渲染器。职业和穿戴配方不是动作 ID。 */
export const WORK_IDS = ['pick', 'place', 'carry_front', 'carry_shoulder', 'carry_back', 'push', 'pull', 'hoe', 'hammer'] as const;
export type WorkId = typeof WORK_IDS[number];
export type WorkSelection = WorkId | 'none';
export type PropId = 'crate' | 'timber' | 'firewood' | 'wheelbarrow' | 'hoe' | 'hammer';
export interface ActionEvent { phase: number; id: string; label: string }
export interface ActionDefinition {
  id: WorkId; label: string; family: 'interaction' | 'carry' | 'tool';
  duration: number; loop: boolean; prop: PropId;
  locomotion: 'planted' | 'walk'; mask: 'full' | 'upper';
  occupied: readonly ('leftHand' | 'rightHand' | 'back')[];
  events: readonly ActionEvent[]; stages: readonly [number, string][];
  description: string; reviewPhase: number;
}
export const ACTIONS: Record<WorkId, ActionDefinition> = {
  pick: {id:'pick',label:'拾起木箱',family:'interaction',duration:2.8,loop:false,prop:'crate',locomotion:'planted',mask:'full',occupied:['leftHand','rightHand'],events:[{phase:.38,id:'grip',label:'双手抓稳'},{phase:.95,id:'load_ready',label:'搬运就绪'}],stages:[[0,'接近'],[.16,'屈膝伸手'],[.38,'抓稳'],[.46,'提起'],[.9,'抱持']],description:'屈膝接触 → 抓稳 → 提起。完成后停在抱持姿态。',reviewPhase:.38},
  place: {id:'place',label:'放下木箱',family:'interaction',duration:2.8,loop:false,prop:'crate',locomotion:'planted',mask:'full',occupied:['leftHand','rightHand'],events:[{phase:.60,id:'set_down',label:'木箱落地'},{phase:.66,id:'release',label:'松手'}],stages:[[0,'抱持'],[.14,'下放'],[.60,'落地'],[.66,'松手'],[.83,'起身']],description:'抱持 → 下放 → 落地 → 松手。不是把拾取循环倒播。',reviewPhase:.60},
  carry_front: {id:'carry_front',label:'抱箱行走',family:'carry',duration:1.3,loop:true,prop:'crate',locomotion:'walk',mask:'upper',occupied:['leftHand','rightHand'],events:[],stages:[[0,'负重迈步']],description:'下半身行走，双手持续锁定木箱两侧握点。',reviewPhase:.25},
  carry_shoulder: {id:'carry_shoulder',label:'扛木行走',family:'carry',duration:1.3,loop:true,prop:'timber',locomotion:'walk',mask:'upper',occupied:['rightHand'],events:[],stages:[[0,'右肩承重']],description:'原木随肩胸移动；右手扶木，左臂自由配重。',reviewPhase:.25},
  carry_back: {id:'carry_back',label:'背柴行走',family:'carry',duration:1.3,loop:true,prop:'firewood',locomotion:'walk',mask:'upper',occupied:['back','leftHand','rightHand'],events:[],stages:[[0,'前倾负重']],description:'柴捆固定在背架，双手扶背带；不模拟绳索和布料。',reviewPhase:.25},
  push: {id:'push',label:'推独轮车',family:'interaction',duration:1.3,loop:true,prop:'wheelbarrow',locomotion:'walk',mask:'upper',occupied:['leftHand','rightHand'],events:[],stages:[[0,'向前推车']],description:'手掌匹配左右车把，车轮按标定行进速度连续滚动。',reviewPhase:.25},
  pull: {id:'pull',label:'拉车行走',family:'interaction',duration:1.3,loop:true,prop:'wheelbarrow',locomotion:'walk',mask:'upper',occupied:['leftHand','rightHand'],events:[],stages:[[0,'车在身后']],description:'转向后的车架位于身后；手臂向后，人物面向 +Z。',reviewPhase:.25},
  hoe: {id:'hoe',label:'双手锄地',family:'tool',duration:2.1,loop:true,prop:'hoe',locomotion:'planted',mask:'full',occupied:['leftHand','rightHand'],events:[{phase:.52,id:'tool_contact',label:'锄刃触地'}],stages:[[0,'举锄'],[.25,'挥下'],[.52,'触地'],[.63,'收锄'],[.85,'复位']],description:'抬起 → 挥落 → 触地 → 收锄；冲击时刻提供语义事件。',reviewPhase:.52},
  hammer: {id:'hammer',label:'单手锤击',family:'tool',duration:1.5,loop:true,prop:'hammer',locomotion:'planted',mask:'full',occupied:['leftHand','rightHand'],events:[{phase:.52,id:'tool_contact',label:'锤面接触'}],stages:[[0,'抬锤'],[.28,'落锤'],[.52,'接触'],[.66,'回弹']],description:'右手锤击台面工件；左手停在安全侧，不穿过锤头。',reviewPhase:.52},
};
export function isWorkId(value:unknown):value is WorkId {return typeof value==='string' && (WORK_IDS as readonly string[]).includes(value);}
export function actionStage(id:WorkId,phase:number):string {let label=ACTIONS[id].stages[0][1];for(const[p,l]of ACTIONS[id].stages)if(phase>=p)label=l;return label;}
/** 只按向前经过事件点触发；seek 由调用者重设游标，不执行游戏副作用。 */
export function crossedEvents(def:ActionDefinition,from:number,to:number):{id:string;label:string;cycle:number}[] {
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||from<0)return [];
  const out:{id:string;label:string;cycle:number}[]=[];
  const last=def.loop?Math.floor(to/def.duration):0;
  for(let cycle=def.loop?Math.floor(from/def.duration):0;cycle<=last;cycle++)for(const event of def.events){const t=(cycle+event.phase)*def.duration;if(t>from+1e-8&&t<=to+1e-8)out.push({id:event.id,label:event.label,cycle});}
  return out;
}
