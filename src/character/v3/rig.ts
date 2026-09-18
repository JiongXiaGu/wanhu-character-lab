import * as T from "three";
import { B, type CharacterData, type Joint, type Motion } from "./types";
import {
  ACTION_DEFINITIONS,
  type CombatActionId,
  clampActionPhase,
} from "./actions";
import { polygonNormal, edgeKey } from "./cage";

type EulerTuple = [number, number, number];
type Pose = Record<number, EulerTuple>;

interface PoseKey {
  phase: number;
  pose: Partial<Pose>;
}

export interface Actor {
  mesh: T.SkinnedMesh;
  skeleton: T.Skeleton;
  bones: T.Bone[];
  mixer: T.AnimationMixer;
  clips: Record<Motion, T.AnimationClip>;
  actionClips: Record<CombatActionId, T.AnimationClip>;
  action: T.AnimationAction;
  combatActionId: CombatActionId;
  wire: T.LineSegments;
  bowString: T.LineSegments;
  bowArrow: T.LineSegments;
  skeletonHelper: T.SkeletonHelper;
  data: CharacterData;
  setMotion: (m: Motion) => void;
  setCombatAction: (id: CombatActionId) => void;
  setCombatPhase: (phase: number) => void;
  setCombatPlaying: (playing: boolean) => void;
  setCombatSpeed: (speed: number) => void;
  setAim: (yawDegrees: number, pitchDegrees: number) => void;
  getCombatPhase: () => number;
  update: (motionDt: number, combatDt?: number) => void;
  dispose: () => void;
  seek: (time: number) => void;
}

