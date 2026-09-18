export type Vec3Tuple = readonly [number, number, number];

export const BODY_REGION_IDS = {
  torso: 0,
  head: 1,
  leftShoulder: 2,
  rightShoulder: 3,
  leftArm: 4,
  rightArm: 5,
  leftLeg: 6,
  rightLeg: 7,
  leftFoot: 8,
  rightFoot: 9,
} as const;

export type BodyRegion = keyof typeof BODY_REGION_IDS;

export interface SectionRing {
  id: string;
  center: Vec3Tuple;
  radiusX: number;
  radiusY: number;
  tangent?: Vec3Tuple;
  sharedBoundary?: string;
}

export interface SectionOpening {
  id: string;
  boundary: string;
  lowerRing: string;
  upperRing: string;
  segmentStart: number;
  segmentCount: number;
}

export interface BodySection {
  id: string;
  region: BodyRegion;
  radialSegments: number;
  rings: readonly SectionRing[];
  openings?: readonly SectionOpening[];
  capStart?: boolean;
  capEnd?: boolean;
}

export interface JointPatch {
  id: string;
  kind: 'shoulder';
  region: BodyRegion;
  radialSegments: number;
  startBoundary?: string;
  rings: readonly SectionRing[];
  capStart?: boolean;
  capEnd?: boolean;
}

export interface HumanTopologyBlueprint {
  version: 2;
  sections: readonly BodySection[];
  jointPatches: readonly JointPatch[];
}

export interface TopologyStats {
  sections: number;
  jointPatches: number;
  rings: number;
  vertices: number;
  triangles: number;
}
