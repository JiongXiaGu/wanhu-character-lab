import * as THREE from 'three';
import { resolveHumanLandmarks } from './resolveHumanLandmarks';
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
  positiveDepth: number,
  negativeDepth = positiveDepth,
): PrismSection {
  return {
    center,
    halfWidth,
    positiveDepth,
    negativeDepth,
  };
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
  shoulderEdgeHalf: number,
  shoulderY: number,
  buildScale: number,
): LowPolyPart[] {
  const prefix = side < 0 ? 'left' : 'right';

  const upperHalf = height * 0.031 * buildScale;
  const elbowHalf = upperHalf * 0.84;
  const wristHalf = upperHalf * 0.64;

  const shoulderX =
    side * (shoulderEdgeHalf + upperHalf * 0.52);
  const shoulderRootY = shoulderY - height * 0.02;

  const upperLength = height * 0.18;
  const lowerLength = height * 0.16;
  const handLength = height * 0.058;

  const elbowX = shoulderX + side * height * 0.006;
  const elbowY = shoulderRootY - upperLength;
  const wristX = elbowX - side * height * 0.004;
  const wristY = elbowY - lowerLength;

  const upperId = `${prefix}UpperArm` as BodyPartId;
  const lowerId = `${prefix}LowerArm` as BodyPartId;
  const handId = `${prefix}Hand` as BodyPartId;

  return [
    part(
      upperId,
      'hex6',
      [
        section(
          [shoulderX, shoulderRootY, -height * 0.002],
          upperHalf,
          upperHalf * 0.94,
          upperHalf * 0.9,
        ),
        section(
          [elbowX, elbowY + height * 0.018, 0],
          elbowHalf,
          elbowHalf * 0.9,
          elbowHalf * 0.88,
        ),
      ],
    ),
    part(
      lowerId,
      'hex6',
      [
        section(
          [elbowX, elbowY + height * 0.026, 0],
          elbowHalf * 0.94,
          elbowHalf * 0.9,
          elbowHalf * 0.86,
        ),
        section(
          [wristX, wristY + height * 0.016, height * 0.002],
          wristHalf,
          wristHalf * 0.76,
          wristHalf * 0.72,
        ),
      ],
    ),
    part(
      handId,
      'box4',
      [
        section(
          [wristX, wristY + height * 0.022, height * 0.006],
          wristHalf * 0.82,
          wristHalf * 0.58,
          wristHalf * 0.52,
        ),
        section(
          [wristX, wristY - handLength, height * 0.012],
          wristHalf * 0.74,
          wristHalf * 0.54,
          wristHalf * 0.48,
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
  kneeY: number,
  ankleY: number,
  pelvisHalfWidth: number,
  buildScale: number,
): LowPolyPart[] {
  const prefix = side < 0 ? 'left' : 'right';

  const hipX = side * pelvisHalfWidth * 0.52;
  const kneeX = hipX * 0.94;
  const ankleX = hipX * 0.9;

  const thighHalf = height * 0.043 * buildScale;
  const kneeHalf = thighHalf * 0.72;
  const calfHalf = thighHalf * 0.8;
  const ankleHalf = thighHalf * 0.54;

  const upperId = `${prefix}UpperLeg` as BodyPartId;
  const lowerId = `${prefix}LowerLeg` as BodyPartId;
  const footId = `${prefix}Foot` as BodyPartId;

  return [
    part(
      upperId,
      'hex6',
      [
        section(
          [hipX, hipY + height * 0.014, -height * 0.004],
          thighHalf * 1.08,
          thighHalf * 0.95,
          thighHalf,
        ),
        section(
          [kneeX, kneeY + height * 0.02, height * 0.004],
          kneeHalf,
          kneeHalf * 0.9,
          kneeHalf * 0.92,
        ),
      ],
    ),
    part(
      lowerId,
      'hex6',
      [
        section(
          [kneeX, kneeY + height * 0.028, height * 0.004],
          kneeHalf * 0.94,
          kneeHalf * 0.88,
          kneeHalf * 0.92,
        ),
        section(
          [
            THREE.MathUtils.lerp(kneeX, ankleX, 0.46),
            THREE.MathUtils.lerp(kneeY, ankleY, 0.46),
            -height * 0.012,
          ],
          calfHalf,
          calfHalf * 0.86,
          calfHalf,
        ),
        section(
          [ankleX, ankleY + height * 0.018, 0],
          ankleHalf,
          ankleHalf * 0.74,
          ankleHalf * 0.76,
        ),
      ],
    ),
    part(
      footId,
      'box4',
      [
        section(
          [ankleX, height * 0.024, -height * 0.015],
          ankleHalf * 1.04,
          height * 0.028,
          height * 0.024,
        ),
        section(
          [ankleX, height * 0.023, height * 0.12],
          ankleHalf * 1.1,
          height * 0.025,
          height * 0.023,
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
  const landmarks = resolveHumanLandmarks(parameters);
  const buildScale = THREE.MathUtils.lerp(0.88, 1.16, build);

  const torsoShoulderHalf = shoulderWidth * 0.455;
  const chestHalf = shoulderWidth * 0.395 * buildScale;
  const waistHalf = shoulderWidth * 0.31 * buildScale;
  const pelvisHalf =
    shoulderWidth * THREE.MathUtils.lerp(0.325, 0.37, build);

  const abdomenHalf =
    THREE.MathUtils.lerp(pelvisHalf, waistHalf, 0.46);

  const chestFront = height * 0.066 * buildScale;
  const chestBack = height * 0.057 * buildScale;
  const waistFront = height * 0.049 * buildScale;
  const waistBack = height * 0.044 * buildScale;
  const abdomenFront = height * 0.057 * buildScale;
  const abdomenBack = height * 0.054 * buildScale;

  const pelvisFront =
    height * 0.052 * THREE.MathUtils.lerp(0.95, 1.07, build);
  const pelvisBack =
    height * 0.066 * THREE.MathUtils.lerp(0.95, 1.08, build);

  const headHeight = landmarks.headTopY - landmarks.headBottomY;
  const headHalfWidth = height * 0.046 * headScale;
  const headFront = height * 0.052 * headScale;
  const headBack = height * 0.058 * headScale;

  const neckHalf =
    height * 0.027 * THREE.MathUtils.lerp(0.92, 1.08, build);

  const parts: LowPolyPart[] = [
    part(
      'torso',
      'oct8',
      [
        section(
          [0, landmarks.lowerAbdomenY, height * 0.008],
          abdomenHalf,
          abdomenFront,
          abdomenBack,
        ),
        section(
          [0, landmarks.waistY, height * 0.002],
          waistHalf,
          waistFront,
          waistBack,
        ),
        section(
          [0, landmarks.chestY, height * 0.006],
          chestHalf,
          chestFront,
          chestBack,
        ),
        section(
          [0, landmarks.shoulderY, 0],
          torsoShoulderHalf,
          chestFront * 0.9,
          chestBack * 0.96,
        ),
      ],
      false,
      true,
    ),
    part(
      'pelvis',
      'oct8',
      [
        section(
          [0, landmarks.hipY - height * 0.035, -height * 0.007],
          pelvisHalf * 0.9,
          pelvisFront * 0.9,
          pelvisBack * 0.94,
        ),
        section(
          [0, landmarks.hipY + height * 0.015, -height * 0.004],
          pelvisHalf,
          pelvisFront,
          pelvisBack,
        ),
        section(
          [0, landmarks.lowerAbdomenY + height * 0.018, -height * 0.002],
          pelvisHalf * 0.9,
          pelvisFront * 0.94,
          pelvisBack * 0.88,
        ),
      ],
    ),
    part(
      'neck',
      'box4',
      [
        section(
          [0, landmarks.shoulderY - height * 0.006, 0],
          neckHalf * 1.08,
          neckHalf,
          neckHalf * 0.96,
        ),
        section(
          [0, landmarks.headBottomY + height * 0.024, 0],
          neckHalf,
          neckHalf * 0.94,
          neckHalf * 0.94,
        ),
      ],
    ),
    part(
      'head',
      'oct8',
      [
        section(
          [
            0,
            landmarks.headBottomY + height * 0.014,
            height * 0.004,
          ],
          headHalfWidth * 0.78,
          headFront * 0.78,
          headBack * 0.82,
        ),
        section(
          [
            0,
            landmarks.headBottomY + headHeight * 0.48,
            height * 0.006,
          ],
          headHalfWidth,
          headFront,
          headBack * 1.05,
        ),
        section(
          [0, landmarks.headTopY - height * 0.018, 0],
          headHalfWidth * 0.9,
          headFront * 0.88,
          headBack * 0.96,
        ),
      ],
      true,
      true,
    ),
    ...createArmParts(
      -1,
      height,
      torsoShoulderHalf,
      landmarks.shoulderY,
      buildScale,
    ),
    ...createArmParts(
      1,
      height,
      torsoShoulderHalf,
      landmarks.shoulderY,
      buildScale,
    ),
    ...createLegParts(
      -1,
      height,
      landmarks.hipY,
      landmarks.kneeY,
      landmarks.ankleY,
      pelvisHalf,
      buildScale,
    ),
    ...createLegParts(
      1,
      height,
      landmarks.hipY,
      landmarks.kneeY,
      landmarks.ankleY,
      pelvisHalf,
      buildScale,
    ),
  ];

  return {
    version: 2,
    triangleBudget: 500,
    parts,
  };
}
