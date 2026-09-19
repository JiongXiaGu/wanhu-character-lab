import { mkdirSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { MIXAMO_CLIPS, mixamoFilename } from '../src/character/mixamo/catalog';
import { extractMixamo } from './lib/mixamo-fbx';
const directory = resolve('public/mixamo');
const files = readdirSync('动画参考').filter(name => /\.fbx$/i.test(name)).sort();
const expected = MIXAMO_CLIPS.map(c => mixamoFilename(c.id)).sort();
if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error('动画参考中的 FBX 与 Mixamo 注册表不一致；请同步 catalog.ts 和截图矩阵，不能静默忽略文件。');
mkdirSync(directory, { recursive: true });
for (const name of readdirSync(directory)) if (name.endsWith('.json')) rmSync(resolve(directory, name));
const inventory = [];
for (const def of MIXAMO_CLIPS) {
  const data = extractMixamo(def.id), json = JSON.stringify(data);
  writeFileSync(resolve(directory, `${def.id}.json`), json);
  inventory.push({ id: def.id, label: def.label, duration: data.duration, frames: data.times.length, bytes: Buffer.byteLength(json), ...data.source });
  console.log(`MIXAMO ${def.id}: ${data.source.uniqueBones} unique / ${data.source.rawBoneNodes} raw bones; ${data.times.length} frames; ${data.duration.toFixed(3)}s; ${(Buffer.byteLength(json) / 1024).toFixed(0)} KiB`);
}
writeFileSync(resolve(directory, 'inventory.json'), JSON.stringify(inventory, null, 2));
console.log(`Prepared ${inventory.length} Mixamo clips. External meshes and textures are not included.`);
