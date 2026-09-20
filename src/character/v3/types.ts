/** V3 的数据协议不依赖 React、Three.js 或 Unity。 */
export type Vec3 = [number, number, number];
export type Weight = [number, number, number]; // bone A, bone B, weight A
export type Region =
  | "head"
  | "neck"
  | "torso"
  | "pelvis"
  | "upperArm"
  | "forearm"
  | "hand"
  | "thigh"
  | "shin"
  | "foot"
  | "detail"
  | "equipment";

/** 两个固定基模；服装只引用基模，不携带连续比例参数。 */
export type BodyType = "male" | "female";
export const BODY_TYPES = ["male", "female"] as const;
export const BODY_PROFILE_VERSION = "wanhu-fixed-bodies-v1";
export const BODY_HEIGHT: Readonly<Record<BodyType, number>> = { male: 1.76, female: 1.66 };

export type Outfit = "farmer" | "guard" | "archer" | "body";

export type HeadwearId =
  | "none"
  | "farmer_straw_hat"
  | "guard_helmet"
  | "archer_headband"
  | "cloth_wrap"
  | "scholar_cap"
  | "jade_pin";
export type TopId =
  | "body"
  | "farmer_tunic"
  | "guard_light_armor"
  | "archer_tunic"
  | "rough_tunic"
  | "cross_jacket"
  | "layered_vest"
  | "ceremony_robe";
export type BottomId =
  | "body"
  | "work_pants"
  | "guard_pants"
  | "archer_pants"
  | "loose_trousers"
  | "work_wrap"
  | "pleated_skirt"
  | "robe_skirt";
export type ShoesId = "body" | "cloth_shoes" | "boots";
export type BackId = "none" | "archer_quiver";
export type LeftHandId = "none" | "guard_shield" | "archer_bow";
export type RightHandId = "none" | "farmer_hoe" | "guard_sword";

export interface CharacterSlots {
  headwear: HeadwearId;
  top: TopId;
  bottom: BottomId;
  shoes: ShoesId;
  back: BackId;
  leftHand: LeftHandId;
  rightHand: RightHandId;
}

export const HAIR_STYLE_IDS = ["topknot", "low_bun", "double_bun"] as const;
export type HairStyleId = typeof HAIR_STYLE_IDS[number];
export interface GarmentDyes { primary: string; secondary: string; accent: string }

/** 仅记录外观；旧版本由文件入口拒绝，不转换、不静默补字段。 */
export interface Recipe {
  version: 5;
  bodyType: BodyType;
  slots: CharacterSlots;
  dyes: GarmentDyes;
  hairStyle: HairStyleId;
  hairColor: string;
}
/** 只供内部创建/编辑使用，不是用户文件验证器。 */
export type RecipeInput = Partial<Omit<Recipe, "slots" | "version">> & {
  slots?: Partial<CharacterSlots>;
};

export interface Vertex {
  p: Vec3;
  w: Weight;
  id: string;
}
export interface Face {
  v: number[];
  region: Region;
  color?: string;
  part?: "skin" | "top" | "bottom" | "shoes";
}
export interface Cage {
  vertices: Vertex[];
  faces: Face[];
  anchors: Record<string, number[]>;
}
export interface Joint {
  name: string;
  parent: number;
  p: Vec3;
}
export interface CharacterData {
  body: Cage;
  surface: Cage;
  joints: Joint[];
  recipe: Recipe;
  replacedTriangles: number;
  bodyTriangles: number;
  garments: { id: string; slot: "top" | "bottom" | "shoes"; version: string; triangles: number; covers: Region[]; openings: string[] }[];
}

export const PRESET_IDS = ["farmer", "guard", "archer", "body"] as const;

export const HEADWEAR_IDS = [
  "none",
  "farmer_straw_hat",
  "guard_helmet",
  "archer_headband",
  "cloth_wrap", "scholar_cap", "jade_pin",
] as const satisfies readonly HeadwearId[];

export const TOP_IDS = [
  "body",
  "farmer_tunic",
  "guard_light_armor",
  "archer_tunic",
  "rough_tunic", "cross_jacket", "layered_vest", "ceremony_robe",
] as const satisfies readonly TopId[];

export const BOTTOM_IDS = [
  "body",
  "work_pants",
  "guard_pants",
  "archer_pants",
  "loose_trousers", "work_wrap", "pleated_skirt", "robe_skirt",
] as const satisfies readonly BottomId[];

export const SHOES_IDS = [
  "body",
  "cloth_shoes",
  "boots",
] as const satisfies readonly ShoesId[];

