export type Point3 = [number, number, number];
/** 两个骨索引及第一个权重；第二权重固定为 1-w。 */
export type HorseWeight = [number, number, number];
export interface HorseJoint { name: string; parent: number; bindWorld: Point3 }
export interface HorseVertex { position: Point3; weight: HorseWeight }
export interface HorseTriangle { indices: [number, number, number]; color: string; part: string }
export interface HorseMeshData {
  version: string;
  vertices: HorseVertex[];
  triangles: HorseTriangle[];
}
export const HORSE_CLIP_IDS = ['Horse_Idle', 'Horse_Walk', 'Horse_Run', 'Horse_Eat'] as const;
export type HorseClipId = typeof HORSE_CLIP_IDS[number];
export type HorseView = 'front' | 'left' | 'right' | 'back' | 'three' | 'rear-three';
export type HorseDisplay = 'beauty' | 'clay' | 'wire';
export interface HorseStats { triangles: number; logicalVertices: number; gpuVertices: number; bones: number }
