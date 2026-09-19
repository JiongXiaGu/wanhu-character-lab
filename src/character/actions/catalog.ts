/** 动作内容协议不依赖渲染器。职业和外观配方不是动作 ID。 */
export const WORK_IDS = ['pick', 'place', 'carry_hold', 'carry_front', 'carry_shoulder', 'carry_back', 'push', 'pull', 'hoe', 'hammer', 'bow_shot', 'bow_draw', 'bow_aim', 'bow_aim_high', 'bow_aim_low', 'bow_release', 'bow_cancel'] as const;
export type WorkId = typeof WORK_IDS[number];
export type WorkSelection = WorkId | 'none';
export type PropId = 'crate' | 'timber' | 'firewood' | 'wheelbarrow' | 'hoe' | 'hammer' | 'bow';
export interface ActionEvent { phase: number; id: string; label: string }
export interface ActionDefinition {
  id: WorkId; label: string; family: 'interaction' | 'carry' | 'tool' | 'combat';
  duration: number; loop: boolean; playback?: 'hold'; prop: PropId;
  locomotion: 'planted' | 'walk'; mask: 'full' | 'upper';
  occupied: readonly ('leftHand' | 'rightHand' | 'back')[];
  events: readonly ActionEvent[]; stages: readonly [number, string][];
  description: string; reviewPhase: number;
}
const bow = (id: WorkId, label: string, duration: number, stages: ActionDefinition['stages'], events: ActionDefinition['events'], reviewPhase: number, description: string, hold = false): ActionDefinition => ({
  id, label, duration, loop: false, ...(hold ? { playback: 'hold' as const } : {}),
  family: 'combat', prop: 'bow', locomotion: 'planted', mask: 'full',
  occupied: ['leftHand', 'rightHand'], stages, events, reviewPhase, description,
});
export const ACTIONS: Record<WorkId, ActionDefinition> = {
  pick: { id:'pick',label:'拾起木箱',family:'interaction',duration:2.8,loop:false,prop:'crate',locomotion:'planted',mask:'full',occupied:['leftHand','rightHand'],events:[{phase:.38,id:'grip',label:'双手抓稳'},{phase:.95,id:'load_ready',label:'搬运就绪'}],stages:[[0,'接近'],[.16,'屈膝伸手'],[.38,'抓稳'],[.46,'提起'],[.9,'抱持']],description:'屈膝接触 → 抓稳 → 提起。完成后停在抱持姿态。',reviewPhase:.38 },
  place: { id:'place',label:'放下木箱',family:'interaction',duration:2.8,loop:false,prop:'crate',locomotion:'planted',mask:'full',occupied:['leftHand','rightHand'],events:[{phase:.60,id:'set_down',label:'木箱落地'},{phase:.66,id:'release',label:'松手'}],stages:[[0,'抱持'],[.14,'下放'],[.60,'落地'],[.66,'松手'],[.83,'起身']],description:'抱持 → 下放 → 落地 → 松手，不是把拾取循环倒播。',reviewPhase:.60 },
  carry_hold: { id:'carry_hold',label:'抱箱待机',family:'carry',duration:1.3,loop:true,prop:'crate',locomotion:'planted',mask:'full',occupied:['leftHand','rightHand'],events:[],stages:[[0,'双手抱持']],description:'双脚站定，双手持续扶住木箱；与拾取末帧共享抱持高度。',reviewPhase:.25 },
  carry_front: { id:'carry_front',label:'抱箱行走',family:'carry',duration:1.3,loop:true,prop:'crate',locomotion:'walk',mask:'upper',occupied:['leftHand','rightHand'],events:[],stages:[[0,'负重迈步']],description:'下半身行走，双手持续锁定木箱两侧握点。',reviewPhase:.25 },
  carry_shoulder: { id:'carry_shoulder',label:'扛木行走',family:'carry',duration:1.3,loop:true,prop:'timber',locomotion:'walk',mask:'upper',occupied:['rightHand'],events:[],stages:[[0,'右肩承重']],description:'原木随肩胸移动；右手扶木，左臂自由配重。',reviewPhase:.25 },
  carry_back: { id:'carry_back',label:'背柴行走',family:'carry',duration:1.3,loop:true,prop:'firewood',locomotion:'walk',mask:'upper',occupied:['back','leftHand','rightHand'],events:[],stages:[[0,'前倾负重']],description:'柴捆固定在背架，双手扶背带；不模拟绳索和布料。',reviewPhase:.25 },
  push: { id:'push',label:'推独轮车',family:'interaction',duration:1.3,loop:true,prop:'wheelbarrow',locomotion:'walk',mask:'upper',occupied:['leftHand','rightHand'],events:[],stages:[[0,'向前推车']],description:'手掌匹配左右车把；原地预览按标定行进速度显示车轮滚动。',reviewPhase:.25 },
  pull: { id:'pull',label:'拉车行走',family:'interaction',duration:1.3,loop:true,prop:'wheelbarrow',locomotion:'walk',mask:'upper',occupied:['leftHand','rightHand'],events:[],stages:[[0,'车在身后']],description:'车架位于身后；手臂向后，人物仍面向 +Z。',reviewPhase:.25 },
  hoe: { id:'hoe',label:'双手锄地',family:'tool',duration:2.1,loop:true,prop:'hoe',locomotion:'planted',mask:'full',occupied:['leftHand','rightHand'],events:[{phase:.52,id:'tool_contact',label:'锄刃触地'}],stages:[[0,'举锄'],[.25,'挥下'],[.52,'触地'],[.63,'收锄'],[.85,'复位']],description:'抬起 → 挥落 → 触地 → 收锄；冲击时刻提供语义事件。',reviewPhase:.52 },
  hammer: { id:'hammer',label:'单手锤击',family:'tool',duration:1.5,loop:true,prop:'hammer',locomotion:'planted',mask:'full',occupied:['leftHand','rightHand'],events:[{phase:.52,id:'tool_contact',label:'锤面接触'}],stages:[[0,'抬锤'],[.28,'落锤'],[.52,'接触'],[.66,'回弹']],description:'右手锤击台面工件；左手停在安全侧。',reviewPhase:.52 },
  bow_shot: bow('bow_shot','完整射箭',4.4,[[0,'准备'],[.065,'取箭示意'],[.18,'搭箭'],[.22,'举弓'],[.42,'拉弓'],[.62,'瞄准'],[.72,'放箭'],[.84,'收势']], [{phase:.18,id:'arrow_nocked',label:'箭搭上弦'},{phase:.72,id:'arrow_released',label:'箭离弦'}],.66,'准备 → 搭箭 → 举弓 → 拉弓 → 瞄准 → 放箭 → 收势。单次执行，末帧停止。'),
  bow_draw: bow('bow_draw','搭箭拉弓',2.5,[[0,'准备'],[.18/.62,'搭箭'],[.22/.62,'举弓'],[.42/.62,'拉弓'],[1,'满弓']], [{phase:.18/.62,id:'arrow_nocked',label:'箭搭上弦'}],1,'搭箭并拉至满弓。末帧与保持瞄准、放箭收势和取消瞄准的起点一致。'),
  bow_aim: bow('bow_aim','保持瞄准',1.2,[[0,'保持满弓']],[],.5,'持续保持瞄准，不循环拉弦，不重复生成箭。',true),
  bow_aim_high: bow('bow_aim_high','抬高瞄准',1.2,[[0,'小幅抬高']],[],.5,'有限高角度瞄准检查；不代表任意方向全身 IK。',true),
  bow_aim_low: bow('bow_aim_low','压低瞄准',1.2,[[0,'小幅压低']],[],.5,'有限低角度瞄准检查；超过范围应交由角色转向。',true),
  bow_release: bow('bow_release','放箭收势',1.1,[[0,'满弓'],[(.72-.70)/.30,'释放'],[(.84-.70)/.30,'收势']], [{phase:(.72-.70)/.30,id:'arrow_released',label:'箭离弦'}],.1,'从满弓开始释放，再收回准备姿态。箭离弦后不跟随弓移动。'),
  bow_cancel: bow('bow_cancel','取消瞄准',1.2,[[0,'满弓'],[.15,'缓慢退弦'],[.65,'收弓'],[1,'准备']],[],.5,'退弦并收弓，整个动作不会触发放箭事件。'),
};
export function isWorkId(value: unknown): value is WorkId { return typeof value === 'string' && (WORK_IDS as readonly string[]).includes(value); }
export function actionStage(id: WorkId, phase: number): string {
  let label = ACTIONS[id].stages[0][1];
  for (const [p, value] of ACTIONS[id].stages) if (phase >= p) label = value;
  return label;
}
/** 时间单位为秒，事件 phase 为归一化相位；seek 不调用此函数。 */
export function crossedEvents(def: ActionDefinition, from: number, to: number): { id: string; label: string; cycle: number }[] {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || from < 0) return [];
  const out: { id: string; label: string; cycle: number }[] = [];
  const last = def.loop ? Math.floor(to / def.duration) : 0;
  for (let cycle = def.loop ? Math.floor(from / def.duration) : 0; cycle <= last; cycle++) {
    for (const event of def.events) {
      const time = (cycle + event.phase) * def.duration;
      if (time > from + 1e-8 && time <= to + 1e-8) out.push({ id: event.id, label: event.label, cycle });
    }
  }
  return out;
}
