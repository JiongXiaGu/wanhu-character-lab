import { applyHeadwearClearance } from "../wardrobe/headwear-fit";
import { addWardrobeHeadwear, finishHair } from "../wardrobe/adornments";
import {
  B,
  rigid,
  createRecipe,
  type Cage,
  type Recipe,
  type RecipeInput,
  type HeadwearId,
  type BackId,
  type LeftHandId,
  type RightHandId,
  type Region,
  type Vec3,
  type Weight,
  type CharacterData,
} from "./types";
import {
  add,
  mul,
  sub,
  unit,
  cross,
  dot,
  ring,
  bridge,
  face,
  vertex,
  triCount,
  OCT,
  BOX,
} from "./cage";
import { makeBody, makeJoints, shapePoint, shapeRigidPoint } from "./body";
import { assembleGarments, compactSurface } from "../wardrobe/assembly";
const SKIN = "#c8956e",
  HAIR = "#282b29",
  INK = "#272b2b";
function patch(
  c: Cage,
  id: string,
  points: Vec3[],
  w: Weight,
  color: string,
  region: Region = "detail",
) {
  face(
    c,
    points.map((p, i) => vertex(c, `${id}.${i}`, p, [...w])),
    region,
    color,
  );
}
function box(c: Cage, id: string, p: Vec3, s: Vec3, w: Weight, color: string) {
  const ids: number[] = [];
  for (const z of [-1, 1])
    for (const y of [-1, 1])
      for (const x of [-1, 1])
        ids.push(
          vertex(
            c,
            `${id}.${ids.length}`,
            add(p, [(x * s[0]) / 2, (y * s[1]) / 2, (z * s[2]) / 2]),
            [...w],
          ),
        );
  for (const ix of [
    [0, 2, 3, 1],
    [4, 5, 7, 6],
    [0, 1, 5, 4],
    [2, 6, 7, 3],
    [0, 4, 6, 2],
    [1, 3, 7, 5],
  ])
    face(
      c,
      ix.map((i) => ids[i]),
      "equipment",
      color,
    );
}
function tube(
  c: Cage,
  id: string,
  points: Vec3[],
  r: number,
  w: Weight,
  color: string,
  n = 4,
) {
  let prev: number[] | undefined;
  const profile = Array.from(
    { length: n },
    (_, i) =>
      [Math.cos((i * Math.PI * 2) / n), Math.sin((i * Math.PI * 2) / n)] as [
        number,
        number,
      ],
  );
  for (let i = 0; i < points.length; i++) {
    const dir = unit(
      sub(
        points[Math.min(i + 1, points.length - 1)],
        points[Math.max(0, i - 1)],
      ),
    );
    const u = unit(cross(dir, Math.abs(dir[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]));
    const v = unit(cross(dir, u));
    const loop = ring(c, `${id}.${i}`, points[i], u, v, profile, r, r, w);
    if (prev) bridge(c, prev, loop, "equipment", color);
    else face(c, [...loop].reverse(), "equipment", color);
    prev = loop;
  }
  if (prev) face(c, prev, "equipment", color);
}
function frontSample(c: Cage, x: number, y: number): { z: number; w: Weight } {
  let best = -Infinity,
    weights: Weight = rigid(B.Chest);
  for (const f of c.faces) {
    if (!["torso", "neck", "pelvis"].includes(f.region)) continue;
    for (let i = 1; i < f.v.length - 1; i++) {
      const verts = [
          c.vertices[f.v[0]],
          c.vertices[f.v[i]],
          c.vertices[f.v[i + 1]],
        ],
        [a, b, d] = verts.map((v) => v.p);
      const det = (b[1] - d[1]) * (a[0] - d[0]) + (d[0] - b[0]) * (a[1] - d[1]);
      if (Math.abs(det) < 1e-10) continue;
      const u = ((b[1] - d[1]) * (x - d[0]) + (d[0] - b[0]) * (y - d[1])) / det,
        v = ((d[1] - a[1]) * (x - d[0]) + (a[0] - d[0]) * (y - d[1])) / det;
      if (u < -1e-6 || v < -1e-6 || u + v > 1.000001) continue;
      const z = u * a[2] + v * b[2] + (1 - u - v) * d[2];
      if (z <= best) continue;
      best = z;
      const sums = new Map<number, number>();
      [u, v, 1 - u - v].forEach((factor, k) => {
        const w = verts[k].w;
        sums.set(w[0], (sums.get(w[0]) ?? 0) + factor * w[2]);
        sums.set(w[1], (sums.get(w[1]) ?? 0) + factor * (1 - w[2]));
      });
      const ranked = [...sums].sort((a, b) => b[1] - a[1]),
        first = ranked[0],
        second = ranked[1] ?? first;
      weights = [
        first[0],
        second[0],
        first[0] === second[0] ? 1 : first[1] / (first[1] + second[1]),
      ];
    }
  }
  return { z: (Number.isFinite(best) ? best : 0.065) + 0.007, w: weights };
}
function ribbon(
  c: Cage,
  id: string,
  points: [number, number][],
  width: number,
  color: string,
) {
  // 曲线先细分再投影，避免一片长条跨越胸前几个平面后埋入衣服。
  const samples: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.025);
    for (let k = 0; k < n; k++)
      samples.push([
        a[0] + ((b[0] - a[0]) * k) / n,
        a[1] + ((b[1] - a[1]) * k) / n,
      ]);
  }
  if (points.length) samples.push(points.at(-1)!);
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i],
      b = samples[i + 1],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy),
      ux = ((-dy / len) * width) / 2,
      uy = ((dx / len) * width) / 2;
    const pts: [
      [number, number],
      [number, number],
      [number, number],
      [number, number],
    ] = [
      [a[0] - ux, a[1] - uy],
      [b[0] - ux, b[1] - uy],
      [b[0] + ux, b[1] + uy],
      [a[0] + ux, a[1] + uy],
    ];
    const ids = pts.map(([x, y], k) => {
      const sample = frontSample(c, x, y);
      return vertex(c, `${id}.${i}.${k}`, [x, y, sample.z], sample.w);
    });
    const normal = cross(
      sub(c.vertices[ids[1]].p, c.vertices[ids[0]].p),
      sub(c.vertices[ids[2]].p, c.vertices[ids[0]].p),
    );
    face(c, normal[2] > 0 ? ids : ids.reverse(), "detail", color);
  }
}
function faceDetails(c: Cage, female = false) {
  const head = rigid(B.Head);
  for (const side of [-1, 1]) {
    const x = 0.037 * side;
    // 眼睛贴在斜向面颊上，而不是漂浮在一个统一的 Z 平面。
    const surface = (xx: number, y: number): Vec3 => [
      xx,
      y,
      0.101 - Math.abs(xx) * 0.22,
    ];
    patch(
      c,
      `Eye${side}`,
      female ? [
        surface(x - .014, 1.659), surface(x, 1.654),
        surface(x + .014, 1.659), surface(x + .007, 1.665), surface(x - .007, 1.665),
      ] : [
        surface(x - 0.011, 1.655),
        surface(x + 0.011, 1.655),
        surface(x + 0.011, 1.666),
        surface(x - 0.011, 1.666),
      ],
      head,
      INK,
    );
    patch(
      c,
      `Brow${side}`,
      female ? [
        surface(x - .014, 1.678), surface(x + .014, 1.678),
        surface(x + .010, 1.6815), surface(x - .010, 1.6815),
      ] : [
        surface(x - 0.015, 1.677),
        surface(x + 0.015, 1.677),
        surface(x + 0.012, 1.683),
        surface(x - 0.012, 1.683),
      ],
      head,
      HAIR,
    );
    box(
      c,
      `Ear${side}`,
      [side * 0.099, 1.625, 0],
      [0.016, 0.04, 0.03],
      head,
      SKIN,
    );
  }
  const nose = [
    [female ? -0.009 : -0.012, 1.646, 0.102],
    [female ? 0.009 : 0.012, 1.646, 0.102],
    [0, 1.615, female ? 0.115 : 0.123],
    [0, 1.612, 0.096],
  ] as Vec3[];
  const n = nose.map((p, i) => vertex(c, `Nose.${i}`, p, head));
  for (const tri of [
    [0, 2, 1],
    [0, 3, 2],
    [1, 2, 3],
  ])
    face(
      c,
      tri.map((i) => n[i]),
      "detail",
      "#bd8963",
    );
  patch(
    c,
    "Mouth",
    [
      [female ? -0.013 : -0.015, 1.595, 0.102],
      [female ? 0.013 : 0.015, 1.595, 0.102],
      [0.01, 1.599, 0.102],
      [-0.01, 1.599, 0.102],
    ],
    head,
    female ? "#956b5e" : "#895f4c",
  );
  const lower = OCT.map(([x, z], i) =>
    vertex(
      c,
      `Hairline.${i}`,
      [x * 0.102, female ? (z > .9 ? 1.706 : z > .6 ? 1.693 : z < -.6 ? 1.588 : 1.634) : (z > 0.6 ? 1.697 : z < -0.6 ? 1.573 : 1.655), z * 0.096],
      head,
    ),
  );
  const top = ring(
    c,
    "HairCrown",
    [0, 1.759, -0.003],
    [1, 0, 0],
    [0, 0, 1],
    OCT,
    0.073,
    0.07,
    head,
  );
  const middle = ring(
    c,
    "HairVolume",
    [0, 1.724, 0],
    [1, 0, 0],
    [0, 0, 1],
    OCT,
    0.103,
    0.097,
    head,
  );
  bridge(c, lower, middle, "detail", HAIR);
  bridge(c, middle, top, "detail", HAIR);
  face(c, [...top], "detail", HAIR);

}
function headwear(c: Cage, id: HeadwearId, recipe: Recipe) {
  const first=c.vertices.length;
  buildHeadwear(c,id,recipe);
  applyHeadwearClearance(c,first,id);
}
function buildHeadwear(c: Cage, id: HeadwearId, recipe: Recipe) {
  if (id === "none") return;
  if (addWardrobeHeadwear(c,id,recipe)) return;

  const skin = rigid(B.Head);

  if (id === "farmer_straw_hat") {
    const profile = Array.from(
      { length: 12 },
      (_, i) =>
        [Math.sin((i * Math.PI) / 6), Math.cos((i * Math.PI) / 6)] as [
          number,
          number,
        ],
    );
    const rim = ring(
      c,
      "StrawBrim",
      [0, 1.72, 0],
      [1, 0, 0],
      [0, 0, 1],
      profile,
      0.255,
      0.255,
      skin,
    );
    const peak = vertex(c, "StrawPeak", [0, 1.89, 0], skin);
    const bottom = vertex(c, "StrawInside", [0, 1.816, 0], skin);

    for (let i = 0; i < 12; i++) {
      const j = (i + 1) % 12;
      face(
        c,
        [peak, rim[i], rim[j]],
        "equipment",
        i % 3 === 0 ? "#c4a76a" : "#baa071",
      );
      face(c, [bottom, rim[j], rim[i]], "equipment", "#8c754d");
    }
    return;
  }

  if (id === "guard_helmet") {
    const low = ring(
      c,
      "HelmetBrim",
      [0, 1.69, -0.006],
      [1, 0, 0],
      [0, 0, 1],
      OCT,
      0.11,
      0.103,
      skin,
    );
    const high = ring(
      c,
      "HelmetCrown",
      [0, 1.805, -0.008],
      [1, 0, 0],
      [0, 0, 1],
      OCT,
      0.062,
      0.06,
      skin,
    );
    bridge(c, low, high, "equipment", "#66716c");
    face(c, high, "equipment", "#778078");
    return;
  }

  const a = ring(
    c,
    "HeadbandA",
    [0, 1.695, 0],
    [1, 0, 0],
    [0, 0, 1],
    OCT,
    0.103,
    0.099,
    skin,
  );
  const b = ring(
    c,
    "HeadbandB",
    [0, 1.712, 0],
    [1, 0, 0],
    [0, 0, 1],
    OCT,
    0.101,
    0.098,
    skin,
  );
  bridge(c, a, b, "equipment", "#a48760");
}
function addSword(c: Cage) {
  const w = rigid(B.RightHand);
  const x = 0.541;
  const y = 0.846;
  const z = 0.023;

  box(c, "SwordGrip", [x, y - 0.025, z], [0.024, 0.12, 0.025], w, "#514435");
  box(
    c,
    "SwordGuard",
    [x, y - 0.095, z],
    [0.125, 0.018, 0.035],
    w,
    "#ad986c",
  );

  const ids = [
    [x - 0.025, y - 0.11, z],
    [x, y - 0.11, z + 0.011],
    [x + 0.025, y - 0.11, z],
    [x, y - 0.66, z],
  ].map((p, i) => vertex(c, `Blade.${i}`, p as Vec3, w));

  face(c, [ids[0], ids[3], ids[1]], "equipment", "#adb8b4");
  face(c, [ids[1], ids[3], ids[2]], "equipment", "#d0d7cb");
  face(c, [ids[0], ids[2], ids[3]], "equipment", "#788783");
}

