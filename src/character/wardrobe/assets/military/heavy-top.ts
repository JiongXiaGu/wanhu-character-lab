import { B, rigid, type Recipe } from '../../../v3/types';
import { armBones, finishTop, sewSleeve, sewTorso, solidBand, torsoChest, torsoNeck, torsoRib, torsoWaist, type TorsoRow } from '../top-seams';

/** 重步兵整壳：宽胸、叠腹、外翻腰甲、层叠肩甲和完整臂甲；不调用中甲工厂。 */
export function makeHeavyArmorTop(recipe: Recipe) {
  const { primary: cloth, secondary: iron, accent: binding } = recipe.dyes;
  const shade = (color: string, factor: number) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * factor)).toString(16).padStart(2, '0')).join('');
  const plate = shade(iron, 1.22), recess = shade(iron, .82), edge = shade(binding, .84);
  const cuts = [-.106, -.045, .045, .106] as const;
  const rows: TorsoRow[] = [
    ['Hem', 1.020, .239, .174, cuts, torsoWaist],
    ['Fauld', 1.062, .248, .188, cuts, torsoWaist],
    ['FauldRim', 1.083, .249, .190, cuts, torsoWaist],
    ['Belt', 1.105, .226, .167, cuts, torsoWaist],
    ['BeltTop', 1.128, .235, .180, cuts, torsoWaist],
    ['Abdomen', 1.180, .260, .216, cuts, torsoRib],
    ['AbdomenRim', 1.215, .270, .232, cuts, [B.Spine, B.Chest, .25]],
    ['Plate', 1.261, .282, .241, cuts, [B.Spine, B.Chest, .14]],
    ['Chest', 1.315, .279, .225, cuts, torsoChest],
    ['Shoulder', 1.438, .291, .186, cuts, torsoChest],
    ['Gorget', 1.461, .153, .116, [-.075, -.030, .030, .075], torsoNeck],
    ['CollarBase', 1.475, .104, .089, [-.046, -.014, .014, .046], torsoNeck],
    ['Collar', 1.494, .099, .084, [-.046, -.014, .014, .046], torsoNeck],
    ['Neck', 1.501, .069, .066, [-.030, -.010, .010, .030], torsoNeck],
  ];
  const torso = sewTorso(rows, [
    solidBand(recess), solidBand(edge), solidBand(iron), solidBand(binding),
    solidBand(recess), solidBand(plate), solidBand(recess), solidBand(plate),
    solidBand(iron), solidBand(plate), solidBand(iron), solidBand(edge), solidBand(cloth),
  ]);
  const cuffs: Record<string, number[]> = {};
  for (const side of [1, -1] as const) {
    const [upper, fore, hand] = armBones(side);
    cuffs[side === 1 ? 'RightCuff' : 'LeftCuff'] = sewSleeve(torso, side, [
      ['MantleRoot', .240, 1.368, 0, .150, .113, [B.Chest, upper, .30], iron],
      ['MantleCrest', .284, 1.326, 0, .192, .137, [B.Chest, upper, .08], plate],
      ['MantleRim', .319, 1.267, 0, .181, .132, rigid(upper), edge],
      ['ShoulderLame', .336, 1.230, 0, .123, .098, rigid(upper), plate],
      ['UpperGuard', .354, 1.195, 0, .096, .083, rigid(upper), iron],
      ['ElbowUpper', .374, 1.136, 0, .063, .059, [upper, fore, .90], recess],
      ['Elbow', .394, 1.101, 0, .056, .055, [upper, fore, .50], recess],
      ['BracerTop', .414, 1.066, .002, .080, .077, [upper, fore, .08], edge],
      ['BracerPlate', .447, 1.010, .006, .083, .078, rigid(fore), plate],
      ['BracerRim', .484, .950, .010, .065, .062, rigid(fore), iron],
      ['Cuff', .508, .904, .014, .039, .039, [fore, hand, .18], binding],
    ]);
  }
  // 外肩的台阶体量不能挤占腋窝；只收内侧三点，保留整个外侧护肩轮廓。
  const shoulderRows = {
    MantleRoot: [.240, 1.368, .150], MantleCrest: [.284, 1.326, .192],
    MantleRim: [.319, 1.267, .181], ShoulderLame: [.336, 1.230, .123],
  } as const;
  for (const v of torso.mesh.vertices) {
    const match = /^Top\.(Right|Left)\.(MantleRoot|MantleCrest|MantleRim|ShoulderLame)\.(\d+)$/.exec(v.id);
    if (!match || Number(match[3]) > 2) continue;
    const side = match[1] === 'Right' ? 1 : -1;
    const [x, y, radius] = shoulderRows[match[2] as keyof typeof shoulderRows];
    v.p[0] = side * x + (v.p[0] - side * x) * (.060 / radius);
    v.p[1] = y + (v.p[1] - y) * (.060 / radius);
  }
  // 胸背到袖根的插接面属于躯干承托面，肩带需要沿它连续采样。
  // 只补齐该段 region；不改顶点、权重、面序、通用采样器或实际臂甲。
  for (const f of torso.mesh.faces) {
    if (f.v.some(i => /^Top\.(Chest|Shoulder)\./.test(torso.mesh.vertices[i].id)) &&
        f.v.some(i => /^Top\.(Right|Left)\.MantleRoot\./.test(torso.mesh.vertices[i].id))) f.region = 'torso';
  }
  return finishTop(recipe, torso, cuffs, true);
}
