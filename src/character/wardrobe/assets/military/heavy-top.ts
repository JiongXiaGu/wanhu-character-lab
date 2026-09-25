import { B, rigid, type Recipe } from '../../../v3/types';
import { armBones, finishTop, sewSleeve, sewTorso, solidBand, torsoChest, torsoNeck, torsoRib, torsoWaist, type TorsoRow } from '../top-seams';

/** 共享重甲：桶状胸腹甲、宽厚外肩和长护臂为连续衣壳；不调用或缩放中甲工厂。 */
export function makeHeavyArmorTop(recipe: Recipe) {
  const { primary: cloth, secondary: iron, accent: binding } = recipe.dyes;
  const shade = (color: string, factor: number) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * factor)).toString(16).padStart(2, '0')).join('');
  const face = shade(iron, 1.16), lower = shade(iron, .88);
  const cuts = [-.085, -.030, .030, .085] as const;
  const rows: TorsoRow[] = [
    ['Hem', 1.035, .181, .124, cuts, torsoWaist],
    ['Belt', 1.080, .193, .140, cuts, torsoWaist],
    ['BeltTop', 1.118, .194, .144, cuts, torsoWaist],
    ['Abdomen', 1.184, .207, .163, cuts, torsoRib],
    ['Plate', 1.244, .223, .176, cuts, [B.Spine, B.Chest, .14]],
    ['Chest', 1.300, .230, .165, cuts, torsoChest],
    ['Shoulder', 1.424, .248, .139, cuts, torsoChest],
    ['Gorget', 1.451, .137, .096, [-.065, -.022, .022, .065], torsoNeck],
    ['Collar', 1.462, .096, .077, [-.046, -.014, .014, .046], torsoNeck],
    ['Neck', 1.469, .067, .063, [-.030, -.010, .010, .030], torsoNeck],
  ];
  const torso = sewTorso(rows, [
    solidBand(lower), [iron, iron, binding, iron, iron, iron],
    solidBand(lower), solidBand(face), solidBand(face), solidBand(iron),
    solidBand(iron), solidBand(binding), solidBand(cloth),
  ]);
  const cuffs: Record<string, number[]> = {};
  for (const side of [1, -1] as const) {
    const [upper, fore, hand] = armBones(side);
    cuffs[side === 1 ? 'RightCuff' : 'LeftCuff'] = sewSleeve(torso, side, [
      ['HeavyShoulderRoot', .246, 1.344, 0, .132, .091, [B.Chest, upper, .30], iron],
      ['HeavyShoulderCrest', .285, 1.300, 0, .150, .096, [B.Chest, upper, .08], face],
      ['HeavyShoulderRim', .310, 1.250, 0, .135, .090, rigid(upper), binding],
      ['HeavyUpperGuard', .335, 1.209, 0, .080, .070, rigid(upper), iron],
      ['ElbowUpper', .374, 1.136, 0, .060, .057, [upper, fore, .90], cloth],
      ['Elbow', .394, 1.101, 0, .052, .053, [upper, fore, .50], cloth],
      ['HeavyBracer', .414, 1.066, .002, .061, .057, [upper, fore, .08], iron],
      ['HeavyBracerLower', .463, .990, .008, .050, .050, rigid(fore), face],
      ['Cuff', .508, .904, .014, .038, .038, [fore, hand, .18], binding],
    ]);
  }
  // 六边袖环的 0/1/2 是内腋侧。只向外肩扩张，内腋半径保持活动净空。
  const shoulderRows = {
    HeavyShoulderRoot: [.246, 1.344, .132],
    HeavyShoulderCrest: [.285, 1.300, .150],
    HeavyShoulderRim: [.310, 1.250, .135],
  } as const;
  for (const v of torso.mesh.vertices) {
    const match = /^Top\.(Right|Left)\.(HeavyShoulderRoot|HeavyShoulderCrest|HeavyShoulderRim)\.(\d+)$/.exec(v.id);
    if (!match || Number(match[3]) > 2) continue;
    const side = match[1] === 'Right' ? 1 : -1;
    const [x, y, radius] = shoulderRows[match[2] as keyof typeof shoulderRows];
    v.p[0] = side * x + (v.p[0] - side * x) * (.060 / radius);
    v.p[1] = y + (v.p[1] - y) * (.060 / radius);
  }
  return finishTop(recipe, torso, cuffs, true);
}
