import { createRecipe, type BodyType, type CharacterSlots, type GarmentDyes, type HairStyleId, type Recipe } from '../v3/types';

/** 外观推荐不是职业或身份；生成器绝不读取此表决定玩法。 */
export interface LookDefinition {
  id: string; name: string; family: string; description: string;
  suggestedBody: BodyType; slots: CharacterSlots; dyes: GarmentDyes; hairStyle: HairStyleId;
}
export const DYE_PALETTES = [
  { name:'苎麻', primary:'#81786a', secondary:'#665f52', accent:'#b5a17c' },
  { name:'青瓷', primary:'#547a77', secondary:'#ddd0b5', accent:'#b49566' },
  { name:'胭脂', primary:'#9a655e', secondary:'#d7b99a', accent:'#e5caa1' },
  { name:'月白', primary:'#c4cfc5', secondary:'#476675', accent:'#c8ad78' },
  { name:'黛紫', primary:'#5b566d', secondary:'#b4a4ab', accent:'#d3b676' },
  { name:'绛朱', primary:'#803f43', secondary:'#394d58', accent:'#c7a366' },
] as const;
const slots = (top:CharacterSlots['top'], bottom:CharacterSlots['bottom'], headwear:CharacterSlots['headwear']='none'):CharacterSlots =>
  ({top,bottom,headwear,shoes:'cloth_shoes',back:'none',leftHand:'none',rightHand:'none'});
