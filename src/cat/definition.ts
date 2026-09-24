import type { LivestockDefinition } from '../livestock/types';
import { buildCatMesh } from './geometry';
import { CAT_JOINTS } from './rig';
import { CAT_MOTIONS, bakeCatClips } from './animation';

export const CAT_DEFINITION: LivestockDefinition = {
  id: 'cat_rural_orange', name: '橘色田园猫',
  description: '短口鼻、尖耳、轻巧猫足和长弯尾；独立低模田园猫，不可骑乘，不含捕鼠或跟随AI。',
  joints: CAT_JOINTS, motions: CAT_MOTIONS, bakeClips: bakeCatClips, buildMesh: () => buildCatMesh('lod0'),
  referenceHeight: .553, previewSpacing: 1.80,
  lods: [
    { id: 'lod0', label: 'LOD0', description: '圆颊短鼻 · 猫足 · 长弯尾', triangles: 262, logicalVertices: 151, buildMesh: () => buildCatMesh('lod0') },
    { id: 'lod1', label: 'LOD1', description: '完整四足 · 尖耳 · 弯尾', triangles: 146, logicalVertices: 93, buildMesh: () => buildCatMesh('lod1') },
    { id: 'lod2', label: 'LOD2', description: '短头 · 尖耳 · 长尾剪影', triangles: 86, logicalVertices: 59, buildMesh: () => buildCatMesh('lod2') },
  ],
  habitats: [{ id: 'land', label: '陆地', defaultMotion: 'idle', duration: 8, mixed: [
    { motion: 'idle', weight: .35 }, { motion: 'walk', weight: .25, radius: .15, laps: 1 },
    { motion: 'sniff', weight: .20 }, { motion: 'groom', weight: .20 },
  ] }],
};
