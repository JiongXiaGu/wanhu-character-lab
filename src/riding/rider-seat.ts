import { Group } from 'three';
import { B, type BodyType } from '../character/v3/types';
import type { Actor } from '../character/v3/rig';
import type { HorseActor } from '../horse/skinning';

/** RiderSeat是接触参考，不是新增马骨骼。Hips还需加上骨盆到坐面的制作距离。 */
export const RIDER_SEAT_OFFSET = [0, .35, .12] as const;
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
    attach(actor: Actor) {
      const hips = actor.data.joints[B.Hips];
      if (hips?.name !== 'Hips' || actor.bones.length !== 20) throw new Error('骑手必须使用当前20骨骼固定基模。');
      const fit = RIDER_FIT[actor.data.recipe.bodyType];
      // Actor先在独立绑定空间创建，再移动整个人物。挂接后绝不重新bind或调用Skeleton.pose。
      root.position.set(-hips.p[0], fit.hipsLift - hips.p[1], -hips.p[2]);
      root.add(actor.mesh);
      horse.mesh.updateMatrixWorld(true);
    },
    dispose() { seat.removeFromParent(); root.clear(); seat.clear(); },
  };
}
