# Developer preview user guide

## 1. Start the local companion

Each participant needs Node.js 22+, npm, OpenSSL, and Chrome 120+. Run on each computer:

```sh
git clone https://github.com/CNJ-Devs/salticus.git
cd salticus
npm ci
npm run build
npm start -- --name My-device
```

Keep the terminal running. The first start generates a certificate, private key, and local key in `~/.salticus`; later starts reuse identity and pairings. The local extension API listens on `127.0.0.1:37842`, and peer TLS connections listen on TCP 37843.

On macOS, after installing dependencies, `salticus.command` builds the extension and starts the companion. This version is not a standalone app and does not start at login.

## 2. Load the Chrome extension

1. Enter `chrome://extensions` in the address bar.
2. Enable Developer mode and click Load unpacked.
3. Select the repository's `dist/extension` directory.
4. Open Salticus on the video website tab.
5. Enter the local address and key from the terminal, then click Connect companion.

Each computer has its own local key. Never use your partner's key. It protects local controls and is absent from invitations.

After updating code, run `npm run build`, reload the extension, and refresh open video pages. Browser or worker restarts require rebinding to avoid reusing stale page identities.

## 3. Connect with your partner

1. Either participant clicks Create room, then Copy invitation, and sends it through their own chat tool.
2. Your partner opens Have an invitation? in the extension, pastes the invitation, and joins.
3. Your partner reads their full device fingerprint. Compare it with the join request before clicking Allow this device.
4. Wait for the participant to show as connected. Reachable paths usually connect within seconds; paired devices reconnect automatically.

Reusable invitations contain room details, a device fingerprint, and candidate addresses, with no video, account, or local key. If an address changes and LAN rediscovery fails, copy a fresh invitation and rejoin to update it.

Anyone in the room can invite. Paired participants exchange approved device information and attempt direct connections; remaining peers can continue after the inviter leaves. Broadcasts reach only directly connected room participants, without forwarding. Check the actual connection count. Revocation and invitation expiry UI are not yet available; this preview is for small groups who know each other.

### Same LAN

Invitations include local network addresses, and mDNS rediscovers paired devices. Allow the requested local-network or inbound access. Guest Wi-Fi, client isolation, and firewalls may block connections.

### Remote devices on a virtual LAN

Connect both devices through your own network tool first, then advertise your virtual LAN address:

```sh
npm start -- --name My-device --advertise YOUR_VIRTUAL_LAN_ADDRESS
```

Repeat `--advertise` for several candidates. Salticus neither installs nor operates a virtual LAN.

### Remote devices using public IPv6 or port mapping

Supply reachable public IPv6 with `--advertise`. For router mappings, supply a public IP or DNS name and map external TCP 37843 to device TCP 37843. Use `--peer-port` consistently for a different port.

Keep extension API port 37842 private. Peer connections use TLS 1.3 and verify certificate fingerprints.

LAN discovery and multiple addresses cannot traverse every NAT. There is currently no STUN, TURN, project signaling, or relay. Without a reachable path, devices do not show as connected.

## 4. Bind and synchronize video

1. Each participant opens the main video and clicks Play once to load it.
2. Open the extension and click Scan current tab. If several videos exist, use duration, visibility, and source to bind the main player.
3. For inaccessible cross-origin players, Allow embedded player requests only the discovered origins. Scan again after granting access.
4. Identical versions can use anchor 0. For different sources, pause at the same scene and click Set current scene as anchor on each device.
5. Use the same content label, such as Episode 1. Confirm anchors again after an episode or label change. Switching rooms or labels resets the current anchor to 0.
6. Sync from here sends the sender's progress and playback state to connected peers. Page play, pause, and seek actions also broadcast.

For ads or buffering, click Wait for me, then I am ready. Once everyone clears their own wait, click Play together. The first version neither detects ads nor resumes automatically.

If Chrome blocks remote play, click Play locally once and sync again. Rebind after navigation, an episode change, or player replacement. Closed Shadow DOM, inaccessible frames, and custom site players may remain unsupported.

## 5. Permissions and data

- Default host access: `yifan.tv` and its subdomains.
- `activeTab`, `scripting`: scan and control video on user interaction.
- `webNavigation`: identify frames, navigation, and expired bindings.
- `storage`: save local companion settings and the selected room, restricted to trusted extension contexts.
- `alarms`: restore the local companion connection.
- `clipboardWrite`: copy invitations when clicked.
- Request other HTTP/HTTPS origins only when needed for a selected site or embedded player.

The companion stores identity, rooms, and pairings in its data directory. Current video bindings and anchors live in memory and require rebinding after restart. There is no historical anchor library.

Participants exchange control actions, anchor-relative positions, content labels, identities, and connection information. Salticus reads no sign-in credentials, transmits no media, and sets no proxy. No telemetry or project online service is required.

## 6. Development checks

```sh
npm test
npm run check
npm run package
```

Tests use real local TLS connections and built-extension DOM tests. The live Yifan site, Chrome behavior, macOS permissions, and remote connectivity still need in-person validation.
