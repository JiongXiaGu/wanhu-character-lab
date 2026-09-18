import * as THREE from 'three';
import type { BodyParameters } from './types';
import type {
  BodySection,
  HumanTopologyBlueprint,
  SectionRing,
  Vec3Tuple,
} from './topology';

function ring(
  id: string,
  center: Vec3Tuple,
  radiusX: number,
  radiusY: number,
): SectionRing {
  return { id, center, radiusX, radiusY };
}

function createArmSection(
  side: -1 | 1,
  height: number,
  shoulderWidth: number,
  shoulderY: number,
  bulk: number,
): BodySection {
  const sideName = side < 0 ? 'left' : 'right';
  const upperArmLength = height * 0.185;
  const lowerArmLength = height * 0.175;
  const shoulderX = side * shoulderWidth * 0.48;
  const elbowX = side * (shoulderWidth * 0.5 + height * 0.018);
  const wristX = side * (shoulderWidth * 0.49 + height * 0.012);

  const upperRadius = height * 0.035 * THREE.MathUtils.lerp(0.84, 1.22, bulk);
  const elbowRadius = upperRadius * 0.86;
  const wristRadius = upperRadius * 0.66;

  return {
    id: `${sideName}Arm`,
    region: side < 0 ? 'leftArm' : 'rightArm',
    radialSegments: 10,
    capStart: true,
    capEnd: true,
    rings: [
      ring('shoulder', [shoulderX, shoulderY, 0], upperRadius * 1.08, upperRadius),
      ring(
        'upperArm',
        [
          THREE.MathUtils.lerp(shoulderX, elbowX, 0.42),
          shoulderY - upperArmLength * 0.42,
          0,
        ],
        upperRadius,
        upperRadius * 0.96,
      ),
      ring(
        'elbowUpper',
        [
          THREE.MathUtils.lerp(shoulderX, elbowX, 0.84),
          shoulderY - upperArmLength * 0.84,
          0,
        ],
        elbowRadius * 1.03,
        elbowRadius,
      ),
      ring('elbow', [elbowX, shoulderY - upperArmLength, 0], elbowRadius, elbowRadius),
      ring(
        'forearm',
        [
          THREE.MathUtils.lerp(elbowX, wristX, 0.56),
          shoulderY - upperArmLength - lowerArmLength * 0.56,
          0,
        ],
        THREE.MathUtils.lerp(elbowRadius, wristRadius, 0.56),
        THREE.MathUtils.lerp(elbowRadius, wristRadius, 0.56) * 0.92,
      ),
      ring(
        'wrist',
        [wristX, shoulderY - upperArmLength - lowerArmLength, 0],
        wristRadius,
        wristRadius * 0.84,
      ),
      ring(
        'hand',
        [
          wristX,
          shoulderY - upperArmLength - lowerArmLength - height * 0.052,
          height * 0.008,
        ],
        height * 0.034,
        height * 0.021,
      ),
    ],
  };
}

function createLegSection(
  side: -1 | 1,
  height: number,
  pelvisY: number,
  pelvisHalfWidth: number,
  bulk: number,
): BodySection {
  const sideName = side < 0 ? 'left' : 'right';
  const hipX = side * pelvisHalfWidth * 0.52;
  const kneeY = pelvisY * 0.48;
  const ankleY = height * 0.055;
  const thighRadius = height * 0.052 * THREE.MathUtils.lerp(0.86, 1.22, bulk);
  const kneeRadius = thighRadius * 0.76;
  const calfRadius = thighRadius * 0.82;
  const ankleRadius = thighRadius * 0.56;

  return {
    id: `${sideName}Leg`,
    region: side < 0 ? 'leftLeg' : 'rightLeg',
    radialSegments: 12,
    capStart: true,
    capEnd: true,
    rings: [
      ring('hip', [hipX, pelvisY, 0], thighRadius * 1.08, thighRadius),
      ring(
        'upperThigh',
        [hipX * 0.98, THREE.MathUtils.lerp(pelvisY, kneeY, 0.3), 0],
        thighRadius,
        thighRadius * 0.95,
      ),
      ring(
        'lowerThigh',
        [hipX * 0.95, THREE.MathUtils.lerp(pelvisY, kneeY, 0.72), 0],
        thighRadius * 0.88,
        thighRadius * 0.84,
      ),
      ring('knee', [hipX * 0.92, kneeY, 0], kneeRadius, kneeRadius * 0.92),
      ring(
        'calf',
        [hipX * 0.9, THREE.MathUtils.lerp(kneeY, ankleY, 0.43), -height * 0.008],
        calfRadius,
        calfRadius * 0.93,
      ),
      ring(
        'lowerCalf',
        [hipX * 0.89, THREE.MathUtils.lerp(kneeY, ankleY, 0.76), 0],
        ankleRadius * 1.18,
        ankleRadius,
      ),
      ring('ankle', [hipX * 0.88, ankleY, 0], ankleRadius, ankleRadius * 0.84),
    ],
  };
}

