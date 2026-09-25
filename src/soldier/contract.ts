/** 军人作者流程契约：只定义风格、命名与阶段，不进入 Recipe 或玩法运行时。 */
export const SOLDIER_WORKFLOW_VERSION = 'wanhu-soldier-authoring-v1';

export const SOLDIER_STYLE_IDS = ['palace', 'frontier', 'city'] as const;
export type SoldierStyleId = typeof SOLDIER_STYLE_IDS[number];

export const SOLDIER_ROLE_IDS = ['spearman', 'swordsman', 'archer', 'shieldman'] as const;
export type SoldierRoleId = typeof SOLDIER_ROLE_IDS[number];

export interface SoldierStyleContract {
  name: string;
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
    silhouette: '宽肩、高盔、红缨',
    palette: { primary: '#713b38', secondary: '#34383a', accent: '#a07c49' },
    assets: {
      headwear: 'palace_guard_helmet',
      top: 'palace_guard_armor',
      bottom: 'palace_guard_skirt',
      shoes: 'military_boots',
    },
  },
  frontier: {
    name: '边疆戍卒',
    silhouette: '厚胸、长甲裙、护颈',
    palette: { primary: '#41535a', secondary: '#4b4b47', accent: '#79504a' },
    assets: {
      headwear: 'frontier_guard_helmet',
      top: 'frontier_lamellar_armor',
      bottom: 'frontier_armor_skirt',
      shoes: 'military_boots',
    },
  },
  city: {
    name: '城市守军',
    silhouette: '短甲、窄肩、明显腰带',
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
