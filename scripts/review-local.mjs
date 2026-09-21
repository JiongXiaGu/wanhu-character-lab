import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

// 只运行当前工作副本；不推送、不更新基线、不部署，不把截图生成写成人工审查通过。
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) throw new Error('需要 Node.js >=22.12');
for (const file of ['node_modules/tsx/dist/cli.mjs', 'node_modules/vite/bin/vite.js', 'node_modules/playwright/package.json']) {
  if (!existsSync(file)) throw new Error('请先在项目根目录执行 npm ci，并执行 npx playwright install chromium');
}
const full = process.argv.includes('--full');
const wardrobe = process.argv.includes('--wardrobe');
const lightwear = process.argv.includes('--lightwear');
if(wardrobe && lightwear)throw new Error('请选择 --wardrobe 或 --lightwear，不可同时使用');
const children = new Set();
function launch(args, env = process.env) {
  const child = spawn(process.execPath, args, { cwd: process.cwd(), env, stdio: 'inherit' });
  children.add(child);
  const done = new Promise(resolve => {
    child.once('error', error => { children.delete(child); resolve({ code: -1, error }); });
    child.once('close', (code, signal) => { children.delete(child); resolve({ code, signal }); });
  });
  return { child, done };
}
async function run(args, env) {
  const result = await launch(args, env).done;
  if (result.code !== 0) throw new Error(`命令失败：${args.join(' ')}；${result.error ?? result.signal ?? result.code}`);
}
async function freePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const address = socket.address();
  const port = address.port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}
async function stopChildren() {
  const live = [...children];
  for (const child of live) child.kill('SIGTERM');
  await delay(700);
  for (const child of live) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  void stopChildren().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
});

try {
  await run(['node_modules/tsx/dist/cli.mjs', 'scripts/prepare-mixamo.ts']);
  const port = await freePort();
  const server = launch(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort']);
  const url = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.child.exitCode !== null || !children.has(server.child)) throw new Error('本地 Vite 服务提前结束');
    try { ready = (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* 启动期间允许连接尚未建立。 */ }
    if (ready) break;
    await delay(300);
  }
  if (!ready) throw new Error('本地 Vite 启动超时');
  await run([lightwear ? 'scripts/review-lightwear.mjs' : wardrobe ? 'scripts/review-wardrobe-batch.mjs' : 'scripts/review-deformation.mjs', ...(full ? [] : ['--quick'])], {
    ...process.env, REVIEW_URL: url, REVIEW_STAGE: 'local',
  });
  console.log(`本地实机截图已写入 ${lightwear ? 'review-wardrobe-batch/lightwear-local' : (wardrobe ? 'review-wardrobe-batch/local' : 'review-deformation/local')}/。请实际看图；此命令不代替完整自动回归。`);
} finally {
  await stopChildren();
}
