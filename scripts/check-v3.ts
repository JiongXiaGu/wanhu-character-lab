import assert from "node:assert/strict";
import { assertComponentWinding } from "./check-components";
import * as T from "three";
import { makeCharacter } from "../src/character/v3/outfit";
import { makeActor, MOTION_LABELS } from "../src/character/v3/rig";
import { edgeKey, triCount, cross, sub, dot } from "../src/character/v3/cage";
import {
  B,
  cleanRecipe,
  type Cage,
  type Motion,
  type Outfit,
  type Vec3,
} from "../src/character/v3/types";
import {
  ACTION_DEFINITIONS,
  actionAvailable,
  type CombatActionId,
} from "../src/character/v3/actions";
function validate(c: Cage, closed: boolean) {
  const edges = new Map<string, [number, number][]>(),
    used = new Set<number>(),
    adj = c.vertices.map(() => new Set<number>());
  let volume = 0;
  for (const v of c.vertices) {
    assert(v.p.every(Number.isFinite), "非有限坐标");
    assert(Number.isInteger(v.w[0]) && v.w[0] >= 0 && v.w[0] < 20);
    assert(Number.isInteger(v.w[1]) && v.w[1] >= 0 && v.w[1] < 20);
    assert(v.w[2] >= 0 && v.w[2] <= 1);
  }
  for (const f of c.faces) {
    assert(f.v.length >= 3);
    assert(new Set(f.v).size === f.v.length);
    for (const i of f.v)
      assert(Number.isInteger(i) && i >= 0 && i < c.vertices.length);
    for (let k = 1; k < f.v.length - 1; k++) {
      const a = c.vertices[f.v[0]].p,
        b = c.vertices[f.v[k]].p,
        d = c.vertices[f.v[k + 1]].p;
      assert(Math.hypot(...cross(sub(b, a), sub(d, a))) > 1e-9, "退化三角形");
      volume += dot(a, cross(b, d)) / 6;
    }
    for (let k = 0; k < f.v.length; k++) {
      const a = f.v[k],
        b = f.v[(k + 1) % f.v.length],
        key = edgeKey(a, b),
        arr = edges.get(key) ?? [];
      arr.push([a, b]);
      edges.set(key, arr);
      adj[a].add(b);
      adj[b].add(a);
      used.add(a);
    }
  }
  if (closed) {
    for (const [k, v] of edges) {
      assert.equal(v.length, 2, `非流形边 ${k}`);
      assert.equal(v[0][0], v[1][1], `绕序冲突 ${k}`);
    }
    const seen = new Set<number>([0]),
      todo = [0];
    while (todo.length) {
      const i = todo.pop()!;
      for (const n of adj[i])
        if (!seen.has(n)) {
          seen.add(n);
          todo.push(n);
        }
    }
    assert.equal(seen.size, c.vertices.length, "人体不是一个连通表面");
    assert.equal(used.size, c.vertices.length, "孤立顶点");
    assert.equal(
      c.vertices.length - edges.size + c.faces.length,
      2,
      "Euler 特征不是 2",
    );
    assert(volume > 0, "整体朝向反了");
    const positions = new Set(
      c.vertices.map((v) => v.p.map((x) => x.toFixed(6)).join(",")),
    );
    for (const v of c.vertices) {
      const key = [-v.p[0], v.p[1], v.p[2]]
        .map((x) => (Math.abs(x) < 1e-7 ? 0 : x).toFixed(6))
        .join(",");
      assert(positions.has(key), `不对称 ${v.id}`);
    }
    for (const [name, loop] of Object.entries(c.anchors)) {
      assert(loop.length >= 3);
      for (let k = 0; k < loop.length; k++)
        assert(
          edges.has(edgeKey(loop[k], loop[(k + 1) % loop.length])),
          `锚点不沿真实网格边 ${name}`,
        );
    }
  }
}
const skeletonMaps: string[] = [];
let frames = 0;
for (const outfit of ["body", "farmer", "guard", "archer"] as Outfit[])
  for (const variant of [
    { height: 1.76, build: 0.5 },
    { height: 1.58, build: 0 },
    { height: 1.92, build: 1 },
  ]) {
    const data = makeCharacter({ outfit, ...variant, equipment: true });
    validate(data.body, true);
    validate(data.surface, false);
    assertComponentWinding(data.surface);
    assert(triCount(data.body) <= 550);
    assert(
      triCount(data.surface) <= 1000,
      `含装备超预算 ${outfit}: ${triCount(data.surface)}`,
    );
    const a = makeActor(data);
    skeletonMaps.push(
      data.joints.map((j) => `${j.name}:${j.parent}`).join("|"),
    );
    assert.equal(a.mesh.skeleton.bones.length, 20);
    const index = a.mesh.geometry.getIndex()!,
      pos = a.mesh.geometry.attributes.position;
    const si = a.mesh.geometry.attributes.skinIndex,
      sw = a.mesh.geometry.attributes.skinWeight;
    assert(index.array instanceof Uint16Array);
    for (let i = 0; i < pos.count; i++) {
      assert(Math.abs(sw.getX(i) + sw.getY(i) - 1) < 1e-6);
      assert(sw.getZ(i) === 0 && sw.getW(i) === 0);
      assert(si.getX(i) < 20);
    }
    const v = new T.Vector3(),
      bind = new T.Vector3();
    a.setMotion("bind");
    a.seek(0);
    a.mesh.updateMatrixWorld(true);
    a.skeleton.update();
    for (let i = 0; i < pos.count; i++) {
      a.mesh.getVertexPosition(i, v);
      bind.fromBufferAttribute(pos as T.BufferAttribute, i);
      assert(v.distanceTo(bind) < 1e-5, "Bind pose 不一致");
    }
    for (const motion of Object.keys(MOTION_LABELS) as Motion[]) {
      a.setMotion(motion);
      for (let f = 0; f < 16; f++) {
        a.seek((f / 16) * a.action.getClip().duration);
        a.mesh.updateMatrixWorld(true);
        a.skeleton.update();
        const coords: Vec3[] = [];
        for (let i = 0; i < pos.count; i++) {
          a.mesh.getVertexPosition(i, v);
          assert([v.x, v.y, v.z].every(Number.isFinite));
          assert(v.length() < variant.height * 2, "动作顶点爆炸");
          coords.push([v.x, v.y, v.z]);
        }
        for (let i = 0; i < index.count; i += 3) {
          const x = coords[index.getX(i)],
            y = coords[index.getX(i + 1)],
            z = coords[index.getX(i + 2)];
          assert(
            Math.hypot(...cross(sub(y, x), sub(z, x))) > 1e-11,
            `动作退化 ${outfit}/${motion}/${f}`,
          );
        }
        frames++;
      }
    }
    // 行走方向语义：+Z 是人物前方。
    // 右脚前触地时右臂必须向后；随后支撑脚贴地向后扫，
    // 对侧脚抬起从后向前摆。这个检查专门防止“月球步/倒走”回归。
    const walk = a.clips.walk;
    const boneWorld = (boneIndex: number) => {
      a.mesh.updateMatrixWorld(true);
      a.skeleton.update();
      return a.bones[boneIndex].getWorldPosition(new T.Vector3());
    };
    const walkPose = (phase: number) => {
      a.setMotion("walk");
      a.seek(phase * walk.duration);
      return {
        rightFoot: boneWorld(16),
        leftFoot: boneWorld(19),
        rightHand: boneWorld(9),
        leftHand: boneWorld(13),
      };
    };
    const contact = walkPose(0);
    assert(
      contact.rightFoot.z > contact.leftFoot.z + 0.05,
      "行走方向错误：右脚前触地没有位于 +Z 前方",
    );
    assert(
      contact.rightHand.z < contact.leftHand.z - 0.015,
      "行走相位错误：同侧手臂和腿在一起向前摆",
    );
    const leftSwing = walkPose(0.25);
    assert(
      leftSwing.leftFoot.y > leftSwing.rightFoot.y + 0.015,
      "行走相位错误：后脚向前摆时没有抬起",
    );
    const oppositeContact = walkPose(0.5);
    assert(
      oppositeContact.leftFoot.z > oppositeContact.rightFoot.z + 0.05,
      "行走方向错误：半周期后左脚没有前触地",
    );
    const rightSwing = walkPose(0.75);
    assert(
      rightSwing.rightFoot.y > rightSwing.leftFoot.y + 0.015,
      "行走相位错误：右脚向前摆时没有抬起",
    );
    assert.equal(walk.tracks.length, 21);
    for (const track of walk.tracks) {
      const s = track.getValueSize();
      for (let k = 0; k < s; k++)
        assert(
          Math.abs(
            track.values[k] - track.values[track.values.length - s + k],
          ) < 1e-5,
          "动画未闭环",
        );
    }
    a.dispose();
    console.log(
      `${outfit.padEnd(7)} ${variant.height}m / build ${variant.build} | body ${triCount(data.body)} tris | final ${triCount(data.surface)} tris | topology + weights + 96 pose samples PASS`,
    );
  }
