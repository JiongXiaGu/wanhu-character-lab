import { createHorseActor } from '../horse/skinning';
import { authorHorsePose, bakeHorseClips, HORSE_CLIPS } from '../horse/animation';
import type { HorseClipId } from '../horse/types';
import { buildDonkeyMesh } from '../donkey/geometry';
import { DONKEY_JOINTS } from '../donkey/rig';
import { authorDonkeyPose, bakeDonkeyClips, DONKEY_MOTIONS } from '../donkey/animation';
import { DONKEY_REIN_PROFILE, DONKEY_RIDER_FIT, DONKEY_SADDLE_PROFILE } from '../donkey/saddles';
import { buildCamelMesh } from '../camel/geometry';
import { CAMEL_JOINTS } from '../camel/rig';
import { authorCamelPose, bakeCamelClips, CAMEL_MOTIONS } from '../camel/animation';
import { CAMEL_REIN_PROFILE, CAMEL_RIDER_FIT, CAMEL_SADDLE_PROFILE } from '../camel/saddles';
import { buildCattleMesh } from '../cattle/geometry';
import { CATTLE_JOINTS } from '../cattle/rig';
import { authorCattlePose, bakeCattleClips, CATTLE_MOTIONS } from '../cattle/animation';
import { CATTLE_REIN_PROFILE, CATTLE_RIDER_FIT, CATTLE_SADDLE_PROFILE } from '../cattle/saddles';
import { HORSE_REIN_PROFILE, HORSE_RIDER_FIT, HORSE_SADDLE_PROFILE } from './horse-profile';
import { makeMountActor } from './skinning';
import { MOUNT_IDS, MOUNT_MOTIONS, type MountDefinition, type MountId, type MountMotion, type MountMotionDefinition, type MountSelection } from './types';

const horseIds: Record<MountMotion, HorseClipId> = { idle: 'Horse_Idle', walk: 'Horse_Walk', run: 'Horse_Run', eat: 'Horse_Eat' };
const horseMotions = Object.fromEntries(MOUNT_MOTIONS.map(id => { const d = HORSE_CLIPS.find(c => c.id === horseIds[id])!; return [id, { nativeId: d.id, label: { idle: '停驻', walk: '步行', run: '奔跑', eat: '进食' }[id], duration: d.duration, description: d.description }]; })) as Record<MountMotion, MountMotionDefinition>;
export const MOUNTS: readonly MountDefinition[] = [
  { id: 'horse_chestnut', name: '栗色马', description: '现有栗色马，保持已认可的外形、绑定与四个动作。', createActor: createHorseActor,
    bakeClips() { const native = bakeHorseClips(); return new Map(MOUNT_MOTIONS.map(id => [id, native.get(horseIds[id])!])); },
    motions: horseMotions, saddle: HORSE_SADDLE_PROFILE, reins: HORSE_REIN_PROFILE, riderFit: HORSE_RIDER_FIT,
    backPitch(id, p) { const pose = authorHorsePose(horseIds[id], p); return pose.rotations[1][0] + pose.rotations[2][0]; },
    frame: { bodyY: 1.13, ridingY: 1.38, bodyHalf: 1.48, ridingHalf: 1.62 },
  },
  { id: 'donkey_gray', name: '灰驴', description: '长耳、浅吻、短鬃与尾端毛束；独立灰驴外形及较短步幅。', createActor: () => makeMountActor(buildDonkeyMesh(), DONKEY_JOINTS, 'WanhuDonkey'),
    bakeClips: bakeDonkeyClips, motions: DONKEY_MOTIONS, saddle: DONKEY_SADDLE_PROFILE, reins: DONKEY_REIN_PROFILE, riderFit: DONKEY_RIDER_FIT,
    backPitch(id, p) { const pose = authorDonkeyPose(id, p); return pose.rotations[1][0] + pose.rotations[2][0]; },
    frame: { bodyY: 1.04, ridingY: 1.18, bodyHalf: 1.34, ridingHalf: 1.53 },
  },
  { id: 'camel_bactrian', name: '双峰骆驼', description: '双峰、弯曲长颈、长腿与宽脚垫；两峰间驼鞍和独立同侧步态。', createActor: () => makeMountActor(buildCamelMesh(), CAMEL_JOINTS, 'WanhuCamel'),
    bakeClips: bakeCamelClips, motions: CAMEL_MOTIONS, saddle: CAMEL_SADDLE_PROFILE, reins: CAMEL_REIN_PROFILE, riderFit: CAMEL_RIDER_FIT,
    backPitch(id, p) { const pose = authorCamelPose(id, p); return pose.rotations[1][0] + pose.rotations[2][0]; },
    frame: { bodyY: 1.32, ridingY: 1.60, bodyHalf: 1.75, ridingHalf: 1.98 },
  },
  { id: 'cattle_yellow', name: '黄牛', description: '厚实桶身、短粗颈、宽鼻镜、弯牛角与分趾蹄；中国古代农耕背景的独立可骑乘黄牛。', createActor: () => makeMountActor(buildCattleMesh(), CATTLE_JOINTS, 'WanhuCattle'),
    bakeClips: bakeCattleClips, motions: CATTLE_MOTIONS, saddle: CATTLE_SADDLE_PROFILE, reins: CATTLE_REIN_PROFILE, riderFit: CATTLE_RIDER_FIT,
    backPitch(id, p) { const pose = authorCattlePose(id, p); return pose.rotations[1][0] + pose.rotations[2][0]; },
    frame: { bodyY: 1.02, ridingY: 1.24, bodyHalf: 1.42, ridingHalf: 1.58 },
  },
];
export function isMountId(value: unknown): value is MountId { return typeof value === 'string' && MOUNT_IDS.includes(value as MountId); }
export function mountDefinition(id: MountId): MountDefinition { const definition = MOUNTS.find(value => value.id === id); if (!definition) throw new Error(`未知坐骑：${String(id)}`); return definition; }
export function initialMount(query: URLSearchParams): MountId { const id = query.get('mount'); return isMountId(id) ? id : 'horse_chestnut'; }
/** 历史马本体URL的片段名只在入口归一化；播放器始终使用语义，不给驴播放Horse轨道。 */
export function initialMountMotion(value: string | null): MountSelection {
  if (value === 'bind') return 'bind';
  const semantic = value?.replace(/^(Horse|Donkey|Camel|Cattle)_/, '').toLowerCase(); return MOUNT_MOTIONS.includes(semantic as MountMotion) ? semantic as MountMotion : 'idle';
}
