import * as THREE from 'three';
import type { BodyParameters } from './types';
import {
  BODY_PART_IDS,
  type BodyPartId,
  type LowPolyHumanoidBlueprint,
  type LowPolyPart,
  type PrismProfile,
  type PrismSection,
  type Vec3Tuple,
} from './lowPolyTopology';

function section(
  center: Vec3Tuple,
  halfWidth: number,
  halfDepth: number,
): PrismSection {
  return { center, halfWidth, halfDepth };
}

function part(
  id: BodyPartId,
  profile: PrismProfile,
  sections: readonly PrismSection[],
  capStart = false,
  capEnd = false,
): LowPolyPart {
  return {
    id,
    boneId: BODY_PART_IDS[id],
    profile,
    sections,
    capStart,
    capEnd,
  };
}

function createArmParts(
  side: -1 | 1,
  height: number,
  shoulderWidth: number,
  shoulderY: number,
  buildScale: number,
): LowPolyPart[] {
  const prefix = side < 0 ? 'left' : 'right';
  const shoulderX = side * shoulderWidth * 0.54;
  const upperLength = height * 0.18;
  const lowerLength = height * 0.16;
  const handLength = height * 0.068;

  const elbowX = shoulderX + side * height * 0.008;
  const elbowY = shoulderY - upperLength;
  const wristX = elbowX - side * height * 0.004;
  const wristY = elbowY - lowerLength;

  const upperHalf = height * 0.032 * buildScale;
  const elbowHalf = upperHalf * 0.86;
  const wristHalf = upperHalf * 0.68;

  const upperId = `${prefix}UpperArm` as BodyPartId;
  const lowerId = `${prefix}LowerArm` as BodyPartId;
  const handId = `${prefix}Hand` as BodyPartId;

  return [
    part(
      upperId,
      'hex6',
      [
        section(
          [shoulderX, shoulderY + height * 0.014, 0],
          upperHalf * 1.06,
          upperHalf * 0.94,
        ),
        section(
          [elbowX, elbowY + height * 0.018, 0],
          elbowHalf,
          elbowHalf * 0.92,
        ),
      ],
      false,
      false,
    ),
    part(
      lowerId,
      'hex6',
      [
        section(
          [elbowX, elbowY + height * 0.028, 0],
          elbowHalf * 0.94,
          elbowHalf * 0.9,
        ),
        section(
          [wristX, wristY + height * 0.018, 0],
          wristHalf,
          wristHalf * 0.82,
        ),
      ],
      false,
      false,
    ),
    part(
      handId,
      'box4',
      [
        section(
          [wristX, wristY + height * 0.024, height * 0.006],
          wristHalf * 0.92,
          wristHalf * 0.62,
        ),
        section(
          [wristX, wristY - handLength, height * 0.014],
          wristHalf * 0.82,
          wristHalf * 0.55,
        ),
      ],
      true,
      true,
    ),
  ];
}

function createLegParts(
  side: -1 | 1,
  height: number,
  hipY: number,
  pelvisHalfWidth: number,
  buildScale: number,
): LowPolyPart[] {
  const prefix = side < 0 ? 'left' : 'right';
  const hipX = side * pelvisHalfWidth * 0.58;
  const kneeY = height * 0.285;
  const ankleY = height * 0.058;
  const kneeX = hipX * 0.94;
  const ankleX = hipX * 0.9;

  const thighHalf = height * 0.044 * buildScale;
  const kneeHalf = thighHalf * 0.74;
  const calfHalf = thighHalf * 0.8;
  const ankleHalf = thighHalf * 0.56;

  const upperId = `${prefix}UpperLeg` as BodyPartId;
  const lowerId = `${prefix}LowerLeg` as BodyPartId;
  const footId = `${prefix}Foot` as BodyPartId;

  return [
    part(
      upperId,
      'hex6',
      [
        section(
          [hipX, hipY + height * 0.018, 0],
          thighHalf * 1.08,
          thighHalf,
        ),
        section(
          [kneeX, kneeY + height * 0.022, 0],
          kneeHalf,
          kneeHalf * 0.92,
        ),
      ],
      false,
      false,
    ),
    part(
      lowerId,
      'hex6',
      [
        section(
          [kneeX, kneeY + height * 0.03, 0],
          kneeHalf * 0.94,
          kneeHalf * 0.9,
        ),
        section(
          [
            THREE.MathUtils.lerp(kneeX, ankleX, 0.46),
            THREE.MathUtils.lerp(kneeY, ankleY, 0.46),
            -height * 0.008,
          ],
          calfHalf,
          calfHalf * 0.9,
        ),
        section(
          [ankleX, ankleY + height * 0.02, 0],
          ankleHalf,
          ankleHalf * 0.78,
        ),
      ],
      false,
      false,
    ),
    part(
      footId,
      'box4',
      [
        section(
          [ankleX, height * 0.045, height * 0.008],
          ankleHalf * 1.02,
          height * 0.04,
        ),
        section(
          [ankleX, height * 0.038, height * 0.105],
          ankleHalf * 1.08,
          height * 0.052,
        ),
      ],
      true,
      true,
    ),
  ];
}

