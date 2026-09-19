/** 外部动作只提供人体轨道，不隐式绑定职业、道具或业务事件。 */
export const MIXAMO_CLIPS = [
  { id:'jogging', label:'慢跑', file:'Jogging', loop:true, ground:true },
  { id:'shooting-arrow', label:'拉弓射箭', file:'Shooting Arrow', loop:false, ground:true },
  { id:'catwalk', label:'高抬腿行走', file:'Catwalk Walk Forward HighKnees', loop:true, ground:true },
  { id:'punching-bag', label:'连续拳击', file:'Punching Bag', loop:true, ground:true },
  { id:'zombie-stand-up', label:'倒地起身', file:'Zombie Stand Up', loop:false, ground:true },
  { id:'pilot-switches', label:'拨动开关', file:'Pilot Flips Switches', loop:false, ground:true },
  { id:'swimming', label:'游泳', file:'Swimming', loop:true, ground:false },
  { id:'hip-hop', label:'街舞', file:'Hip Hop Dancing', loop:false, ground:true },
  { id:'capoeira', label:'卡波耶拉动作', file:'Capoeira', loop:false, ground:true },
  { id:'flair', label:'Flair 动作', file:'Flair', loop:false, ground:true },
  { id:'assassination', label:'近身攻击', file:'Brutal Assassination', loop:false, ground:true },
] as const;
export type MixamoId = typeof MIXAMO_CLIPS[number]['id'];
export type MixamoSelection = MixamoId | 'none';
export function isMixamoId(value: unknown): value is MixamoId { return MIXAMO_CLIPS.some(c => c.id === value); }
export function mixamoDefinition(id: MixamoId) { const def = MIXAMO_CLIPS.find(c => c.id === id); if (!def) throw new Error(`未知 Mixamo 动作 ${id}`); return def; }
export function mixamoFilename(id: MixamoId) { return `Vanguard By T. Choonyung@${mixamoDefinition(id).file}.fbx`; }
