/** 军人作者流程契约：只定义风格、命名与阶段，不进入 Recipe 或玩法运行时。 */
export const SOLDIER_WORKFLOW_VERSION = 'wanhu-soldier-authoring-v3';

export const SOLDIER_STYLE_IDS = ['palace', 'frontier', 'city'] as const;
export type SoldierStyleId = typeof SOLDIER_STYLE_IDS[number];

export const SOLDIER_ARMOR_CLASS_IDS = ['light', 'medium', 'heavy'] as const;
export type SoldierArmorClassId = typeof SOLDIER_ARMOR_CLASS_IDS[number];

export const SOLDIER_ROLE_IDS = ['spearman', 'swordsman', 'archer', 'shieldman'] as const;
export type SoldierRoleId = typeof SOLDIER_ROLE_IDS[number];

export interface SoldierStyleContract {
  name: string;
  /** 首次从居民装进入试衣时的默认等级，不限制该驻地可使用的甲装。 */
  armorClass: SoldierArmorClassId;
  silhouette: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  /** 默认长枪搭配；后续切驻地只换头盔和配色。 */
  assets: {
    headwear: string;
    top: string;
    bottom: string;
    shoes: string;
  };
}

export const SOLDIER_STYLE_CONTRACT: Readonly<Record<SoldierStyleId, SoldierStyleContract>> = {
  palace: {
    name: '皇宫禁卫',
    armorClass: 'medium',
    silhouette: '高盔、绛红配色；甲装等级独立选择',
    palette: { primary: '#713b38', secondary: '#34383a', accent: '#a07c49' },
    assets: {
      headwear: 'palace_guard_helmet',
      top: 'medium_armor',
      bottom: 'medium_armor_skirt',
      shoes: 'military_boots',
    },
  },
  frontier: {
    name: '边疆戍卒',
    armorClass: 'medium',
    silhouette: '护颈盔、靛灰配色；甲装等级独立选择',
    palette: { primary: '#41535a', secondary: '#4b4b47', accent: '#79504a' },
    assets: {
      headwear: 'frontier_guard_helmet',
      top: 'medium_armor',
      bottom: 'medium_armor_skirt',
      shoes: 'military_boots',
    },
  },
  city: {
    name: '城市守军',
    armorClass: 'light',
    silhouette: '低檐盔、灰青配色；甲装等级独立选择',
    palette: { primary: '#44565b', secondary: '#505557', accent: '#887252' },
    assets: {
      headwear: 'city_guard_helmet',
      top: 'city_guard_brigandine',
      bottom: 'city_guard_trousers',
      shoes: 'military_boots',
    },
  },
};

export const SOLDIER_FIRST_BUILD = {
  style: 'palace',
  role: 'spearman',
  weapon: 'military_spear',
} as const satisfies { style: SoldierStyleId; role: SoldierRoleId; weapon: string };
