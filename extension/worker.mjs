import { DEFAULT_CONTEXT, finite } from '../shared/protocol.mjs';
import { mediaIdentity, choosePlayer } from '../shared/media.mjs';
import { NATIVE_HOST } from '../shared/extension-id.mjs';

let socket, connected = false, companion, reconnectTimer, binding, selection, lastError = '', notice = '';
let config = {}, boot;
let operationQueue = Promise.resolve();
let needsInitialSync = true, pendingSync, connectedPeers = 0;
const requests = new Map();
const bootState = async () => {
  await chrome.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
  const stored = await chrome.storage.local.get(['config', 'selection']);
  config = stored.config ?? {}; selection = stored.selection ?? { room: '', context: DEFAULT_CONTEXT };
  // A worker restart must not silently rebind a stale document or media element.
  binding = null;
  connect();
};
boot = bootState();

function rpc(method, args = {}) {
  if (!connected || socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Connect to the local companion first'));
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { requests.delete(id); reject(new Error('Local companion timed out')); }, 8000);
    requests.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, args }));
  });
}

function disconnect() {
  const previous = socket; socket = null; connected = false;
  if (previous) previous.close();
  for (const request of requests.values()) { clearTimeout(request.timer); request.reject(new Error('Local companion disconnected')); }
  requests.clear();
}

function connect() {
  clearTimeout(reconnectTimer); disconnect();
  let current;
  if (!config.token && chrome.runtime.connectNative) {
    let port;
    try { port = chrome.runtime.connectNative(NATIVE_HOST); }
    catch { lastError = 'Open the Salticus app'; reconnectTimer = setTimeout(connect, 3000); return; }
    current = { readyState: 0, send: value => port.postMessage(JSON.parse(value)), close: () => port.disconnect() };
    port.onMessage.addListener(message => {
      if (socket !== current) return;
      if (message.type === 'native-error') { lastError = message.error; return; }
      if (current.readyState !== WebSocket.OPEN) { current.readyState = WebSocket.OPEN; current.onopen?.(); }
      current.onmessage?.({ data: JSON.stringify(message) });
    });
    port.onDisconnect.addListener(() => { void chrome.runtime.lastError; if (socket === current) { lastError = 'Open the Salticus app; for first-time setup, load its matching extension'; current.onclose?.(); } });
  } else if (config.token) current = new WebSocket(config.url, ['salticus', config.token]);
  else return;
  socket = current;
  current.onopen = () => { if (socket !== current) return; connected = true; lastError = ''; };
  current.onerror = () => { if (socket === current) lastError = 'Local connection failed. Check that the companion is running and the address and key are correct'; };
  current.onclose = () => {
    if (socket !== current) return;
    disconnect(); companion = null; needsInitialSync = true; pendingSync = null;
    reconnectTimer = setTimeout(connect, 3000);
  };
  current.onmessage = ({ data }) => {
    if (socket !== current) return;
    try {
      const message = JSON.parse(data);
      if (message.id && requests.has(message.id)) {
        const request = requests.get(message.id); requests.delete(message.id); clearTimeout(request.timer);
        message.ok ? request.resolve(message.data) : request.reject(new Error(message.error));
      } else if (message.type === 'status') {
        companion = message.data;
        if (companion.lastError) lastError = companion.lastError;
        enqueue(async () => {
          const count = companion.peers.filter(p => p.connected && p.rooms.includes(selection.room)).length;
          if (connectedPeers && !count) { needsInitialSync = true; pendingSync = null; }
          connectedPeers = count;
          if (companion.activeRoom && selection.room !== companion.activeRoom) {
            selection = { room: companion.activeRoom, context: binding?.mediaKey ?? DEFAULT_CONTEXT, manual: false };
            if (binding) binding.anchor = 0;
            // A newly created, empty room has nobody to catch up with. This
            // also covers creation through the desktop UI before opening a tab.
            needsInitialSync = hasRoomContacts(); pendingSync = null;
            await chrome.storage.local.set({ selection });
          }
          if (binding) await requestState();
        }).catch(() => {});
      }
      else if (message.type === 'event') enqueue(() => receive(message.event));
    } catch { lastError = 'The companion sent an unrecognized message'; }
  };
}

function enqueue(action) {
  const task = operationQueue.then(action);
  operationQueue = task.catch(error => { lastError = error.message; });
  return task;
}

async function player(method, args = {}, target = binding) {
  if (!target) throw new Error('Bind a video on the page first');
  const result = await chrome.tabs.sendMessage(target.tab, { channel: 'salticus-player', method, ...args },
    { frameId: target.frame, ...(target.documentId ? { documentId: target.documentId } : {}) });
  if (!result?.ok) throw new Error(result?.error ?? 'Cannot access the player. Reload the page and bind it again');
  return result.data;
}

function waits(context = selection.context) {
  return Object.entries(companion?.waiting?.[selection.room] ?? {}).filter(([, value]) => value === context);
}

function hasRoomContacts() {
  return companion?.peers.some(p => p.rooms.includes(selection.room)) ?? true;
}

