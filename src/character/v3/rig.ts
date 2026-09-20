import { BODY_HEIGHT } from './types';
import * as T from "three";
import type { CharacterData } from "./types";
import { polygonNormal, edgeKey } from "./cage";
export interface Actor {
  mesh: T.SkinnedMesh;
  beautyMaterial: T.MeshStandardMaterial;
  unlitMaterial: T.MeshBasicMaterial;
  skeleton: T.Skeleton;
  bones: T.Bone[];
  mixer: T.AnimationMixer;
  wire: T.LineSegments;
  skeletonHelper: T.SkeletonHelper;
  data: CharacterData;
  resetBindPose: () => void;
  update: (dt: number) => void;
  dispose: () => void;
}
/** GPU 蒙皮采用 Three.js 官方 SkinnedMesh 路径。逻辑顶点和渲染法线拆点分别计数。 */
export function makeActor(data: CharacterData): Actor {
  const p: number[] = [],
    n: number[] = [],
    col: number[] = [],
    si: number[] = [],
    sw: number[] = [],
    ix: number[] = [];
  const c = data.surface,
    color = new T.Color();
  for (const f of c.faces) {
    const start = p.length / 3,
      normal = polygonNormal(c, f);
    color.set(f.color ?? "#b79773");
    for (const vi of f.v) {
      const v = c.vertices[vi];
      p.push(...v.p);
      n.push(...normal);
      col.push(color.r, color.g, color.b);
      si.push(v.w[0], v.w[1], 0, 0);
      sw.push(v.w[2], 1 - v.w[2], 0, 0);
    }
    for (let i = 1; i < f.v.length - 1; i++)
      ix.push(start, start + i, start + i + 1);
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
  const unlitMaterial = new T.MeshBasicMaterial({vertexColors:true, toneMapped:false});
  const mesh = new T.SkinnedMesh(geometry, material);
  mesh.name = "WanhuCharacter";
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  const bones = data.joints.map((j) => {
    const b = new T.Bone();
    b.name = j.name;
    return b;
  });
  data.joints.forEach((j, i) => {
    const parent = j.parent < 0 ? [0, 0, 0] : data.joints[j.parent].p;
    bones[i].position.set(
      j.p[0] - parent[0],
      j.p[1] - parent[1],
      j.p[2] - parent[2],
    );
    if (j.parent >= 0) bones[j.parent].add(bones[i]);
    else mesh.add(bones[i]);
  });
  mesh.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones);
  mesh.bind(skeleton);
  mesh.normalizeSkinWeights();
  // 固定安全包围盒涵盖已实现的动作。不能只使用 Bind Pose 包围盒剔除动画。
  mesh.boundingSphere = new T.Sphere(
    new T.Vector3(0, BODY_HEIGHT[data.recipe.bodyType] * 0.5, 0),
    BODY_HEIGHT[data.recipe.bodyType] * 1.4,
  );
  const mixer = new T.AnimationMixer(mesh);
  const edges = new Map<string, [number, number]>();
  for (const f of c.faces)
    f.v.forEach((v, i) => {
      const b = f.v[(i + 1) % f.v.length];
      edges.set(edgeKey(v, b), [v, b]);
    });
  for (const f of c.faces) {
    for (let i = 2; i < f.v.length - 1; i++) {
      edges.set(edgeKey(f.v[0], f.v[i]), [f.v[0], f.v[i]]);
    }
  }
  const edgeList = [...edges.values()];
  const wireGeo = new T.BufferGeometry();
  const wp = new Float32Array(edgeList.length * 6);
  wireGeo.setAttribute(
    "position",
    new T.BufferAttribute(wp, 3).setUsage(T.DynamicDrawUsage),
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
  const helper = new T.SkeletonHelper(mesh);
  helper.visible = false;
  helper.renderOrder = 4;
  (helper.material as T.LineBasicMaterial).depthTest = false;
  const skinned = c.vertices.map(() => new T.Vector3()),
    temp = new T.Vector3();
  const matrices = bones.map(() => new T.Matrix4());
  const debug = () => {
    mesh.updateMatrixWorld(true);
    skeleton.update();
    if (wire.visible) {
      for (let i = 0; i < bones.length; i++)
        matrices[i].multiplyMatrices(
          bones[i].matrixWorld,
          skeleton.boneInverses[i],
        );
      c.vertices.forEach((v, i) => {
        skinned[i]
          .fromArray(v.p)
          .applyMatrix4(matrices[v.w[0]])
          .multiplyScalar(v.w[2]);
        temp
          .fromArray(v.p)
          .applyMatrix4(matrices[v.w[1]])
          .multiplyScalar(1 - v.w[2]);
        skinned[i].add(temp);
      });
      edgeList.forEach(([a, b], i) => {
        skinned[a].toArray(wp, i * 6);
        skinned[b].toArray(wp, i * 6 + 3);
      });
      wireGeo.attributes.position.needsUpdate = true;
    }
  };
  const actor: Actor = {
    mesh,
    beautyMaterial:material,
    unlitMaterial,
    skeleton,
    bones,
    mixer,
    wire,
    skeletonHelper: helper,
    data,
    resetBindPose() {
      // 静态校准状态，不创建任何程序 AnimationClip，也不当作 FBX 失败回退动画。
      mixer.stopAllAction();
      skeleton.pose();
      debug();
    },
    update(dt) {
      mixer.update(dt);
      debug();
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(mesh);
      geometry.dispose();
      material.dispose();
      unlitMaterial.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      helper.geometry.dispose();
      (helper.material as T.Material).dispose();
      skeleton.dispose();
    },
  };
  actor.update(0);
  return actor;
}
