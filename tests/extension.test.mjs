import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { Window } from 'happy-dom';
import { WebSocket } from 'ws';
import { Companion } from '../companion/server.mjs';

const workerCode = await readFile('dist/extension/worker.js', 'utf8');
const contentCode = await readFile('dist/extension/content.js', 'utf8');
const popupCode = await readFile('dist/extension/popup.js', 'utf8');
const popupHTML = await readFile('extension/popup.html', 'utf8');
async function until(check, timeout = 5000) {
  const start = Date.now();
  while (!await check()) { if (Date.now() - start > timeout) throw new Error('extension condition timed out'); await new Promise(r => setTimeout(r, 20)); }
}
function makeWindow(url) {
  return new Window({ url, settings: { enableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true, enableFileSystemHttpRequests: false, disableIframePageLoading: true,
    // Only our built bundles are evaluated; no website JavaScript enters this test process.
    suppressInsecureJavaScriptEnvironmentWarning: true } });
}
async function extension(t, name, startTime) {
  const directory = await mkdtemp(join(tmpdir(), 'salticus-ext-test-'));
  const server = await new Companion({ directory, name, apiPort: 0, peerPort: 0, peerHost: '127.0.0.1', discovery: false }).start();
  server.endpoints = () => [{ host: '127.0.0.1', port: server.peerPort }];
  const window = makeWindow('https://www.yifan.tv/play/test');
  const video = window.document.createElement('video'); window.document.body.append(video);
  let time = startTime, paused = true;
  Object.defineProperties(video, {
    currentTime: { get: () => time, set: value => { time = value; queueMicrotask(() => video.dispatchEvent(new window.Event('seeked'))); } },
    duration: { get: () => 3600 }, paused: { get: () => paused }, readyState: { get: () => 4 },
  });
  video.getBoundingClientRect = () => ({ width: 960, height: 540 });
  video.play = async () => { if (!paused) return; paused = false; video.dispatchEvent(new window.Event('play')); };
  video.pause = () => { if (paused) return; paused = true; video.dispatchEvent(new window.Event('pause')); };
  const runtimeListeners = [], contentListeners = [], timers = new Set(), sockets = new Set();
  const stored = { config: { url: `ws://127.0.0.1:${server.apiPort}/extension`, token: server.config.token } };
  const runtimeId = 'a'.repeat(32);
  const sendToWorker = (message, sender) => new Promise((resolve, reject) => {
    let answered = false;
    const timer = setTimeout(() => { if (!answered) reject(new Error('worker response timed out')); }, 3000); timer.unref();
    const result = runtimeListeners[0](message, sender, value => { answered = true; clearTimeout(timer); resolve(value); });
    if (result !== true && !answered) { clearTimeout(timer); resolve(); }
  });
  window.chrome = { runtime: {
    onMessage: { addListener: listener => contentListeners.push(listener) },
    sendMessage: message => sendToWorker(message, { id: runtimeId, tab: { id: 1 }, frameId: 0, documentId: 'document-1' }),
  } };
  const chrome = {
    runtime: { id: runtimeId, onMessage: { addListener: listener => runtimeListeners.push(listener) } },
    storage: { local: { get: async () => structuredClone(stored), set: async data => Object.assign(stored, structuredClone(data)) } },
    tabs: { onRemoved: { addListener() {} }, sendMessage: async (tab, message) => new Promise(resolve => contentListeners[0](message, {}, resolve)) },
    webNavigation: { getAllFrames: async () => [{ frameId: 0, documentId: 'document-1', url: window.location.href }], onCommitted: { addListener() {} } },
    scripting: { executeScript: async () => window.eval(contentCode) },
    alarms: { create() {}, onAlarm: { addListener() {} } },
  };
  class TrackedWebSocket extends WebSocket {
    constructor(...args) { super(...args); sockets.add(this); this.on('error', () => {}); }
  }
  const interval = (fn, ms) => { const id = setInterval(fn, ms); id.unref(); timers.add(id); return id; };
  const timeout = (fn, ms) => { const id = setTimeout(fn, ms); id.unref(); timers.add(id); return id; };
  const context = vm.createContext({ chrome, WebSocket: TrackedWebSocket, crypto: webcrypto, URL, console,
    setInterval: interval, setTimeout: timeout, clearTimeout, clearInterval });
  vm.runInContext(workerCode, context);
  const call = async (method, args = {}) => {
    const response = await sendToWorker({ type: 'popup', method, args }, { id: runtimeId });
    if (!response?.ok) throw new Error(response?.error ?? 'missing response'); return response.data;
  };
  t.after(async () => {
    for (const timer of timers) { clearTimeout(timer); clearInterval(timer); }
    for (const socket of sockets) socket.terminate();
    await window.happyDOM.close(); await server.stop(); await rm(directory, { recursive: true, force: true });
  });
  await until(async () => (await call('status')).connected);
  const scanned = await call('scan', { tab: 1 });
  assert.equal(scanned.players.length, 1); assert.equal(scanned.players[0].visible, true);
  await call('bind', { player: scanned.players[0] });
  return { server, call, video, setTimeSilently: value => { time = value; } };
}

