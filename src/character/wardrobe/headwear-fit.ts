import type { Cage, HeadwearId } from '../v3/types';

/** 固定制作留量，不按发型拟合、压发或读取动画。簪饰不是帽壳，保持其插簪位置。 */
export const HEADWEAR_CLEARANCE:Partial<Record<HeadwearId,readonly [number,number,number]>>={
  guard_helmet:[1.30,1.16,1.30],
  cloth_wrap:[1.22,1.18,1.24],
  scholar_cap:[1.20,1.08,1.22],
  farmer_straw_hat:[1.12,1.10,1.12],
  archer_headband:[1.16,1.00,1.16],
};
export const HEADWEAR_GEOMETRY_VERSION='wanhu-headwear-closed-v3';
export function applyHeadwearClearance(c:Cage,firstVertex:number,id:HeadwearId):void {
  const scale=HEADWEAR_CLEARANCE[id];if(!scale)return;
  const originY=1.690,originZ=-.006;
  for(let i=firstVertex;i<c.vertices.length;i++){
    const p=c.vertices[i].p;
    c.vertices[i].p=[p[0]*scale[0],originY+(p[1]-originY)*scale[1],originZ+(p[2]-originZ)*scale[2]];
  }
}
