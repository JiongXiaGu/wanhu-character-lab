import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = process.env.REVIEW_URL ?? "http://127.0.0.1:4173";
const output = process.env.REVIEW_DIR ?? "review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1080 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [],
  captures = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function open(options = {}) {
  const query = new URLSearchParams({ review: "1", paused: "1", ...options });
  await page.goto(`${root}/?${query}`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => window.__WANHU_REVIEW__?.stats.triangles > 0,
    { timeout: 15000 },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  assert.equal(
    await page.locator('[role="alert"]').count(),
    0,
    "页面出现错误提示",
  );
}
async function capture(name, options) {
  await open(options);
  const stats = await page.evaluate(() => window.__WANHU_REVIEW__.stats);
  assert(
    stats.triangles <= 1000 &&
      stats.bones === 20 &&
      stats.bodyTriangles === 510,
  );
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  captures.push({ name, options, stats });
  console.log("CAPTURE", name, JSON.stringify(stats));
}
try {
  await capture("01-farmer-studio", {
    outfit: "farmer",
    motion: "idle",
    phase: ".25",
  });
  await capture("02-body-three-views", {
    outfit: "body",
    motion: "bind",
    view: "three",
    display: "clay",
  });
  await capture("03-body-quad-cage", {
    outfit: "body",
    motion: "bind",
    view: "front",
    display: "cage",
  });
  await capture("04-body-side", {
    outfit: "body",
    motion: "bind",
    view: "side",
    display: "clay",
  });
  await capture("05-body-back", {
    outfit: "body",
    motion: "bind",
    view: "back",
    display: "cage",
  });
  await capture("06-farmer-walk-contact", {
    outfit: "farmer",
    motion: "walk",
    phase: "0",
  });
  await capture("07-farmer-walk-pass", {
    outfit: "farmer",
    motion: "walk",
    phase: ".25",
    view: "side",
  });
  await capture("07b-farmer-walk-back-contact", {
    outfit: "farmer",
    motion: "walk",
    phase: ".5",
    view: "side",
  });
  await capture("07c-farmer-walk-forward-swing", {
    outfit: "farmer",
    motion: "walk",
    phase: ".75",
    view: "side",
  });
  await capture("08-farmer-wave", {
    outfit: "farmer",
    motion: "wave",
    phase: ".5",
  });
  await capture("09-farmer-squat", {
    outfit: "farmer",
    motion: "squat",
    phase: ".5",
  });
  await capture("10-squat-side", {
    outfit: "body",
    motion: "squat",
    phase: ".5",
    view: "side",
    display: "cage",
  });
  await capture("11-guard-equipped", {
    outfit: "guard",
    equipment: "1",
    motion: "idle",
    phase: ".25",
  });
  await capture("12-guard-walk", {
    outfit: "guard",
    equipment: "1",
    motion: "walk",
    phase: ".25",
  });
  await capture("13-archer-equipped", {
    outfit: "archer",
    equipment: "1",
    motion: "idle",
    phase: ".25",
  });
  await capture("14-archer-back", {
    outfit: "archer",
    equipment: "1",
    motion: "idle",
    phase: ".25",
    view: "back",
  });
  await capture("15-farmer-run", {
    outfit: "farmer",
    motion: "run",
    phase: ".25",
  });
  await capture("16-farmer-no-hat", {
    outfit: "farmer",
    hat: "0",
    motion: "idle",
  });
  await capture("16b-archer-farmer-hat-diy", {
    outfit: "archer",
    equipment: "1",
    headwear: "farmer_straw_hat",
    motion: "idle",
    phase: ".25",
  });
  assert.equal(await page.getByLabel("头饰").inputValue(), "farmer_straw_hat");
  assert.equal(await page.getByLabel("上衣").inputValue(), "archer_tunic");
  assert.equal(await page.getByLabel("背部").inputValue(), "archer_quiver");
  assert.equal(await page.getByLabel("左手").inputValue(), "archer_bow");
  await capture("17-body-top", {
    outfit: "body",
    motion: "bind",
    view: "top",
    display: "cage",
  });

  await capture("22-bow-raise", {
    outfit: "archer",
    equipment: "1",
    motion: "idle",
    paused: "1",
    action: "bowShot",
    actionPaused: "1",
    actionPhase: ".16",
    view: "front",
  });

  await capture("23-bow-draw-side", {
    outfit: "archer",
    equipment: "1",
    motion: "idle",
    paused: "1",
    action: "bowShot",
    actionPaused: "1",
    actionPhase: ".48",
    view: "side",
  });

  await capture("24-bow-hold-aim", {
    outfit: "archer",
    equipment: "1",
    motion: "idle",
    paused: "1",
    action: "bowShot",
    actionPaused: "1",
    actionPhase: ".62",
    aimYaw: "20",
    aimPitch: "15",
  });

  await capture("25-bow-release", {
    outfit: "archer",
    equipment: "1",
    motion: "idle",
    paused: "1",
    action: "bowShot",
    actionPaused: "1",
    actionPhase: ".78",
  });

  await capture("26-bow-walk-layer", {
    outfit: "archer",
    equipment: "1",
    motion: "walk",
    paused: "1",
    phase: ".25",
    action: "bowShot",
    actionPaused: "1",
    actionPhase: ".62",
    view: "side",
  });

  await capture("27-sword-slash", {
    outfit: "guard",
    equipment: "1",
    motion: "idle",
    paused: "1",
    action: "swordSlash",
    actionPaused: "1",
    actionPhase: ".55",
  });

  await capture("28-shield-guard", {
    outfit: "guard",
    equipment: "1",
    motion: "walk",
    paused: "1",
    phase: ".25",
    action: "shieldGuard",
    actionPaused: "1",
    actionPhase: ".5",
  });
  // 测试真实 UI，不用 hook 代替用户交互。
  await open();
  await page.getByRole("button", { name: "行走", exact: true }).click();
  await page.getByLabel("动画进度").evaluate((el) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(el, ".25");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await page.getByLabel("动画进度").inputValue(), "0.25");
  await page.getByLabel("骨骼叠加").check();
  await page.getByRole("button", { name: "结构布线", exact: true }).click();
  await page.screenshot({
    path: `${output}/18-animated-cage-and-bones.png`,
    fullPage: true,
  });
  await page.getByLabel("骨骼叠加").uncheck();
  await page.getByRole("button", { name: "着色", exact: true }).click();
  await page.getByLabel("播放", { exact: true }).click();
  await page.waitForTimeout(100);
  const before = hash(await page.locator("canvas").screenshot());
  await page.waitForTimeout(280);
  const after = hash(await page.locator("canvas").screenshot());
  assert.notEqual(before, after, "动画没有改变画面");
  await page.getByLabel("暂停", { exact: true }).click();
  await page.waitForTimeout(150);
  const paused = hash(await page.locator("canvas").screenshot());
  await page.waitForTimeout(200);
  assert.equal(
    hash(await page.locator("canvas").screenshot()),
    paused,
    "暂停后画面仍在变化",
  );
  for (let i = 0; i < 12; i++) {
    await page
      .locator(".outfit")
      .nth(i % 4)
      .click();
    await page.waitForTimeout(40);
  }

  // 真实 DIY：弓手换农户草帽，职业预设自动转为 CUSTOM。
  await page.getByRole("button", { name: /弓手/ }).click();
  await page.getByLabel("头饰", { exact: true }).selectOption("farmer_straw_hat");
  assert.equal(await page.getByLabel("头饰").inputValue(), "farmer_straw_hat");
  assert.equal(await page.getByLabel("左手").inputValue(), "archer_bow");
  assert.equal(await page.getByLabel("背部").inputValue(), "archer_quiver");
  assert.match(await page.locator(".stage-heading h2").innerText(), /自定义角色/);
  await page.screenshot({
    path: `${output}/21-ui-diy-archer-straw-hat.png`,
    fullPage: true,
  });

  // 真实 Combat UI：弓手装备决定拉弓可用性；动作层可独立暂停、逐帧与瞄准。
  await page.getByRole("button", { name: /弓手/ }).click();
  const bowActionButton = page.getByRole("button", {
    name: "拉弓射击",
    exact: true,
  });
  const swordActionButton = page.getByRole("button", {
    name: "挥砍",
    exact: true,
  });

  assert.equal(await bowActionButton.isEnabled(), true);
  assert.equal(await swordActionButton.isDisabled(), true);

  await bowActionButton.click();
  await page.getByLabel("暂停战斗动作", { exact: true }).click();

  await page.getByLabel("战斗动作进度").evaluate((el) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(el, ".62");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await page.getByLabel("水平瞄准").evaluate((el) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(el, "20");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await page.getByLabel("俯仰瞄准").evaluate((el) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(el, "15");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  assert.equal(await page.getByLabel("战斗动作进度").inputValue(), "0.62");
  assert.equal(await page.getByLabel("水平瞄准").inputValue(), "20");
  assert.equal(await page.getByLabel("俯仰瞄准").inputValue(), "15");

  await page.screenshot({
    path: `${output}/29-ui-bow-aim-controls.png`,
    fullPage: true,
  });

  await page.locator(".outfit").nth(0).click();
  assert.equal(await bowActionButton.isDisabled(), true);

  await page.getByLabel("身高", { exact: true }).press("End");
  await page.getByLabel("体格", { exact: true }).press("End");
  await page.getByRole("button", { name: "赭红", exact: true }).click();
  await page.getByLabel("头饰", { exact: true }).selectOption("none");
  await page.screenshot({
    path: `${output}/19-heavy-tall-palette.png`,
    fullPage: true,
  });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: /导出配方/ }).click();
  const download = await downloadEvent;
  const path = await download.path();
  const recipe = JSON.parse(await readFile(path, "utf8"));
  assert.equal(recipe.height, 1.92);
  assert.equal(recipe.palette, 2);
  assert.equal(recipe.slots.headwear, "none");
  assert.equal(recipe.version, 4);
  const pngEvent = page.waitForEvent("download");
  await page.getByLabel("保存截图", { exact: true }).click();
  const png = await pngEvent;
  const bytes = await readFile(await png.path());
  assert.equal(bytes.subarray(1, 4).toString(), "PNG");
  assert(bytes.length > 10000);
  await page.getByRole("button", { name: "正面", exact: true }).click();
  await page.getByRole("button", { name: "正面", exact: true }).click();
  await open({
    motion: "bad-value",
    view: "bad-value",
    display: "bad-value",
    phase: "NaN",
  });
  assert.equal(
    await page.evaluate(() => window.__WANHU_REVIEW__.motion),
    "idle",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await open({ outfit: "farmer" });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "移动端水平溢出",
  );
  await page.screenshot({ path: `${output}/20-mobile.png`, fullPage: true });
  assert.deepEqual(errors, [], "浏览器控制台有错误");
  await writeFile(
    `${output}/browser-review.json`,
    JSON.stringify(
      {
        pass: true,
        commit: process.env.GITHUB_SHA ?? "local",
        captures,
        checks: [
          "rendered WebGL",
          "UI preset changes",
          "slot-based DIY wardrobe",
          "layered combat action mask",
          "bow draw stages and aim controls",
          "sword and shield actions",
          "animation plays",
          "animation pauses",
          "timeline scrubs",
          "bone and wire overlays",
          "height and build",
          "palette",
          "recipe export",
          "PNG capture",
          "invalid query fallback",
          "mobile layout",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Browser interaction tests passed. Screenshots still require human visual review.",
  );
} catch (e) {
  await page
    .screenshot({ path: `${output}/failure.png`, fullPage: true })
    .catch(() => {});
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify({ message: String(e), errors, captures }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
}
