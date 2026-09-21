import { weight } from '../rig';
import { HorseMeshBuilder, COAT, COAT_DARK, HOOF, SOCK } from './builder';

export function buildHorseLegs(builder: HorseMeshBuilder) {
  for (const side of ['Left', 'Right'] as const) {
    const sign = side === 'Left' ? -1 : 1;
    for (const front of [true, false]) {
      const name = `${front ? 'Front' : 'Back'}${side}`, x = sign * (front ? .235 : .245);
      const upper = `${name}Upper`, middle = `${name}Middle`, lower = `${name}Lower`, hoof = `${name}Hoof`;
      if (front) builder.loft(`${name}Leg`, [
        { p: [x, 1.32, .53], width: .125, depth: .17, skin: weight('Chest', upper, .55) },
        { p: [x, 1.19, .55], width: .115, depth: .145, skin: weight(upper) },
        { p: [x, .965, .585], width: .09, depth: .105, skin: weight(upper) },
        { p: [x, .73, .60], width: .066, depth: .072, skin: weight(upper, middle, .5) },
        { p: [x, .61, .60], width: .052, depth: .059, skin: weight(middle) },
        { p: [x, .38, .59], width: .045, depth: .051, skin: weight(middle), color: COAT_DARK },
        { p: [x, .235, .59], width: .058, depth: .065, skin: weight(middle, lower, .5), color: SOCK },
        { p: [x, .16, .625], width: .05, depth: .055, skin: weight(lower), color: SOCK },
        { p: [x, .105, .65], width: .064, depth: .068, skin: weight(lower, hoof, .4), color: SOCK },
      ], 8, COAT);
      else builder.loft(`${name}Leg`, [
        { p: [x, 1.33, -.64], width: .145, depth: .19, skin: weight('Pelvis', upper, .6) },
        { p: [x, 1.22, -.63], width: .14, depth: .17, skin: weight(upper) },
        { p: [x, 1.06, -.52], width: .12, depth: .145, skin: weight(upper) },
        { p: [x, .90, -.42], width: .088, depth: .101, skin: weight(upper, middle, .5) },
        { p: [x, .69, -.585], width: .08, depth: .089, skin: weight(middle) },
        { p: [x, .47, -.77], width: .065, depth: .075, skin: weight(middle, lower, .5) },
        { p: [x, .30, -.737], width: .045, depth: .051, skin: weight(lower), color: COAT_DARK },
        { p: [x, .17, -.713], width: .048, depth: .058, skin: weight(lower), color: COAT_DARK },
        { p: [x, .105, -.70], width: .063, depth: .07, skin: weight(lower, hoof, .4), color: COAT_DARK },
      ], 8, COAT);
      const z = front ? .68 : -.675;
      builder.loft(`${name}Hoof`, [
        { p: [x, .145, z - .02], width: .072, depth: .083, skin: weight(hoof) },
        { p: [x, .065, z], width: .103, depth: .129, skin: weight(hoof) },
        { p: [x, .018, z + .004], width: .099, depth: .125, skin: weight(hoof) },
      ], 8, HOOF);
    }
  }
}