assert(new Set(skeletonMaps).size === 1, "职业或体型改变了骨架语义");

// DIY 回归：弓手预设必须可以换成农户草帽，同时保留弓和箭袋。
const diyArcher = makeCharacter({
  outfit: "archer",
  equipment: true,
  preset: "custom",
  slots: { headwear: "farmer_straw_hat" },
});
assert.equal(diyArcher.recipe.preset, "custom");
assert.equal(diyArcher.recipe.slots.headwear, "farmer_straw_hat");
assert.equal(diyArcher.recipe.slots.leftHand, "archer_bow");
assert.equal(diyArcher.recipe.slots.back, "archer_quiver");
assert(
  diyArcher.surface.vertices.some((vertex) => vertex.id === "StrawPeak"),
  "DIY 草帽没有生成",
);
assert(
  diyArcher.surface.vertices.some((vertex) => vertex.id.startsWith("Bow.")),
  "DIY 后弓丢失",
);
assert(
  diyArcher.surface.vertices.some((vertex) => vertex.id.startsWith("Quiver.")),
  "DIY 后箭袋丢失",
);
assert(
  !diyArcher.surface.vertices.some((vertex) => vertex.id.startsWith("HeadbandA")),
  "DIY 草帽与原弓手头巾重复生成",
);

// Combat Action Layer：只覆盖定义的 Bone Mask，不重做人体或腿部动画。
for (const definition of Object.values(ACTION_DEFINITIONS)) {
  assert.equal(
    new Set(definition.boneMask).size,
    definition.boneMask.length,
    `Action Bone Mask 重复：${definition.id}`,
  );

  for (const bone of definition.boneMask) {
    assert(Number.isInteger(bone) && bone >= 0 && bone < 20);
  }

  assert(
    !definition.boneMask.includes(B.RightThigh) &&
      !definition.boneMask.includes(B.RightShin) &&
      !definition.boneMask.includes(B.RightFoot) &&
      !definition.boneMask.includes(B.LeftThigh) &&
      !definition.boneMask.includes(B.LeftShin) &&
      !definition.boneMask.includes(B.LeftFoot),
    `上半身 Action 错误覆盖腿部：${definition.id}`,
  );
}