async function receive(event) {
  if (!binding || event.room !== selection.room) return;
  if (event.target && event.target !== companion?.peer) return;
  if (event.context !== selection.context) { if (!['request-state', 'state'].includes(event.action)) notice = 'Your partner is watching different content. Open manual alignment for different sources'; return; }
  if (event.action === 'request-state') {
    // Simultaneous starts use a temporary tie-break; there is no fixed host.
    if (pendingSync && companion.peer > event.sender) return;
    if (pendingSync) { pendingSync = null; needsInitialSync = false; }
    await broadcast('state', await player('snapshot'), { request: event.request, target: event.sender });
    return;
  }
  if (event.action === 'state') {
    if (!pendingSync || pendingSync.id !== event.request || pendingSync.until < Date.now()) return;
    pendingSync = null; needsInitialSync = false;
  } else { pendingSync = null; needsInitialSync = false; }
  if (event.action === 'ready') { notice = 'Your partner is ready. Click Play together to continue'; return; }
  const effective = { ...event, paused: event.paused || waits(event.context).length > 0 };
  await player('apply', { event: effective, anchor: binding.anchor });
  notice = event.action === 'wait' ? 'Your partner needs to wait. Playback paused' : 'Synchronized with your partner';
}

async function broadcast(action, state, extra = {}) {
  if (!binding) throw new Error('Bind a video first');
  if (!selection.room) throw new Error('Create or join a room first');
  let result;
  try {
    result = await rpc('send', { room: selection.room, context: selection.context, action,
      position: state.time - binding.anchor, paused: action === 'wait' ? true : state.paused, ...extra });
  } catch (error) {
    if (error.message.includes('waiting') && binding) await player('apply', { event: { action: 'wait', paused: true }, anchor: binding.anchor });
    throw error;
  }
  if (!['request-state', 'state'].includes(action)) notice = result.recipients ? `Sent to ${result.recipients} peers` : 'Waiting for a peer connection; alignment will follow automatically';
  return result;
}

async function requestState() {
  if (!connected || !binding?.mediaKey || selection.manual || !selection.room || !needsInitialSync) return;
  if (pendingSync?.until > Date.now()) return;
  if (!companion?.peers.some(p => p.connected && p.rooms.includes(selection.room))) return;
  const request = crypto.randomUUID(); pendingSync = { id: request, until: Date.now() + 5000 };
  await broadcast('request-state', await player('snapshot'), { request });
}

async function scan(tabId) {
  const frames = await chrome.webNavigation.getAllFrames({ tabId });
  const players = [];
  const deniedOrigins = new Set();
  let inaccessible = 0;
  for (const frame of frames ?? []) {
    if (!/^https?:/.test(frame.url)) continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId, frameIds: [frame.frameId] }, files: ['content.js'] });
      const data = await player('list', {}, { tab: tabId, frame: frame.frameId, documentId: frame.documentId });
      players.push(...data.players.map(item => ({ ...item, tab: tabId, frame: frame.frameId,
        documentId: frame.documentId, origin: new URL(frame.url).origin })));
    } catch { inaccessible++; deniedOrigins.add(`${new URL(frame.url).origin}/*`); }
  }
  return { players: players.sort((a, b) => Number(b.visible) - Number(a.visible) || b.area - a.area), inaccessible, deniedOrigins: [...deniedOrigins] };
}

