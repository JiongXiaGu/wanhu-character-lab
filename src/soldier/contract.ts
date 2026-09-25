/** 军人作者流程契约：只定义风格、命名与阶段，不进入 Recipe 或玩法运行时。 */
export const SOLDIER_WORKFLOW_VERSION = 'wanhu-soldier-authoring-v2';

export const SOLDIER_STYLE_IDS = ['palace', 'frontier', 'city'] as const;
export type SoldierStyleId = typeof SOLDIER_STYLE_IDS[number];

export const SOLDIER_ARMOR_CLASS_IDS = ['light', 'medium', 'heavy'] as const;
export type SoldierArmorClassId = typeof SOLDIER_ARMOR_CLASS_IDS[number];

export const SOLDIER_ROLE_IDS = ['spearman', 'swordsman', 'archer', 'shieldman'] as const;
export type SoldierRoleId = typeof SOLDIER_ROLE_IDS[number];

export interface SoldierStyleContract {
  name: string;
  armorClass: SoldierArmorClassId;
  silhouette: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
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
    silhouette: '中甲、高盔、绛红配色',
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
    silhouette: '中甲、护颈盔、靛灰配色',
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
    silhouette: '轻甲、低檐盔、束腿军裤',
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
