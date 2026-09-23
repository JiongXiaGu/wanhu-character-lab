import assert from 'node:assert/strict';

/** 复用现有真实桌面浏览器，不截图；新物种不替换原马/驴交互回归。 */
export async function checkCattleBrowser(page, base, checks) {
  const near = (a, b, e = 1e-6) => assert(Math.abs(a - b) <= e, `${a} != ${b}`);
  const body = () => page.evaluate(() => { const r = window.__MOUNT_REVIEW__; return { id: r.mountId(), stats: r.stats, status: r.getStatus(), geometry: r.geometryId(), finite: r.matricesFinite() }; });
  const riding = () => page.evaluate(() => { const r = window.__RIDING_REVIEW__; return { id: r.mountId(), stats: r.stats(), status: r.getStatus(), recipe: r.recipe(), ids: r.geometryIds(), saddle: r.saddleState(), camera: r.cameraState(), finite: r.matricesFinite() }; });
  const pause = async id => { const button = page.getByTestId(id); if ((await button.innerText()).includes('暂停')) await button.click(); };
  const valid = s => { assert(s.finite); near(s.status.horsePhase, s.status.riderPhase, 1e-9); assert(s.saddle.reinPositions.every(Number.isFinite)); };
  await page.goto(`${base}/?lab=mount&mount=cattle_yellow&clip=Cattle_Walk&paused=1&phase=.375`);
  await page.waitForFunction(() => window.__MOUNT_REVIEW__?.mountId() === 'cattle_yellow');
  const first = await body(); assert.equal(first.stats.bones, 28); assert.equal(first.stats.triangles, 1956); near(first.status.duration, 1.8); near(first.status.phase, .375);
  assert.equal(await page.getByTestId('mount-stage-name').innerText(), '黄牛');
  assert.equal(await page.locator('.mount-selector select').count(), 2); assert.deepEqual(await page.locator('.animal-mode-switcher a').allTextContents(), ['坐骑本体', '骑乘试衣', '家畜']); assert.equal(await page.locator('canvas').count(), 1);
  for (const [clip, duration] of [['Cattle_Idle', 5.2], ['Cattle_Walk', 1.8], ['Cattle_Run', 1.05], ['Cattle_Eat', 6.8]]) {
    await page.getByTestId(clip).click(); await pause('horse-play');
    for (const p of [0, .25, .5, .75, 1]) { await page.evaluate(phase => window.__MOUNT_REVIEW__.seek(phase), p); const s = await body(); assert(s.finite); near(s.status.duration, duration); assert.equal(s.geometry, first.geometry); }
  }
  for (const saddle of ['simple', 'travel', 'none']) { await page.getByTestId('mount-saddle').selectOption(saddle); assert.equal((await body()).geometry, first.geometry); }
  await page.getByTestId('animal-mode-riding').click(); await page.waitForFunction(() => window.__RIDING_REVIEW__?.mountId() === 'cattle_yellow');
  let s = await riding(); assert.equal(s.saddle.id, 'none'); assert(!s.saddle.riderVisible && !s.saddle.reinsVisible); assert(await page.getByTestId('riding-play').isDisabled());
  checks.push('cattle native URL and four independent clips; 1956 triangles/28 bones; two fields/three animal sections/one canvas; no-saddle body-to-riding does not auto-equip');
  await page.getByTestId('mount-saddle').selectOption('simple'); await pause('riding-play');
  await page.getByTestId('Rider_Walk').click(); await pause('riding-play');
  await page.evaluate(() => window.__RIDING_REVIEW__.seek(.375)); await page.getByTestId('riding-view-left').click();
  const start = await riding(); valid(start); assert.equal(start.stats.rider.bones, 20); assert.equal(start.stats.horse.bones, 28);
  const direction = c => c.position.map((value, i) => value - c.target[i]);
  for (const [id, bones, duration] of [['horse_chestnut', 25, 1.2], ['donkey_gray', 27, 1.4], ['camel_bactrian', 29, 1.6], ['cattle_yellow', 28, 1.8]]) {
    await page.getByTestId('mount-horse').selectOption(id); s = await riding(); valid(s); near(s.status.phase, .375); near(s.status.duration, duration);
    assert.equal(s.stats.horse.bones, bones); assert.equal(s.ids.rider, start.ids.rider); assert.deepEqual(s.recipe, start.recipe); assert.equal(s.saddle.id, 'simple');
    direction(s.camera).forEach((value, i) => near(value, direction(start.camera)[i])); assert.equal(await page.locator('canvas').count(), 1);
  }
  await page.getByTestId('mount-saddle').selectOption('none'); const frozen = await riding();
  for (const id of ['horse_chestnut', 'donkey_gray', 'camel_bactrian', 'cattle_yellow']) {
    await page.getByTestId('mount-horse').selectOption(id); s = await riding(); assert.equal(s.saddle.id, 'none'); near(s.status.phase, frozen.status.phase);
    assert(!s.saddle.riderVisible && !s.saddle.reinsVisible); assert.equal(s.ids.rider, frozen.ids.rider); assert(await page.getByTestId('riding-play').isDisabled());
  }
  await page.getByTestId('mount-saddle').selectOption('travel'); s = await riding(); valid(s); near(s.status.phase, frozen.status.phase);
  const animal = s.ids.horse, rein = s.saddle.reinGeometry;
  for (const gender of ['female', 'male']) {
    await page.getByTestId(`riding-body-${gender}`).click(); await page.waitForFunction(value => window.__RIDING_REVIEW__.recipe().bodyType === value, gender);
    for (const saddle of ['simple', 'travel']) {
      await page.getByTestId('mount-saddle').selectOption(saddle); s = await riding(); valid(s); assert.equal(s.ids.horse, animal); assert.equal(s.saddle.reinGeometry, rein);
      await page.getByTestId('riding-pose').click(); valid(await riding());
      for (const [clip, duration] of [['Rider_Idle', 5.2], ['Rider_Walk', 1.8], ['Rider_Run', 1.05]]) {
        await page.getByTestId(clip).click(); await pause('riding-play');
        for (const p of [0, .25, .5, .75, 1]) { await page.evaluate(phase => window.__RIDING_REVIEW__.seek(phase), p); s = await riding(); valid(s); near(s.status.duration, duration); }
      }
    }
  }
  await page.evaluate(() => window.__RIDING_REVIEW__.seek(.375));
  await page.getByTestId('riding-slot-top').selectOption('work_vest'); await page.getByTestId('riding-slot-bottom').selectOption('short_trousers');
  s = await riding(); valid(s); near(s.status.phase, .375); assert.equal(s.ids.horse, animal); assert.equal(s.saddle.reinGeometry, rein);
  await page.getByTestId('riding-slot-bottom').selectOption('long_skirt'); assert(await page.getByTestId('riding-skirt-warning').isVisible()); assert.equal((await riding()).recipe.slots.bottom, 'long_skirt');
  await page.getByLabel('骑乘循环播放', { exact: true }).uncheck(); await page.evaluate(() => window.__RIDING_REVIEW__.seek(.98)); await page.getByTestId('riding-play').click();
  await page.waitForFunction(() => window.__RIDING_REVIEW__.getStatus().finished); near((await riding()).status.phase, 1);
  await page.getByLabel('骑乘循环播放', { exact: true }).check(); await page.getByTestId('riding-replay').click(); await page.waitForTimeout(250); s = await riding(); valid(s); assert(!s.status.finished && s.status.phase > 0);
  checks.push('cattle male/female × simple/travel × three rider clips; species preserve rider/appearance/camera/phase; none freezes across all four species; wardrobe and replay remain valid');
  await page.getByTestId('animal-mode-horse').click(); await page.waitForFunction(() => window.__MOUNT_REVIEW__?.mountId() === 'cattle_yellow'); assert.equal(await page.getByTestId('mount-saddle').inputValue(), 'travel');
  await page.getByTestId('animal-mode-riding').click(); await page.waitForFunction(() => window.__RIDING_REVIEW__?.mountId() === 'cattle_yellow'); assert.equal(await page.getByTestId('mount-saddle').inputValue(), 'travel');
  assert.equal(await page.locator('canvas').count(), 1); checks.push('cattle body/riding round trip preserves fourth species and whole saddle kit');
  const sameCamera = (a, b) => { for (const field of ['position', 'target', 'projection']) a[field].forEach((v, i) => near(v, b[field][i])); };
  const wardrobeBefore = await page.evaluate(() => localStorage.getItem('wanhu.character.wardrobe.v5'));
  await page.getByTestId('riding-body-female').click();
  await page.getByTestId('riding-slot-top').selectOption('work_vest'); await page.getByTestId('riding-slot-bottom').selectOption('work_pants');
  await page.getByTestId('Rider_Walk').click(); await pause('riding-play');
  await page.evaluate(() => window.__RIDING_REVIEW__.seek(.375)); await page.getByTestId('riding-view-left').click();
  const box = await page.locator('canvas').boundingBox(); assert(box); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -160); await page.waitForTimeout(250);
  const savedRider = await riding();
  await page.getByTestId('animal-mode-horse').click(); await page.waitForFunction(() => window.__MOUNT_REVIEW__?.mountId() === 'cattle_yellow');
  await page.getByTestId('Cattle_Eat').click(); await pause('horse-play'); await page.evaluate(() => window.__MOUNT_REVIEW__.seek(.625)); await page.getByTestId('horse-view-front').click();
  const savedBody = await page.evaluate(() => ({ status: window.__MOUNT_REVIEW__.getStatus(), camera: window.__MOUNT_REVIEW__.cameraState() }));
  await page.getByTestId('animal-mode-riding').click(); await page.waitForFunction(() => window.__RIDING_REVIEW__?.mountId() === 'cattle_yellow');
  const restoredRider = await riding(); valid(restoredRider); near(restoredRider.status.phase, .375); assert.equal(restoredRider.status.clip, savedRider.status.clip); assert.deepEqual(restoredRider.recipe, savedRider.recipe); sameCamera(restoredRider.camera, savedRider.camera);
  assert((await page.getByTestId('riding-play').innerText()).includes('播放'));
  await page.getByTestId('animal-mode-horse').click(); await page.waitForFunction(() => window.__MOUNT_REVIEW__?.mountId() === 'cattle_yellow');
  const restoredBody = await page.evaluate(() => ({ status: window.__MOUNT_REVIEW__.getStatus(), camera: window.__MOUNT_REVIEW__.cameraState() }));
  near(restoredBody.status.phase, .625); assert.equal(restoredBody.status.clip, 'eat'); sameCamera(restoredBody.camera, savedBody.camera);
  assert((await page.getByTestId('horse-play').innerText()).includes('播放'));
  assert.equal(await page.evaluate(() => localStorage.getItem('wanhu.character.wardrobe.v5')), wardrobeBefore);
  checks.push('cattle real page round trips restore each mode phase, clip, paused state, Orbit camera/zoom and unsaved V5 rider appearance without writing wardrobe storage');
  await page.evaluate(() => sessionStorage.setItem('wanhu.mount.preview.v1.riding', '{bad-cache'));
  await page.goto(`${base}/?lab=riding&mount=cattle_yellow&saddle=simple&clip=Rider_Walk&paused=1&phase=.2&preview=resume`); await page.waitForFunction(() => window.__RIDING_REVIEW__?.mountId() === 'cattle_yellow');
  valid(await riding()); near((await riding()).status.phase, .2); assert.equal(await page.locator('canvas').count(), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('wanhu.character.wardrobe.v5')), wardrobeBefore);
  checks.push('malformed temporary preview state falls back to explicit URL without corrupting wardrobe');

}
