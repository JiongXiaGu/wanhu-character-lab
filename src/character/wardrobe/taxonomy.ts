import type { BottomId, HeadwearId, ShoesId, TopId } from '../v3/types';

export type WearableSlot = 'headwear' | 'top' | 'bottom' | 'shoes';
export type WearableId =
  | Exclude<HeadwearId, 'none'>
  | Exclude<TopId, 'body'>
  | Exclude<BottomId, 'body'>
  | Exclude<ShoesId, 'body'>;

export type WardrobeFormality = 'labor' | 'daily' | 'formal' | 'ceremonial' | 'military';
export type WardrobeLayer = 'head' | 'base' | 'middle' | 'outer' | 'foot';

export interface WardrobeTaxonomyEntry {
  id: WearableId;
  name: string;
  slot: WearableSlot;
  family: string;
  silhouette: string;
  length: string;
  layer: WardrobeLayer;
  formality: WardrobeFormality;
  sleeve?: string;
  neckline?: string;
  contexts: readonly string[];
  visualTraits: readonly string[];
}

const entry = <T extends WardrobeTaxonomyEntry>(value: T): T => value;

/**
 * 当前可穿戴资产的检索权威。
 *
 * 这里只描述“它是什么轮廓”，不把服饰锁死到职业/身份。
 * contexts 仅用于检索和缺口分析；玩家仍可自由混搭。
 */
