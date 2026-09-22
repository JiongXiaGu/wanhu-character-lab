import { Group } from 'three';
import { B } from '../character/v3/types';
import type { Actor } from '../character/v3/rig';
import { saddleDefinition, type SaddleId } from '../horse/saddles/catalog';
import { HORSE_RIDER_FIT, HORSE_SADDLE_PROFILE } from '../mounts/horse-profile';
import { mountBone, type MountActor, type MountDefinition } from '../mounts/types';

/** 保留马专项检查的原数值出口；实际实例由坐骑作者配置提供。 */
export const RIDER_SEAT_OFFSET = saddleDefinition('simple').seat!;
export const RIDER_FIT = HORSE_RIDER_FIT;
export function createRiderSeat(animal: MountActor, definition?: MountDefinition) {
  const profile = definition?.saddle ?? HORSE_SADDLE_PROFILE, fits = definition?.riderFit ?? HORSE_RIDER_FIT;
  const bone = mountBone(animal, profile.backBone), seat = new Group(), root = new Group();
  seat.name = 'RiderSeat'; root.name = 'RiderRoot'; seat.position.fromArray(profile.seat('simple')!); seat.add(root); bone.add(seat);
  return {
    seat, root,
    setSaddle(id: SaddleId) { saddleDefinition(id); const position = profile.seat(id); if (position) seat.position.fromArray(position); },
    attach(actor: Actor) {
      const hips = actor.data.joints[B.Hips];
      if (hips?.name !== 'Hips' || actor.bones.length !== 20) throw new Error('骑手必须使用当前20骨骼固定基模。');
      const fit = fits[actor.data.recipe.bodyType];
      root.position.set(-hips.p[0], fit.hipsLift - hips.p[1], -hips.p[2]); root.add(actor.mesh); animal.mesh.updateMatrixWorld(true);
    },
    dispose() { seat.removeFromParent(); root.clear(); seat.clear(); },
  };
}
