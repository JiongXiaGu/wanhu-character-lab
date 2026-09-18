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
export type Outfit = "farmer" | "guard" | "archer" | "body";
export type Motion = "idle" | "walk" | "run" | "wave" | "squat" | "bind";
export interface Recipe {
  version: 3;
  outfit: Outfit;
  height: number;
  build: number;
  hat: boolean;
  equipment: boolean;
  palette: number;
}
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
export const DEFAULT_RECIPE: Recipe = {
  version: 3,
  outfit: "farmer",
  height: 1.76,
  build: 0.5,
  hat: true,
  equipment: false,
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
export function cleanRecipe(value: Partial<Recipe>): Recipe {
  const number = (
    v: number | undefined,
    fallback: number,
    lo: number,
    hi: number,
  ) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(hi, Math.max(lo, v))
      : fallback;
  return {
    version: 3,
    outfit: ["farmer", "guard", "archer", "body"].includes(value.outfit ?? "")
      ? value.outfit!
      : "farmer",
    height: number(value.height, 1.76, 1.58, 1.92),
    build: number(value.build, 0.5, 0, 1),
    hat: value.hat ?? true,
    equipment: value.equipment ?? false,
    palette: Math.round(number(value.palette, 0, 0, 2)),
  };
}
