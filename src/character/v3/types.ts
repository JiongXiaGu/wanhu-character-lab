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


export type HeadwearId =
  | "none"
  | "farmer_straw_hat"
  | "palace_heavy_helmet"
  | "palace_heavy_captain_helmet"
  | "frontier_heavy_helmet"
  | "frontier_heavy_captain_helmet"
  | "city_heavy_helmet"
  | "city_heavy_captain_helmet"
  | "palace_guard_helmet"
  | "palace_captain_helmet"
  | "frontier_guard_helmet"
  | "frontier_captain_helmet"
  | "city_guard_helmet"
  | "city_captain_helmet"
  | "guard_helmet"
  | "archer_headband"
  | "cloth_wrap"
  | "scholar_cap"
  | "jade_pin";
export type TopId =
  | "body"
  | "medium_armor"
  | "heavy_armor"
  | "city_guard_brigandine"
  | "farmer_tunic"
  | "rough_tunic"
  | "cross_jacket"
  | "layered_vest"
  | "ceremony_robe"
  | "work_vest"
  | "short_work_jacket";
export type BottomId =
  | "body"
  | "medium_armor_skirt"
  | "heavy_armor_skirt"
  | "city_guard_trousers"
  | "work_pants"
  | "work_wrap"
  | "short_trousers"
  | "true_short_skirt"
  | "long_skirt";
export type ShoesId = "body" | "cloth_shoes" | "military_boots";
export type BackId = "none" | "archer_quiver" | "bamboo_basket" | "firewood_bundle" | "book_case";
export type LeftHandId = "none" | "guard_shield" | "archer_bow";
export type RightHandId = "none" | "farmer_hoe" | "guard_sword" | "military_spear";

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

export const HEADWEAR_IDS = [
  "none",
  "farmer_straw_hat",
  "palace_heavy_helmet",
  "palace_heavy_captain_helmet",
  "frontier_heavy_helmet",
  "frontier_heavy_captain_helmet",
  "city_heavy_helmet",
  "city_heavy_captain_helmet",
  "palace_guard_helmet",
  "palace_captain_helmet",
  "frontier_guard_helmet",
  "frontier_captain_helmet",
  "city_guard_helmet",
  "city_captain_helmet",
  "guard_helmet",
  "archer_headband",
  "cloth_wrap", "scholar_cap", "jade_pin",
] as const satisfies readonly HeadwearId[];

export const TOP_IDS = [
  "body",
  "medium_armor",
  "heavy_armor",
  "city_guard_brigandine",
  "farmer_tunic",
  "rough_tunic", "cross_jacket", "layered_vest", "ceremony_robe",
  "work_vest", "short_work_jacket",
] as const satisfies readonly TopId[];

export const BOTTOM_IDS = [
  "body",
  "medium_armor_skirt",
  "heavy_armor_skirt",
  "city_guard_trousers",
  "work_pants", "work_wrap", "short_trousers", "true_short_skirt", "long_skirt",
] as const satisfies readonly BottomId[];

export const SHOES_IDS = [
  "body",
  "cloth_shoes",
  "military_boots",
] as const satisfies readonly ShoesId[];

export const BACK_IDS = [
  "none",
  "archer_quiver",
  "bamboo_basket",
  "firewood_bundle",
  "book_case",
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
  "military_spear",
] as const satisfies readonly RightHandId[];

export const EMPTY_SLOTS: CharacterSlots = {
  headwear: "none", top: "body", bottom: "body", shoes: "body",
  back: "none", leftHand: "none", rightHand: "none",
};
export function emptySlots(): CharacterSlots { return { ...EMPTY_SLOTS }; }

export const DEFAULT_RECIPE: Recipe = {
  version: 5,
  bodyType: "male",
  slots: { headwear: "none", top: "rough_tunic", bottom: "work_pants", shoes: "cloth_shoes", back: "none", leftHand: "none", rightHand: "none" },
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

export function patchSlots(recipe: Recipe, patch: Partial<CharacterSlots>): Recipe {
  return createRecipe({ ...recipe, slots: { ...recipe.slots, ...patch } });
}