const archerData = makeCharacter({ outfit: "archer", equipment: true });
assert(actionAvailable(archerData.recipe, "bowShot"));
assert(!actionAvailable(archerData.recipe, "swordSlash"));
assert(
  archerData.surface.vertices.some(
    (vertex) =>
      vertex.id.startsWith("BowstringTop.End") &&
      vertex.w[0] === B.RightHand,
  ),
  "弓弦中点没有绑定右手拉弦骨骼",
);

const guardData = makeCharacter({ outfit: "guard", equipment: true });
assert(actionAvailable(guardData.recipe, "swordSlash"));
assert(actionAvailable(guardData.recipe, "shieldGuard"));
assert(!actionAvailable(guardData.recipe, "bowShot"));

function validateCombatAction(
  data: ReturnType<typeof makeCharacter>,
  actionId: Exclude<CombatActionId, "none">,
) {
  const actor = makeActor(data);
  const geometry = actor.mesh.geometry;
  const position = geometry.attributes.position;
  const index = geometry.getIndex()!;
  const point = new T.Vector3();
  const coords: Vec3[] = [];

  actor.setMotion("walk");
  actor.seek(actor.clips.walk.duration * 0.25);

  const rightThighBefore = actor.bones[B.RightThigh].quaternion.clone();
  const leftThighBefore = actor.bones[B.LeftThigh].quaternion.clone();

  actor.setCombatAction(actionId);
  actor.setCombatPlaying(false);

  assert.equal(
    actor.actionClips[actionId].tracks.length,
    ACTION_DEFINITIONS[actionId].boneMask.length,
    `Action Track 数量不等于 Bone Mask：${actionId}`,
  );

  for (const track of actor.actionClips[actionId].tracks) {
    assert(
      !track.name.startsWith("RightThigh") &&
        !track.name.startsWith("LeftThigh") &&
        !track.name.startsWith("Hips"),
      `Action Clip 写入了下半身：${actionId} / ${track.name}`,
    );
  }

  for (let frame = 0; frame < 12; frame++) {
    const phase = frame / 12;

    actor.setCombatPhase(phase);
    actor.update(0, 0);
    actor.mesh.updateMatrixWorld(true);
    actor.skeleton.update();

    coords.length = 0;

    for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex++) {
      actor.mesh.getVertexPosition(vertexIndex, point);

      assert(
        [point.x, point.y, point.z].every(Number.isFinite),
        `Combat 顶点非法：${actionId} / ${frame}`,
      );

      coords.push([point.x, point.y, point.z]);
    }

    for (let offset = 0; offset < index.count; offset += 3) {
      const a = coords[index.getX(offset)];
      const b = coords[index.getX(offset + 1)];
      const c = coords[index.getX(offset + 2)];

      assert(
        Math.hypot(...cross(sub(b, a), sub(c, a))) > 1e-11,
        `Combat 动作产生退化三角形：${actionId} / ${frame}`,
      );
    }
  }

  const rightThighDelta =
    actor.bones[B.RightThigh].quaternion.angleTo(rightThighBefore);
  const leftThighDelta =
    actor.bones[B.LeftThigh].quaternion.angleTo(leftThighBefore);

  console.log(
    `combat ${actionId.padEnd(11)} | leg delta R=${rightThighDelta.toExponential(3)} L=${leftThighDelta.toExponential(3)}`,
  );

  assert(
    rightThighDelta < 5e-4,
    `Action 覆盖了右腿：${actionId} / ${rightThighDelta}`,
  );
  assert(
    leftThighDelta < 5e-4,
    `Action 覆盖了左腿：${actionId} / ${leftThighDelta}`,
  );

  actor.dispose();
}