export const BACK_IDS = [
  "none",
  "archer_quiver",
] as const satisfies readonly BackId[];

export const LEFT_HAND_IDS = [
  "none",
  "guard_shield",
  "archer_bow",
] as const satisfies readonly LeftHandId[];

export const RIGHT_HAND_IDS = [
  "none",
  "farmer_hoe",
  "guard_sword",
] as const satisfies readonly RightHandId[];

const PRESET_SLOTS: Record<Outfit, CharacterSlots> = {
  farmer: {
    headwear: "farmer_straw_hat",
    top: "farmer_tunic",
    bottom: "work_pants",
    shoes: "cloth_shoes",
    back: "none",
    leftHand: "none",
    rightHand: "none",
  },
  guard: {
    headwear: "guard_helmet",
    top: "guard_light_armor",
    bottom: "guard_pants",
    shoes: "boots",
    back: "none",
    leftHand: "guard_shield",
    rightHand: "guard_sword",
  },
  archer: {
    headwear: "archer_headband",
    top: "archer_tunic",
    bottom: "archer_pants",
    shoes: "boots",
    back: "archer_quiver",
    leftHand: "archer_bow",
    rightHand: "none",
  },
  body: {
    headwear: "none",
    top: "body",
    bottom: "body",
    shoes: "body",
    back: "none",
    leftHand: "none",
    rightHand: "none",
  },
};

export function presetSlots(preset: Outfit): CharacterSlots {
  return { ...PRESET_SLOTS[preset] };
}

export const DEFAULT_RECIPE: Recipe = {
  version: 5,
  bodyType: "male",
  slots: presetSlots("farmer"),
  dyes: { primary: "#547a77", secondary: "#ddd0b5", accent: "#b49566" },
  hairStyle: "topknot",
  hairColor: "#282b29",
};

export const B = {
  Root: 0,
  Hips: 1,
  Spine: 2,
  Chest: 3,
  Neck: 4,
  Head: 5,
  RightClavicle: 6,
  RightUpperArm: 7,
  RightForearm: 8,
  RightHand: 9,
  LeftClavicle: 10,
  LeftUpperArm: 11,
  LeftForearm: 12,
  LeftHand: 13,
  RightThigh: 14,
  RightShin: 15,
  RightFoot: 16,
  LeftThigh: 17,
  LeftShin: 18,
  LeftFoot: 19,
} as const;

export const rigid = (bone: number): Weight => [bone, bone, 1];

function valid<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && values.includes(value as T)
    ? (value as T)
    : fallback;
}

/** 内部构造器：返回独立对象；外部 JSON 必须经 parseRecipeFile 严格验证。 */
export function createRecipe(value: RecipeInput = {}): Recipe {
  const base = DEFAULT_RECIPE;
  const bodyType = valid(value.bodyType, BODY_TYPES, base.bodyType);
  const input = value.slots ?? {};
  const hex = (v: unknown, fallback: string) =>
    typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;
  return {
    version: 5,
    bodyType,
    slots: {
      headwear: valid(input.headwear, HEADWEAR_IDS, base.slots.headwear),
      top: valid(input.top, TOP_IDS, base.slots.top),
      bottom: valid(input.bottom, BOTTOM_IDS, base.slots.bottom),
      shoes: valid(input.shoes, SHOES_IDS, base.slots.shoes),
      back: valid(input.back, BACK_IDS, base.slots.back),
      leftHand: valid(input.leftHand, LEFT_HAND_IDS, base.slots.leftHand),
      rightHand: valid(input.rightHand, RIGHT_HAND_IDS, base.slots.rightHand),
    },
    dyes: {
      primary: hex(value.dyes?.primary, base.dyes.primary),
      secondary: hex(value.dyes?.secondary, base.dyes.secondary),
      accent: hex(value.dyes?.accent, base.dyes.accent),
    },
    hairStyle: valid(value.hairStyle, HAIR_STYLE_IDS, bodyType === "female" ? "low_bun" : "topknot"),
    hairColor: hex(value.hairColor, base.hairColor),
  };
}

/** 推荐只填部件，不写入职业身份。 */
export function applyPreset(recipe: Recipe, preset: Outfit): Recipe {
  return createRecipe({ ...recipe, slots: presetSlots(preset) });
}
export function patchSlots(recipe: Recipe, patch: Partial<CharacterSlots>): Recipe {
  return createRecipe({ ...recipe, slots: { ...recipe.slots, ...patch } });
}