/** GPU 蒙皮采用 Three.js 官方 SkinnedMesh 路径。逻辑顶点和渲染法线拆点分别计数。 */
export function makeActor(data: CharacterData): Actor {
  const p: number[] = [],
    n: number[] = [],
    col: number[] = [],
    si: number[] = [],
    sw: number[] = [],
    ix: number[] = [];

  const c = data.surface;
  const color = new T.Color();

  for (const f of c.faces) {
    const start = p.length / 3;
    const normal = polygonNormal(c, f);

    color.set(f.color ?? "#b79773");

    for (const vi of f.v) {
      const v = c.vertices[vi];

      p.push(...v.p);
      n.push(...normal);
      col.push(color.r, color.g, color.b);
      si.push(v.w[0], v.w[1], 0, 0);
      sw.push(v.w[2], 1 - v.w[2], 0, 0);
    }

    for (let i = 1; i < f.v.length - 1; i++) {
      ix.push(start, start + i, start + i + 1);
    }
  }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  geometry.setAttribute("normal", new T.Float32BufferAttribute(n, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(col, 3));
  geometry.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
  geometry.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
  geometry.setIndex(ix);

  const material = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });

  const mesh = new T.SkinnedMesh(geometry, material);
  mesh.name = "WanhuCharacter";
  mesh.castShadow = true;
  mesh.receiveShadow = false;

  const bones = data.joints.map((joint) => {
    const bone = new T.Bone();
    bone.name = joint.name;
    return bone;
  });

  data.joints.forEach((joint, index) => {
    const parent =
      joint.parent < 0 ? [0, 0, 0] : data.joints[joint.parent].p;

    bones[index].position.set(
      joint.p[0] - parent[0],
      joint.p[1] - parent[1],
      joint.p[2] - parent[2],
    );

    if (joint.parent >= 0) {
      bones[joint.parent].add(bones[index]);
    } else {
      mesh.add(bones[index]);
    }
  });

  mesh.updateMatrixWorld(true);

  const skeleton = new T.Skeleton(bones);
  mesh.bind(skeleton);
  mesh.normalizeSkinWeights();

  mesh.boundingSphere = new T.Sphere(
    new T.Vector3(0, data.recipe.height * 0.5, 0),
    data.recipe.height * 1.4,
  );

  const mixer = new T.AnimationMixer(mesh);
  const clips = makeClips(data.joints);
  const actionClips = makeCombatClips(data.joints);

  let motionAction = mixer.clipAction(clips.idle);
  motionAction.play();

  let combatActionId: CombatActionId = "none";
  let combatPhase = 0;
  let combatPlaying = false;
  let combatSpeed = 1;
  let aimYaw = 0;
  let aimPitch = 0;

  const edges = new Map<string, [number, number]>();

  for (const f of c.faces) {
    f.v.forEach((vertexIndex, index) => {
      const next = f.v[(index + 1) % f.v.length];
      edges.set(edgeKey(vertexIndex, next), [vertexIndex, next]);
    });
  }

  const edgeList = [...edges.values()];
  const wireGeo = new T.BufferGeometry();
  const wirePositions = new Float32Array(edgeList.length * 6);

  wireGeo.setAttribute(
    "position",
    new T.BufferAttribute(wirePositions, 3).setUsage(T.DynamicDrawUsage),
  );

  const wireMat = new T.LineBasicMaterial({
    color: "#1d2522",
    transparent: true,
    opacity: 0.75,
    depthTest: true,
  });

  const wire = new T.LineSegments(wireGeo, wireMat);
  wire.visible = false;
  wire.renderOrder = 2;
  wire.frustumCulled = false;

  const bowStringPositions = new Float32Array(12);
  const bowStringGeo = new T.BufferGeometry();
  bowStringGeo.setAttribute(
    "position",
    new T.BufferAttribute(bowStringPositions, 3).setUsage(T.DynamicDrawUsage),
  );
  const bowStringMat = new T.LineBasicMaterial({
    color: "#ddcfb1",
    transparent: true,
    opacity: 0.92,
    depthTest: true,
  });
  const bowString = new T.LineSegments(bowStringGeo, bowStringMat);
  bowString.renderOrder = 3;
  bowString.frustumCulled = false;

  const bowArrowPositions = new Float32Array(6);
  const bowArrowGeo = new T.BufferGeometry();
  bowArrowGeo.setAttribute(
    "position",
    new T.BufferAttribute(bowArrowPositions, 3).setUsage(T.DynamicDrawUsage),
  );
  const bowArrowMat = new T.LineBasicMaterial({
    color: "#c4aa72",
    depthTest: true,
  });
  const bowArrow = new T.LineSegments(bowArrowGeo, bowArrowMat);
  bowArrow.renderOrder = 3;
  bowArrow.frustumCulled = false;

  const helper = new T.SkeletonHelper(mesh);
  helper.visible = false;
  helper.renderOrder = 4;
  (helper.material as T.LineBasicMaterial).depthTest = false;

  const skinned = c.vertices.map(() => new T.Vector3());
  const temp = new T.Vector3();
  const matrices = bones.map(() => new T.Matrix4());

  const averageBindPoint = (prefix: string): T.Vector3 => {
    const matches = c.vertices.filter((vertex) => vertex.id.startsWith(prefix));

    if (matches.length === 0) {
      return new T.Vector3();
    }

    const center = new T.Vector3();

    for (const vertexData of matches) {
      center.add(new T.Vector3().fromArray(vertexData.p));
    }

    return center.multiplyScalar(1 / matches.length);
  };

  const bowTopBind = averageBindPoint("Bow.0.");
  const bowBottomBind = averageBindPoint("Bow.6.");
  const rightFingersBind = averageBindPoint("RightFingers.");
  const hasBow = data.recipe.slots.leftHand === "archer_bow";

  const setBoneToward = (
    boneIndex: number,
    childIndex: number,
    targetWorld: T.Vector3,
    blend: number,
  ) => {
    mesh.updateMatrixWorld(true);

    const bone = bones[boneIndex];
    const parent = bone.parent;

    if (!parent) return;

    const boneWorld = bone.getWorldPosition(new T.Vector3());
    const parentWorld = parent.getWorldQuaternion(new T.Quaternion());
    const desiredWorldDirection = targetWorld
      .clone()
      .sub(boneWorld)
      .normalize();
    const desiredParentDirection = desiredWorldDirection.applyQuaternion(
      parentWorld.clone().invert(),
    );
    const bindDirection = bones[childIndex].position.clone().normalize();
    const desiredLocal = new T.Quaternion().setFromUnitVectors(
      bindDirection,
      desiredParentDirection,
    );

    bone.quaternion.slerp(desiredLocal, blend);
    mesh.updateMatrixWorld(true);
  };

  const setBoneWorldRotation = (
    boneIndex: number,
    worldRotation: T.Quaternion,
    blend: number,
  ) => {
    const bone = bones[boneIndex];
    const parent = bone.parent;

    if (!parent) return;

    const parentWorld = parent.getWorldQuaternion(new T.Quaternion());
    const desiredLocal = parentWorld
      .clone()
      .invert()
      .multiply(worldRotation);

    bone.quaternion.slerp(desiredLocal, blend);
    mesh.updateMatrixWorld(true);
  };

  const solveTwoBone = (
    upperIndex: number,
    lowerIndex: number,
    handIndex: number,
    targetWorld: T.Vector3,
    poleDirectionWorld: T.Vector3,
    blend: number,
  ) => {
    mesh.updateMatrixWorld(true);

    const shoulder = bones[upperIndex].getWorldPosition(new T.Vector3());
    const l1 = bones[lowerIndex].position.length();
    const l2 = bones[handIndex].position.length();
    const toTarget = targetWorld.clone().sub(shoulder);
    const rawDistance = toTarget.length();

    if (rawDistance < 1e-5) return;

    const distance = T.MathUtils.clamp(
      rawDistance,
      Math.abs(l1 - l2) + 1e-4,
      l1 + l2 - 1e-4,
    );
    const direction = toTarget.normalize();

    let pole = poleDirectionWorld
      .clone()
      .addScaledVector(
        direction,
        -poleDirectionWorld.dot(direction),
      );

    if (pole.lengthSq() < 1e-6) {
      pole = new T.Vector3(1, 0, 0).addScaledVector(
        direction,
        -direction.x,
      );
    }

    pole.normalize();

    const along =
      (l1 * l1 - l2 * l2 + distance * distance) /
      (2 * distance);
    const height = Math.sqrt(
      Math.max(0, l1 * l1 - along * along),
    );
    const elbow = shoulder
      .clone()
      .addScaledVector(direction, along)
      .addScaledVector(pole, height);

    setBoneToward(
      upperIndex,
      lowerIndex,
      elbow,
      blend,
    );
    setBoneToward(
      lowerIndex,
      handIndex,
      targetWorld,
      blend,
    );
  };

  const bowEnvelope = (phase: number): number => {
    if (phase < 0.18) return smooth(phase / 0.18);
    if (phase < 0.82) return 1;
    return smooth((1 - phase) / 0.18);
  };

  const bowDrawAmount = (phase: number): number => {
    if (phase < 0.18) return 0;
    if (phase < 0.52) return smooth((phase - 0.18) / 0.34);
    if (phase < 0.72) return 1;
    if (phase < 0.82) {
      return 1 - smooth((phase - 0.72) / 0.1);
    }
    return 0;
  };

  const aimRotation = (): T.Quaternion => {
    const yaw = T.MathUtils.degToRad(aimYaw);
    const pitch = T.MathUtils.degToRad(aimPitch);

    return new T.Quaternion().setFromEuler(
      new T.Euler(-pitch, yaw, 0, "YXZ"),
    );
  };

  const applyBowPose = () => {
    const weight = bowEnvelope(combatPhase);

    if (weight <= 1e-5) return;

    const drawAmount = bowDrawAmount(combatPhase);
    const aim = aimRotation();
    const scale = data.recipe.height / 1.76;

    // Action 只轻微接管胸、颈和头；腿部完全保留 locomotion。
    const addLocalRotation = (
      boneIndex: number,
      x: number,
      y: number,
      z: number,
    ) => {
      const rotation = new T.Quaternion().setFromEuler(
        new T.Euler(x, y, z, "XYZ"),
      );
      const weighted = new T.Quaternion().slerp(rotation, weight);
      bones[boneIndex].quaternion.multiply(weighted);
    };

    const yaw = T.MathUtils.degToRad(aimYaw);
    const pitch = T.MathUtils.degToRad(aimPitch);

    addLocalRotation(B.Chest, -pitch * 0.12, yaw * 0.22, 0);
    addLocalRotation(B.Neck, -pitch * 0.16, yaw * 0.14, 0);
    addLocalRotation(B.Head, -pitch * 0.22, yaw * 0.24, 0);

    // 让锁骨回到稳定的射箭肩线，随后再由 IK 解双臂。
    bones[B.LeftClavicle].quaternion.slerp(
      new T.Quaternion(),
      weight,
    );
    bones[B.RightClavicle].quaternion.slerp(
      new T.Quaternion(),
      weight,
    );

    mesh.updateMatrixWorld(true);

    const chest = bones[B.Chest].getWorldPosition(new T.Vector3());

    const rotateOffset = (x: number, y: number, z: number) =>
      new T.Vector3(x * scale, y * scale, z * scale)
        .applyQuaternion(aim)
        .add(chest);

    const bowHandTarget = rotateOffset(-0.1, 0.16, 0.47);
    const stringReady = rotateOffset(0.015, 0.17, 0.425);
    const drawHand = rotateOffset(0.115, 0.285, 0.085);
    const releaseHand = rotateOffset(0.18, 0.285, 0.07);

    const releaseAmount =
      combatPhase <= 0.72
        ? 0
        : combatPhase < 0.82
          ? smooth((combatPhase - 0.72) / 0.1)
          : 1;

    const rightTarget = stringReady
      .clone()
      .lerp(drawHand, drawAmount)
      .lerp(releaseHand, releaseAmount);

    const leftPole = new T.Vector3(-1, 0.18, 0)
      .applyQuaternion(aim)
      .normalize();
    const rightPole = new T.Vector3(1, 0.3, -0.06)
      .applyQuaternion(aim)
      .normalize();

    solveTwoBone(
      B.LeftUpperArm,
      B.LeftForearm,
      B.LeftHand,
      bowHandTarget,
      leftPole,
      weight,
    );
    solveTwoBone(
      B.RightUpperArm,
      B.RightForearm,
      B.RightHand,
      rightTarget,
      rightPole,
      weight,
    );

    // 弓的建模平面在 Bind Pose 面向 +Z；保持它随瞄准方向旋转且竖直。
    setBoneWorldRotation(B.LeftHand, aim, weight);
  };

  const applyCombatPose = () => {
    if (combatActionId === "none") return;

    if (combatActionId === "bowShot") {
      applyBowPose();
      return;
    }

    const definition = ACTION_DEFINITIONS[combatActionId];
    const pose = samplePose(
      actionKeys(combatActionId),
      definition.boneMask,
      combatPhase,
    );
    const quaternion = new T.Quaternion();

    for (const boneIndex of definition.boneMask) {
      const angles = (pose[boneIndex] ?? [0, 0, 0]) as EulerTuple;
      quaternion.setFromEuler(new T.Euler(...angles, "XYZ"));
      bones[boneIndex].quaternion.copy(quaternion);
    }
  };

  const updateBowLines = () => {
    bowString.visible = hasBow;
    bowArrow.visible =
      hasBow &&
      combatActionId === "bowShot" &&
      combatPhase >= 0.18 &&
      combatPhase < 0.82;

    if (!hasBow) return;

    mesh.updateMatrixWorld(true);
    skeleton.update();

    const leftMatrix = new T.Matrix4().multiplyMatrices(
      bones[B.LeftHand].matrixWorld,
      skeleton.boneInverses[B.LeftHand],
    );
    const rightMatrix = new T.Matrix4().multiplyMatrices(
      bones[B.RightHand].matrixWorld,
      skeleton.boneInverses[B.RightHand],
    );

    const top = bowTopBind.clone().applyMatrix4(leftMatrix);
    const bottom = bowBottomBind.clone().applyMatrix4(leftMatrix);
    const midpoint = top.clone().add(bottom).multiplyScalar(0.5);
    const rightGrip = rightFingersBind.clone().applyMatrix4(rightMatrix);
    const draw =
      combatActionId === "bowShot"
        ? bowDrawAmount(combatPhase)
        : 0;
    const nock = midpoint.clone().lerp(rightGrip, draw);

    top.toArray(bowStringPositions, 0);
    nock.toArray(bowStringPositions, 3);
    nock.toArray(bowStringPositions, 6);
    bottom.toArray(bowStringPositions, 9);
    bowStringGeo.attributes.position.needsUpdate = true;

    if (bowArrow.visible) {
      const direction = new T.Vector3(0, 0, 1).applyQuaternion(
        aimRotation(),
      );
      const arrowTip = midpoint
        .clone()
        .addScaledVector(direction, 0.55 * scale);

      nock.toArray(bowArrowPositions, 0);
      arrowTip.toArray(bowArrowPositions, 3);
      bowArrowGeo.attributes.position.needsUpdate = true;
    }
  };

  const debug = () => {
    mesh.updateMatrixWorld(true);
    skeleton.update();
    updateBowLines();

    if (!wire.visible) return;

    for (let i = 0; i < bones.length; i++) {
      matrices[i].multiplyMatrices(
        bones[i].matrixWorld,
        skeleton.boneInverses[i],
      );
    }

    c.vertices.forEach((vertexData, index) => {
      skinned[index]
        .fromArray(vertexData.p)
        .applyMatrix4(matrices[vertexData.w[0]])
        .multiplyScalar(vertexData.w[2]);

      temp
        .fromArray(vertexData.p)
        .applyMatrix4(matrices[vertexData.w[1]])
        .multiplyScalar(1 - vertexData.w[2]);

      skinned[index].add(temp);
    });

    edgeList.forEach(([a, b], index) => {
      skinned[a].toArray(wirePositions, index * 6);
      skinned[b].toArray(wirePositions, index * 6 + 3);
    });

    wireGeo.attributes.position.needsUpdate = true;
  };

  const refreshPose = () => {
    mixer.update(0);
    applyCombatPose();
    debug();
  };

  const actor: Actor = {
    mesh,
    skeleton,
    bones,
    mixer,
    clips,
    actionClips,
    action: motionAction,
    combatActionId,
    wire,
    bowString,
    bowArrow,
    skeletonHelper: helper,
    data,

    setMotion(motion) {
      const next = mixer.clipAction(clips[motion]);

      if (next === motionAction) return;

      motionAction.fadeOut(0.18);
      next.reset().fadeIn(0.18).play();
      motionAction = next;
      actor.action = motionAction;
    },

    setCombatAction(id) {
      if (id === combatActionId) return;

      combatActionId = id;
      combatPhase = 0;
      actor.combatActionId = id;
      refreshPose();
    },

    setCombatPhase(phase) {
      combatPhase = clampActionPhase(phase);
      refreshPose();
    },

    setCombatPlaying(playing) {
      combatPlaying = playing;
    },

    setCombatSpeed(speed) {
      combatSpeed = Number.isFinite(speed)
        ? Math.max(0.1, Math.min(3, speed))
        : 1;
    },

    setAim(yawDegrees, pitchDegrees) {
      aimYaw = Math.max(-45, Math.min(45, yawDegrees));
      aimPitch = Math.max(-45, Math.min(45, pitchDegrees));
      refreshPose();
    },

    getCombatPhase() {
      return combatPhase;
    },

    update(motionDt, combatDt = motionDt) {
      mixer.update(motionDt);

      if (combatPlaying && combatActionId !== "none") {
        const duration = ACTION_DEFINITIONS[combatActionId].duration;
        combatPhase =
          (combatPhase + (combatDt * combatSpeed) / duration) % 1;
      }

      applyCombatPose();
        debug();
    },

    seek(time) {
      mixer.stopAllAction();
      motionAction.reset().play();
      motionAction.time = time % motionAction.getClip().duration;
      mixer.update(0);
      applyCombatPose();
        debug();
    },

    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(mesh);
      geometry.dispose();
      material.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      bowStringGeo.dispose();
      bowStringMat.dispose();
      bowArrowGeo.dispose();
      bowArrowMat.dispose();
      helper.geometry.dispose();
      (helper.material as T.Material).dispose();
      skeleton.dispose();
    },
  };

  actor.update(0);
  return actor;
}