function createFootSection(
  side: -1 | 1,
  height: number,
  pelvisHalfWidth: number,
): BodySection {
  const sideName = side < 0 ? 'left' : 'right';
  const x = side * pelvisHalfWidth * 0.46;
  const ankleY = height * 0.055;
  const soleY = height * 0.026;
  const footWidth = height * 0.034;

  return {
    id: `${sideName}Foot`,
    region: side < 0 ? 'leftFoot' : 'rightFoot',
    radialSegments: 10,
    capStart: true,
    capEnd: true,
    rings: [
      ring('heelBack', [x, ankleY * 0.8, -height * 0.035], footWidth * 0.8, height * 0.027),
      ring('heel', [x, soleY + height * 0.022, 0], footWidth, height * 0.03),
      ring('midFoot', [x, soleY + height * 0.018, height * 0.055], footWidth * 1.08, height * 0.026),
      ring('toe', [x, soleY + height * 0.014, height * 0.105], footWidth * 1.12, height * 0.022),
      ring('toeTip', [x, soleY + height * 0.012, height * 0.13], footWidth * 0.72, height * 0.016),
    ],
  };
}

export function createHumanTopologyBlueprint(
  parameters: BodyParameters,
): HumanTopologyBlueprint {
  const { height, build, shoulderWidth, headScale } = parameters;
  const bulk = THREE.MathUtils.lerp(0.82, 1.24, build);

  const headHeight = height * 0.135 * headScale;
  const neckHeight = height * 0.045;
  const legLength = height * 0.49;
  const torsoHeight = height - legLength - headHeight - neckHeight;

  const pelvisY = legLength;
  const shoulderY = pelvisY + torsoHeight * 0.82;
  const neckBaseY = height - headHeight - neckHeight;
  const neckTopY = height - headHeight * 0.92;

  const chestHalfWidth = shoulderWidth * 0.41 * bulk;
  const waistHalfWidth = shoulderWidth * 0.305 * bulk;
  const pelvisHalfWidth =
    shoulderWidth * THREE.MathUtils.lerp(0.315, 0.365, build);

  const chestDepth = height * 0.058 * bulk;
  const waistDepth = chestDepth * 0.83;
  const pelvisDepth = height * 0.086 * THREE.MathUtils.lerp(0.9, 1.1, build);
  const neckRadius = height * 0.035 * THREE.MathUtils.lerp(0.9, 1.08, build);

  const torso: BodySection = {
    id: 'torso',
    region: 'torso',
    radialSegments: 16,
    capStart: true,
    capEnd: true,
    rings: [
      ring(
        'pelvisBottom',
        [0, pelvisY - height * 0.055, 0],
        pelvisHalfWidth * 0.92,
        pelvisDepth * 0.92,
      ),
      ring('pelvis', [0, pelvisY, 0], pelvisHalfWidth, pelvisDepth),
      ring(
        'lowerWaist',
        [0, pelvisY + torsoHeight * 0.18, 0],
        THREE.MathUtils.lerp(pelvisHalfWidth, waistHalfWidth, 0.72),
        THREE.MathUtils.lerp(pelvisDepth, waistDepth, 0.72),
      ),
      ring(
        'waist',
        [0, pelvisY + torsoHeight * 0.32, 0],
        waistHalfWidth,
        waistDepth,
      ),
      ring(
        'rib',
        [0, pelvisY + torsoHeight * 0.52, 0],
        chestHalfWidth * 0.9,
        chestDepth * 0.96,
      ),
      ring(
        'chest',
        [0, pelvisY + torsoHeight * 0.68, 0],
        chestHalfWidth,
        chestDepth,
      ),
      ring(
        'upperChest',
        [0, shoulderY - torsoHeight * 0.06, 0],
        chestHalfWidth * 1.03,
        chestDepth * 0.96,
      ),
      ring(
        'collar',
        [0, shoulderY + torsoHeight * 0.055, 0],
        shoulderWidth * 0.28,
        chestDepth * 0.76,
      ),
      ring('neckBase', [0, neckBaseY, 0], neckRadius * 1.06, neckRadius),
      ring('neckTop', [0, neckTopY, 0], neckRadius, neckRadius * 0.96),
    ],
  };

  const headCenterY = height - headHeight * 0.5;
  const headHalfHeight = headHeight * 0.5;
  const headWidth = headHeight * 0.39;
  const headDepth = headHeight * 0.42;

  const head: BodySection = {
    id: 'head',
    region: 'head',
    radialSegments: 16,
    capStart: true,
    capEnd: true,
    rings: [
      ring(
        'jawBase',
        [0, headCenterY - headHalfHeight * 0.78, 0],
        headWidth * 0.68,
        headDepth * 0.7,
      ),
      ring(
        'jaw',
        [0, headCenterY - headHalfHeight * 0.5, height * 0.006],
        headWidth * 0.84,
        headDepth * 0.83,
      ),
      ring(
        'cheek',
        [0, headCenterY - headHalfHeight * 0.08, height * 0.008],
        headWidth,
        headDepth,
      ),
      ring(
        'temple',
        [0, headCenterY + headHalfHeight * 0.28, 0],
        headWidth * 0.98,
        headDepth * 0.98,
      ),
      ring(
        'crown',
        [0, headCenterY + headHalfHeight * 0.68, -height * 0.004],
        headWidth * 0.78,
        headDepth * 0.8,
      ),
      ring(
        'top',
        [0, headCenterY + headHalfHeight * 0.92, -height * 0.006],
        headWidth * 0.36,
        headDepth * 0.38,
      ),
    ],
  };

  return {
    version: 1,
    sections: [
      torso,
      head,
      createArmSection(-1, height, shoulderWidth, shoulderY, build),
      createArmSection(1, height, shoulderWidth, shoulderY, build),
      createLegSection(-1, height, pelvisY, pelvisHalfWidth, build),
      createLegSection(1, height, pelvisY, pelvisHalfWidth, build),
      createFootSection(-1, height, pelvisHalfWidth),
      createFootSection(1, height, pelvisHalfWidth),
    ],
  };
}
