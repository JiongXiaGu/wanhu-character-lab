import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const types = await readFile("src/character/v3/types.ts", "utf8");
const review = await readFile("scripts/review-v3.mjs", "utf8");

const motionMatch = types.match(/export type Motion\s*=\s*([\s\S]*?);/);
assert(motionMatch, "找不到 Motion 类型定义");

const motions = [
  ...motionMatch[1].matchAll(/"([^"]+)"/g),
].map((match) => match[1]);

const matrixMatch = review.match(
  /const ACTION_SCREENSHOT_MATRIX\s*=\s*\[([\s\S]*?)\];/,
);
assert(matrixMatch, "找不到 ACTION_SCREENSHOT_MATRIX");

const reviewed = new Set(
  [...matrixMatch[1].matchAll(/id:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  ),
);

const missing = motions.filter((motion) => !reviewed.has(motion));
const unknown = [...reviewed].filter(
  (motion) => !motions.includes(motion),
);

assert.deepEqual(
  missing,
  [],
  "新增 Motion 后必须加入 GitHub Actions 截图矩阵",
);
assert.deepEqual(
  unknown,
  [],
  "截图矩阵存在已经删除或拼写错误的 Motion",
);

console.log(
  "Screenshot review coverage PASS:",
  motions.join(", "),
);
