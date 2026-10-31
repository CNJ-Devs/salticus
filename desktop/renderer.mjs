const $ = id => document.getElementById(id);
const call = (method, args) => window.salticus.call(method, args);
let selectedRoom = '', current, pendingSignature = '', memberSignature = '', roomSignature = '', busy = false, settingsDirty = false;
const node = (tag, text) => { const e = document.createElement(tag); e.textContent = text; return e; };
function feedback(text, error = false) { $('feedback').textContent = text; $('feedback').classList.toggle('error', error); }
async function run(action) { if (busy) return; busy = true; try { await action(); await refresh(); } catch (error) { feedback(error.message, true); } finally { busy = false; } }
async function refresh() {
  const result = await call('status'); current = result.status;
  $('health').textContent = result.running ? 'Ready on this device' : 'Needs attention'; $('health').classList.toggle('online', result.running);
  if (!result.running) { feedback(result.error, true); return; }
  selectedRoom = current.activeRoom ?? selectedRoom;
  if (!current.rooms.some(r => r.id === selectedRoom)) selectedRoom = current.rooms[0]?.id ?? '';
  const signature = JSON.stringify([current.rooms, selectedRoom]);
  if (signature !== roomSignature) { roomSignature = signature; $('room').replaceChildren(...current.rooms.map(room => { const option = node('option', room.name); option.value = room.id; return option; })); $('room').value = selectedRoom; }
  $('invite').disabled = !selectedRoom;
  if (!settingsDirty) { $('name').value = current.name; $('addresses').value = (current.advertise ?? []).join('\n'); }
  $('fingerprint').textContent = current.peer;
  const peers = current.peers.filter(p => p.rooms.includes(selectedRoom));
  const roomError = current.rooms.find(r => r.id === selectedRoom)?.error;
  if (roomError) { feedback(roomError, true); $('invite').disabled = true; }
  else if (current.lastError) feedback(current.lastError, true);
  $('member-count').textContent = peers.some(p => p.connected) ? 'Partner connected' : peers.length ? 'Waiting for your partner to come online' : 'Waiting for your partner to join';
  const members = JSON.stringify(peers);
  if (members !== memberSignature) { memberSignature = members; $('members').replaceChildren(...peers.map(peer => { const row = node('div', ''); row.className = 'member'; row.append(node('span', peer.name), node('small', peer.connected ? `● ${peer.route}` : '○ Waiting for connection')); return row; })); }
  const pending = JSON.stringify(current.pending);
  if (pending !== pendingSignature) { pendingSignature = pending; $('pending').replaceChildren(...current.pending.map(peer => {
    const row = node('div', `${peer.name} wants to watch together`); row.className = 'pending';
    row.append(node('p', 'Compare the device fingerprint with your partner before allowing:'), node('code', peer.id));
    const button = node('button', 'Allow this device'); button.className = 'secondary'; button.onclick = () => run(() => call('approve', { peer: peer.id })); row.append(button); return row;
  })); }
}
$('create').onclick = () => run(async () => { const result = await call('createRoom', { name: 'Watch together' }); selectedRoom = result.room; await call('copyInvite', { room: selectedRoom }); feedback('Room created and invitation copied. Send it to your partner.'); });
$('invite').onclick = () => run(async () => { await call('copyInvite', { room: selectedRoom }); feedback('Invitation copied.'); });
$('room').onchange = () => run(async () => { selectedRoom = $('room').value; await call('selectRoom', { room: selectedRoom }); });
$('extension').onclick = () => run(async () => { await call('showExtension'); feedback('Extension folder found. For the first setup, load it in the Chrome extension manager. Future connections are automatic.'); });
$('guide').onclick = () => run(() => call('openGuide'));
$('join-form').onsubmit = event => { event.preventDefault(); run(async () => { const result = await call('join', { invite: $('invitation').value.trim() }); selectedRoom = result.room; $('invitation').value = ''; feedback('Joined. Waiting for your partner to verify the fingerprint and allow the connection.'); }); };
$('settings').addEventListener('input', () => { settingsDirty = true; });
$('settings').onsubmit = event => { event.preventDefault(); run(async () => { await call('configure', { name: $('name').value.trim(), advertise: $('addresses').value.split(/\s+/).filter(Boolean) }); settingsDirty = false; feedback('Settings saved.'); }); };
window.salticus.onStatus(() => { if (!busy) refresh().catch(e => feedback(e.message, true)); });
await refresh().catch(e => feedback(e.message, true));
setInterval(() => { if (!busy) refresh().catch(e => feedback(e.message, true)); }, 3000);
