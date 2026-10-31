import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { Companion } from '../companion/server.mjs';
import { parseInvite, makeInvite } from '../shared/protocol.mjs';

async function eventually(predicate, timeout = 6000) {
  const start = Date.now();
  while (!predicate()) { if (Date.now() - start > timeout) throw new Error('condition timed out'); await new Promise(resolve => setTimeout(resolve, 20)); }
}
async function instance(t, name) {
  const directory = await mkdtemp(join(tmpdir(), 'salticus-test-'));
  const server = await new Companion({ directory, name, apiPort: 0, peerPort: 0, peerHost: '127.0.0.1', discovery: false }).start();
  server.endpoints = () => [{ host: '127.0.0.1', port: server.peerPort }];
  t.after(async () => { await server.stop(); await rm(directory, { recursive: true, force: true }); });
  return server;
}
function connectExtension(server, token = server.config.token, origin = `chrome-extension://${'a'.repeat(32)}`) {
  return new WebSocket(`ws://127.0.0.1:${server.apiPort}/extension`, ['salticus', token], { origin });
}
function rpc(ws, method, args = {}) {
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { ws.off('message', handler); reject(new Error('RPC timeout')); }, 3000);
    function handler(bytes) {
      const message = JSON.parse(bytes);
      if (message.id !== id) return;
      clearTimeout(timeout); ws.off('message', handler);
      message.ok ? resolve(message.data) : reject(new Error(message.error));
    }
    ws.on('message', handler); ws.send(JSON.stringify({ id, method, args }));
  });
}
async function pair(a, b) {
  const { room, invite } = await a.command('createRoom', { name: 'Watch together' });
  await b.command('join', { invite });
  await eventually(() => a.pending.has(b.identity.id));
  assert.equal(a.peers.has(b.identity.id), false, 'unknown device must wait for approval');
  await a.command('approve', { peer: b.identity.id });
  a.connectKnown(); b.connectKnown();
  await eventually(() => a.peers.has(b.identity.id) && b.peers.has(a.identity.id));
  return room;
}

test('two independent companions authenticate, sync both directions, wait independently and reconnect', async t => {
  const a = await instance(t, 'A'), b = await instance(t, 'B');
  const room = await pair(a, b);
  const wa = connectExtension(a), wb = connectExtension(b);
  wa.on('error', () => {}); wb.on('error', () => {});
  t.after(() => { wa.terminate(); wb.terminate(); });
  await Promise.all([once(wa, 'open'), once(wb, 'open')]);
  const receivedA = [], receivedB = [];
  wa.on('message', bytes => { const msg = JSON.parse(bytes); if (msg.type === 'event') receivedA.push(msg.event); });
  wb.on('message', bytes => { const msg = JSON.parse(bytes); if (msg.type === 'event') receivedB.push(msg.event); });
  const args = { room, context: 'Episode 1', position: 60, paused: false };
  const sync = await rpc(wa, 'send', { ...args, action: 'sync' });
  assert.equal(sync.recipients, 1);
  await eventually(() => receivedB.length === 1);
  assert.equal(receivedB[0].position, 60); assert.equal(receivedA.length, 0, 'sender is not echoed');
  await rpc(wb, 'send', { ...args, action: 'pause', paused: true });
  await eventually(() => receivedA.length === 1); assert.equal(receivedA[0].action, 'pause');
  // Retransmission and older sequence numbers cannot execute again.
  a.write(a.peers.get(b.identity.id).socket, { type: 'event', event: sync.event });
  await new Promise(resolve => setTimeout(resolve, 80)); assert.equal(receivedB.length, 1);
  await rpc(wa, 'send', { ...args, action: 'wait', paused: true });
  await rpc(wb, 'send', { ...args, action: 'wait', paused: true });
  await eventually(() => a.waiting.get(room)?.size === 2 && b.waiting.get(room)?.size === 2);
  await rpc(wa, 'send', { ...args, action: 'ready', paused: true });
  await eventually(() => a.waiting.get(room)?.size === 1 && b.waiting.get(room)?.size === 1);
  assert.equal(a.waiting.get(room).has(b.identity.id), true);
  await rpc(wb, 'send', { ...args, action: 'ready', paused: true });
  await eventually(() => !a.waiting.get(room)?.size && !b.waiting.get(room)?.size);
  a.peers.get(b.identity.id).socket.destroy();
  await eventually(() => !a.peers.size && !b.peers.size);
  const beforeReconnect = receivedB.length;
  const offline = await rpc(wa, 'send', { ...args, action: 'sync' }); assert.equal(offline.recipients, 0);
  a.connectKnown(); b.connectKnown();
  await eventually(() => a.peers.size === 1 && b.peers.size === 1);
  assert.equal(receivedB.length, beforeReconnect, 'offline commands are never replayed');
  await rpc(wa, 'send', { ...args, action: 'sync' });
  await eventually(() => receivedB.length === beforeReconnect + 1);
  assert.equal((await stat(join(a.options.directory, 'peer-key.pem'))).mode & 0o777, 0o600);
});

