'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

function supportedNode(version) {
  const [major, minor] = version.split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 12);
}
function dependencyHash(root) {
  const hash = crypto.createHash('sha256');
  for (const file of ['package.json', 'package-lock.json']) {
    hash.update(file);
    hash.update(fs.readFileSync(path.join(root, file)));
  }
  return hash.digest('hex');
}
function chooseUpdate(branch, dirty) {
  return branch === 'main' && !dirty;
}
function git(args) {
  return spawnSync('git', ['-C', ROOT, ...args], {
    encoding: 'utf8', timeout: 35000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
  });
}
function tryUpdate() {
  if (!fs.existsSync(path.join(ROOT, '.git'))) {
    console.log('[更新] ZIP 下载目录，跳过 Git 更新。');
    return;
  }
  const branch = git(['branch', '--show-current']);
  const status = git(['status', '--porcelain']);
  if (branch.status !== 0 || status.status !== 0) {
    console.log('[更新] Git 不可用，继续当前本地版本。');
    return;
  }
  if (!chooseUpdate(branch.stdout.trim(), status.stdout.trim() !== '')) {
    console.log('[更新] 有本地修改或当前分支不是 main；为保护工作内容，跳过自动更新。');
    return;
  }
  console.log('[更新] 正在尝试 git pull --ff-only；不会覆盖本地改动。');
  const result = git(['pull', '--ff-only']);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status !== 0) {
    console.log('[更新] 无法快进更新，继续当前本地版本。可稍后手动 git pull。');
    if (result.stderr) process.stdout.write(result.stderr);
  }
}
function npmProcess(args, sync) {
  // Windows 的 npm 是 .cmd；传给 shell 的参数在本文件中固定，不接受用户命令。
  const windows = process.platform === 'win32';
  const command = windows ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const argv = windows ? ['/d', '/s', '/c', 'npm.cmd ' + args.join(' ')] : args;
  return (sync ? spawnSync : spawn)(command, argv, { cwd: ROOT, stdio: 'inherit' });
}
function portAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}
async function choosePort(start = 5173) {
  for (let port = start; port < start + 10; port++) {
    if (await portAvailable(port)) return port;
  }
  throw new Error('5173–5182 端口均被占用。请关闭之前的预览窗口后重试。');
}
async function main() {
  if (!supportedNode(process.versions.node)) {
    throw new Error('需要 Node.js 22.12 或更新版本；当前为 ' + process.versions.node);
  }
  if (!fs.existsSync(path.join(ROOT, 'package.json'))) throw new Error('未找到项目根目录。');
  console.log('\nWanhu Character Lab · V3\nNode ' + process.versions.node + '\n');
  tryUpdate();
  if (!fs.existsSync(path.join(ROOT, 'package-lock.json'))) {
    throw new Error('缺少 package-lock.json，请先拉取最新 main。');
  }
  const hash = dependencyHash(ROOT);
  const marker = path.join(ROOT, 'node_modules', '.wanhu-install-hash');
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const previous = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim() : '';
  if (previous !== hash || !fs.existsSync(vite)) {
    console.log('[依赖] 首次运行或依赖有变化，执行 npm ci。');
    const result = npmProcess(['ci'], true);
    if (result.error || result.status !== 0) throw new Error('依赖安装失败；检查 npm、网络或代理配置后重试。');
    fs.writeFileSync(marker, hash + '\n');
  } else console.log('[依赖] 与 lockfile 一致，无需重新安装。');
  const port = await choosePort();
  console.log('\n本地地址：http://127.0.0.1:' + port + '\n保持窗口开启；Ctrl+C 停止。\n');
  const child = npmProcess(['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--open'], false);
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code === null ? 0 : code; });
}
module.exports = { supportedNode, dependencyHash, chooseUpdate, choosePort, portAvailable };
if (require.main === module) main().catch(error => { console.error('[错误] ' + error.message); process.exitCode = 1; });
