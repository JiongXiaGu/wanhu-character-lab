import type { LivestockDefinition } from '../livestock/types';
import { buildDogMesh } from './geometry';
import { DOG_JOINTS } from './rig';
import { DOG_MOTIONS, bakeDogClips } from './animation';

export const DOG_DEFINITION:LivestockDefinition={
  id:'dog_rural_yellow',name:'中国田园犬',
  description:'黄褐短毛、正常长腿、朴素楔形头和自然弯尾；独立九骨院落犬，不可骑乘，不含看门AI。',
  joints:DOG_JOINTS,motions:DOG_MOTIONS,bakeClips:bakeDogClips,buildMesh:()=>buildDogMesh('lod0'),
  referenceHeight:.807,previewSpacing:2.25,
  lods:[
    {id:'lod0',label:'LOD0',description:'结实短毛 · 楔形头 · 弯尾',triangles:274,logicalVertices:157,buildMesh:()=>buildDogMesh('lod0')},
    {id:'lod1',label:'LOD1',description:'完整长腿 · 简化头部与弯尾',triangles:142,logicalVertices:91,buildMesh:()=>buildDogMesh('lod1')},
    {id:'lod2',label:'LOD2',description:'四腿 · 立耳 · 上扬尾剪影',triangles:78,logicalVertices:55,buildMesh:()=>buildDogMesh('lod2')},
  ],
  habitats:[{id:'land',label:'陆地',defaultMotion:'idle',duration:8,mixed:[
    {motion:'idle',weight:.35},{motion:'walk',weight:.30,radius:.24,laps:1},{motion:'sniff',weight:.20},{motion:'bark',weight:.15},
  ]}],
};
