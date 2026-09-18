import type { BodyParameters } from './types';

export interface HumanLandmarks {
  height: number;
  ankleY: number;
  kneeY: number;
  hipY: number;
  lowerAbdomenY: number;
  waistY: number;
  chestY: number;
  shoulderY: number;
  neckBaseY: number;
  headBottomY: number;
  headTopY: number;
}

export function resolveHumanLandmarks(
  parameters: BodyParameters,
): HumanLandmarks {
  const { height, headScale } = parameters;
  const headHeight = height * 0.13 * headScale;

  return {
    height,
    ankleY: height * 0.058,
    kneeY: height * 0.285,
    hipY: height * 0.51,
    lowerAbdomenY: height * 0.555,
    waistY: height * 0.62,
    chestY: height * 0.735,
    shoulderY: height * 0.805,
    neckBaseY: height * 0.84,
    headBottomY: height - headHeight,
    headTopY: height,
  };
}
