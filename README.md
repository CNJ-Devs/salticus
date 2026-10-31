# Salticus

**Play locally. Watch together.**

Salticus is a planned open-source P2P watch-together tool. Everyone plays video with their own device, account, source, and network. Salticus exchanges playback controls and progress so people in different places can watch together.

## Project status

A **v0.1.0 developer preview** is available: a Chrome extension and a Node.js companion on your own computer. It supports video binding, manual anchors, synchronized playback and seeking, manual waiting, encrypted direct connections, invitations, and automatic reconnection.

The initial target is [Yifan](https://www.yifan.tv/) on **macOS + Chrome** for both users. Automated tests cover two extension contexts, two DOM videos, real TLS connections, and a three-participant mesh. **The live Yifan page, installed Chrome extension, and actual remote network still need testing**; see the [validation record](docs/yifan-validation.md).

Longer-term goals include other browsers, mobile devices, and local software with no UI or configuration UI only, connecting devices and controlling browsers or native apps as platform APIs allow.

## Getting started

Requires Node.js 22+, npm, OpenSSL (for initial device certificate generation), and Chrome 120+. Each participant runs:

```sh
git clone https://github.com/CNJ-Devs/salticus.git
cd salticus
npm ci
npm run build
npm start -- --name My-device
```

1. Open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select the repository's `dist/extension`.
2. Open the video page and enter the companion's local address and connection key in the extension.
3. Create a room and send its invitation through your own chat tool. Your partner pastes it to join. Compare the full device fingerprint before allowing the first connection.
4. Each participant starts the main video once, then scans for and binds it through the extension.
5. Identical versions use anchor 0 by default. For different sources, pause at the same scene and set each local anchor. Use the same content label.
6. Click Sync from here. Play, pause, and seek actions on the page also go to connected participants.

Remote connections require a reachable address or the user's virtual LAN. Include a public or virtual LAN address with `--advertise ADDRESS`; map public TCP 37843 to the companion if needed. mDNS finds paired LAN devices but does not traverse remote NAT.

See the [user guide](docs/getting-started.md) for setup, permissions, and troubleshooting.

## Development and verification

```sh
npm test
npm run check
npm run package
```

`npm test` builds the extension, then tests anchor conversion, player events, TLS identity checks, room isolation, group connections, reconnection, and built-extension messaging. DOM media behavior is simulated and does not validate a real site. Build outputs live in ignored `dist/`.

## Product principles

- **Local playback**: no screen, audio, or video transmission and no video proxy. Each person signs in and accesses the source independently.
- **Equal participants**: no permanent controller. Everyone can sync, play, pause, and seek by default.
- **Local anchors**: participants find the same scene manually and save their own anchor and offset. Different sources may use different timestamps.
- **Broadcast on demand**: whoever clicks Sync broadcasts their current state to connected room participants.
- **No project-operated services**: the project runs no signaling, room, or relay servers. Connection options must state their dependencies and reachability limits.
- **Try available paths**: attempt encrypted connections to configured or discovered LAN, public, or virtual LAN addresses. Validate Bluetooth and nearby options later.
- **Small groups of people who know each other**: solve watching together for couples and friends before considering very large rooms.
- **Extension as the first client**: keep the synchronization protocol separate from player adapters so other clients can follow.

## First-phase goals

1. Two people open Yifan independently and bind their local video tabs.
2. Join the same room over direct TLS connections between local companions, confirming invitations and device fingerprints.
3. Set local anchors at the same scene manually.
4. Either participant clicks Sync from here; the other seeks to the corresponding position and adopts that playback state.
5. Share play, pause, and seek controls without rebroadcasting received operations in a loop.
6. Provide Wait for me / I am ready to handle ads and buffering manually at first.
7. Show connection state clearly and allow one-click resynchronization after reconnecting.

Automatic ad detection, automatic resume, continuous drift correction, other sites, and native app control will follow evidence from actual use.

## Connection limits

The project must not operate servers. Direct serverless connectivity on every network cannot be guaranteed.

The connection layer tries reachable IPv6/port mappings, LAN, or a user's virtual LAN and falls back among available paths. Bluetooth is a future local-companion option for nearby devices, not remote connectivity.

The companion provides TLS 1.3 direct connections and mDNS discovery. The extension uses an authenticated loopback-only WebSocket. Each device stores identity, rooms, and pairings in `~/.salticus`. Invitations contain certificate fingerprints and connection addresses; share them only with intended viewing partners.

Room participants can invite others. Paired participants exchange approved device identities and attempt a mesh; TLS fingerprints verify identities. The first inviter has no extra playback rights, and remaining connected participants can continue after they leave.

User-configured signaling, STUN, and TURN are deferred and are not first-version dependencies. Multiple transports cannot create a missing remote network path. Explain why a connection is unavailable and what can be configured.

See the [product and technical baseline](docs/product-direction.md).

## Open source

Licensed under the [MIT License](LICENSE). CNJ-Devs manages the repository; users may use and modify the code under MIT. Organization ownership and licensing are separate.
