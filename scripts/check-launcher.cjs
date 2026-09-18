'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { supportedNode, dependencyHash, chooseUpdate, choosePort } = require('./start-local.cjs');
async function test() {
  assert(supportedNode('22.12.0'));
  assert(supportedNode('24.0.0'));
  assert(!supportedNode('22.11.0'));
  assert(!supportedNode('20.19.0'));
  assert(chooseUpdate('main', false));
  assert(!chooseUpdate('main', true));
  assert(!chooseUpdate('rebuild/character-v3', false));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wanhu launcher test '));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
    fs.writeFileSync(path.join(tmp, 'package-lock.json'), '{"lockfileVersion":3}');
    const first = dependencyHash(tmp);
    assert.equal(dependencyHash(tmp), first);
    fs.appendFileSync(path.join(tmp, 'package-lock.json'), '\n');
    assert.notEqual(dependencyHash(tmp), first);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(5173, '127.0.0.1', resolve); });
  try { const port = await choosePort(); assert(port > 5173 && port < 5183); }
  finally { await new Promise(resolve => server.close(resolve)); }
  console.log('Launcher logic PASS: Node version, safe-update policy, dependency hash and occupied-port fallback. Windows CMD execution requires a Windows machine.');
}
test().catch(error => { console.error(error); process.exitCode = 1; });