export const WARDROBE_TAXONOMY = [
  entry({id:'attendant_fitted_long_robe',name:'收袖内侍长衣',slot:'top',family:'court-attendant-robe',silhouette:'fitted-split-front-back-long-robe',length:'calf',layer:'outer',formality:'formal',sleeve:'elbow-to-wrist-fitted',neckline:'close-small-standing-collar',contexts:['内侍','太监','宫廷日常','正式场合','自由混搭'],visualTraits:['窄肩','肘下收袖近腕','轻收腰无凸出束带','前后窄长片','双侧有厚边开衩','前短后长']}),
  entry({id:'official_winged_cap',name:'正式官帽',slot:'headwear',family:'civil-official',silhouette:'horizontal-wings-sloped-box-cap',length:'head',layer:'head',formality:'formal',contexts:['官员','官署','正式场合','自由混搭'],visualTraits:['前低后高帽身','左右独立薄翅','近直立侧壁','无护颊护颈']}),
  entry({id:'court_maid_short_jacket',name:'宫女短襦',slot:'top',family:'court-light-separates',silhouette:'cropped-narrow-long-sleeve',length:'high-waist',layer:'base',formality:'formal',sleeve:'long-narrow-tapered',neckline:'small-centered-facing',contexts:['宫女','宫廷日常','自由混搭'],visualTraits:['高腰短身','窄长袖','小对襟','收口袖缘']}),
  entry({id:'court_maid_high_waist_skirt',name:'宫女高腰长裙',slot:'bottom',family:'court-light-separates',silhouette:'high-waist-vertical-skirt',length:'ankle',layer:'base',formality:'formal',contexts:['宫女','宫廷日常','自由混搭'],visualTraits:['真实高裙头','纵向浅折棱','踝部长身','克制展开']}),
  entry({id:'cloth_wrap',name:'素布包巾',slot:'headwear',family:'civilian-soft',silhouette:'wrapped-cloth',length:'head',layer:'head',formality:'daily',contexts:['居民','劳作','市井'],visualTraits:['软质包裹','低体量','后结']}),
  entry({id:'scholar_cap',name:'方冠',slot:'headwear',family:'civilian-formal',silhouette:'square-cap',length:'head',layer:'head',formality:'formal',contexts:['士人','官署候选','礼仪'],visualTraits:['方正','硬挺','横向帽翅']}),
  entry({id:'jade_pin',name:'玉色簪饰',slot:'headwear',family:'civilian-jewelry',silhouette:'hair-pin',length:'head',layer:'head',formality:'formal',contexts:['女性','雅居','宫廷候选'],visualTraits:['细长簪体','低体量','依附发髻']}),
  entry({id:'farmer_straw_hat',name:'草帽',slot:'headwear',family:'labor',silhouette:'wide-brim-hat',length:'head',layer:'head',formality:'labor',contexts:['农户','户外劳作'],visualTraits:['宽檐','低冠','遮阳']}),
  entry({id:'guard_helmet',name:'轻盔',slot:'headwear',family:'military-light',silhouette:'light-helmet',length:'head',layer:'head',formality:'military',contexts:['军人','守卫'],visualTraits:['轻量盔壳','低装饰']}),
  entry({id:'archer_headband',name:'头巾',slot:'headwear',family:'military-soft',silhouette:'forehead-band',length:'head',layer:'head',formality:'military',contexts:['弓手','轻装军人'],visualTraits:['前额束带','开放头顶','低体量']}),
  entry({id:'palace_guard_helmet',name:'宫卫红缨盔',slot:'headwear',family:'military-palace',silhouette:'palace-helmet',length:'head',layer:'head',formality:'military',contexts:['皇宫禁卫','普通士兵'],visualTraits:['红缨','宫卫识别','中等体量']}),
  entry({id:'palace_captain_helmet',name:'宫卫队长高束缨盔',slot:'headwear',family:'military-palace',silhouette:'palace-captain-helmet',length:'head',layer:'head',formality:'military',contexts:['皇宫禁卫','队长'],visualTraits:['细高竖向顶饰','居中','收尖']}),
  entry({id:'frontier_guard_helmet',name:'边军护颈盔',slot:'headwear',family:'military-frontier',silhouette:'frontier-helmet',length:'head-neck',layer:'head',formality:'military',contexts:['边疆戍卒','普通士兵'],visualTraits:['低盔','长护颈','厚重']}),
  entry({id:'frontier_captain_helmet',name:'边军队长束缨尖盔',slot:'headwear',family:'military-frontier',silhouette:'frontier-captain-helmet',length:'head-neck',layer:'head',formality:'military',contexts:['边疆戍卒','队长'],visualTraits:['束缨','金属盔尖','护颈']}),
  entry({id:'city_guard_helmet',name:'城军低檐盔',slot:'headwear',family:'military-city',silhouette:'city-low-brim-helmet',length:'head',layer:'head',formality:'military',contexts:['城市守军','普通士兵'],visualTraits:['低檐','紧凑','巡逻感']}),
  entry({id:'city_captain_helmet',name:'城军队长窄竖冠盔',slot:'headwear',family:'military-city',silhouette:'city-captain-helmet',length:'head',layer:'head',formality:'military',contexts:['城市守军','队长'],visualTraits:['窄竖冠','居中','收尖']}),
  entry({id:'palace_heavy_helmet',name:'宫卫重盔',slot:'headwear',family:'military-heavy-palace',silhouette:'heavy-palace-helmet',length:'head-neck',layer:'head',formality:'military',contexts:['重甲步兵','皇宫禁卫'],visualTraits:['厚盔壳','眉檐','护颊','护颈']}),
  entry({id:'palace_heavy_captain_helmet',name:'宫卫队长重盔',slot:'headwear',family:'military-heavy-palace',silhouette:'heavy-palace-captain-helmet',length:'head-neck',layer:'head',formality:'military',contexts:['重甲步兵','皇宫禁卫','队长'],visualTraits:['厚盔壳','竖向队长识别','护颈']}),
  entry({id:'frontier_heavy_helmet',name:'边军重盔',slot:'headwear',family:'military-heavy-frontier',silhouette:'heavy-frontier-helmet',length:'head-neck',layer:'head',formality:'military',contexts:['重甲步兵','边疆戍卒'],visualTraits:['厚盔壳','边军识别','护颈']}),
  entry({id:'frontier_heavy_captain_helmet',name:'边军队长重盔',slot:'headwear',family:'military-heavy-frontier',silhouette:'heavy-frontier-captain-helmet',length:'head-neck',layer:'head',formality:'military',contexts:['重甲步兵','边疆戍卒','队长'],visualTraits:['厚盔壳','竖向队长识别','护颈']}),
  entry({id:'city_heavy_helmet',name:'城军重盔',slot:'headwear',family:'military-heavy-city',silhouette:'heavy-city-helmet',length:'head-neck',layer:'head',formality:'military',contexts:['重甲步兵','城市守军'],visualTraits:['厚盔壳','城市守军识别','护颈']}),
  entry({id:'city_heavy_captain_helmet',name:'城军队长重盔',slot:'headwear',family:'military-heavy-city',silhouette:'heavy-city-captain-helmet',length:'head-neck',layer:'head',formality:'military',contexts:['重甲步兵','城市守军','队长'],visualTraits:['厚盔壳','竖向队长识别','护颈']}),

  entry({id:'narrow_long_robe',name:'窄袖直身长袍',slot:'top',family:'civilian-long-robe',silhouette:'straight-h-long-robe',length:'calf',layer:'outer',formality:'formal',sleeve:'long-narrow-tapered',neckline:'close-collar-with-cross-trim',contexts:['士人','官署','官员','太监','内侍','宫廷日常','正式场合'],visualTraits:['膝下长身','窄长袖筒','收敛袖口','H型小展下摆','腰内回折']}),
  entry({id:'work_vest',name:'干活背心',slot:'top',family:'labor-light',silhouette:'sleeveless-short',length:'waist',layer:'base',formality:'labor',sleeve:'none',neckline:'open',contexts:['居民','劳作','夏季'],visualTraits:['无袖','短衣','大面积露臂']}),
  entry({id:'short_work_jacket',name:'短打短褂',slot:'top',family:'labor-light',silhouette:'short-jacket',length:'waist',layer:'base',formality:'labor',sleeve:'short',neckline:'simple',contexts:['居民','劳作','夏季'],visualTraits:['短袖','短衣摆','行动轻便']}),
  entry({id:'farmer_tunic',name:'农户短衣',slot:'top',family:'labor',silhouette:'plain-short-tunic',length:'hip',layer:'base',formality:'labor',sleeve:'short',neckline:'simple',contexts:['农户','劳作'],visualTraits:['朴素','短袖','松量有限']}),
  entry({id:'rough_tunic',name:'劳作短衣',slot:'top',family:'labor',silhouette:'work-tunic',length:'hip',layer:'base',formality:'labor',sleeve:'short-rolled',neckline:'short-placket',contexts:['居民','劳作','布衣'],visualTraits:['短门襟','卷袖口','清楚短腰线']}),
  entry({id:'cross_jacket',name:'交领常服',slot:'top',family:'civilian-daily',silhouette:'cross-collar-jacket',length:'hip',layer:'base',formality:'daily',sleeve:'long-wide',neckline:'cross-collar',contexts:['居民','市井','日常'],visualTraits:['交领','较完整衣身','宽长袖']}),
  entry({id:'layered_vest',name:'半臂配内衬',slot:'top',family:'civilian-layered',silhouette:'layered-half-sleeve',length:'hip',layer:'middle',formality:'formal',sleeve:'half-over-long-inner',neckline:'front-open',contexts:['居民','雅居','士人','宫廷候选'],visualTraits:['对襟外衣','短外袖','可见细长内袖']}),
  entry({id:'ceremony_robe',name:'滚边礼衣',slot:'top',family:'civilian-ceremonial',silhouette:'formal-jacket',length:'hip',layer:'outer',formality:'ceremonial',sleeve:'long-wide',neckline:'formal',contexts:['居民礼仪','士人','宫廷候选'],visualTraits:['滚边','长袖','礼仪感','仍是短身上装']}),
  entry({id:'city_guard_brigandine',name:'轻甲布面短甲',slot:'top',family:'military-light',silhouette:'short-brigandine',length:'hip',layer:'outer',formality:'military',sleeve:'armor-open-arm',neckline:'guard',contexts:['城市守军','轻甲'],visualTraits:['布面短甲','窄肩','浅胸','短轮廓']}),
  entry({id:'medium_armor',name:'中甲札甲',slot:'top',family:'military-medium',silhouette:'lamellar-medium',length:'hip',layer:'outer',formality:'military',sleeve:'armored',neckline:'guard',contexts:['军人','中甲','皇宫禁卫','边疆戍卒'],visualTraits:['札甲','中等厚度','胸腹防护']}),
  entry({id:'heavy_armor',name:'重甲胸腹甲',slot:'top',family:'military-heavy',silhouette:'heavy-infantry-armor',length:'hip',layer:'outer',formality:'military',sleeve:'armored',neckline:'heavy-guard',contexts:['重甲步兵','军人'],visualTraits:['厚胸腹','护肩','护臂','高体量']}),

  entry({id:'short_trousers',name:'封口短裤',slot:'bottom',family:'labor-light',silhouette:'closed-short-trousers',length:'knee',layer:'base',formality:'labor',contexts:['居民','劳作','夏季'],visualTraits:['短裤腿','厚端面封边','露小腿']}),
  entry({id:'true_short_skirt',name:'日常短裙',slot:'bottom',family:'civilian-skirt',silhouette:'continuous-short-skirt',length:'knee',layer:'base',formality:'daily',contexts:['居民','女性','日常'],visualTraits:['连续裙壳','A字感','露小腿']}),
  entry({id:'long_skirt',name:'素面长裙',slot:'bottom',family:'civilian-skirt',silhouette:'continuous-long-skirt',length:'ankle',layer:'base',formality:'daily',contexts:['居民','女性','市井','宫廷候选'],visualTraits:['连续长裙','素面','纵向长轮廓']}),
  entry({id:'work_pants',name:'劳动直裤',slot:'bottom',family:'labor',silhouette:'straight-trousers',length:'ankle',layer:'base',formality:'labor',contexts:['居民','劳作'],visualTraits:['直筒','宽裤脚','窄折边']}),
  entry({id:'work_wrap',name:'劳作束脚裤',slot:'bottom',family:'labor',silhouette:'bound-trousers',length:'ankle',layer:'base',formality:'labor',contexts:['居民','劳作'],visualTraits:['大腿留量','小腿收束','脚踝束带']}),
  entry({id:'city_guard_trousers',name:'轻甲束腿军裤',slot:'bottom',family:'military-light',silhouette:'military-bound-trousers',length:'ankle',layer:'base',formality:'military',contexts:['城市守军','轻甲'],visualTraits:['束腿','便于巡逻','与短甲配套']}),
  entry({id:'medium_armor_skirt',name:'中甲长甲裙与裤装',slot:'bottom',family:'military-medium',silhouette:'armor-long-skirt',length:'calf',layer:'outer',formality:'military',contexts:['军人','中甲','皇宫禁卫','边疆戍卒'],visualTraits:['长甲裙','裤管出口','前后连续']}),
  entry({id:'heavy_armor_skirt',name:'重甲长围裳',slot:'bottom',family:'military-heavy',silhouette:'heavy-long-skirt',length:'calf',layer:'outer',formality:'military',contexts:['重甲步兵','军人'],visualTraits:['连续过膝','长围裳','厚重纵向轮廓']}),

  entry({id:'cloth_shoes',name:'布鞋',slot:'shoes',family:'civilian-footwear',silhouette:'low-cloth-shoe',length:'foot',layer:'foot',formality:'daily',contexts:['居民','劳作','市井','礼仪基础'],visualTraits:['低帮','软质','低体量']}),
  entry({id:'military_boots',name:'短筒军靴',slot:'shoes',family:'military-footwear',silhouette:'ankle-military-boot',length:'ankle',layer:'foot',formality:'military',contexts:['军人','轻甲','中甲','重甲'],visualTraits:['短筒','硬挺','军用']}),
] as const satisfies readonly WardrobeTaxonomyEntry[];

