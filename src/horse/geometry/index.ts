import { HorseMeshBuilder } from './builder';
import { buildHorseBody } from './body';
import { buildHorseLegs } from './legs';
import { buildHorseDetails } from './details';

export function buildHorseMesh() {
  const builder = new HorseMeshBuilder();
  buildHorseBody(builder); buildHorseLegs(builder); buildHorseDetails(builder);
  return builder.data;
}