function addShield(c: Cage) {
  const w = rigid(B.LeftHand);
  const center: Vec3 = [-0.56, 0.87, 0.088];
  const edge = OCT.map(([xx, yy], i) =>
    vertex(c, `Shield.${i}`, add(center, [xx * 0.2, yy * 0.25, 0]), w),
  );
  const boss = vertex(c, "ShieldBoss", add(center, [0, 0, 0.058]), w);

  for (let i = 0; i < 8; i++) {
    face(
      c,
      [boss, edge[(i + 1) % 8], edge[i]],
      "equipment",
      i % 2 ? "#6f4937" : "#79503a",
    );
  }

  face(c, [...edge], "equipment", "#463b31");
  box(
    c,
    "ShieldBossCap",
    add(center, [0, 0, 0.052]),
    [0.05, 0.055, 0.025],
    w,
    "#9d9d86",
  );
}

function addBow(c: Cage) {
  const w = rigid(B.LeftHand);
  const center: Vec3 = [-0.55, 0.86, 0.02];
  const points: Vec3[] = [
    [-0.075, 0.34, 0],
    [0.012, 0.24, 0],
    [0.05, 0.11, 0],
    [0, 0, 0],
    [0.05, -0.11, 0],
    [0.012, -0.24, 0],
    [-0.075, -0.34, 0],
  ].map((p) => add(center, p as Vec3));

  tube(c, "Bow", points, 0.014, w, "#956d42");
  tube(c, "Bowstring", [points[0], points.at(-1)!], 0.002, w, "#d6c9ad", 3);
}