validateCombatAction(archerData, "bowShot");
validateCombatAction(guardData, "swordSlash");
validateCombatAction(guardData, "shieldGuard");

const aimActor = makeActor(archerData);
aimActor.setMotion("bind");
aimActor.seek(0);
aimActor.setCombatAction("bowShot");
aimActor.setCombatPlaying(false);
aimActor.setCombatPhase(0.62);
aimActor.setAim(22, 15);
aimActor.update(0, 0);

const aimedChest = aimActor.bones[B.Chest].quaternion.clone();
const aimedRightThigh = aimActor.bones[B.RightThigh].quaternion.clone();

aimActor.setAim(22, 15);
aimActor.update(0, 0);

assert(
  aimActor.bones[B.Chest].quaternion.angleTo(aimedChest) < 1e-5,
  "Aim Overlay 重复应用后发生累积漂移",
);
assert(
  aimActor.bones[B.RightThigh].quaternion.angleTo(aimedRightThigh) < 1e-5,
  "Aim Overlay 影响了腿部",
);
aimActor.dispose();

const legacyFarmerWithHoe = makeCharacter({
  outfit: "farmer",
  equipment: true,
});
assert.equal(
  legacyFarmerWithHoe.recipe.slots.rightHand,
  "farmer_hoe",
  "V3 农户 equipment=true 没有迁移为锄头",
);

assert.equal(cleanRecipe({ height: NaN, build: Infinity }).height, 1.76);
console.log(
  `PASS: 12 character variants, ${frames} posed-frame checks, real-edge garment anchors, closed continuous base body, fixed rig, <=2 weights, runtime-only geometry + layered combat actions.`,
);
