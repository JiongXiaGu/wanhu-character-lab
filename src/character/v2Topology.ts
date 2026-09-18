export const BODY_FACE_GROUP_IDS = {
  Head: 0,
  Neck: 1,
  Shoulder: 2,
  Chest: 3,
  Back: 4,
  Abdomen: 5,
  Pelvis: 6,
  UpperArm: 7,
  LowerArm: 8,
  Hand: 9,
  UpperLeg: 10,
  LowerLeg: 11,
  Foot: 12,
} as const;

export type BodyFaceGroup = keyof typeof BODY_FACE_GROUP_IDS;

export interface V2PlanarVertex {
  id: string;
  x: number;
  y: number;
  frontDepth: number;
  backDepth: number;
}

export interface V2PlanarTriangle {
  a: string;
  b: string;
  c: string;
  group: BodyFaceGroup;
}

export interface V2AnchorLoop {
  id: string;
  planarVertexIds: readonly string[];
}

export interface V2MirrorPair {
  left: string;
  right: string;
}

export interface V2BaseBodyTemplate {
  version: 2;
  bindPose: 'A';
  triangleBudget: number;
  planarVertices: readonly V2PlanarVertex[];
  planarTriangles: readonly V2PlanarTriangle[];
  anchorLoops: readonly V2AnchorLoop[];
  mirrorPairs: readonly V2MirrorPair[];
}

export interface V2BodyStats {
  surfaceComponents: number;
  vertices: number;
  triangles: number;
  faceGroups: number;
  anchors: number;
  triangleBudget: number;
  meshValid: boolean;
}

export interface V2BodyGeometryMetadata extends V2BodyStats {
  templateVersion: number;
  triangleFaceGroups: readonly number[];
  anchorVertexIndices: Readonly<Record<string, readonly number[]>>;
  semanticVertexIndices: Readonly<
    Record<string, { front: number; back: number }>
  >;
}
