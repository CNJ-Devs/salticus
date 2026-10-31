const $ = id => document.getElementById(id);
let state, candidates = [], deniedOrigins = [], busy = false, roomSignature = '', lastNotice = '', feedbackUntil = 0;
async function call(method, args = {}) {
  const result = await chrome.runtime.sendMessage({ type: 'popup', method, args });
  if (!result?.ok) throw new Error(result?.error ?? 'The extension worker did not respond. Reopen the popup');
  return result.data;
}
function feedback(message, error = false) {
  $('feedback').textContent = message; $('feedback').classList.toggle('error', error); feedbackUntil = Date.now() + 5000;
}
const time = seconds => {
  if (!Number.isFinite(seconds)) return '--:--';
  const value = Math.floor(seconds); return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
};
function element(tag, text, className) {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
async function run(action) {
  if (busy) return;
  busy = true;
  try { await action(); await refresh(); }
  catch (error) { feedback(error.message, true); }
  finally { busy = false; }
}
async function refresh() {
  state = await call('status');
  $('connection').textContent = state.connected ? 'Local app connected' : 'Companion disconnected';
  $('connection').classList.toggle('online', state.connected);
  if (!state.configured) $('setup').open = true;
  if (document.activeElement !== $('server')) $('server').value = state.url;
  const signature = JSON.stringify([state.companion?.rooms, state.selection.room]);
  if (signature !== roomSignature) {
    roomSignature = signature;
    const rooms = state.companion?.rooms ?? [];
    $('room').replaceChildren(...(rooms.length ? rooms.map(room => { const option = element('option', room.name); option.value = room.id; return option; }) : [element('option', 'Create or join a room first')]));
    $('room').value = state.selection.room;
  }
  if (document.activeElement !== $('context')) $('context').value = state.selection.context;
  if (document.activeElement !== $('anchor')) $('anchor').value = state.binding?.anchor ?? 0;
  $('binding').replaceChildren();
  if (state.binding && state.media) {
    $('binding').append(element('strong', time(state.media.time)), element('span', `${state.media.paused ? 'Paused' : 'Playing'} · Anchor ${time(state.binding.anchor)}`));
  } else $('binding').textContent = 'Open the main video on its website, then bind it.';
  $('identity').textContent = state.companion?.peer ?? 'Shown after connecting to the local companion';
  const peers = (state.companion?.peers ?? []).filter(peer => peer.rooms.includes(state.selection.room));
  $('members').replaceChildren(element('div', peers.length ? `${peers.filter(p => p.connected).length} peers connected` : 'Your partner appears here after joining and being approved.'));
  for (const peer of peers) {
    const row = element('div', null, 'member'); row.append(element('span', peer.name), element('span', peer.connected ? `● ${peer.route}` : '○ Waiting for connection')); $('members').append(row);
  }
  $('pending').replaceChildren();
  for (const peer of state.companion?.pending ?? []) {
    const card = element('div', null, 'pending');
    card.append(element('p', `${peer.name} wants to join. Verify the device fingerprint before allowing:`), element('code', peer.id, 'fingerprint'));
    const approve = element('button', 'Allow this device', 'secondary full');
    approve.addEventListener('click', () => run(() => call('approve', { peer: peer.id })));
    card.append(approve); $('pending').append(card);
  }
  const waiting = Object.entries(state.companion?.waiting?.[state.selection.room] ?? {}).filter(([, context]) => context === state.selection.context);
  $('waiting').textContent = waiting.length ? `${waiting.length} participants are waiting. Clear your own wait when ready, then play together.` : '';
  for (const button of document.querySelectorAll('[data-action]')) button.disabled = !state.connected || !state.binding || !state.selection.room;
  for (const id of ['create']) $(id).disabled = !state.connected;
  $('invite').disabled = !state.connected || !state.selection.room;
  for (const id of ['anchor-now']) $(id).disabled = !state.binding;
  if (Date.now() > feedbackUntil) {
    if (state.lastError) feedback(state.lastError, true);
    else if (state.notice && state.notice !== lastNotice) { lastNotice = state.notice; feedback(state.notice); }
  }
}

$('setup-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
  await call('configure', { url: $('server').value.trim(), token: $('token').value.trim() }); $('token').value = ''; $('setup').open = false; feedback('Connecting to the local companion…');
}); });
$('create').addEventListener('click', () => run(async () => { await call('createRoom', { name: 'Watch together' }); feedback('Room created. Copy the invitation and send it to your partner.'); }));
$('invite').addEventListener('click', () => run(async () => {
  const result = await call('invite', { room: state.selection.room }); await navigator.clipboard.writeText(result.invite); feedback('Invitation copied. Send it to your partner, verify their device fingerprint, and allow them to join.');
}));
$('join-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
  await call('join', { invite: $('invitation').value.trim() }); $('invitation').value = ''; feedback('Joined. Waiting for your partner to verify the device fingerprint and allow the connection.');
}); });
$('room').addEventListener('change', () => run(() => call('select', { room: $('room').value, context: $('context').value })));
$('context-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
  await call('select', { room: $('room').value, context: $('context').value }); feedback('Content label saved. Check that both of you use the same label.');
}); });

async function scan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url ?? '')) throw new Error('Open the extension on a video page');
  const result = await call('scan', { tab: tab.id });
  candidates = result.players; deniedOrigins = result.deniedOrigins ?? [];
  $('players').replaceChildren(); $('grant').hidden = !deniedOrigins.length;
  for (const candidate of candidates) {
    const row = element('div', null, 'player'), info = element('div', `${candidate.label} · ${time(candidate.time)} / ${time(candidate.duration)}`);
    info.append(element('small', `${candidate.origin}${candidate.visible ? '' : ' · hidden'}${candidate.ready < 1 ? ' · not loaded' : ''}`));
    const bind = element('button', 'Bind', 'secondary'); bind.addEventListener('click', () => run(async () => { await call('bind', { player: candidate }); $('players').replaceChildren(); }));
    row.append(info, bind); $('players').append(row);
  }
  if (!candidates.length) feedback(result.inaccessible ? 'No accessible video found. Grant access to the embedded player and retry.' : 'No video found. Click Play on the page first.');
}
$('scan').addEventListener('click', () => run(scan));
$('grant').addEventListener('click', () => {
  // The permission request itself stays directly inside this user gesture.
  const permission = chrome.permissions.request({ origins: deniedOrigins });
  run(async () => { if (!await permission) throw new Error('Player access was not granted'); await scan(); });
});
$('anchor-now').addEventListener('click', () => run(() => call('anchor')));
$('anchor-form').addEventListener('submit', event => { event.preventDefault(); run(() => call('anchor', { value: Number($('anchor').value) })); });
for (const button of document.querySelectorAll('[data-action]')) button.addEventListener('click', () => run(() => call('control', { action: button.dataset.action })));
await refresh().catch(error => feedback(error.message, true));
setInterval(() => { if (!busy) refresh().catch(error => feedback(error.message, true)); }, 1000);