export interface WardrobeGap {
  id: string;
  slot: WearableSlot;
  label: string;
  targetContexts: readonly string[];
  distinguishingTraits: readonly string[];
  whyExistingAssetsDoNotCoverIt: string;
}

/**
 * 只登记“轮廓空缺”，不预注册运行时服饰 ID。
 * 后续制作应优先填这里的缺口，再决定是否需要新增正式资产。
 */
export const WARDROBE_GAPS = [
  {id:'wide-sleeve-ceremonial-robe',slot:'top',label:'宽袖礼服长袍',targetContexts:['皇帝','皇后','高等级礼仪'],distinguishingTraits:['长身','宽大袖体','高礼仪体量'],whyExistingAssetsDoNotCoverIt:'ceremony_robe 是短身礼衣，不能仅靠加宽袖口冒充宫廷大礼服。'},
  {id:'layered-court-outerwear',slot:'top',label:'多层宫廷外服',targetContexts:['皇后','高等级宫廷女性','高级官员'],distinguishingTraits:['明显外层','前后层次','大轮廓边缘'],whyExistingAssetsDoNotCoverIt:'layered_vest 只有半臂叠穿，层次和覆盖面积不足。'},
  {id:'court-high-rank-ceremonial-skirt',slot:'bottom',label:'高等级宽摆或多层礼裙（C8/C11）',targetContexts:['皇后','高等级宫廷礼仪'],distinguishingTraits:['宽摆高体量或分层裙摆','与宫女日常裙拉开'],whyExistingAssetsDoNotCoverIt:'C2 高腰长裙已覆盖基础宫廷日常正式裙；仍不包含 C8 宽摆宫裙或 C11 多层礼裙。'},
  {id:'official-robe',slot:'top',label:'官员袍服',targetContexts:['官员','官署'],distinguishingTraits:['规整长袍','官署识别','克制而正式'],whyExistingAssetsDoNotCoverIt:'C3 正式官帽已补足横向官署头部轮廓，C1 可作为窄袖混搭长袍；C4 是收袖窄摆内侍长衣，规整宽松的专门官袍仍是独立缺口。'},
  {id:'imperial-crown',slot:'headwear',label:'皇帝冠饰',targetContexts:['皇帝'],distinguishingTraits:['最高等级纵向识别','远景唯一轮廓'],whyExistingAssetsDoNotCoverIt:'方冠与 C3 横向正式官帽都不是皇室纵向高冠，军盔也不能替代。'},
  {id:'empress-headdress',slot:'headwear',label:'皇后大型头饰',targetContexts:['皇后'],distinguishingTraits:['更大横向/纵向体量','多层装饰','高识别度'],whyExistingAssetsDoNotCoverIt:'jade_pin 只是低体量簪饰，无法建立皇后剪影。'},
  {id:'court-attendant-cap',slot:'headwear',label:'宫廷内侍帽冠',targetContexts:['太监','宫廷内侍'],distinguishingTraits:['收敛','非武职','与官帽明显不同'],whyExistingAssetsDoNotCoverIt:'C4 已提供收袖内侍长衣，但不是头饰；cloth_wrap 太日常，方冠和 C3 長薄翅官帽不能代替 C5 紧凑无长翅的帽型。'},
  {id:'court-maid-headwear',slot:'headwear',label:'宫女日常头饰',targetContexts:['宫女'],distinguishingTraits:['轻量发饰','成组可变化','不压过皇后'],whyExistingAssetsDoNotCoverIt:'当前只有单一 jade_pin，缺少宫廷女性内部层级。'},
  {id:'formal-footwear',slot:'shoes',label:'正式鞋履',targetContexts:['皇帝','皇后','官员','宫女','太监'],distinguishingTraits:['比布鞋更正式','非军靴','与长袍下摆协调'],whyExistingAssetsDoNotCoverIt:'当前鞋履只有日常布鞋和军靴，两端之间没有正式文职/宫廷鞋履。'},
] as const satisfies readonly WardrobeGap[];

export const WARDROBE_TAXONOMY_BY_ID = new Map<WearableId, WardrobeTaxonomyEntry>(
  WARDROBE_TAXONOMY.map(item => [item.id, item]),
);

export function wardrobeByContext(context: string): readonly WardrobeTaxonomyEntry[] {
  return WARDROBE_TAXONOMY.filter(item => item.contexts.includes(context));
}