const dyes = (index:number):GarmentDyes => { const {primary,secondary,accent}=DYE_PALETTES[index]; return {primary,secondary,accent}; };
export const WARDROBE_LOOKS: readonly LookDefinition[] = [
  {id:'plain-male',name:'布衣短褐',family:'布衣',description:'窄袖短衣 · 收口布裤',suggestedBody:'male',slots:slots('rough_tunic','loose_trousers','cloth_wrap'),dyes:dyes(0),hairStyle:'topknot'},
  {id:'plain-female',name:'布衣围裳',family:'布衣',description:'素衣短裳 · 利落束发',suggestedBody:'female',slots:slots('rough_tunic','work_wrap'),dyes:{primary:'#978576',secondary:'#685e55',accent:'#bbaa8d'},hairStyle:'low_bun'},
  {id:'town-male',name:'青衿市井',family:'市井',description:'交领长袖 · 束腰短摆',suggestedBody:'male',slots:slots('cross_jacket','loose_trousers'),dyes:dyes(1),hairStyle:'topknot'},
  {id:'town-female',name:'杏衫青裙',family:'市井',description:'交领袄衫 · 裤式分裳',suggestedBody:'female',slots:slots('cross_jacket','pleated_skirt'),dyes:{primary:'#d3b08b',secondary:'#537775',accent:'#ece0c4'},hairStyle:'low_bun'},
  {id:'elegant-male',name:'月白雅服',family:'雅居',description:'半臂叠穿 · 分裳垂线',suggestedBody:'male',slots:slots('layered_vest','robe_skirt','scholar_cap'),dyes:dyes(3),hairStyle:'topknot'},
  {id:'elegant-female',name:'藕色绮裳',family:'雅居',description:'半臂叠穿 · 褶面层次',suggestedBody:'female',slots:slots('layered_vest','pleated_skirt','jade_pin'),dyes:{primary:'#a57b80',secondary:'#d6b5aa',accent:'#e6c98a'},hairStyle:'double_bun'},
  {id:'ceremony-male',name:'绛色礼衣',family:'礼仪',description:'整肃袍形 · 冠帽与缘边',suggestedBody:'male',slots:{...slots('ceremony_robe','robe_skirt','scholar_cap'),shoes:'boots'},dyes:dyes(5),hairStyle:'topknot'},
  {id:'ceremony-female',name:'黛紫宫装',family:'礼仪',description:'收束袖形 · 长裳与簪饰',suggestedBody:'female',slots:slots('ceremony_robe','robe_skirt','jade_pin'),dyes:dyes(4),hairStyle:'topknot'},
];
export const SLOT_LABELS:Record<keyof CharacterSlots,string>={headwear:'头饰',top:'上衣',bottom:'下装',shoes:'鞋',back:'背部',leftHand:'左手',rightHand:'右手'};
export const SLOT_OPTIONS: { [K in keyof CharacterSlots]: readonly {id:CharacterSlots[K];name:string}[] } = {
  headwear:[{id:'none',name:'无头饰'},{id:'cloth_wrap',name:'素布包巾'},{id:'scholar_cap',name:'方冠'},{id:'jade_pin',name:'玉色簪饰'},{id:'farmer_straw_hat',name:'草帽'},{id:'guard_helmet',name:'轻盔'},{id:'archer_headband',name:'头巾'}],
  top:[{id:'rough_tunic',name:'粗布短衣'},{id:'cross_jacket',name:'交领袄衫'},{id:'layered_vest',name:'半臂叠衣'},{id:'ceremony_robe',name:'礼仪袍衣'},{id:'farmer_tunic',name:'原版农户短衣'},{id:'guard_light_armor',name:'轻甲'},{id:'archer_tunic',name:'原版弓手短衣'},{id:'body',name:'无上衣'}],
  bottom:[{id:'loose_trousers',name:'收口布裤'},{id:'work_wrap',name:'劳作短围裳'},{id:'pleated_skirt',name:'褶纹分裳'},{id:'robe_skirt',name:'长式分裳'},{id:'work_pants',name:'原版劳动裤'},{id:'guard_pants',name:'卫兵裤'},{id:'archer_pants',name:'弓手裤'},{id:'body',name:'无下装'}],
  shoes:[{id:'cloth_shoes',name:'布鞋'},{id:'boots',name:'短靴'},{id:'body',name:'无鞋'}],
  back:[{id:'none',name:'无背部装备'},{id:'archer_quiver',name:'箭袋'}],
  leftHand:[{id:'none',name:'左手空'},{id:'guard_shield',name:'盾牌'},{id:'archer_bow',name:'短弓'}],
  rightHand:[{id:'none',name:'右手空'},{id:'farmer_hoe',name:'锄头'},{id:'guard_sword',name:'短剑'}],
};
export const HAIR_NAMES:Record<HairStyleId,string>={topknot:'束发高髻',low_bun:'后侧低髻',double_bun:'双髻'};
export const DEFAULT_DYES:GarmentDyes = {primary:'#547a77',secondary:'#ddd0b5',accent:'#b49566'};
export const WARDROBE_VERSION='wanhu-wardrobe-v5';
export function applyLook(recipe:Recipe,id:string):Recipe {
  const look=WARDROBE_LOOKS.find(x=>x.id===id);
  if(!look)return recipe;
  return createRecipe({...recipe,slots:{...look.slots},dyes:{...look.dyes},hairStyle:look.hairStyle});
}
export type RandomLock = keyof CharacterSlots | 'dyes' | 'hairStyle';
/** 同一种子可复现；仅随机外观，不改变身体、配色以外的身份参数。 */
export function randomizeLook(recipe:Recipe,seed:number,locks:readonly RandomLock[]=[]):Recipe {
  let n=Number.isFinite(seed)?seed>>>0:1;
  const random=()=>{n=(n+0x6d2b79f5)>>>0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
  const candidates=WARDROBE_LOOKS.filter(x=>x.suggestedBody===recipe.bodyType);
  const next=applyLook(recipe,candidates[Math.floor(random()*candidates.length)].id);
  next.dyes=dyes(Math.floor(random()*DYE_PALETTES.length));
  next.slots.headwear=(['none','cloth_wrap','scholar_cap','jade_pin'] as const)[Math.floor(random()*4)];
  for(const key of locks){
    if(key==='dyes')next.dyes={...recipe.dyes};
    else if(key==='hairStyle')next.hairStyle=recipe.hairStyle;
    else (next.slots as unknown as Record<string,string>)[key]=recipe.slots[key];
  }
  return createRecipe(next);
}
/** 严格文件边界：只接受 V5；错误时由 UI 保持当前角色不变。 */
export function parseRecipeFile(text: string): Recipe {
  if (new TextEncoder().encode(text).length > 32768) throw new Error('配方文件过大（最多 32 KB）。');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('不是有效的 JSON 配方。'); }
  const object = (value: unknown, label: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label+'必须是对象。');
    return value as Record<string, unknown>;
  };
  const exact = (value: Record<string, unknown>, keys: readonly string[], label: string) => {
    if (Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value,k)))
      throw new Error(label+'字段不完整或包含不支持的字段。');
  };
  const r = object(raw,'配方');
  if (r.version !== 5) throw new Error('只支持 Recipe V5；旧版配方不再兼容，请重新搭配并导出。');
  exact(r,['version','bodyType','slots','dyes','hairStyle','hairColor'],'配方');
  if (r.bodyType !== 'male' && r.bodyType !== 'female') throw new Error('无法识别固定基模。');
  const s=object(r.slots,'部件'), keys=Object.keys(SLOT_OPTIONS) as (keyof CharacterSlots)[];
  exact(s,keys,'部件');
  for (const k of keys) if (!SLOT_OPTIONS[k].some(x=>x.id===s[k])) throw new Error(`无法识别${SLOT_LABELS[k]}部件。`);
  const color=(v:unknown)=>typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v);
  const d=object(r.dyes,'染色'); exact(d,['primary','secondary','accent'],'染色');
  if (!Object.values(d).every(color) || !color(r.hairColor)) throw new Error('颜色必须为六位十六进制颜色。');
  if (typeof r.hairStyle!=='string' || !Object.hasOwn(HAIR_NAMES,r.hairStyle)) throw new Error('无法识别发型。');
  return createRecipe(r as unknown as Recipe);
}