function addQuiver(c: Cage) {
  const chest = rigid(B.Chest);

  tube(
    c,
    "Quiver",
    [
      [-0.13, 1.0, -0.14],
      [-0.13, 1.37, -0.16],
    ],
    0.058,
    chest,
    "#604739",
    6,
  );

  for (let i = 0; i < 3; i++) {
    const x = -0.16 + i * 0.028;
    tube(
      c,
      `Arrow${i}`,
      [
        [x, 1.22, -0.16],
        [x, 1.48, -0.16],
      ],
      0.005,
      chest,
      "#b39969",
      3,
    );
    patch(
      c,
      `Fletch${i}`,
      [
        [x - 0.014, 1.45, -0.17],
        [x + 0.014, 1.45, -0.17],
        [x + 0.009, 1.49, -0.17],
        [x - 0.009, 1.49, -0.17],
      ],
      chest,
      "#cbc8ad",
    );
  }
}

function addHoe(c: Cage) {
  const w = rigid(B.RightHand);
  tube(
    c,
    "HoeHandle",
    [
      [0.54, 0.26, 0.025],
      [0.54, 1.09, 0.025],
    ],
    0.012,
    w,
    "#9b764a",
  );
  box(c, "HoeBlade", [0.6, 1.08, 0.025], [0.15, 0.024, 0.055], w, "#707977");
}