export const MOTION_LABELS: Record<Motion, string> = {
  idle: "待机",
  walk: "行走",
  run: "慢跑",
  wave: "招手",
  squat: "屈膝",
  bind: "基准 A 姿态",
};

function neutralUpperPose(): Pose {
  return {
    [B.Spine]: [0, 0, 0],
    [B.Chest]: [0, 0, 0],
    [B.Neck]: [0, 0, 0],
    [B.Head]: [0, 0, 0],

    [B.RightClavicle]: [0, 0, 0],
    [B.RightUpperArm]: [0, 0, -0.37],
    [B.RightForearm]: [-0.06, 0, 0],
    [B.RightHand]: [0, 0, 0],

    [B.LeftClavicle]: [0, 0, 0],
    [B.LeftUpperArm]: [0, 0, 0.37],
    [B.LeftForearm]: [-0.06, 0, 0],
    [B.LeftHand]: [0, 0, 0],
  };
}

function clonePose(source: Pose): Pose {
  return Object.fromEntries(
    Object.entries(source).map(([bone, value]) => [
      Number(bone),
      [...value] as EulerTuple,
    ]),
  );
}

function poseWith(
  base: Pose,
  patch: Partial<Record<number, EulerTuple>>,
): Pose {
  const result = clonePose(base);

  for (const [bone, value] of Object.entries(patch)) {
    if (!value) continue;
    result[Number(bone)] = [...value] as EulerTuple;
  }

  return result;
}