test('local API rejects wrong tokens and website origins', async t => {
  const server = await instance(t, 'A');
  for (const [token, origin] of [['f'.repeat(64), `chrome-extension://${'a'.repeat(32)}`], [server.config.token, 'https://www.yifan.tv']]) {
    const ws = connectExtension(server, token, origin);
    ws.on('error', () => {});
    const [, response] = await once(ws, 'unexpected-response');
    assert.equal(response.statusCode, 403);
    ws.terminate();
  }
});

test('a wrong certificate fingerprint cannot connect or create a trusted device', async t => {
  const a = await instance(t, 'A'), b = await instance(t, 'B');
  const { invite } = await a.command('createRoom', { name: 'Watch together' });
  const bad = { ...parseInvite(invite), peer: 'f'.repeat(64) };
  await b.command('join', { invite: makeInvite(bad) });
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(b.peers.size, 0); assert.equal(a.pending.size, 0);
});

test('a peer cannot send an event for a room it has not joined', async t => {
  const a = await instance(t, 'A'), b = await instance(t, 'B');
  await pair(a, b);
  const { room } = await a.command('createRoom', { name: 'Another room' });
  const { recipients } = await a.command('send', { room, context: 'Episode 1', position: 1, paused: true, action: 'pause' });
  assert.equal(recipients, 0);
  const malicious = { v: 1, id: randomUUID(), session: randomUUID(), seq: 1, room, sender: b.identity.id, context: 'Episode 1', action: 'pause', position: 1, paused: true };
  b.write(b.peers.get(a.identity.id).socket, { type: 'event', event: malicious });
  await eventually(() => !a.peers.has(b.identity.id));
});

test('joining a second room with a known peer requires a new room approval', async t => {
  const a = await instance(t, 'A'), b = await instance(t, 'B');
  await pair(a, b);
  const { room, invite } = await a.command('createRoom', { name: 'Second room' });
  await b.command('join', { invite });
  // Joining renegotiates room membership without asking the user to reconnect.
  await eventually(() => a.pending.has(b.identity.id));
  await a.command('approve', { peer: b.identity.id });
  await eventually(() => a.peers.get(b.identity.id)?.rooms.includes(room) && b.peers.get(a.identity.id)?.rooms.includes(room));
});

test('a local waiting state survives reconnect and is restored on the other device', async t => {
  const a = await instance(t, 'A'), b = await instance(t, 'B');
  const room = await pair(a, b);
  await a.command('send', { room, context: 'Episode 1', position: 1, paused: true, action: 'wait' });
  await eventually(() => b.waiting.get(room)?.has(a.identity.id));
  a.peers.get(b.identity.id).socket.destroy();
  await eventually(() => !a.peers.size && !b.peers.size);
  a.connectKnown(); b.connectKnown();
  await eventually(() => a.peers.size === 1 && b.peers.size === 1 && b.waiting.get(room)?.has(a.identity.id));
  await assert.rejects(b.command('send', { room, context: 'Episode 1', position: 1, paused: false, action: 'play' }), /waiting/);
});

test('three room members discover each other and keep syncing after the inviter leaves', async t => {
  const a = await instance(t, 'A'), b = await instance(t, 'B'), c = await instance(t, 'C');
  const room = await pair(a, b);
  await c.command('join', { invite: a.invite(room) });
  await eventually(() => a.pending.has(c.identity.id));
  await a.command('approve', { peer: c.identity.id });
  await eventually(() => a.peers.size === 2 && b.peers.size === 2 && c.peers.size === 2);
  assert.equal(b.config.contacts[c.identity.id].introducedBy, a.identity.id);
  await a.stop();
  await eventually(() => b.peers.size === 1 && c.peers.size === 1);
  const wc = connectExtension(c); wc.on('error', () => {}); t.after(() => wc.terminate()); await once(wc, 'open');
  const received = [];
  wc.on('message', bytes => { const msg = JSON.parse(bytes); if (msg.type === 'event') received.push(msg.event); });
  const { recipients } = await b.command('send', { room, context: 'Episode 1', position: 42, paused: true, action: 'sync' });
  assert.equal(recipients, 1);
  await eventually(() => received.length === 1);
  assert.equal(received[0].sender, b.identity.id); assert.equal(received[0].position, 42);
});