function addBack(c: Cage, id: BackId) {
  if (id === "archer_quiver") addQuiver(c);
}

function addLeftHand(c: Cage, id: LeftHandId) {
  if (id === "guard_shield") addShield(c);
  if (id === "archer_bow") addBow(c);
}

function addRightHand(c: Cage, id: RightHandId) {
  if (id === "farmer_hoe") addHoe(c);
  if (id === "guard_sword") addSword(c);
}

export function makeCharacter(input: RecipeInput): CharacterData {
  const recipe = createRecipe(input);
  const body = makeBody();
  const {surface:c,replacedTriangles,garments} = assembleGarments(body,recipe);
  const colors = recipe.dyes;
  const [trim, leather] = [colors.accent, colors.accent];

  const hasTop = recipe.slots.top !== "body";
  if (hasTop && !["rough_tunic", "cross_jacket", "layered_vest"].includes(recipe.slots.top)) {
    ribbon(
      c,
      "CrossCollar",
      [
        [-0.049, 1.45],
        [0.073, 1.32],
        [0.097, 1.2],
      ],
      0.023,
      trim,
    );
    ribbon(
      c,
      "InnerCollar",
      [
        [0.049, 1.45],
        [-0.024, 1.371],
      ],
      0.02,
      trim,
    );
  }

  if (recipe.slots.top === "guard_light_armor") {
    for (const yy of [1.16, 1.215, 1.27]) {
      ribbon(
        c,
        `Lamellar${yy}`,
        [
          [-0.113, yy],
          [0.113, yy],
        ],
        0.008,
        "#a6a88c",
      );
    }
    ribbon(
      c,
      "ChestTie",
      [
        [-0.08, 1.39],
        [-0.08, 1.15],
      ],
      0.012,
      "#aa8a61",
    );
  }

  if (recipe.slots.back === "archer_quiver") {
    ribbon(
      c,
      "QuiverStrap",
      [
        [-0.1, 1.42],
        [0.115, 1.15],
      ],
      0.035,
      leather,
    );
  }

  const female = recipe.bodyType === "female";
  faceDetails(c, female);
  finishHair(c,recipe);
  const rigidStart = c.vertices.length;
  headwear(c, recipe.slots.headwear, recipe);
  addBack(c, recipe.slots.back);
  addLeftHand(c, recipe.slots.leftHand);
  addRightHand(c, recipe.slots.rightHand);
  const joints = makeJoints(recipe);
  const baseJoints = makeJoints(createRecipe({ bodyType:"male" }));
  c.vertices.forEach((v,i) => {
    v.p = i < rigidStart ? shapePoint(v.p,recipe) : shapeRigidPoint(v.p,v.w[0],recipe,baseJoints,joints);
  });
  for (const v of body.vertices) v.p = shapePoint(v.p, recipe);

  return {
    body,
    surface: compactSurface(c),
    joints,
    recipe,
    replacedTriangles,
    bodyTriangles: triCount(body),
    garments,
  };
}
