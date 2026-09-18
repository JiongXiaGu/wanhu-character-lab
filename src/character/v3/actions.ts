import { B, type CharacterSlots, type Recipe } from "./types";

export type CombatActionId =
  | "none"
  | "bowShot"
  | "swordSlash"
  | "shieldGuard";

export type BowStage =
  | "raise"
  | "draw"
  | "hold"
  | "release"
  | "recover";

export interface CombatActionState {
  id: CombatActionId;
  phase: number;
  playing: boolean;
  speed: number;
  aimYaw: number;
  aimPitch: number;
}

export interface ActionDefinition {
  id: CombatActionId;
  label: string;
  duration: number;
  loop: boolean;
  boneMask: readonly number[];
  requiredSlots: Partial<CharacterSlots>;
}

export const UPPER_BODY_MASK = [
  B.Spine,
  B.Chest,
  B.Neck,
  B.Head,
  B.RightClavicle,
  B.RightUpperArm,
  B.RightForearm,
  B.RightHand,
  B.LeftClavicle,
  B.LeftUpperArm,
  B.LeftForearm,
  B.LeftHand,
] as const;

export const ACTION_DEFINITIONS: Record<CombatActionId, ActionDefinition> = {
  none: {
    id: "none",
    label: "无",
    duration: 1,
    loop: true,
    boneMask: [],
    requiredSlots: {},
  },
  bowShot: {
    id: "bowShot",
    label: "拉弓射击",
    duration: 2.4,
    loop: true,
    boneMask: UPPER_BODY_MASK,
    requiredSlots: {
      leftHand: "archer_bow",
    },
  },
  swordSlash: {
    id: "swordSlash",
    label: "挥砍",
    duration: 1.15,
    loop: true,
    boneMask: [
      B.Spine,
      B.Chest,
      B.Neck,
      B.Head,
      B.RightClavicle,
      B.RightUpperArm,
      B.RightForearm,
      B.RightHand,
    ],
    requiredSlots: {
      rightHand: "guard_sword",
    },
  },
  shieldGuard: {
    id: "shieldGuard",
    label: "举盾",
    duration: 1.8,
    loop: true,
    boneMask: [
      B.Spine,
      B.Chest,
      B.Neck,
      B.Head,
      B.LeftClavicle,
      B.LeftUpperArm,
      B.LeftForearm,
      B.LeftHand,
    ],
    requiredSlots: {
      leftHand: "guard_shield",
    },
  },
};

export const COMBAT_ACTION_IDS = Object.keys(
  ACTION_DEFINITIONS,
) as CombatActionId[];

export function actionAvailable(
  recipe: Recipe,
  action: CombatActionId,
): boolean {
  const required = ACTION_DEFINITIONS[action].requiredSlots;

  for (const [slot, value] of Object.entries(required)) {
    if (recipe.slots[slot as keyof CharacterSlots] !== value) {
      return false;
    }
  }

  return true;
}

export function clampActionPhase(phase: number): number {
  if (!Number.isFinite(phase)) return 0;
  return Math.max(0, Math.min(0.999, phase));
}

export function clampAimDegrees(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-45, Math.min(45, value));
}

export function bowStage(phase: number): BowStage {
  const value = clampActionPhase(phase);

  if (value < 0.18) return "raise";
  if (value < 0.52) return "draw";
  if (value < 0.72) return "hold";
  if (value < 0.82) return "release";
  return "recover";
}

export const BOW_STAGE_LABELS: Record<BowStage, string> = {
  raise: "举弓",
  draw: "开弓",
  hold: "瞄准保持",
  release: "放箭",
  recover: "收势",
};

export function actionPhaseLabel(
  action: CombatActionId,
  phase: number,
): string {
  if (action === "bowShot") {
    return BOW_STAGE_LABELS[bowStage(phase)];
  }

  if (action === "swordSlash") {
    if (phase < 0.25) return "蓄势";
    if (phase < 0.62) return "挥砍";
    if (phase < 0.78) return "收刃";
    return "复位";
  }

  if (action === "shieldGuard") {
    if (phase < 0.3) return "举盾";
    if (phase < 0.78) return "防御保持";
    return "放下";
  }

  return "无动作";
}
