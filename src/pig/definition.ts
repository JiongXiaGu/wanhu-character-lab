import type { LivestockDefinition } from '../livestock/types';
import { buildPigMesh } from './geometry';
import { PIG_JOINTS } from './rig';
import { PIG_MOTIONS, bakePigClips } from './animation';

export const PIG_DEFINITION: LivestockDefinition = {
  id:'pig_domestic_black',name:'黑色家猪',
  description:'深炭褐厚身、垂腹短腿、宽鼻盘、前垂耳与短卷尾；独立九骨陆地家畜，不可骑乘。',
  joints:PIG_JOINTS,motions:PIG_MOTIONS,bakeClips:bakePigClips,buildMesh:()=>buildPigMesh('lod0'),
  referenceHeight:.607,previewSpacing:2.50,
  lods:[
    {id:'lod0',label:'LOD0',description:'厚身体 · 宽鼻盘 · 浅分趾',triangles:248,logicalVertices:148,buildMesh:()=>buildPigMesh('lod0')},
    {id:'lod1',label:'LOD1',description:'保留鼻盘 · 合并蹄体',triangles:114,logicalVertices:73,buildMesh:()=>buildPigMesh('lod1')},
    {id:'lod2',label:'LOD2',description:'长厚身 · 短腿 · 前伸猪鼻',triangles:62,logicalVertices:47,buildMesh:()=>buildPigMesh('lod2')},
  ],
  habitats:[{id:'land',label:'陆地',defaultMotion:'idle',duration:12,mixed:[
    {motion:'idle',weight:.30},{motion:'walk',weight:.30,radius:.30,laps:1},
    {motion:'root',weight:.25},{motion:'sniff',weight:.15},
  ]}],
};
