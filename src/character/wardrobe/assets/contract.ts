import type { Cage, Region } from '../../v3/types';

/** 制作好的绑定空间服装；装配不读取动作、求碰撞或修改源人体。 */
export type GarmentSlot='top'|'bottom'|'shoes';
export interface GarmentPiece {
  id:string;
  slot:GarmentSlot;
  version:string;
  mesh:Cage;
  covers:readonly Region[];
  /** 仅允许这些实际网格边界；裆底不能开口。 */
  openings:Record<string,number[]>;
}
export const GARMENT_GEOMETRY_VERSION='wanhu-modular-garments-v4';
export const BODY_HIDE_VERSION='wanhu-authored-coverage-v1';
