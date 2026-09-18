export type Vec3Tuple = readonly [number, number, number];

export type BodyRegion =
  | 'torso'
  | 'head'
  | 'leftArm'
  | 'rightArm'
  | 'leftLeg'
  | 'rightLeg'
  | 'leftFoot'
  | 'rightFoot';

export interface SectionRing {
  id: string;
  center: Vec3Tuple;
  radiusX: number;
  radiusY: number;
}

export interface BodySection {
  id: string;
  region: BodyRegion;
  radialSegments: number;
  rings: readonly SectionRing[];
  capStart?: boolean;
  capEnd?: boolean;
}

export interface HumanTopologyBlueprint {
  version: 1;
  sections: readonly BodySection[];
}

export interface TopologyStats {
  sections: number;
  rings: number;
  vertices: number;
  triangles: number;
}
