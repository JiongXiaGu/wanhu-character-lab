import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeCharacter} from '../src/character/v3/outfit';
import {makeActor} from '../src/character/v3/rig';
import {DEFAULT_RECIPE} from '../src/character/v3/types';
import {createMixamoPlayer} from '../src/character/mixamo/player';
const actor=makeActor(makeCharacter(DEFAULT_RECIPE));
const player=createMixamoPlayer(actor,JSON.parse(readFileSync('public/mixamo/shooting-arrow.json','utf8')));
for(const step of [.05,1/30,1/60]){
  player.replay();
  const count=Math.ceil(player.status().duration/step);
  for(let i=0;i<count;i++)player.update(step);
  assert.equal(player.status().phase,1);
  assert.equal(player.status().finished,true);
  player.update(0);assert.equal(player.status().phase,1);
}
player.seek(1-1e-8);assert.equal(player.status().finished,false);
player.update(1e-7);assert.equal(player.status().phase,1);assert.equal(player.status().finished,true);
player.dispose();actor.dispose();
console.log('PASS Mixamo clock: accumulated fractional deltas, terminal hold, canonical finished state');
