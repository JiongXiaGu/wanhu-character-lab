import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as T from 'three';
import { BODY_TYPES, createRecipe } from '../src/character/v3/types';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { motionAssetDirectory, MOTION_CLIPS } from '../src/character/motion/catalog';
import { retargetMotion } from '../src/character/motion/retarget';

/** 数值证据只在显式 --motion 检查时导出，不改模型、源文件、时间采样或任何检查阈值。 */
if (process.argv.includes('--motion')) {
  const ids = new Set(['pilot-switches', 'shooting-arrow', 'jogging', 'snatch', 'start-walking']);
  const dir = process.env.SOLDIER_CHECK_DIR ?? 'review/soldier-numeric';
  mkdirSync(dir, { recursive: true });
  for (const bodyType of BODY_TYPES) {
    // 与原完整下身矩阵使用相同上衣；只导出 Heavy 下装实际装配后的数值，不导出仓库源码。
    const actor = makeActor(makeCharacter(createRecipe({ bodyType, slots: { top: 'rough_tunic', bottom: 'heavy_armor_skirt' } })));
    const c = actor.data.surface;
    const selected = c.vertices.flatMap((v, i) => v.id.startsWith('HeavyArmor') ? [i] : []);
    const remap = new Map(selected.map((i, j) => [i, j]));
    const vertices = selected.map(i => c.vertices[i]);
    const faces = c.faces.filter(f => f.v.every(i => remap.has(i))).map(f => ({ ...f, v: f.v.map(i => remap.get(i)!) }));
    const bones = [...new Set(vertices.flatMap(v => v.w.slice(0, 2)))].sort((a, b) => a - b);
    const frames: { clip: string; time: number; phase: number; matrices: Record<number, number[]> }[] = [];
    try {
      for (const def of MOTION_CLIPS.filter(d => ids.has(d.id))) {
        const source = JSON.parse(readFileSync(`public/${motionAssetDirectory(def.id)}/${def.id}.json`, 'utf8'));
        const bake = retargetMotion(actor.data, source);
        actor.resetBindPose();
        const action = actor.mixer.clipAction(bake.clip); action.setLoop(T.LoopOnce, 1).play(); action.paused = true; action.clampWhenFinished = true;
        const times = [...new Set<number>([0, source.duration, ...source.times, ...source.times.slice(1).map((t: number, i: number) => (t + source.times[i]) / 2)])].sort((a, b) => a - b);
        for (const time of times) {
          action.time = time; actor.update(0); actor.mesh.updateMatrixWorld(true); actor.skeleton.update();
          const matrices = Object.fromEntries(bones.map(b => [b, new T.Matrix4().multiplyMatrices(actor.bones[b].matrixWorld, actor.skeleton.boneInverses[b]).toArray()]));
          frames.push({ clip: def.id, time, phase: time / source.duration, matrices });
        }
        actor.mixer.uncacheClip(bake.clip);
      }
    } finally { actor.dispose(); }
    writeFileSync(`${dir}/heavy-deformation-${bodyType}.json`, JSON.stringify({ sourceSHA: process.env.REVIEW_HEAD_SHA ?? 'local', bodyType, vertices, faces, bones, frames, matrixLayout: 'column-major; actual bone world times unchanged inverse bind', purpose: 'Authoring diagnostics only. The unchanged full tailoring check remains authoritative.' }));
    console.log('HEAVY_DEFORMATION_EVIDENCE', bodyType, frames.length, vertices.length, faces.length);
  }
}