async function command(method, args) {
  if (method !== 'status') lastError = '';
  if (method === 'status') {
    let media;
    if (binding) { try { media = await player('snapshot'); } catch { binding = null; } }
    return { connected, companion, selection, binding, media, lastError, notice, configured: !!config.token,
      transport: config.token ? 'development' : 'app',
      url: config.url ?? 'ws://127.0.0.1:37842/extension' };
  }
  if (method === 'connectApp') { config = {}; await chrome.storage.local.set({ config }); connect(); return {}; }
  if (method === 'configure') {
    const url = new URL(args.url);
    if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || url.pathname !== '/extension' || url.search || url.hash || url.username || url.password) throw new Error('Local companion address must be ws://127.0.0.1:port/extension');
    if (!/^[a-f0-9]{64}$/.test(args.token)) throw new Error('Copy the complete local connection key shown by the companion');
    config = { url: url.href, token: args.token };
    await chrome.storage.local.set({ config }); connect(); return {};
  }
  if (method === 'scan') return scan(args.tab);
  if (method === 'autoBind') {
    if (binding) return {};
    const result = await scan(args.tab); const candidate = choosePlayer(result.players);
    if (!candidate) return result;
    await command('bind', { player: candidate }); return {};
  }
  if (method === 'bind') {
    if (binding) await player('unbind').catch(() => {});
    const data = await player('bind', { player: args.player.id }, args.player);
    binding = { tab: args.player.tab, frame: args.player.frame, documentId: args.player.documentId,
      documentKey: data.documentKey, player: args.player.id, anchor: 0, label: args.player.label,
      mediaKey: await mediaIdentity(args.player) };
    if (!selection.manual) selection.context = binding.mediaKey ?? DEFAULT_CONTEXT;
    needsInitialSync = hasRoomContacts(); pendingSync = null;
    lastError = ''; notice = 'Video ready. Matching videos align automatically and follow playback controls.';
    await requestState(); return {};
  }
  if (method === 'anchor') {
    const state = await player('snapshot');
    const value = args.value === undefined ? state.time : Number(args.value);
    if (!finite(value, 0) || (state.duration !== null && value > state.duration)) throw new Error('Anchor must be within the video duration');
    if (!selection.manual) { selection.manual = true; selection.context = DEFAULT_CONTEXT; await chrome.storage.local.set({ selection }); }
    needsInitialSync = false; pendingSync = null;
    binding.anchor = value; notice = 'Anchor saved for this binding. Check that both of you selected the same scene.'; return {};
  }
  if (method === 'select') {
    if (typeof args.context !== 'string' || !args.context.trim() || args.context.length > 120) throw new Error('Enter a content label');
    if (!companion?.rooms.some(room => room.id === args.room)) throw new Error('Select a valid room');
    if (binding && (selection.room !== args.room || selection.context !== args.context.trim())) {
      binding.anchor = 0; notice = 'Content changed; the anchor was reset to 0. Re-align different sources.';
    }
    selection = { room: args.room, context: args.manual === false ? (binding?.mediaKey ?? DEFAULT_CONTEXT) : args.context.trim(), manual: args.manual !== false };
    if (!selection.manual && binding) binding.anchor = 0;
    needsInitialSync = true; pendingSync = null;
    await rpc('selectRoom', { room: args.room });
    await chrome.storage.local.set({ selection }); return {};
  }
  if (method === 'control') {
    needsInitialSync = false; pendingSync = null;
    companion = await rpc('status');
    const roomError = companion.rooms.find(room => room.id === selection.room)?.error;
    if (roomError) throw new Error(roomError);
    const state = await player('snapshot');
    if (args.action === 'ready') return broadcast('ready', state);
    if (!['sync', 'play', 'pause', 'wait'].includes(args.action)) throw new Error('Unknown playback operation');
    if (['play', 'sync'].includes(args.action) && waits().length) throw new Error('A participant is still waiting. Each person must click I am ready first');
    const paused = ['pause', 'wait'].includes(args.action) ? true : args.action === 'play' ? false : state.paused;
    const updated = await player('apply', { event: { action: args.action, position: state.time - binding.anchor, paused }, anchor: binding.anchor });
    return broadcast(args.action, updated);
  }
  if (['createRoom', 'join'].includes(method)) {
    const result = await rpc(method, args);
    selection = { room: result.room, context: binding?.mediaKey ?? DEFAULT_CONTEXT, manual: false };
    if (binding) binding.anchor = 0;
    needsInitialSync = method === 'join'; pendingSync = null;
    await requestState();
    await chrome.storage.local.set({ selection }); return result;
  }
  if (['invite', 'approve'].includes(method)) return rpc(method, args);
  throw new Error('Unknown operation');
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (sender.tab) {
    if (message.type === 'playerAvailable') {
      if (sender.tab.url?.startsWith('https://') && selection?.room) enqueue(async () => {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (active?.id === sender.tab.id && !binding) await command('autoBind', { tab: active.id });
      }).catch(() => {});
      return;
    }
    if (!binding || sender.tab.id !== binding.tab || sender.frameId !== binding.frame ||
        message.documentKey !== binding.documentKey || message.player !== binding.player) return;
    if (message.type === 'bindingLost') { binding = null; lastError = selection.manual ? 'Video changed. Confirm your manual anchor again' : 'Video changed. Identifying the new video…'; return; }
    if (message.type === 'playerAction') {
      enqueue(async () => {
        needsInitialSync = false; pendingSync = null;
        if (!finite(message.state?.time, 0) || typeof message.state.paused !== 'boolean') return;
        if (message.action === 'play' && waits().length) {
          await player('apply', { event: { action: 'wait', paused: true }, anchor: binding.anchor });
          notice = 'A participant is still waiting; playback remains paused'; return;
        }
        await broadcast(message.action, message.state);
      }).catch(() => {});
    }
    return;
  }
  if (message.type !== 'popup') return;
  boot.then(() => enqueue(() => command(message.method, message.args ?? {})))
    .then(data => respond({ ok: true, data }), error => { lastError = error.message; respond({ ok: false, error: error.message }); });
  return true;
});

chrome.tabs.onRemoved.addListener(tab => { if (binding?.tab === tab) binding = null; });
chrome.webNavigation.onCommitted.addListener(details => {
  if (binding?.tab === details.tabId && (details.frameId === 0 || details.frameId === binding.frame)) {
    binding = null; lastError = selection.manual ? 'Video changed. Confirm your manual anchor again' : 'Video changed. Identifying the new video…';
  }
});
chrome.alarms.create('salticus-connection', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(async () => { await boot; if (!socket) connect(); else if (connected) rpc('status').catch(() => {}); });
// Chrome 116+ resets the MV3 worker idle timer on WebSocket traffic.
setInterval(() => { if (connected) rpc('status').catch(() => {}); }, 20000);
