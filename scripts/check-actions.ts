import assert from 'node:assert/strict';
import { Vector3 as V, Mesh } from 'three';
import { makeCharacter } from '../src/character/v3/outfit';
import { makeActor } from '../src/character/v3/rig';
import { WORK_IDS, ACTIONS, crossedEvents } from '../src/character/actions/catalog';
import { sampleWork } from '../src/character/actions/dispatch';
import { sampleBow, isBowId } from '../src/character/actions/bow';
import { createWorkPlayer, visibleRecipe } from '../src/character/actions/player';
import { B } from '../src/character/v3/types';

let cases = 0, frames = 0, maxError = 0, minFoot = Infinity, maxReach = 0;
for (const shape of [{ height:1.76, build:.5 }, { height:1.58, build:0 }, { height:1.92, build:1 }]) {
  for (const id of WORK_IDS) {
    const data = makeCharacter({ outfit:'archer', ...shape });
    const before = JSON.stringify(data.recipe), effective = visibleRecipe(data.recipe, id), def = ACTIONS[id];
    for (const slot of def.occupied) assert.equal(effective.slots[slot], 'none');
    assert.equal(JSON.stringify(data.recipe), before, '预览修改了原配方');
    const actor = makeActor(makeCharacter(effective)), work = createWorkPlayer(actor, id, data.recipe);
    const pos = actor.mesh.geometry.attributes.position, index = actor.mesh.geometry.index!, skin = actor.mesh.geometry.attributes.skinIndex;
    const originalPositions = pos.array;
    const footVertices: number[] = [];
    for (let i = 0; i < pos.count; i++) if (skin.getX(i) === B.RightFoot || skin.getX(i) === B.LeftFoot) footVertices.push(i);
    let worst = 0, lowest = Infinity;
    for (let k = 0; k <= 60; k++) {
      const phase = k / 60;
      work.seek(phase); actor.mesh.updateMatrixWorld(true); actor.skeleton.update();
      const sample = sampleWork(actor.data.joints, data.recipe, id, Math.min(phase, def.loop ? .999999 : 1));
      for (const contact of sample.contacts) {
        const actual = new V(...contact.offset).applyMatrix4(actor.bones[contact.bone].matrixWorld);
        const error = actual.distanceTo(new V(...contact.point));
        worst = Math.max(worst, error); maxReach = Math.max(maxReach, contact.unreachable);
        assert(error < .012 * shape.height / 1.76, `${id} 手离握点 ${phase}: ${error}`);
      }
      const values: V[] = [];
      for (let i = 0; i < pos.count; i++) {
        const p = actor.mesh.getVertexPosition(i, new V());
        assert([p.x, p.y, p.z].every(Number.isFinite), `${id} 非有限蒙皮坐标`);
        assert(p.length() < shape.height * 2, `${id} 蒙皮爆炸`); values.push(p);
      }
      for (let i = 0; i < index.count; i += 3) {
        const a = values[index.getX(i)], b = values[index.getX(i + 1)], c = values[index.getX(i + 2)];
        assert(new V().crossVectors(b.clone().sub(a), c.clone().sub(a)).lengthSq() > 1e-18, `${id} 退化面 ${phase}/${i / 3}`);
      }
      for (const i of footVertices) lowest = Math.min(lowest, values[i].y);
      assert.equal(pos.array, originalPositions, '逐帧重建了人体 Mesh');
      if (isBowId(id)) {
        const bow = sampleBow(actor.data.joints, data.recipe, id, phase);
        const string = work.props.object.getObjectByName('BowStringTop')!;
        const end = new V(0, .5, 0).applyMatrix4(string.matrixWorld);
        assert(end.distanceTo(bow.nock) < .012 * shape.height / 1.76, `${id} 弓弦不同步 ${phase}`);
      }
      frames++;
    }
    assert(lowest > -.018 * shape.height / 1.76, `${id} 脚穿地: ${lowest}`);
    assert(work.props.triangles < 600, `${id} 道具面数超限`);
    assert.equal(actor.skeleton.bones.length, 20);
    work.props.group.traverse(node => {
      if (!(node instanceof Mesh)) return;
      assert(node.geometry.attributes.position.count > 0);
      for (const attribute of ['position', 'normal']) assert(Array.from(node.geometry.getAttribute(attribute).array).every(Number.isFinite));
    });
    if (def.loop) {
      const a = sampleWork(actor.data.joints, data.recipe, id, 0), b = sampleWork(actor.data.joints, data.recipe, id, 1);
      assert(a.propP.distanceTo(b.propP) < 1e-6);
      for (let i = 0; i < 20; i++) assert(a.pose.local[i].angleTo(b.pose.local[i]) < 1e-6, `${id} 骨骼不闭环`);
    }
    work.replay(); work.update(def.duration * .59);
    const count = work.status().eventCount; work.update(0);
    assert.equal(work.status().eventCount, count, '暂停仍发事件');
    work.seek(.53); assert.equal(work.status().eventCount, 0, '定位触发事件');
    assert.equal(work.status().releaseCount, 0, '定位生成箭');
    work.replay(); work.update(def.duration * 3.3);
    assert.equal(work.status().eventCount, def.events.length * (def.loop ? 3 : 1), `${id} 跳帧事件错误`);
    if (!def.loop) {
      assert.equal(work.status().finished, def.playback !== 'hold', `${id} 单次/保持状态错误`);
      assert(Math.abs(work.status().phase - 1) < 1e-6, '单次动作跳回开头');
      work.update(def.duration * 2);
      assert.equal(work.status().eventCount, def.events.length, '末帧重复触发事件');
    }
    if (id === 'bow_shot' || id === 'bow_release') assert.equal(work.status().releaseCount, 1, '一次射箭必须恰好释放一支箭');
    if (id === 'bow_cancel' || def.playback === 'hold') assert.equal(work.status().releaseCount, 0, '取消/瞄准不能射箭');
    if (id === 'hoe' || id === 'hammer') {
      const contact = sampleWork(actor.data.joints, data.recipe, id, .52).toolContact!;
      assert(Math.abs(contact.y - (id === 'hoe' ? .00372 : .875) * shape.height / 1.76) < .01);
    }
    const propTriangles = work.props.triangles;
    work.dispose(); actor.dispose(); maxError = Math.max(maxError, worst); minFoot = Math.min(minFoot, lowest); cases++;
    console.log(`${id.padEnd(16)} ${shape.height}m | grip ${(worst * 1000).toFixed(2)}mm | foot ${(lowest * 1000).toFixed(2)}mm | prop ${propTriangles} tris | PASS`);
  }
}
// 阶段接缝必须使用同一个满弓姿态；取消动作不能通过倒放事件表实现。
const data = makeCharacter({ outfit:'archer' });
const aim = sampleBow(data.joints, data.recipe, 'bow_aim', .5);
for (const [id, phase] of [['bow_draw', 1], ['bow_release', 0], ['bow_cancel', 0]] as const) {
  const sample = sampleBow(data.joints, data.recipe, id, phase);
  for (let i = 0; i < 20; i++) assert(sample.pose.local[i].angleTo(aim.pose.local[i]) < 1e-6, `${id} 满弓接缝`);
  assert(sample.nock.distanceTo(aim.nock) < 1e-6);
}
const pickup = sampleWork(data.joints, data.recipe, 'pick', 1);
for (const id of ['carry_hold', 'place'] as const) {
  const sample = sampleWork(data.joints, data.recipe, id, 0);
  for (let i = 0; i < 20; i++) assert(sample.pose.local[i].angleTo(pickup.pose.local[i]) < 1e-6, `${id} 抱箱接缝`);
}
assert.deepEqual(crossedEvents(ACTIONS.pick, 1, 1), []);
assert.deepEqual(crossedEvents(ACTIONS.hoe, 1, .5), []);
const releaseTime = ACTIONS.bow_shot.duration * .72;
assert.equal(crossedEvents(ACTIONS.bow_shot, releaseTime - .01, releaseTime).filter(e => e.id === 'arrow_released').length, 1);
assert.equal(crossedEvents(ACTIONS.bow_shot, releaseTime, releaseTime + .01).length, 0);
console.log(JSON.stringify({ pass:true, cases, frames, maxGripErrorMillimeters:maxError * 1000, maxUnreachable:maxReach, minFootY:minFoot, checks:['all registered actions','prop sockets','bow string synchrony','stage seams','recipe restoration','once / loop / hold','event seek / pause / skip / exact boundary','no per-frame body mesh rebuild','skinned geometry','ground contact','20 bones preserved'] }, null, 2));
