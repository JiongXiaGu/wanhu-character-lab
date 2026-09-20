import { femalePoint } from "./proportions";
import {
  B,
  BODY_HEIGHT,
  rigid,
  type Cage,
  type Joint,
  type Recipe,
  type Vec3,
  type Weight,
} from "./types";
import {
  OCT,
  HEX,
  LEG,
  add,
  mul,
  ring,
  bridge,
  face,
  vertex,
  orient,
} from "./cage";

/** 一个三维、四边面主导的固定拓扑。衣服和基模共用这些接口。 */
export function makeBody(): Cage {
  const c: Cage = { vertices: [], faces: [], anchors: {} };
  const rows: [string, number, number, number, Weight][] = [
    ["Hip", 0.91, 0.165, 0.104, rigid(B.Hips)],
    ["Waist", 1.055, 0.142, 0.083, [B.Hips, B.Spine, 0.35]],
    ["Rib", 1.18, 0.177, 0.105, [B.Spine, B.Chest, 0.35]],
    ["Chest", 1.3, 0.202, 0.113, rigid(B.Chest)],
    ["Shoulder", 1.395, 0.211, 0.098, rigid(B.Chest)],
    ["NeckBase", 1.455, 0.06, 0.053, [B.Chest, B.Neck, 0.35]],
    ["NeckTop", 1.51, 0.057, 0.055, [B.Neck, B.Head, 0.3]],
    ["Jaw", 1.545, 0.076, 0.079, rigid(B.Head)],
    ["Cheek", 1.63, 0.098, 0.092, rigid(B.Head)],
    ["Forehead", 1.72, 0.097, 0.09, rigid(B.Head)],
    ["Crown", 1.755, 0.069, 0.065, rigid(B.Head)],
  ];
  const loops = rows.map(([id, y, w, d, skin]) =>
    ring(
      c,
      id,
      [0, y, id === "Jaw" ? 0.013 : id === "Cheek" ? 0.008 : 0],
      [1, 0, 0],
      [0, 0, 1],
      OCT,
      w,
      d,
      skin,
    ),
  );
  loops.forEach((loop, i) => {
    c.anchors[rows[i][0]] = loop;
  });
  for (let r = 0; r < loops.length - 1; r++) {
    for (let j = 0; j < 8; j++) {
      // 固定肩口：每侧两个四边面由肩-上臂连续面替代。
      if (r === 3 && [1, 2, 5, 6].includes(j)) continue;
      face(
        c,
        [
          loops[r][j],
          loops[r][(j + 1) % 8],
          loops[r + 1][(j + 1) % 8],
          loops[r + 1][j],
        ],
        r < 1 ? "pelvis" : r < 5 ? "torso" : r < 7 ? "neck" : "head",
      );
    }
  }
  face(c, [...loops.at(-1)!], "head");
  const hips = loops[0];
  const crotch = vertex(c, "Crotch", [0, 0.815, 0], rigid(B.Hips));
  for (const side of [1, -1]) {
    const right = side === 1,
      prefix = right ? "Right" : "Left";
    const upper = right ? B.RightUpperArm : B.LeftUpperArm,
      lower = right ? B.RightForearm : B.LeftForearm,
      hand = right ? B.RightHand : B.LeftHand;
    const chest = loops[3],
      shoulder = loops[4];
    const socket = right
      ? [chest[1], chest[2], chest[3], shoulder[3], shoulder[2], shoulder[1]]
      : [chest[7], chest[6], chest[5], shoulder[5], shoulder[6], shoulder[7]];
    c.anchors[`${prefix}Armhole`] = socket;
    // 上肩口和下腋窝分别保留不同的权重，不能整圈刚性旋转。
    socket.forEach((idx, i) => {
      c.vertices[idx].w = [B.Chest, upper, i < 3 ? 0.87 : 0.62];
    });
    const u: Vec3 = [side * 0.866, 0.5, 0];
    const armRows: [string, Vec3, number, number, Weight][] = [
      [
        "Deltoid",
        [side * 0.25, 1.302, 0],
        0.065,
        0.061,
        [B.Chest, upper, 0.16],
      ],
      [
        "ElbowUpper",
        [side * 0.374, 1.136, 0],
        0.047,
        0.046,
        [upper, lower, 0.9],
      ],
      ["Elbow", [side * 0.394, 1.101, 0], 0.039, 0.04, [upper, lower, 0.5]],
      [
        "ElbowLower",
        [side * 0.414, 1.066, 0.002],
        0.046,
        0.042,
        [upper, lower, 0.08],
      ],
      [
        "Wrist",
        [side * 0.503, 0.912, 0.014],
        0.027,
        0.027,
        [lower, hand, 0.18],
      ],
      ["Fingers", [side * 0.546, 0.832, 0.025], 0.035, 0.023, rigid(hand)],
    ];
    let prev = socket;
    armRows.forEach(([id, center, w, d, skin], i) => {
      const next = ring(
        c,
        `${prefix}${id}`,
        center,
        u,
        [0, 0, 1],
        HEX,
        w,
        d,
        skin,
      );
      bridge(c, prev, next, i < 2 ? "upperArm" : i < 5 ? "forearm" : "hand");
      c.anchors[`${prefix}${id}`] = next;
      prev = next;
    });
    face(c, [...prev], "hand");
    const thigh = right ? B.RightThigh : B.LeftThigh,
      shin = right ? B.RightShin : B.LeftShin,
      foot = right ? B.RightFoot : B.LeftFoot;
    const legRoot = right
      ? [hips[0], hips[1], hips[2], hips[3], hips[4], crotch]
      : [hips[4], hips[5], hips[6], hips[7], hips[0], crotch];
    c.anchors[`${prefix}LegRoot`] = legRoot;
    // 两条腿都由同一骨盆边界分叉，裆点由 Hips 驱动，不重复。
    const legRows: [string, number, number, number, number, Weight][] = [
      ["Thigh", 0.805, 0.091, 0.078, 0, [B.Hips, thigh, 0.12]],
      ["KneeUpper", 0.529, 0.058, 0.057, 0, [thigh, shin, 0.94]],
      ["Knee", 0.489, 0.055, 0.055, 0, [thigh, shin, 0.5]],
      ["KneeLower", 0.449, 0.056, 0.052, 0, [thigh, shin, 0.06]],
      ["Calf", 0.293, 0.062, 0.063, -0.008, rigid(shin)],
      ["Ankle", 0.105, 0.04, 0.039, 0, [shin, foot, 0.2]],
      ["Instep", 0.064, 0.052, 0.104, 0.05, rigid(foot)],
      ["Sole", 0, 0.054, 0.109, 0.053, rigid(foot)],
    ];
    prev = legRoot;
    legRows.forEach(([id, y, w, d, z, skin], i) => {
      const prof = right
        ? LEG
        : LEG.map(([x, zz]) => [-x, -zz] as [number, number]);
      const next = ring(
        c,
        `${prefix}${id}`,
        [side * 0.101, y, z],
        [1, 0, 0],
        [0, 0, 1],
        prof,
        w,
        d,
        skin,
      );
      bridge(c, prev, next, i < 2 ? "thigh" : i < 6 ? "shin" : "foot");
      c.anchors[`${prefix}${id}`] = next;
      prev = next;
    });
    face(c, [...prev], "foot");
  }
  orient(c);
  return c;
}
export function shapePoint(p: Vec3, recipe: Recipe): Vec3 {
  if (recipe.bodyType === "female") p = femalePoint(p);
  const h = BODY_HEIGHT[recipe.bodyType] / 1.76;
  return [
    p[0] * h,
    p[1] * h,
    p[2] * h,
  ];
}
export function makeJoints(recipe: Recipe): Joint[] {
  const j: Joint[] = [];
  const put = (name: string, parent: number, p: Vec3) =>
    j.push({ name, parent, p: shapePoint(p, recipe) });
  put("Root", -1, [0, 0, 0]);
  put("Hips", 0, [0, 0.929, 0]);
  put("Spine", 1, [0, 1.07, 0]);
  put("Chest", 2, [0, 1.24, 0]);
  put("Neck", 3, [0, 1.457, 0]);
  put("Head", 4, [0, 1.52, 0]);
  for (const s of [1, -1]) {
    const name = s === 1 ? "Right" : "Left",
      clav = j.length;
    put(`${name}Clavicle`, 3, [s * 0.08, 1.36, 0]);
    put(`${name}UpperArm`, clav, [s * 0.211, 1.365, 0]);
    put(`${name}Forearm`, clav + 1, [s * 0.394, 1.101, 0]);
    put(`${name}Hand`, clav + 2, [s * 0.503, 0.912, 0.014]);
  }
  for (const s of [1, -1]) {
    const name = s === 1 ? "Right" : "Left",
      t = j.length;
    put(`${name}Thigh`, 1, [s * 0.101, 0.929, 0]);
    put(`${name}Shin`, t, [s * 0.101, 0.489, 0]);
    put(`${name}Foot`, t + 1, [s * 0.101, 0.105, 0]);
  }
  return j;
}

/** 刚性工具只换绑定锚点和等比尺寸，不套非线性身体比例场，避免直杆变弯。 */
export function shapeRigidPoint(p: Vec3, bone: number, recipe: Recipe, baseJoints: Joint[], targetJoints: Joint[]): Vec3 {
  if (recipe.bodyType === "male") return shapePoint(p, recipe);
  const origin = baseJoints[bone].p, target = targetJoints[bone].p, h = BODY_HEIGHT[recipe.bodyType] / 1.76;
  const head = bone === B.Head;
  return [target[0] + (p[0] - origin[0]) * h * (head ? .96 : 1),
    target[1] + (p[1] - origin[1]) * h,
    target[2] + (p[2] - origin[2]) * h * (head ? .98 : 1)];
}
