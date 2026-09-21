import { weight } from '../rig';
import { HorseMeshBuilder, COAT, COAT_DARK, type Section } from './builder';

export const NECK_SECTIONS: Section[] = [
  { p: [0, 1.36, .55], width: .255, depth: .30, skin: weight('Chest') },
  { p: [0, 1.53, .67], width: .215, depth: .265, skin: weight('Chest', 'Neck', .25) },
  { p: [0, 1.69, .78], width: .17, depth: .215, skin: weight('Neck') },
  { p: [0, 1.82, .89], width: .14, depth: .18, skin: weight('Neck', 'NeckUpper', .45) },
  { p: [0, 1.93, 1.00], width: .125, depth: .16, skin: weight('NeckUpper') },
  { p: [0, 2.015, 1.075], width: .105, depth: .14, skin: weight('NeckUpper', 'Head', .65) },
];
export function buildHorseBody(builder: HorseMeshBuilder) {
  // 胸腔和臀部用同一条封闭主壳；背中段只有Spine/Pelvis低幅变形，留给未来挂点。
  builder.loft('Body', [
    { p: [0, 1.31, -.97], width: .09, depth: .15, skin: weight('Pelvis') },
    { p: [0, 1.30, -.81], width: .285, depth: .315, skin: weight('Pelvis') },
    { p: [0, 1.26, -.59], width: .34, depth: .39, skin: weight('Pelvis') },
    { p: [0, 1.25, -.25], width: .365, depth: .39, skin: weight('Pelvis', 'Spine', .35) },
    { p: [0, 1.25, .10], width: .355, depth: .38, skin: weight('Spine') },
    { p: [0, 1.24, .40], width: .315, depth: .385, skin: weight('Spine', 'Chest', .2) },
    { p: [0, 1.24, .62], width: .25, depth: .32, skin: weight('Chest') },
    { p: [0, 1.27, .71], width: .09, depth: .20, skin: weight('Chest') },
  ], 12, COAT);
  builder.loft('Neck', NECK_SECTIONS, 10, COAT);
  builder.loft('Head', [
    { p: [0, 2.035, 1.035], width: .10, depth: .135, skin: weight('Head') },
    { p: [0, 1.99, 1.145], width: .157, depth: .185, skin: weight('Head') },
    { p: [0, 1.89, 1.255], width: .14, depth: .157, skin: weight('Head') },
    { p: [0, 1.77, 1.38], width: .112, depth: .128, skin: weight('Head') },
    { p: [0, 1.645, 1.505], width: .133, depth: .11, skin: weight('Head'), color: COAT_DARK },
    { p: [0, 1.595, 1.565], width: .106, depth: .08, skin: weight('Head'), color: '#63513f' },
  ], 10, COAT);
}