test('built extensions control two DOM players over two real TLS companions without echo', async t => {
  const a = await extension(t, 'A', 600), b = await extension(t, 'B', 588);
  const { room, invite } = await a.call('createRoom', { name: 'Watch together' });
  await b.call('join', { invite });
  await until(() => a.server.pending.has(b.server.identity.id));
  await a.call('approve', { peer: b.server.identity.id });
  await until(() => a.server.peers.size === 1 && b.server.peers.size === 1);
  for (const member of [a, b]) {
    await member.call('select', { room, context: 'Episode 1' }); await member.call('anchor');
  }
  a.setTimeSilently(660); await a.video.play();
  await until(() => b.video.currentTime === 648 && !b.video.paused);
  b.video.pause(); await until(() => a.video.paused);
  assert.equal(a.video.currentTime, 660);
  const sequences = [a.server.sequence, b.server.sequence];
  await new Promise(r => setTimeout(r, 100));
  assert.deepEqual([a.server.sequence, b.server.sequence], sequences, 'programmatic media events must not loop');
  await a.call('control', { action: 'wait' });
  await until(() => b.server.waiting.get(room)?.has(a.server.identity.id));
  await assert.rejects(b.call('control', { action: 'play' }), /waiting/);
  await a.call('control', { action: 'ready' });
  await until(() => !b.server.waiting.get(room)?.size);
  assert.equal(a.video.paused, true); assert.equal(b.video.paused, true);
  await b.call('control', { action: 'play' }); await until(() => !a.video.paused);
  await b.call('select', { room, context: 'Episode 2' });
  await a.call('control', { action: 'pause' });
  await until(async () => (await b.call('status')).notice.includes('another video'));
  assert.equal(b.video.paused, false, 'different alignment contexts must not control each other');
});

test('popup renders untrusted device names as text and keeps offline controls disabled', async t => {
  const window = makeWindow('https://salticus.invalid/popup.html');
  t.after(() => window.happyDOM.close());
  window.document.write(popupHTML);
  window.chrome = { runtime: { sendMessage: async () => ({ ok: true, data: {
    connected: false, configured: false, selection: { room: '', context: 'Current content' },
    companion: { rooms: [], peers: [], pending: [{ id: 'a'.repeat(64), name: '<img src=x onerror=alert(1)>', rooms: [] }] },
    url: 'ws://127.0.0.1:37842/extension',
  } }) } };
  await window.eval(`(async () => { ${popupCode}\n })()`);
  assert.equal(window.document.querySelectorAll('#pending img').length, 0);
  assert.match(window.document.querySelector('#pending').textContent, /<img/);
  assert.equal(window.document.querySelector('#sync').disabled, true);
  assert.equal(window.document.querySelector('#setup').open, true);
});
