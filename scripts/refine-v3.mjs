// One-time, idempotent correction of issues found in the first WebGL screenshot review.
import {readFileSync,writeFileSync} from 'node:fs';
function edit(path,before,after){let s=readFileSync(path,'utf8');if(s.includes(after))return;if(!s.includes(before))throw Error(`Expected source not found: ${path}`);writeFileSync(path,s.replace(before,after));}
const outfit='src/character/v3/outfit.ts';
edit(outfit,'[peak, rim[j], rim[i]]','[peak, rim[i], rim[j]]');
edit(outfit,'[bottom, rim[i], rim[j]]','[bottom, rim[j], rim[i]]');
edit(outfit,'[boss, edge[i], edge[(i + 1) % 8]]','[boss, edge[(i + 1) % 8], edge[i]]');
edit(outfit,'face(c, [...edge].reverse(), "equipment", "#463b31");','face(c, [...edge], "equipment", "#463b31");');
edit(outfit,'bridge(c, lower, top, "detail", HAIR);',`const middle = ring(c, "HairVolume", [0, 1.724, 0], [1, 0, 0], [0, 0, 1], OCT, .103, .097, head);
  bridge(c, lower, middle, "detail", HAIR);
  bridge(c, middle, top, "detail", HAIR);`);
edit(outfit,'[0, 1.808, -0.025]','[0, 1.794, -0.025]');
edit('src/character/v3/body.ts','["Sole", 0.018, 0.054, 0.109, 0.053, rigid(foot)]','["Sole", 0, 0.054, 0.109, 0.053, rigid(foot)]');
edit('scripts/check-v3.ts','import assert from "node:assert/strict";','import assert from "node:assert/strict";\nimport { assertComponentWinding } from "./check-components";');
edit('scripts/check-v3.ts','validate(data.surface, false);','validate(data.surface, false);\n    assertComponentWinding(data.surface);');
