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

/** 外观体型，不改变骨骼语义；旧 V4 配方缺省为 male。 */
export type BodyType = "male" | "female";
export const BODY_TYPES = ["male", "female"] as const;
export const BODY_PROFILE_VERSION = "wanhu-body-profiles-v1";
export const defaultHeight = (bodyType: BodyType) => bodyType === "female" ? 1.66 : 1.76;

export type Outfit = "farmer" | "guard" | "archer" | "body";
export type PresetId = Outfit | "custom";

export type HeadwearId =
  | "none"
  | "farmer_straw_hat"
  | "guard_helmet"
  | "archer_headband";
export type TopId =
  | "body"
  | "farmer_tunic"
  | "guard_light_armor"
  | "archer_tunic";
export type BottomId =
  | "body"
  | "work_pants"
  | "guard_pants"
  | "archer_pants";
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

export interface Recipe {
  version: 4;
  bodyType: BodyType;
  preset: PresetId;
  slots: CharacterSlots;
  height: number;
  build: number;
  palette: number;
}

/** 兼容旧的 ?outfit / hat / equipment 和早期调用。 */
export type RecipeInput = Partial<Omit<Recipe, "slots">> & {
  slots?: Partial<CharacterSlots>;
  outfit?: Outfit;
  hat?: boolean;
  equipment?: boolean;
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
}

export const PRESET_IDS = ["farmer", "guard", "archer", "body"] as const;

export const HEADWEAR_IDS = [
  "none",
  "farmer_straw_hat",
  "guard_helmet",
  "archer_headband",
] as const satisfies readonly HeadwearId[];

export const TOP_IDS = [
  "body",
  "farmer_tunic",
  "guard_light_armor",
  "archer_tunic",
] as const satisfies readonly TopId[];

export const BOTTOM_IDS = [
  "body",
  "work_pants",
  "guard_pants",
  "archer_pants",
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
  version: 4,
  bodyType: "male",
  preset: "farmer",
  slots: presetSlots("farmer"),
  height: 1.76,
  build: 0.5,
  palette: 0,
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

export function cleanRecipe(value: RecipeInput): Recipe {
  const number = (
    v: number | undefined,
    fallback: number,
    lo: number,
    hi: number,
  ) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(hi, Math.max(lo, v))
      : fallback;

  const bodyType = valid(value.bodyType, BODY_TYPES, "male");
  const legacyPreset = valid(value.outfit, PRESET_IDS, "farmer");
  const requestedPreset =
    value.preset === "custom"
      ? "custom"
      : valid(value.preset, PRESET_IDS, legacyPreset);

  const basePreset: Outfit =
    requestedPreset === "custom" ? legacyPreset : requestedPreset;
  const baseSlots = presetSlots(basePreset);
  const inputSlots = value.slots ?? {};

  const slots: CharacterSlots = {
    headwear: valid(
      inputSlots.headwear,
      HEADWEAR_IDS,
      baseSlots.headwear,
    ),
    top: valid(inputSlots.top, TOP_IDS, baseSlots.top),
    bottom: valid(inputSlots.bottom, BOTTOM_IDS, baseSlots.bottom),
    shoes: valid(inputSlots.shoes, SHOES_IDS, baseSlots.shoes),
    back: valid(inputSlots.back, BACK_IDS, baseSlots.back),
    leftHand: valid(
      inputSlots.leftHand,
      LEFT_HAND_IDS,
      baseSlots.leftHand,
    ),
    rightHand: valid(
      inputSlots.rightHand,
      RIGHT_HAND_IDS,
      baseSlots.rightHand,
    ),
  };

  // 旧参数兼容：hat=false 清空头饰；equipment=false 清空装备。
  if (value.hat === false) slots.headwear = "none";

  // V3 农户的 equipment=true 表示手持锄头。只有没有显式新 Slot 时
  // 才迁移该旧语义，避免覆盖 V4 DIY 的右手选择。
  if (
    value.equipment === true &&
    legacyPreset === "farmer" &&
    inputSlots.rightHand === undefined
  ) {
    slots.rightHand = "farmer_hoe";
  }

  if (value.equipment === false) {
    slots.back = "none";
    slots.leftHand = "none";
    slots.rightHand = "none";
  }

  return {
    version: 4,
    bodyType,
    preset: requestedPreset,
    slots,
    height: number(value.height, defaultHeight(bodyType), 1.58, 1.92),
    build: number(value.build, 0.5, 0, 1),
    palette: Math.round(number(value.palette, 0, 0, 2)),
  };
}

export function applyPreset(recipe: Recipe, preset: Outfit): Recipe {
  return {
    ...recipe,
    version: 4,
    preset,
    slots: presetSlots(preset),
  };
}

export function patchSlots(
  recipe: Recipe,
  patch: Partial<CharacterSlots>,
): Recipe {
  return cleanRecipe({
    ...recipe,
    preset: "custom",
    slots: { ...recipe.slots, ...patch },
  });
}
