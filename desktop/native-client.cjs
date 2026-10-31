// Chrome Native Messaging host. Node is supplied by the installed Electron app.
const { readFile } = require('node:fs/promises');
const { homedir } = require('node:os');
const { join } = require('node:path');
const { spawn } = require('node:child_process');
let input = Buffer.alloc(0), socket, queued = [], stopped = false;
function send(value) {
  const body = Buffer.from(JSON.stringify(value));
  if (body.length > 1024 * 1024) return;
  const header = Buffer.alloc(4); header.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([header, body]));
}
process.stdin.on('data', chunk => {
  input = Buffer.concat([input, chunk]);
  while (input.length >= 4) {
    const size = input.readUInt32LE();
    if (size > 32768) return process.exit(1);
    if (input.length < size + 4) return;
    try { const value = JSON.parse(input.subarray(4, size + 4));
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
      else if (queued.length < 32) queued.push(value);
    } catch { return process.exit(1); }
    input = input.subarray(4 + size);
  }
});
process.stdin.on('end', () => { stopped = true; socket?.close(); process.exit(0); });
async function connect() {
  const config = JSON.parse(await readFile(join(process.env.SALTICUS_DATA_DIR || join(homedir(), '.salticus'), 'config.json'), 'utf8'));
  return new Promise((resolve, reject) => {
    let opened = false;
    socket = new WebSocket(`ws://127.0.0.1:${process.env.SALTICUS_API_PORT || 37842}/extension`, ['salticus', config.token]);
    const timer = setTimeout(() => { socket.close(); reject(Error('timeout')); }, 2000);
    socket.addEventListener('open', () => { opened = true; clearTimeout(timer); for (const value of queued) socket.send(JSON.stringify(value)); queued = []; resolve(); });
    socket.addEventListener('message', event => { try { send(JSON.parse(event.data)); } catch {} });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(Error('connection')); });
    socket.addEventListener('close', () => { if (opened && !stopped) process.exit(0); });
  });
}
(async () => {
  // No shell command or remote URL comes from browser messages.
  const appPath = process.env.SALTICUS_APP_PATH;
  if (process.platform === 'darwin' && appPath) spawn('/usr/bin/open', ['-g', appPath, '--args', '--background'], { stdio: 'ignore' }).unref();
  for (let attempt = 0; attempt < 15; attempt++) {
    try { await connect(); return; } catch { await new Promise(r => setTimeout(r, 400)); }
  }
  send({ type: 'native-error', error: 'Open the Salticus app, then retry the connection.' });
  process.exit(1);
})().catch(() => process.exit(1));
