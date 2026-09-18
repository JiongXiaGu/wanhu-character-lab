export type Vec3Tuple = readonly [number, number, number];

export type PrismProfile = 'box4' | 'hex6' | 'oct8';

export const BODY_PART_IDS = {
  torso: 0,
  pelvis: 1,
  head: 2,
  neck: 3,
  leftUpperArm: 4,
  leftLowerArm: 5,
  leftHand: 6,
  rightUpperArm: 7,
  rightLowerArm: 8,
  rightHand: 9,
  leftUpperLeg: 10,
  leftLowerLeg: 11,
  leftFoot: 12,
  rightUpperLeg: 13,
  rightLowerLeg: 14,
  rightFoot: 15,
} as const;

export type BodyPartId = keyof typeof BODY_PART_IDS;

export interface PrismSection {
  center: Vec3Tuple;
  halfWidth: number;
  halfDepth: number;
}

export interface LowPolyPart {
  id: BodyPartId;
  boneId: number;
  profile: PrismProfile;
  sections: readonly PrismSection[];
  capStart: boolean;
  capEnd: boolean;
}

export interface LowPolyHumanoidBlueprint {
  version: 1;
  triangleBudget: number;
  parts: readonly LowPolyPart[];
}

export interface LowPolyStats {
  parts: number;
  crossSections: number;
  vertices: number;
  triangles: number;
  triangleBudget: number;
  meshValid: boolean;
}
