import type { Cage, Region } from '../../v3/types';

/** 制作好的绑定空间服装；装配不读取动作、求碰撞或修改源人体。 */
export type GarmentSlot='top'|'bottom'|'shoes';
export interface GarmentPiece {
  id:string;
  slot:GarmentSlot;
  version:string;
  mesh:Cage;
  covers:readonly Region[];
  /** 作者构造阶段的真实边界；正式衣柜交付时必须全部封闭并清空。 */
  openings:Record<string,number[]>;
  /** 已用衣料 Cap 封死、继续保留作换装与审查锚点的接口环。 */
  sealedInterfaces?:Record<string,number[]>;
}
export const GARMENT_GEOMETRY_VERSION='wanhu-modular-garments-v9';
export const BODY_HIDE_VERSION='wanhu-authored-coverage-v1';