function smooth(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function samplePose(
  keys: readonly PoseKey[],
  mask: readonly number[],
  phase: number,
): Pose {
  const value = clampActionPhase(phase);

  let left = keys[0];
  let right = keys[keys.length - 1];

  for (let i = 0; i < keys.length - 1; i++) {
    if (value >= keys[i].phase && value <= keys[i + 1].phase) {
      left = keys[i];
      right = keys[i + 1];
      break;
    }
  }

  const range = Math.max(0.00001, right.phase - left.phase);
  const t = smooth((value - left.phase) / range);
  const result: Pose = {};

  for (const bone of mask) {
    const a = left.pose[bone] ?? [0, 0, 0];
    const b = right.pose[bone] ?? a;

    result[bone] = [
      T.MathUtils.lerp(a[0], b[0], t),
      T.MathUtils.lerp(a[1], b[1], t),
      T.MathUtils.lerp(a[2], b[2], t),
    ];
  }

  return result;
}

function actionKeys(id: CombatActionId): PoseKey[] {
  const neutral = neutralUpperPose();

  if (id === "bowShot") {
    const raise = poseWith(neutral, {
      [B.Chest]: [-0.02, 0.04, 0],
      [B.LeftClavicle]: [0, 0.06, 0.1],
      [B.LeftUpperArm]: [-0.95, 0.02, 0.28],
      [B.LeftForearm]: [-0.2, 0, 0.03],
      [B.RightClavicle]: [0, -0.06, -0.08],
      [B.RightUpperArm]: [-0.7, -0.1, -0.55],
      [B.RightForearm]: [-0.65, 0.08, 0.18],
    });

    const draw = poseWith(neutral, {
      [B.Spine]: [0, 0.04, 0],
      [B.Chest]: [-0.04, 0.14, 0],
      [B.Neck]: [0, -0.03, 0],
      [B.Head]: [0, -0.06, 0],

      [B.LeftClavicle]: [-0.04, 0.08, 0.16],
      [B.LeftUpperArm]: [-1.42, 0.02, 0.18],
      [B.LeftForearm]: [-0.14, 0.02, -0.02],
      [B.LeftHand]: [0, 0.02, 0],

      [B.RightClavicle]: [0.02, -0.14, -0.12],
      [B.RightUpperArm]: [-1.08, -0.15, -0.88],
      [B.RightForearm]: [-1.34, 0.16, 0.42],
      [B.RightHand]: [-0.12, 0.04, 0.1],
    });

    const release = poseWith(draw, {
      [B.RightUpperArm]: [-1.28, -0.08, -0.48],
      [B.RightForearm]: [-0.42, 0.08, 0.12],
      [B.RightHand]: [0.1, 0, -0.05],
      [B.Chest]: [-0.03, 0.11, 0],
    });

    return [
      { phase: 0, pose: neutral },
      { phase: 0.18, pose: raise },
      { phase: 0.52, pose: draw },
      { phase: 0.72, pose: draw },
      { phase: 0.79, pose: release },
      { phase: 0.88, pose: release },
      { phase: 0.999, pose: neutral },
    ];
  }

  if (id === "swordSlash") {
    const windup = poseWith(neutral, {
      [B.Spine]: [0, -0.1, 0],
      [B.Chest]: [-0.04, -0.26, 0],
      [B.Head]: [0, 0.08, 0],
      [B.RightClavicle]: [0, -0.12, -0.18],
      [B.RightUpperArm]: [0.15, -0.2, -1.0],
      [B.RightForearm]: [-1.05, 0.08, 0.12],
      [B.RightHand]: [-0.2, 0, 0.22],
    });

    const strike = poseWith(neutral, {
      [B.Spine]: [0, 0.12, 0],
      [B.Chest]: [-0.08, 0.34, -0.05],
      [B.Head]: [0, -0.1, 0],
      [B.RightClavicle]: [-0.04, 0.12, 0.12],
      [B.RightUpperArm]: [-1.0, 0.1, 0.38],
      [B.RightForearm]: [-0.34, -0.04, -0.16],
      [B.RightHand]: [0.18, 0, -0.18],
    });

    const follow = poseWith(neutral, {
      [B.Chest]: [-0.05, 0.18, -0.03],
      [B.RightUpperArm]: [-0.78, 0.08, 0.62],
      [B.RightForearm]: [-0.26, -0.02, -0.12],
      [B.RightHand]: [0.12, 0, -0.12],
    });

    return [
      { phase: 0, pose: neutral },
      { phase: 0.22, pose: windup },
      { phase: 0.55, pose: strike },
      { phase: 0.72, pose: follow },
      { phase: 0.999, pose: neutral },
    ];
  }

  if (id === "shieldGuard") {
    const guard = poseWith(neutral, {
      [B.Spine]: [0, -0.04, 0],
      [B.Chest]: [-0.05, -0.12, 0],
      [B.Head]: [0, 0.06, 0],
      [B.LeftClavicle]: [-0.03, -0.1, 0.12],
      [B.LeftUpperArm]: [-0.92, -0.04, 0.64],
      [B.LeftForearm]: [-1.06, 0.08, -0.22],
      [B.LeftHand]: [-0.08, 0, 0.05],
    });

    return [
      { phase: 0, pose: neutral },
      { phase: 0.28, pose: guard },
      { phase: 0.78, pose: guard },
      { phase: 0.999, pose: neutral },
    ];
  }

  return [
    { phase: 0, pose: {} },
    { phase: 0.999, pose: {} },
  ];
}

function makeCombatClips(
  joints: Joint[],
): Record<CombatActionId, T.AnimationClip> {
  const result = {} as Record<CombatActionId, T.AnimationClip>;
  const q = new T.Quaternion();

  for (const id of Object.keys(ACTION_DEFINITIONS) as CombatActionId[]) {
    const definition = ACTION_DEFINITIONS[id];

    if (id === "none") {
      result[id] = new T.AnimationClip(id, 1, []);
      continue;
    }

    const count = Math.max(2, Math.round(definition.duration * 30));
    const times: number[] = [];
    const rotations = new Map<number, number[]>();

    for (const bone of definition.boneMask) {
      rotations.set(bone, []);
    }

    const keys = actionKeys(id);

    for (let frame = 0; frame <= count; frame++) {
      const phase = frame / count;
      const pose = samplePose(keys, definition.boneMask, phase);

      times.push(phase * definition.duration);

      for (const bone of definition.boneMask) {
        const angles = (pose[bone] ?? [0, 0, 0]) as EulerTuple;

        q.setFromEuler(new T.Euler(...angles, "XYZ"));
        rotations.get(bone)!.push(q.x, q.y, q.z, q.w);
      }
    }

    const tracks = definition.boneMask.map(
      (bone) =>
        new T.QuaternionKeyframeTrack(
          `${joints[bone].name}.quaternion`,
          times,
          rotations.get(bone)!,
        ),
    );

    result[id] = new T.AnimationClip(id, definition.duration, tracks);
  }

  return result;
}

/** 只在构建角色时采样 Clip；运行时不重建 Mesh，不逐帧改顶点。 */
function makeClips(joints: Joint[]): Record<Motion, T.AnimationClip> {
  const result = {} as Record<Motion, T.AnimationClip>;
  const q = new T.Quaternion();
  const scale = joints[B.Head].p[1] / 1.52;

  for (const name of Object.keys(MOTION_LABELS) as Motion[]) {
    const duration =
      name === "walk"
        ? 1.1
        : name === "run"
          ? 0.72
          : name === "bind"
            ? 1
            : 3.2;

    const count = Math.round(duration * 30);
    const times: number[] = [];
    const rot = joints.map(() => [] as number[]);
    const hips: number[] = [];

    for (let frame = 0; frame <= count; frame++) {
      const phase = frame / count;
      const t = phase * Math.PI * 2;

      times.push(phase * duration);

      const angles = joints.map(() => [0, 0, 0]);
      let dy = 0;

      if (name !== "bind") {
        angles[B.RightUpperArm][2] = -0.37;
        angles[B.LeftUpperArm][2] = 0.37;
        angles[B.RightForearm][0] = -0.06;
        angles[B.LeftForearm][0] = -0.06;

        if (name === "idle") {
          dy = 0.002 * Math.sin(t);
          angles[B.Chest][0] = 0.014 * Math.sin(t);
          angles[B.Head][1] = 0.04 * Math.sin(t);
        }

        if (name === "walk" || name === "run" || name === "squat") {
          const squat = name === "squat" ? (1 - Math.cos(t)) * 0.5 : 0;

          dy =
            name === "squat"
              ? -0.25 * squat
              : name === "run"
                ? -0.055 + 0.012 * Math.cos(t * 2)
                : -0.026 + 0.006 * Math.cos(t * 2);

          for (const [thigh, shin, foot, side] of [
            [B.RightThigh, B.RightShin, B.RightFoot, 1],
            [B.LeftThigh, B.LeftShin, B.LeftFoot, -1],
          ]) {
            const local = t + (side === 1 ? 0 : Math.PI);
            const stride = name === "run" ? 0.22 : 0.14;
            const z =
              name === "squat" ? 0 : Math.cos(local) * stride * scale;
            const lift =
              name === "squat"
                ? 0
                : Math.max(0, -Math.sin(local)) *
                  (name === "run" ? 0.105 : 0.045) *
                  scale;

            const l1 = joints[thigh].p[1] - joints[shin].p[1];
            const l2 = joints[shin].p[1] - joints[foot].p[1];
            const down = l1 + l2 + dy * scale - lift;
            const distance = Math.min(
              l1 + l2 - 0.00001,
              Math.hypot(down, z),
            );

            const hipAngle = Math.acos(
              T.MathUtils.clamp(
                (l1 * l1 + distance * distance - l2 * l2) /
                  (2 * l1 * distance),
                -1,
                1,
              ),
            );

            const kneeAngle =
              Math.PI -
              Math.acos(
                T.MathUtils.clamp(
                  (l1 * l1 + l2 * l2 - distance * distance) /
                    (2 * l1 * l2),
                  -1,
                  1,
                ),
              );

            angles[thigh][0] = -Math.atan2(z, down) - hipAngle;
            angles[shin][0] = kneeAngle;
            angles[foot][0] = -angles[thigh][0] - kneeAngle;
          }

          if (name === "squat") {
            angles[B.Chest][0] = 0.18 * squat;
            angles[B.RightUpperArm][0] = -0.45 * squat;
            angles[B.LeftUpperArm][0] = -0.45 * squat;
          } else {
            angles[B.RightUpperArm][0] = 0.32 * Math.cos(t);
            angles[B.LeftUpperArm][0] = -0.32 * Math.cos(t);
            angles[B.RightForearm][0] =
              name === "run" ? -0.75 : -0.15;
            angles[B.LeftForearm][0] =
              name === "run" ? -0.75 : -0.15;
            angles[B.Chest][1] = 0.06 * Math.cos(t);
          }
        }

        if (name === "wave") {
          const raise = 0.5 - 0.5 * Math.cos(t);
          angles[B.RightUpperArm][2] = -0.37 + 1.65 * raise;
          angles[B.RightForearm][0] = -0.85 * raise;
          angles[B.RightForearm][2] = 0.3 * raise;
          angles[B.RightHand][2] = 0.35 * Math.sin(t * 3) * raise;
          angles[B.Head][2] = -0.06 * raise;
        }
      }

      for (let i = 0; i < joints.length; i++) {
        q.setFromEuler(
          new T.Euler(...(angles[i] as EulerTuple), "XYZ"),
        );
        rot[i].push(q.x, q.y, q.z, q.w);
      }

      const hip = joints[B.Hips].p;
      hips.push(hip[0], hip[1] + dy * scale, hip[2]);
    }

    const tracks: T.KeyframeTrack[] = joints.map(
      (bone, index) =>
        new T.QuaternionKeyframeTrack(
          `${bone.name}.quaternion`,
          times,
          rot[index],
        ),
    );

    tracks.push(new T.VectorKeyframeTrack("Hips.position", times, hips));
    result[name] = new T.AnimationClip(name, duration, tracks);
  }

  return result;
}
