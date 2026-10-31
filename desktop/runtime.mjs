import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { Companion } from '../companion/server.mjs';
export async function startRuntime({ directory, name, apiPort = 37842, peerPort = 37843, discovery = true }) {
  let server;
  try { server = await new Companion({ directory, name, apiPort, peerPort, discovery }).start(); }
  catch (error) { if (error.code !== 'EADDRINUSE') throw error; }
  const config = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8'));
  const ws = new WebSocket(`ws://127.0.0.1:${server?.apiPort ?? apiPort}/extension`, ['salticus', config.token]);
  const requests = new Map();
  const listeners = new Set();
  let status;
  ws.on('error', () => {});
  ws.on('message', bytes => {
    const m = JSON.parse(bytes);
    if (m.type === 'status') { status = m.data; for (const listener of listeners) listener(status); }
    if (requests.has(m.id)) { const r = requests.get(m.id); clearTimeout(r.timer); requests.delete(m.id); m.ok ? r.resolve(m.data) : r.reject(Error(m.error)); }
  });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  return {
    get status() { return status; },
    owned: !!server,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    command(method, args = {}) {
      if (ws.readyState !== WebSocket.OPEN) return Promise.reject(Error('Local connection lost. Reopen the app'));
      const id = randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { requests.delete(id); reject(Error('Local connection timed out')); }, 8000);
        requests.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, args }));
      });
    },
    async stop() { ws.terminate(); if (server) await server.stop(); for (const r of requests.values()) { clearTimeout(r.timer); r.reject(Error('The app has quit')); } requests.clear(); },
  };
}