export function createLowPolyHumanoidBlueprint(
  parameters: BodyParameters,
): LowPolyHumanoidBlueprint {
  const { height, build, shoulderWidth, headScale } = parameters;
  const buildScale = THREE.MathUtils.lerp(0.86, 1.18, build);

  const hipY = height * 0.51;
  const lowerAbdomenY = hipY + height * 0.04;
  const waistY = height * 0.62;
  const chestY = height * 0.745;
  const shoulderY = height * 0.805;
  const neckBaseY = height * 0.835;

  const torsoShoulderHalf = shoulderWidth * 0.455;
  const chestHalf = shoulderWidth * 0.39 * buildScale;
  const waistHalf = shoulderWidth * 0.305 * buildScale;
  const pelvisHalf = shoulderWidth * THREE.MathUtils.lerp(0.32, 0.37, build);

  const chestDepth = height * 0.062 * buildScale;
  const waistDepth = chestDepth * 0.78;
  const pelvisDepth = height * 0.072 * THREE.MathUtils.lerp(0.94, 1.08, build);

  const lowerAbdomenHalf =
    THREE.MathUtils.lerp(pelvisHalf, waistHalf, 0.42);
  const lowerAbdomenDepth =
    THREE.MathUtils.lerp(pelvisDepth, waistDepth, 0.5);

  const headHeight = height * 0.13 * headScale;
  const headTopY = height;
  const headBottomY = headTopY - headHeight;
  const headHalfWidth = height * 0.048 * headScale;
  const headHalfDepth = height * 0.058 * headScale;

  const neckHalf = height * 0.028 * THREE.MathUtils.lerp(0.92, 1.08, build);

  const parts: LowPolyPart[] = [
    part(
      'torso',
      'oct8',
      [
        section(
          [0, lowerAbdomenY, 0],
          lowerAbdomenHalf,
          lowerAbdomenDepth,
        ),
        section(
          [0, waistY, 0],
          waistHalf,
          waistDepth,
        ),
        section(
          [0, chestY, 0],
          chestHalf,
          chestDepth,
        ),
        section(
          [0, shoulderY, 0],
          torsoShoulderHalf,
          chestDepth * 0.9,
        ),
      ],
      false,
      false,
    ),
    part(
      'pelvis',
      'oct8',
      [
        section(
          [0, hipY - height * 0.035, 0],
          pelvisHalf * 0.94,
          pelvisDepth * 0.94,
        ),
        section(
          [0, hipY + height * 0.07, 0],
          pelvisHalf,
          pelvisDepth,
        ),
      ],
      false,
      false,
    ),
    part(
      'neck',
      'box4',
      [
        section(
          [0, neckBaseY - height * 0.018, 0],
          neckHalf * 1.06,
          neckHalf,
        ),
        section(
          [0, headBottomY + height * 0.018, 0],
          neckHalf,
          neckHalf * 0.96,
        ),
      ],
      false,
      false,
    ),
    part(
      'head',
      'box4',
      [
        section(
          [0, headBottomY - height * 0.006, height * 0.004],
          headHalfWidth * 0.82,
          headHalfDepth * 0.82,
        ),
        section(
          [0, headTopY - headHeight * 0.18, 0],
          headHalfWidth,
          headHalfDepth,
        ),
      ],
      true,
      true,
    ),
    ...createArmParts(-1, height, shoulderWidth, shoulderY, buildScale),
    ...createArmParts(1, height, shoulderWidth, shoulderY, buildScale),
    ...createLegParts(-1, height, hipY, pelvisHalf, buildScale),
    ...createLegParts(1, height, hipY, pelvisHalf, buildScale),
  ];

  return {
    version: 1,
    triangleBudget: 500,
    parts,
  };
}
