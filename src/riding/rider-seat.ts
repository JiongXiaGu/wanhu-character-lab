import { Group } from 'three';
import { B, type BodyType } from '../character/v3/types';
import type { Actor } from '../character/v3/rig';
import type { HorseActor } from '../horse/skinning';
import { saddleDefinition, type SaddleId } from '../horse/saddles/catalog';

/** 普通马鞍坐面；具体马鞍资产拥有座点，不增加马Skeleton骨骼。 */
export const RIDER_SEAT_OFFSET = saddleDefinition('simple').seat!;
export const RIDER_FIT: Readonly<Record<BodyType, { hipsLift: number; thighDirection: readonly [number, number, number] }>> = {
  male: { hipsLift: .13, thighDirection: [.72, -.63, .29] },
  female: { hipsLift: .12, thighDirection: [.77, -.59, .245] },
};
export function createRiderSeat(horse: HorseActor) {
  const spine = horse.bones.find(bone => bone.name === 'Spine');
  if (!spine) throw new Error('马骨架缺少Spine，无法创建骑乘挂点。');
  const seat = new Group(); seat.name = 'RiderSeat'; seat.position.set(...RIDER_SEAT_OFFSET);
  const root = new Group(); root.name = 'RiderRoot'; seat.add(root); spine.add(seat);
  return {
    seat, root,
    setSaddle(id: SaddleId) { const position = saddleDefinition(id).seat; if (position) seat.position.set(...position); },
    attach(actor: Actor) {
      const hips = actor.data.joints[B.Hips];
      if (hips?.name !== 'Hips' || actor.bones.length !== 20) throw new Error('骑手必须使用当前20骨骼固定基模。');
      const fit = RIDER_FIT[actor.data.recipe.bodyType];
      root.position.set(-hips.p[0], fit.hipsLift - hips.p[1], -hips.p[2]); root.add(actor.mesh);
      horse.mesh.updateMatrixWorld(true);
    },
    dispose() { seat.removeFromParent(); root.clear(); seat.clear(); },
  };
}
