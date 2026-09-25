import { B, rigid, type Recipe } from '../../../v3/types';
import { armBones, finishTop, sewSleeve, sewTorso, solidBand, torsoChest, torsoNeck, torsoRib, torsoWaist, type TorsoRow } from '../top-seams';

/** 中性重甲：厚胸腹壳、宽厚外展护肩与整段护臂。只复用缝片操作，不调用中甲作者工厂。 */
export function makeHeavyArmorTop(recipe: Recipe) {
  const { primary: cloth, secondary: iron, accent: binding } = recipe.dyes;
  const shade = (color: string, k: number) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('');
  const dark = shade(iron, .82), plate = shade(iron, 1.18);
  const cuts = [-.080, -.022, .022, .080] as const;
  const band = (color: string) => [color, color, dark, color, color, color];
  const rows: TorsoRow[] = [
    ['Hem', 1.020, .190, .139, cuts, torsoWaist],
    ['Belt', 1.070, .194, .144, cuts, torsoWaist],
    ['BeltTop', 1.111, .205, .151, cuts, torsoWaist],
    ['Abdomen', 1.155, .220, .166, cuts, torsoRib],
    ['Rib', 1.205, .237, .180, cuts, torsoRib],
    ['Plate', 1.253, .246, .185, cuts, [B.Spine, B.Chest, .10]],
    ['Chest', 1.304, .248, .180, cuts, torsoChest],
    ['Shoulder', 1.424, .263, .148, cuts, torsoChest],
    ['Collar', 1.459, .104, .085, [-.047, -.015, .015, .047], torsoNeck],
    ['Neck', 1.473, .069, .065, [-.030, -.010, .010, .030], torsoNeck],
  ];
  const torso = sewTorso(rows, [
    band(dark), [cloth, binding, binding, binding, cloth, binding],
    band(iron), band(dark), band(plate), band(iron), band(plate),
    [iron, cloth, cloth, cloth, iron, iron], solidBand(cloth),
  ]);
  const cuffs: Record<string, number[]> = {};
  for (const side of [1, -1] as const) {
    const [upper, fore, hand] = armBones(side);
    cuffs[side === 1 ? 'RightCuff' : 'LeftCuff'] = sewSleeve(torso, side, [
      ['PauldronRoot', .267, 1.354, 0, .148, .103, [B.Chest, upper, .30], plate],
      ['PauldronEdge', .308, 1.298, 0, .151, .101, [B.Chest, upper, .08], iron],
      ['PauldronRim', .323, 1.273, 0, .137, .094, rigid(upper), binding],
      ['UpperGuard', .332, 1.219, 0, .074, .071, rigid(upper), iron],
      ['ElbowUpper', .374, 1.136, 0, .059, .057, [upper, fore, .90], cloth],
      ['Elbow', .394, 1.101, 0, .053, .054, [upper, fore, .50], cloth],
      ['Bracer', .414, 1.066, .002, .061, .058, [upper, fore, .08], iron],
      ['BracerEnd', .484, .946, .011, .048, .046, [fore, hand, .90], plate],
      ['Cuff', .508, .904, .014, .037, .037, [fore, hand, .18], binding],
    ]);
  }
  // 宽肩只向外上方增长；腋窝的内侧半环独立收窄，不能整圈放大后压进胸甲。
  const roots = { PauldronRoot: [.267, 1.354, .148], PauldronEdge: [.308, 1.298, .151], PauldronRim: [.323, 1.273, .137] } as const;
  for (const v of torso.mesh.vertices) {
    const match = /^Top\.(Right|Left)\.(PauldronRoot|PauldronEdge|PauldronRim)\.(\d+)$/.exec(v.id);
    if (!match || Number(match[3]) > 2) continue;
    const side = match[1] === 'Right' ? 1 : -1;
    const [x, y, width] = roots[match[2] as keyof typeof roots];
    const factor = .064 / width;
    v.p[0] = side * x + (v.p[0] - side * x) * factor;
    v.p[1] = y + (v.p[1] - y) * factor;
  }
  return finishTop(recipe, torso, cuffs, true);
}
