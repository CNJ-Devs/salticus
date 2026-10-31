import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Companion } from '../companion/server.mjs';
import { startRuntime } from '../desktop/runtime.mjs';
import { registerNativeHost } from '../desktop/native-registration.mjs';
import { EXTENSION_ID } from '../shared/extension-id.mjs';
import { mediaIdentity, choosePlayer } from '../shared/media.mjs';

test('desktop runtime creates its own identity without an external openssl and exposes rooms through the app API', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'salticus-desktop-'));
  const runtime = await startRuntime({ directory, name: 'Desktop device', apiPort: 0, peerPort: 0, discovery: false });
  t.after(async () => { await runtime.stop(); await rm(directory, { recursive: true, force: true }); });
  const created = await runtime.command('createRoom', { name: 'Created in the app' });
  const status = await runtime.command('status');
  assert.equal(status.rooms[0].id, created.room); assert.equal(status.activeRoom, created.room);
  await runtime.command('configure', { name: 'Updated name', advertise: ['100.64.0.2'] });
  assert.equal((await runtime.command('status')).name, 'Updated name');
  assert.deepEqual((await runtime.command('status')).advertise, ['100.64.0.2']);
});

test('installed Native Messaging bridge exchanges real framed Chrome messages without a manually copied token', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'salticus-native-'));
  const server = await new Companion({ directory, apiPort: 0, peerPort: 0, discovery: false }).start();
  const child = spawn(process.execPath, [resolve('desktop/native-client.cjs')], { env: { ...process.env, SALTICUS_DATA_DIR: directory, SALTICUS_API_PORT: String(server.apiPort) }, stdio: ['pipe', 'pipe', 'pipe'] });
  let buffered = Buffer.alloc(0); const messages = [];
  child.stdout.on('data', chunk => { buffered = Buffer.concat([buffered, chunk]); while (buffered.length >= 4 && buffered.length >= buffered.readUInt32LE() + 4) { const length = buffered.readUInt32LE(); messages.push(JSON.parse(buffered.subarray(4, length + 4))); buffered = buffered.subarray(length + 4); } });
  t.after(async () => { child.kill(); await server.stop(); await rm(directory, { recursive: true, force: true }); });
  const body = Buffer.from(JSON.stringify({ id: 'test-room', method: 'createRoom', args: { name: 'Native connection' } }));
  const header = Buffer.alloc(4); header.writeUInt32LE(body.length);
  // A fragmented frame may arrive before the local WebSocket has opened.
  child.stdin.write(header.subarray(0, 2)); child.stdin.write(Buffer.concat([header.subarray(2), body]));
  const deadline = Date.now() + 8000;
  while (!messages.some(m => m.id === 'test-room')) { if (Date.now() > deadline) throw Error('Native Messaging response timeout'); await new Promise(r => setTimeout(r, 20)); }
  const result = messages.find(m => m.id === 'test-room'); assert.equal(result.ok, true); assert.equal(server.config.rooms[result.data.room].name, 'Native connection');
  assert.equal(messages.some(m => JSON.stringify(m).includes(server.config.token)), false, 'local token never reaches the extension');
  const exit = once(child, 'exit'); child.stdin.end(); await exit;
});

test('native registration uses a stable allowlist and safely quotes application paths', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'salticus-host-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = await registerNativeHost({ home: directory, executable: "/Applications/Jay's Salticus.app/Contents/MacOS/Salticus", clientPath: '/app/native-client.cjs', appPath: '/Applications/Salticus.app', directory: join(directory, 'support'), platform: 'darwin' });
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(manifest.allowed_origins.includes(`chrome-extension://${EXTENSION_ID}/`), true);
  assert.equal(manifest.allowed_origins.some(o => o.includes('*')), false);
  assert.match(await readFile(manifest.path, 'utf8'), /Jay'\\''s Salticus/);
});

test('automatic matching distinguishes episodes and versions and ignores short ad players', async () => {
  const a = { pageUrl: 'https://www.yifan.tv/play/show?episode=1&utm_source=foo', pageTitle: 'Episode one', duration: 2400, visible: true, ready: 4, area: 1000 };
  const same = { ...a, pageUrl: 'https://www.yifan.tv/play/show?utm_source=bar&episode=1' };
  assert.equal(await mediaIdentity(a), await mediaIdentity(same));
  assert.notEqual(await mediaIdentity(a), await mediaIdentity({ ...a, pageUrl: 'https://www.yifan.tv/play/show?episode=2' }));
  assert.notEqual(await mediaIdentity(a), await mediaIdentity({ ...a, duration: 2412 }));
  assert.equal(choosePlayer([{ ...a, duration: 1, area: 2000 }, a]), a);
  assert.equal(choosePlayer([a, { ...a }]), null, 'ambiguous players require an explicit choice');
});
