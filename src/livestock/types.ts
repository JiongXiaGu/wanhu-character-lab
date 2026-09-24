import type { AnimationClip, Bone, BufferGeometry, MeshStandardMaterial, Skeleton, SkeletonHelper, SkinnedMesh } from 'three';

export type Point = readonly [number, number, number];
export interface Joint { name: string; parent: number; position: Point }
export interface MeshPart { name: string; start: number; count: number }
/** 作者空间为米、+Z前；索引是逻辑顶点，不是硬边展开后的渲染顶点。 */
export interface AnimalMeshData { positions: Point[]; indices: number[]; bones: number[]; colors: string[]; parts: MeshPart[]; version: string }
export interface AnimalActor {
  data: AnimalMeshData; mesh: SkinnedMesh; geometry: BufferGeometry; material: MeshStandardMaterial;
  bones: Bone[]; skeleton: Skeleton; helper: SkeletonHelper;
  sample(motion: string, phase: number): void; bind(): void; dispose(): void;
}
export type Habitat = 'land' | 'water';
export interface MotionDefinition { id: string; label: string; description: string; duration: number; surface?: Habitat }
/** 作者预览配置，不是环境模拟；各环境只允许自己的动作池。 */
export interface HabitatDefinition {
  id: Habitat; label: string; defaultMotion: string; duration: number; waterline?: number;
  mixed: readonly { motion: string; weight: number; radius?: number; laps?: number }[];
}
export const LIVESTOCK_LOD_IDS = ['lod0', 'lod1', 'lod2'] as const;
export type LivestockLodId = typeof LIVESTOCK_LOD_IDS[number];
export type LivestockLodMode = 'auto' | LivestockLodId;
export interface LivestockLodDefinition {
  id: LivestockLodId; label: string; description: string; triangles: number; logicalVertices: number;
  buildMesh(): AnimalMeshData;
}
/** 家畜不继承坐骑：没有鞍具、缰绳、骑姿，也不约束所有物种必须拥有四个动作。 */
export interface LivestockDefinition {
  id: string; name: string; description: string; joints: readonly Joint[]; motions: readonly MotionDefinition[];
  /** 兼容单只精确检查的标准精度入口，等价于lod0。 */
  buildMesh(): AnimalMeshData;
  lods: readonly LivestockLodDefinition[];
  bakeClips(): Map<string, AnimationClip>;
  habitats: readonly HabitatDefinition[]; referenceHeight?: number;
  /** 固定种子预览格距（米），缺省保持原鸡鸭鹅1.45；不是碰撞半径。 */
  previewSpacing?: number;
}
export const CROWD_COUNTS = [1, 10, 50, 100, 500] as const;
export type CrowdCount = typeof CROWD_COUNTS[number];
export type LivestockView = 'three' | 'front' | 'left' | 'farm';
export type DisplayMode = 'beauty' | 'clay' | 'wire';
export interface CameraSnapshot { position: number[]; target: number[]; zoom: number }
export interface LabOptions {
  animal: string; surface: Habitat; waterline: boolean;
  count: CrowdCount; motion: string; mixed: boolean; playing: boolean; loop: boolean; speed: number;
  phase: number; seekRevision: number; seed: number; view: LivestockView; viewRevision: number;
  display: DisplayMode; skeleton: boolean; grid: boolean; lod: LivestockLodMode;
}
export interface Playback { phase: number; time: number; duration: number; finished: boolean }
export interface LabStats {
  triangles: number; logicalVertices: number; bones: number; count: number; modelTriangles: number; batches: number; cachedPoses: number;
  lod: LivestockLodId; pixelHeight: number;
}
