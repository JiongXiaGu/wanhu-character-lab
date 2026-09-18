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
      addVertex(
        `${row.id}_${torsoSuffixes[index]}`,
        x,
        row.y,
        row.front,
        row.back,
      );
    });
  }

  addFourPointBand('hip', 'waist', 'Abdomen');
  addFourPointBand('waist', 'chest', 'Chest');
  addFourPointBand('chest', 'under', 'Chest');

  // under -> shoulder：左右最外侧插入固定 Armhole 中点，
  // 肩与袖笼从一开始就是固定拓扑语义，而不是运行时开洞。
  addVertex('armhole_L_mid', -0.238, 1.4, 0.105, 0.092);
  addVertex('armhole_R_mid', 0.238, 1.4, 0.105, 0.092);

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
      row.front,
      row.back,
    );
    addVertex(`${row.id}_C`, 0, row.y, row.front, row.back);
    addVertex(
      `${row.id}_R`,
      row.width,
      row.y,
      row.front,
      row.back,
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

  // Left leg. Right leg is an explicit mirror with fixed semantic ids.
  const leftLegSections = [
    ['thigh', -0.115, 0.8, 0.06, 0.075, 0.085, 'UpperLeg'],
    ['kneeU', -0.105, 0.5, 0.05, 0.07, 0.08, 'UpperLeg'],
    ['kneeL', -0.105, 0.44, 0.048, 0.068, 0.075, 'LowerLeg'],
    ['calf', -0.095, 0.12, 0.042, 0.055, 0.06, 'LowerLeg'],
    ['ankle', -0.095, 0.06, 0.035, 0.05, 0.055, 'LowerLeg'],
  ] as const;

  let leftLegPrevious: readonly [string, string] = [
    'crotch_LO',
    'crotch_LI',
  ];

  for (const [
    id,
    centerX,
    y,
    halfWidth,
    front,
    back,
    group,
  ] of leftLegSections) {
    const outer = `L_${id}_O`;
    const inner = `L_${id}_I`;

    addVertex(outer, centerX - halfWidth, y, front, back);
    addVertex(inner, centerX + halfWidth, y, front, back);

    addTriangle(group, leftLegPrevious[0], leftLegPrevious[1], inner);
    addTriangle(group, leftLegPrevious[0], inner, outer);

    leftLegPrevious = [outer, inner];
  }

  addVertex('L_toe_O', -0.145, 0.035, 0.12, 0.035);
  addVertex('L_toe_I', -0.045, 0.035, 0.12, 0.035);
  addTriangle('Foot', leftLegPrevious[0], leftLegPrevious[1], 'L_toe_I');
  addTriangle('Foot', leftLegPrevious[0], 'L_toe_I', 'L_toe_O');

  // Mirror left leg vertices.
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

  let rightLegPrevious: readonly [string, string] = [
    'crotch_RI',
    'crotch_RO',
  ];

  for (const [id, , , , , , group] of leftLegSections) {
    const inner = `R_${id}_I`;
    const outer = `R_${id}_O`;

    addTriangle(group, rightLegPrevious[0], rightLegPrevious[1], outer);
    addTriangle(group, rightLegPrevious[0], outer, inner);

    rightLegPrevious = [inner, outer];
  }

  addTriangle(
    'Foot',
    rightLegPrevious[0],
    rightLegPrevious[1],
    'R_toe_O',
  );
  addTriangle('Foot', rightLegPrevious[0], 'R_toe_O', 'R_toe_I');

  // Left arm uses the fixed 3-point Armhole boundary.
  const leftArmSections = [
    ['upper', -0.29, 1.31, 0.025, 0.015, 0.06, 'UpperArm'],
    ['elbowU', -0.34, 1.2, 0.024, 0.014, 0.055, 'UpperArm'],
    ['elbowL', -0.37, 1.13, 0.022, 0.013, 0.05, 'LowerArm'],
    ['fore', -0.41, 1.0, 0.02, 0.012, 0.043, 'LowerArm'],
    ['wrist', -0.43, 0.92, 0.018, 0.01, 0.038, 'LowerArm'],
  ] as const;

  const leftArmPairs: Array<readonly [string, string]> = [];

  for (const [id, centerX, centerY, dx, dy, depth] of leftArmSections) {
    const inner = `L_${id}_I`;
    const outer = `L_${id}_O`;

    addVertex(inner, centerX + dx, centerY - dy, depth);
    addVertex(outer, centerX - dx, centerY + dy, depth);
    leftArmPairs.push([inner, outer]);
  }

  const firstLeftArm = leftArmPairs[0];
  addTriangle('Shoulder', 'under_L', 'armhole_L_mid', firstLeftArm[0]);
  addTriangle(
    'Shoulder',
    'armhole_L_mid',
    firstLeftArm[1],
    firstLeftArm[0],
  );
  addTriangle(
    'Shoulder',
    'armhole_L_mid',
    'shoulder_L',
    firstLeftArm[1],
  );

  let leftArmPrevious = firstLeftArm;

  for (let section = 1; section < leftArmPairs.length; section += 1) {
    const current = leftArmPairs[section];
    const group: BodyFaceGroup =
      section <= 1 ? 'UpperArm' : 'LowerArm';

    addTriangle(group, leftArmPrevious[0], leftArmPrevious[1], current[1]);
    addTriangle(group, leftArmPrevious[0], current[1], current[0]);
    leftArmPrevious = current;
  }

  addVertex('L_hand_I', -0.42, 0.84, 0.04);
  addVertex('L_hand_O', -0.47, 0.86, 0.04);
  addTriangle('Hand', leftArmPrevious[0], leftArmPrevious[1], 'L_hand_O');
  addTriangle('Hand', leftArmPrevious[0], 'L_hand_O', 'L_hand_I');

  // Mirror left arm vertices.
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

  const rightArmPairs = leftArmPairs.map(
    ([inner, outer]) =>
      [
        outer.replace(/^L_/, 'R_'),
        inner.replace(/^L_/, 'R_'),
      ] as const,
  );

  const firstRightArm = rightArmPairs[0];
  addTriangle(
    'Shoulder',
    'shoulder_R',
    'armhole_R_mid',
    firstRightArm[0],
  );
  addTriangle(
    'Shoulder',
    'armhole_R_mid',
    firstRightArm[1],
    firstRightArm[0],
  );
  addTriangle(
    'Shoulder',
    'armhole_R_mid',
    'under_R',
    firstRightArm[1],
  );

  let rightArmPrevious = firstRightArm;

  for (let section = 1; section < rightArmPairs.length; section += 1) {
    const current = rightArmPairs[section];
    const group: BodyFaceGroup =
      section <= 1 ? 'UpperArm' : 'LowerArm';

    addTriangle(
      group,
      rightArmPrevious[0],
      rightArmPrevious[1],
      current[1],
    );
    addTriangle(group, rightArmPrevious[0], current[1], current[0]);
    rightArmPrevious = current;
  }

  addTriangle(
    'Hand',
    rightArmPrevious[0],
    rightArmPrevious[1],
    'R_hand_I',
  );
  addTriangle('Hand', rightArmPrevious[0], 'R_hand_I', 'R_hand_O');

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
      planarVertexIds: ['L_upper_I', 'L_upper_O'],
    },
    {
      id: 'UpperArmLine.R',
      planarVertexIds: ['R_upper_O', 'R_upper_I'],
    },
    {
      id: 'ElbowLine.L',
      planarVertexIds: ['L_elbowL_I', 'L_elbowL_O'],
    },
    {
      id: 'ElbowLine.R',
      planarVertexIds: ['R_elbowL_O', 'R_elbowL_I'],
    },
    {
      id: 'WristLine.L',
      planarVertexIds: ['L_wrist_I', 'L_wrist_O'],
    },
    {
      id: 'WristLine.R',
      planarVertexIds: ['R_wrist_O', 'R_wrist_I'],
    },
    {
      id: 'ThighLine.L',
      planarVertexIds: ['L_thigh_O', 'L_thigh_I'],
    },
    {
      id: 'ThighLine.R',
      planarVertexIds: ['R_thigh_I', 'R_thigh_O'],
    },
    {
      id: 'KneeLine.L',
      planarVertexIds: ['L_kneeL_O', 'L_kneeL_I'],
    },
    {
      id: 'KneeLine.R',
      planarVertexIds: ['R_kneeL_I', 'R_kneeL_O'],
    },
    {
      id: 'AnkleLine.L',
      planarVertexIds: ['L_ankle_O', 'L_ankle_I'],
    },
    {
      id: 'AnkleLine.R',
      planarVertexIds: ['R_ankle_I', 'R_ankle_O'],
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
