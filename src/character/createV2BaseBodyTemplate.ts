import type {
  BodyFaceGroup,
  V2AnchorLoop,
  V2BaseBodyTemplate,
  V2MirrorPair,
  V2PlanarTriangle,
  V2PlanarVertex,
} from './v2Topology';

interface MutableTemplate {
  vertices: V2PlanarVertex[];
  triangles: V2PlanarTriangle[];
}

function createTemplate(): V2BaseBodyTemplate {
  const mutable: MutableTemplate = {
    vertices: [],
    triangles: [],
  };

  const vertexById = new Map<string, V2PlanarVertex>();

  const addVertex = (
    id: string,
    x: number,
    y: number,
    frontDepth: number,
    backDepth = frontDepth,
  ) => {
    const vertex: V2PlanarVertex = {
      id,
      x,
      y,
      frontDepth,
      backDepth,
    };

    mutable.vertices.push(vertex);
    vertexById.set(id, vertex);
  };

  const addTriangle = (
    group: BodyFaceGroup,
    a: string,
    b: string,
    c: string,
  ) => {
    const va = vertexById.get(a);
    const vb = vertexById.get(b);
    const vc = vertexById.get(c);

    if (!va || !vb || !vc) {
      throw new Error(
        `V2 topology triangle references missing vertex: ${a}, ${b}, ${c}`,
      );
    }

    const signedArea =
      (vb.x - va.x) * (vc.y - va.y) -
      (vb.y - va.y) * (vc.x - va.x);

    mutable.triangles.push(
      signedArea >= 0
        ? { a, b, c, group }
        : { a, b: c, c: b, group },
    );
  };

  const addFourPointBand = (
    lower: string,
    upper: string,
    group: BodyFaceGroup,
  ) => {
    const suffixes = ['L', 'CL', 'CR', 'R'] as const;

    for (let column = 0; column < 3; column += 1) {
      const a = `${lower}_${suffixes[column]}`;
      const b = `${lower}_${suffixes[column + 1]}`;
      const c = `${upper}_${suffixes[column + 1]}`;
      const d = `${upper}_${suffixes[column]}`;

      addTriangle(group, a, b, c);
      addTriangle(group, a, c, d);
    }
  };

  const addThreePointBand = (
    lower: string,
    upper: string,
    group: BodyFaceGroup,
  ) => {
    const suffixes = ['L', 'C', 'R'] as const;

    for (let column = 0; column < 2; column += 1) {
      const a = `${lower}_${suffixes[column]}`;
      const b = `${lower}_${suffixes[column + 1]}`;
      const c = `${upper}_${suffixes[column + 1]}`;
      const d = `${upper}_${suffixes[column]}`;

      addTriangle(group, a, b, c);
      addTriangle(group, a, c, d);
    }
  };

  const torsoRows = [
    {
      id: 'hip',
      x: [-0.18, -0.06, 0.06, 0.18],
      y: 0.96,
      front: 0.105,
      back: 0.115,
    },
    {
      id: 'waist',
      x: [-0.15, -0.05, 0.05, 0.15],
      y: 1.08,
      front: 0.085,
      back: 0.075,
    },
    {
      id: 'chest',
      x: [-0.2, -0.07, 0.07, 0.2],
      y: 1.22,
      front: 0.115,
      back: 0.095,
    },
    {
      id: 'under',
      x: [-0.22, -0.075, 0.075, 0.22],
      y: 1.36,
      front: 0.11,
      back: 0.095,
    },
    {
      id: 'shoulder',
      x: [-0.25, -0.07, 0.07, 0.25],
      y: 1.44,
      front: 0.1,
      back: 0.09,
    },
  ] as const;

  const torsoSuffixes = ['L', 'CL', 'CR', 'R'] as const;

  for (const row of torsoRows) {
    row.x.forEach((x, index) => {
      const depthScale =
        index === 0 || index === row.x.length - 1
          ? 0.6
          : 1;

      addVertex(
        `${row.id}_${torsoSuffixes[index]}`,
        x,
        row.y,
        row.front * depthScale,
        row.back * depthScale,
      );
    });
  }

  addFourPointBand('hip', 'waist', 'Abdomen');
  addFourPointBand('waist', 'chest', 'Chest');
  addFourPointBand('chest', 'under', 'Chest');

  // under -> shoulder：左右最外侧插入固定 Armhole 中点，
  // 肩与袖笼从一开始就是固定拓扑语义，而不是运行时开洞。
  addVertex('armhole_L_mid', -0.238, 1.4, 0.066, 0.06);
  addVertex('armhole_R_mid', 0.238, 1.4, 0.066, 0.06);

  addTriangle('Shoulder', 'under_L', 'under_CL', 'shoulder_CL');
  addTriangle('Shoulder', 'under_L', 'shoulder_CL', 'armhole_L_mid');
  addTriangle('Shoulder', 'armhole_L_mid', 'shoulder_CL', 'shoulder_L');

  addTriangle('Shoulder', 'under_CL', 'under_CR', 'shoulder_CR');
  addTriangle('Shoulder', 'under_CL', 'shoulder_CR', 'shoulder_CL');

  addTriangle('Shoulder', 'under_CR', 'under_R', 'armhole_R_mid');
  addTriangle('Shoulder', 'under_CR', 'armhole_R_mid', 'shoulder_R');
  addTriangle('Shoulder', 'under_CR', 'shoulder_R', 'shoulder_CR');

  // Neck / head
  addVertex('neck_L', -0.055, 1.455, 0.055);
  addVertex('neck_R', 0.055, 1.455, 0.055);
  addVertex('neck2_L', -0.05, 1.54, 0.052, 0.055);
  addVertex('neck2_R', 0.05, 1.54, 0.052, 0.055);

  addTriangle('Shoulder', 'shoulder_L', 'shoulder_CL', 'neck_L');
  addTriangle('Shoulder', 'shoulder_CL', 'shoulder_CR', 'neck_R');
  addTriangle('Shoulder', 'shoulder_CL', 'neck_R', 'neck_L');
  addTriangle('Shoulder', 'shoulder_CR', 'shoulder_R', 'neck_R');

  addTriangle('Neck', 'neck_L', 'neck_R', 'neck2_R');
  addTriangle('Neck', 'neck_L', 'neck2_R', 'neck2_L');

  const headRows = [
    { id: 'jaw', y: 1.55, width: 0.075, front: 0.075, back: 0.085 },
    { id: 'face', y: 1.63, width: 0.095, front: 0.09, back: 0.1 },
    { id: 'crown', y: 1.7, width: 0.085, front: 0.085, back: 0.095 },
    { id: 'top', y: 1.72, width: 0.06, front: 0.06, back: 0.07 },
  ] as const;

  for (const row of headRows) {
    addVertex(
      `${row.id}_L`,
      -row.width,
      row.y,
      row.front * 0.65,
      row.back * 0.65,
    );
    addVertex(
      `${row.id}_C`,
      0,
      row.y,
      row.front,
      row.back,
    );
    addVertex(
      `${row.id}_R`,
      row.width,
      row.y,
      row.front * 0.65,
      row.back * 0.65,
    );
  }

  addTriangle('Neck', 'neck2_L', 'neck2_R', 'jaw_R');
  addTriangle('Neck', 'neck2_L', 'jaw_R', 'jaw_C');
  addTriangle('Neck', 'neck2_L', 'jaw_C', 'jaw_L');

  addThreePointBand('jaw', 'face', 'Head');
  addThreePointBand('face', 'crown', 'Head');
  addThreePointBand('crown', 'top', 'Head');

  // Pelvis
  const crotchPoints = [
    ['LO', -0.17],
    ['LI', -0.035],
    ['RI', 0.035],
    ['RO', 0.17],
  ] as const;

  for (const [suffix, x] of crotchPoints) {
    addVertex(`crotch_${suffix}`, x, 0.9, 0.1, 0.115);
  }

  const hipIds = ['hip_L', 'hip_CL', 'hip_CR', 'hip_R'] as const;
  const crotchIds = [
    'crotch_LO',
    'crotch_LI',
    'crotch_RI',
    'crotch_RO',
  ] as const;

  for (let column = 0; column < 3; column += 1) {
    addTriangle(
      'Pelvis',
      hipIds[column],
      hipIds[column + 1],
      crotchIds[column + 1],
    );
    addTriangle(
      'Pelvis',
      hipIds[column],
      crotchIds[column + 1],
      crotchIds[column],
    );
  }

  // Limbs use three planar vertices per section.
  // Front/back expansion turns each section into a real 6-sided cage.
  const leftLegSections = [
    ['thigh', -0.115, 0.8, 0.06, 0.075, 0.085, 'UpperLeg'],
    ['kneeU', -0.105, 0.5, 0.05, 0.07, 0.08, 'UpperLeg'],
    ['kneeL', -0.105, 0.44, 0.048, 0.068, 0.075, 'LowerLeg'],
    ['calf', -0.095, 0.12, 0.042, 0.055, 0.06, 'LowerLeg'],
    ['ankle', -0.095, 0.06, 0.035, 0.05, 0.055, 'LowerLeg'],
  ] as const;

  const leftLegTriples: Array<
    readonly [string, string, string]
  > = [];

  for (const [
    id,
    centerX,
    y,
    halfWidth,
    front,
    back,
  ] of leftLegSections) {
    const outer = `L_${id}_O`;
    const center = `L_${id}_C`;
    const inner = `L_${id}_I`;

    addVertex(
      outer,
      centerX - halfWidth,
      y,
      front * 0.62,
      back * 0.62,
    );
    addVertex(center, centerX, y, front, back);
    addVertex(
      inner,
      centerX + halfWidth,
      y,
      front * 0.62,
      back * 0.62,
    );

    leftLegTriples.push([outer, center, inner]);
  }

  const bridgePairToTriple = (
    group: BodyFaceGroup,
    pair: readonly [string, string],
    triple: readonly [string, string, string],
  ) => {
    addTriangle(group, pair[0], pair[1], triple[2]);
    addTriangle(group, pair[0], triple[2], triple[1]);
    addTriangle(group, pair[0], triple[1], triple[0]);
  };

  const bridgeTripleBand = (
    group: BodyFaceGroup,
    lower: readonly [string, string, string],
    upper: readonly [string, string, string],
  ) => {
    addTriangle(group, lower[0], lower[1], upper[1]);
    addTriangle(group, lower[0], upper[1], upper[0]);
    addTriangle(group, lower[1], lower[2], upper[2]);
    addTriangle(group, lower[1], upper[2], upper[1]);
  };

  bridgePairToTriple(
    'UpperLeg',
    ['crotch_LO', 'crotch_LI'],
    leftLegTriples[0],
  );

  for (let section = 1; section < leftLegTriples.length; section += 1) {
    const group: BodyFaceGroup =
      section === 1 ? 'UpperLeg' : 'LowerLeg';

    bridgeTripleBand(
      group,
      leftLegTriples[section - 1],
      leftLegTriples[section],
    );
  }

  addVertex('L_toe_O', -0.145, 0.035, 0.075, 0.025);
  addVertex('L_toe_C', -0.095, 0.035, 0.12, 0.035);
  addVertex('L_toe_I', -0.045, 0.035, 0.075, 0.025);

  bridgeTripleBand(
    'Foot',
    leftLegTriples[leftLegTriples.length - 1],
    ['L_toe_O', 'L_toe_C', 'L_toe_I'],
  );

  for (const vertex of [...mutable.vertices]) {
    if (
      vertex.id.startsWith('L_') &&
      /_(thigh|kneeU|kneeL|calf|ankle|toe)_/.test(vertex.id)
    ) {
      addVertex(
        vertex.id.replace(/^L_/, 'R_'),
        -vertex.x,
        vertex.y,
        vertex.frontDepth,
        vertex.backDepth,
      );
    }
  }

  const rightLegTriples = leftLegTriples.map(
    ([outer, center, inner]) =>
      [
        inner.replace(/^L_/, 'R_'),
        center.replace(/^L_/, 'R_'),
        outer.replace(/^L_/, 'R_'),
      ] as const,
  );

  bridgePairToTriple(
    'UpperLeg',
    ['crotch_RI', 'crotch_RO'],
    rightLegTriples[0],
  );

  for (let section = 1; section < rightLegTriples.length; section += 1) {
    const group: BodyFaceGroup =
      section === 1 ? 'UpperLeg' : 'LowerLeg';

    bridgeTripleBand(
      group,
      rightLegTriples[section - 1],
      rightLegTriples[section],
    );
  }

  bridgeTripleBand(
    'Foot',
    rightLegTriples[rightLegTriples.length - 1],
    ['R_toe_I', 'R_toe_C', 'R_toe_O'],
  );

  // Shoulder Armhole and every arm section both have three planar
  // vertices, producing a stable 6-sided continuous limb cage.
  const leftArmSections = [
    ['upper', -0.29, 1.31, 0.025, 0.015, 0.06],
    ['elbowU', -0.34, 1.2, 0.024, 0.014, 0.055],
    ['elbowL', -0.37, 1.13, 0.022, 0.013, 0.05],
    ['fore', -0.41, 1.0, 0.02, 0.012, 0.043],
    ['wrist', -0.43, 0.92, 0.018, 0.01, 0.038],
  ] as const;

  const leftArmTriples: Array<
    readonly [string, string, string]
  > = [];

  for (const [
    id,
    centerX,
    centerY,
    dx,
    dy,
    depth,
  ] of leftArmSections) {
    const inner = `L_${id}_I`;
    const center = `L_${id}_C`;
    const outer = `L_${id}_O`;

    addVertex(
      inner,
      centerX + dx,
      centerY - dy,
      depth * 0.64,
    );
    addVertex(center, centerX, centerY, depth);
    addVertex(
      outer,
      centerX - dx,
      centerY + dy,
      depth * 0.64,
    );

    leftArmTriples.push([inner, center, outer]);
  }

  const leftArmRoot = [
    'under_L',
    'armhole_L_mid',
    'shoulder_L',
  ] as const;

  bridgeTripleBand(
    'Shoulder',
    leftArmRoot,
    leftArmTriples[0],
  );

  for (let section = 1; section < leftArmTriples.length; section += 1) {
    const group: BodyFaceGroup =
      section === 1 ? 'UpperArm' : 'LowerArm';

    bridgeTripleBand(
      group,
      leftArmTriples[section - 1],
      leftArmTriples[section],
    );
  }

  addVertex('L_hand_I', -0.42, 0.84, 0.026);
  addVertex('L_hand_C', -0.445, 0.85, 0.045);
  addVertex('L_hand_O', -0.47, 0.86, 0.026);

  bridgeTripleBand(
    'Hand',
    leftArmTriples[leftArmTriples.length - 1],
    ['L_hand_I', 'L_hand_C', 'L_hand_O'],
  );

  for (const vertex of [...mutable.vertices]) {
    if (
      vertex.id.startsWith('L_') &&
      /_(upper|elbowU|elbowL|fore|wrist|hand)_/.test(vertex.id)
    ) {
      addVertex(
        vertex.id.replace(/^L_/, 'R_'),
        -vertex.x,
        vertex.y,
        vertex.frontDepth,
        vertex.backDepth,
      );
    }
  }

  const rightArmTriples = leftArmTriples.map(
    ([inner, center, outer]) =>
      [
        outer.replace(/^L_/, 'R_'),
        center.replace(/^L_/, 'R_'),
        inner.replace(/^L_/, 'R_'),
      ] as const,
  );

  const rightArmRoot = [
    'shoulder_R',
    'armhole_R_mid',
    'under_R',
  ] as const;

  bridgeTripleBand(
    'Shoulder',
    rightArmRoot,
    rightArmTriples[0],
  );

  for (let section = 1; section < rightArmTriples.length; section += 1) {
    const group: BodyFaceGroup =
      section === 1 ? 'UpperArm' : 'LowerArm';

    bridgeTripleBand(
      group,
      rightArmTriples[section - 1],
      rightArmTriples[section],
    );
  }

  bridgeTripleBand(
    'Hand',
    rightArmTriples[rightArmTriples.length - 1],
    ['R_hand_O', 'R_hand_C', 'R_hand_I'],
  );

  const anchorLoops: V2AnchorLoop[] = [
    {
      id: 'NeckLine',
      planarVertexIds: ['neck_L', 'neck_R'],
    },
    {
      id: 'ShoulderLine',
      planarVertexIds: [
        'shoulder_L',
        'shoulder_CL',
        'shoulder_CR',
        'shoulder_R',
      ],
    },
    {
      id: 'ChestLine',
      planarVertexIds: ['chest_L', 'chest_CL', 'chest_CR', 'chest_R'],
    },
    {
      id: 'WaistLine',
      planarVertexIds: ['waist_L', 'waist_CL', 'waist_CR', 'waist_R'],
    },
    {
      id: 'HipLine',
      planarVertexIds: ['hip_L', 'hip_CL', 'hip_CR', 'hip_R'],
    },
    {
      id: 'Armhole.L',
      planarVertexIds: ['under_L', 'armhole_L_mid', 'shoulder_L'],
    },
    {
      id: 'Armhole.R',
      planarVertexIds: ['shoulder_R', 'armhole_R_mid', 'under_R'],
    },
    {
      id: 'UpperArmLine.L',
      planarVertexIds: ['L_upper_I', 'L_upper_C', 'L_upper_O'],
    },
    {
      id: 'UpperArmLine.R',
      planarVertexIds: ['R_upper_O', 'R_upper_C', 'R_upper_I'],
    },
    {
      id: 'ElbowLine.L',
      planarVertexIds: ['L_elbowL_I', 'L_elbowL_C', 'L_elbowL_O'],
    },
    {
      id: 'ElbowLine.R',
      planarVertexIds: ['R_elbowL_O', 'R_elbowL_C', 'R_elbowL_I'],
    },
    {
      id: 'WristLine.L',
      planarVertexIds: ['L_wrist_I', 'L_wrist_C', 'L_wrist_O'],
    },
    {
      id: 'WristLine.R',
      planarVertexIds: ['R_wrist_O', 'R_wrist_C', 'R_wrist_I'],
    },
    {
      id: 'ThighLine.L',
      planarVertexIds: ['L_thigh_O', 'L_thigh_C', 'L_thigh_I'],
    },
    {
      id: 'ThighLine.R',
      planarVertexIds: ['R_thigh_I', 'R_thigh_C', 'R_thigh_O'],
    },
    {
      id: 'KneeLine.L',
      planarVertexIds: ['L_kneeL_O', 'L_kneeL_C', 'L_kneeL_I'],
    },
    {
      id: 'KneeLine.R',
      planarVertexIds: ['R_kneeL_I', 'R_kneeL_C', 'R_kneeL_O'],
    },
    {
      id: 'AnkleLine.L',
      planarVertexIds: ['L_ankle_O', 'L_ankle_C', 'L_ankle_I'],
    },
    {
      id: 'AnkleLine.R',
      planarVertexIds: ['R_ankle_I', 'R_ankle_C', 'R_ankle_O'],
    },
  ];

  const mirrorPairs: V2MirrorPair[] = [];

  const explicitPairs: readonly [string, string][] = [
    ['hip_L', 'hip_R'],
    ['hip_CL', 'hip_CR'],
    ['waist_L', 'waist_R'],
    ['waist_CL', 'waist_CR'],
    ['chest_L', 'chest_R'],
    ['chest_CL', 'chest_CR'],
    ['under_L', 'under_R'],
    ['under_CL', 'under_CR'],
    ['shoulder_L', 'shoulder_R'],
    ['shoulder_CL', 'shoulder_CR'],
    ['armhole_L_mid', 'armhole_R_mid'],
    ['neck_L', 'neck_R'],
    ['neck2_L', 'neck2_R'],
    ['jaw_L', 'jaw_R'],
    ['face_L', 'face_R'],
    ['crown_L', 'crown_R'],
    ['top_L', 'top_R'],
    ['crotch_LO', 'crotch_RO'],
    ['crotch_LI', 'crotch_RI'],
  ];

  for (const [left, right] of explicitPairs) {
    mirrorPairs.push({ left, right });
  }

  for (const vertex of mutable.vertices) {
    if (!vertex.id.startsWith('L_')) {
      continue;
    }

    const right = vertex.id.replace(/^L_/, 'R_');

    if (vertexById.has(right)) {
      mirrorPairs.push({ left: vertex.id, right });
    }
  }

  return {
    version: 2,
    bindPose: 'A',
    triangleBudget: 550,
    planarVertices: mutable.vertices,
    planarTriangles: mutable.triangles,
    anchorLoops,
    mirrorPairs,
  };
}

export const V2_BASE_BODY_TEMPLATE = createTemplate();
