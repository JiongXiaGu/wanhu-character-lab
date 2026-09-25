import { createRecipe, HEADWEAR_IDS, TOP_IDS, BOTTOM_IDS, SHOES_IDS, BACK_IDS, LEFT_HAND_IDS, RIGHT_HAND_IDS, type BodyType, type CharacterSlots, type GarmentDyes, type HairStyleId, type Recipe } from '../v3/types';

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
  {id:'lightwork-male',name:'夏日劳作',family:'轻便',description:'无袖短褂 · 封口短裤',suggestedBody:'male',slots:slots('work_vest','short_trousers','cloth_wrap'),dyes:{primary:'#8b7760',secondary:'#546e70',accent:'#d3ba88'},hairStyle:'topknot'},
  {id:'lightwork-female',name:'轻装围裳',family:'轻便',description:'短袖短打 · 日常短裙',suggestedBody:'female',slots:slots('short_work_jacket','true_short_skirt'),dyes:{primary:'#a67568',secondary:'#526b68',accent:'#d5bc8f'},hairStyle:'low_bun'},
  {id:'plain-male',name:'布衣短褐',family:'布衣',description:'劳作短衣 · 劳动直裤',suggestedBody:'male',slots:slots('rough_tunic','work_pants','cloth_wrap'),dyes:dyes(0),hairStyle:'topknot'},
  {id:'plain-female',name:'布衣围裳',family:'布衣',description:'素衣 · 劳作束脚裤',suggestedBody:'female',slots:slots('rough_tunic','work_wrap'),dyes:{primary:'#978576',secondary:'#685e55',accent:'#bbaa8d'},hairStyle:'low_bun'},
  {id:'town-male',name:'青衿市井',family:'市井',description:'交领常服 · 劳动直裤',suggestedBody:'male',slots:slots('cross_jacket','work_pants'),dyes:dyes(1),hairStyle:'topknot'},
  {id:'town-female',name:'杏衫青裙',family:'市井',description:'交领常服 · 素面长裙',suggestedBody:'female',slots:slots('cross_jacket','long_skirt'),dyes:{primary:'#d3b08b',secondary:'#537775',accent:'#ece0c4'},hairStyle:'low_bun'},
  {id:'elegant-male',name:'月白雅服',family:'雅居',description:'半臂叠穿 · 劳动直裤',suggestedBody:'male',slots:slots('layered_vest','work_pants','scholar_cap'),dyes:dyes(3),hairStyle:'topknot'},
  {id:'elegant-female',name:'藕色绮裳',family:'雅居',description:'半臂叠穿 · 素面长裙',suggestedBody:'female',slots:slots('layered_vest','long_skirt','jade_pin'),dyes:{primary:'#a57b80',secondary:'#d6b5aa',accent:'#e6c98a'},hairStyle:'double_bun'},
  {id:'ceremony-male',name:'绛色礼衣',family:'礼仪',description:'滚边礼衣 · 劳动直裤',suggestedBody:'male',slots:slots('ceremony_robe','work_pants','scholar_cap'),dyes:dyes(5),hairStyle:'topknot'},
  {id:'ceremony-female',name:'黛紫宫装',family:'礼仪',description:'滚边礼衣 · 素面长裙',suggestedBody:'female',slots:slots('ceremony_robe','long_skirt','jade_pin'),dyes:dyes(4),hairStyle:'topknot'},
];
export const SLOT_LABELS:Record<keyof CharacterSlots,string>={headwear:'头饰',top:'上衣',bottom:'下装',shoes:'鞋',back:'背部',leftHand:'左手',rightHand:'右手'};
export const SLOT_OPTIONS: { [K in keyof CharacterSlots]: readonly {id:CharacterSlots[K];name:string}[] } = {
  headwear:[{id:'palace_guard_helmet',name:'宫卫红缨盔'},{id:'palace_captain_helmet',name:'宫卫队长高束缨盔'},{id:'frontier_guard_helmet',name:'边军护颈盔'},{id:'frontier_captain_helmet',name:'边军队长束缨尖盔'},{id:'city_guard_helmet',name:'城军低檐盔'},{id:'city_captain_helmet',name:'城军队长窄竖冠盔'},{id:'none',name:'无头饰'},{id:'cloth_wrap',name:'素布包巾'},{id:'scholar_cap',name:'方冠'},{id:'jade_pin',name:'玉色簪饰'},{id:'farmer_straw_hat',name:'草帽'},{id:'guard_helmet',name:'轻盔'},{id:'archer_headband',name:'头巾'}],
  top:[{id:'heavy_armor',name:'重甲厚壳札甲'},{id:'medium_armor',name:'中甲札甲'},{id:'city_guard_brigandine',name:'轻甲布面短甲'},{id:'work_vest',name:'干活背心'},{id:'short_work_jacket',name:'短打短褂'},{id:'rough_tunic',name:'劳作短衣'},{id:'cross_jacket',name:'交领常服'},{id:'layered_vest',name:'半臂配内衬'},{id:'ceremony_robe',name:'滚边礼衣'},{id:'farmer_tunic',name:'农户短衣'},{id:'body',name:'无上衣'}],
  bottom:[{id:'heavy_armor_skirt',name:'重甲宽幅甲裙与裤装'},{id:'medium_armor_skirt',name:'中甲长甲裙与裤装'},{id:'city_guard_trousers',name:'轻甲束腿军裤'},{id:'short_trousers',name:'封口短裤'},{id:'true_short_skirt',name:'日常短裙'},{id:'long_skirt',name:'素面长裙'},{id:'work_pants',name:'劳动直裤'},{id:'work_wrap',name:'劳作束脚裤'},{id:'body',name:'无下装'}],
  shoes:[{id:'cloth_shoes',name:'布鞋'},{id:'military_boots',name:'短筒军靴'}],
  back:[{id:'none',name:'无背部装备'},{id:'bamboo_basket',name:'竹背篓'},{id:'firewood_bundle',name:'柴捆'},{id:'book_case',name:'书笈'},{id:'archer_quiver',name:'箭袋'}],
  leftHand:[{id:'none',name:'左手空'},{id:'guard_shield',name:'盾牌'},{id:'archer_bow',name:'短弓'}],
  rightHand:[{id:'military_spear',name:'军用长枪'},{id:'none',name:'右手空'},{id:'farmer_hoe',name:'锄头'},{id:'guard_sword',name:'短剑'}],
};
const SLOT_IDS: { [K in keyof CharacterSlots]: readonly CharacterSlots[K][] } = {
  headwear:HEADWEAR_IDS, top:TOP_IDS, bottom:BOTTOM_IDS, shoes:SHOES_IDS,
  back:BACK_IDS, leftHand:LEFT_HAND_IDS, rightHand:RIGHT_HAND_IDS,
};
export const HAIR_NAMES:Record<HairStyleId,string>={topknot:'束发高髻',low_bun:'后侧低髻',double_bun:'双髻'};
export const DEFAULT_DYES:GarmentDyes = {primary:'#547a77',secondary:'#ddd0b5',accent:'#b49566'};
export const WARDROBE_VERSION='wanhu-wardrobe-v5';
export function applyLook(recipe:Recipe,id:string):Recipe {
  const look=WARDROBE_LOOKS.find(x=>x.id===id);
  if(!look)return recipe;
  return createRecipe({...recipe,slots:{...look.slots},dyes:{...look.dyes},hairStyle:look.hairStyle});
}
export type RandomLock = keyof CharacterSlots | 'bodyType' | 'dyes' | 'hairStyle';
/** 同一种子、输入配方和锁定项可复现完整人物外观。 */
export function randomizeCharacter(recipe:Recipe,seed:number,locks:readonly RandomLock[]=[]):Recipe {
  let n=Number.isFinite(seed)?seed>>>0:1;
  const random=()=>{n=(n+0x6d2b79f5)>>>0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
  const bodyType=locks.includes('bodyType')?recipe.bodyType:(random()<.5?'male':'female');
  const candidates=WARDROBE_LOOKS.filter(x=>x.suggestedBody===bodyType);
  const next=applyLook(createRecipe({...recipe,bodyType}),candidates[Math.floor(random()*candidates.length)].id);
  next.dyes=dyes(Math.floor(random()*DYE_PALETTES.length));
  next.slots.headwear=(['none','cloth_wrap','scholar_cap','jade_pin'] as const)[Math.floor(random()*4)];
  next.slots.back=BACK_IDS[Math.floor(random()*BACK_IDS.length)];
  for(const key of locks){
    if(key==='bodyType')continue;
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
  const s=object(r.slots,'部件'), keys=Object.keys(SLOT_IDS) as (keyof CharacterSlots)[];
  exact(s,keys,'部件');
  for (const k of keys) if (!(SLOT_IDS[k] as readonly unknown[]).includes(s[k])) throw new Error(`无法识别${SLOT_LABELS[k]}部件。`);
  const color=(v:unknown)=>typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v);
  const d=object(r.dyes,'染色'); exact(d,['primary','secondary','accent'],'染色');
  if (!Object.values(d).every(color) || !color(r.hairColor)) throw new Error('颜色必须为六位十六进制颜色。');
  if (typeof r.hairStyle!=='string' || !Object.hasOwn(HAIR_NAMES,r.hairStyle)) throw new Error('无法识别发型。');
  return createRecipe(r as unknown as Recipe);
}
