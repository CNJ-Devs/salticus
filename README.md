# Salticus

**Play locally. Watch together.**

Salticus is an open-source P2P watch-together tool. Everyone uses their own device, account, source, and network. Salticus exchanges playback controls and progress so people in different places can watch together.

## Project status

A **v0.2.0 desktop preview** is available: a macOS app installer and Chrome extension. The app bundles its runtime and offers room, device, and network UI, without Node.js, OpenSSL, or a terminal for users. Matching videos select the main player, align initially, and follow playback controls; different versions use manual anchors.

The initial target is [Yifan](https://www.yifan.tv/) on **macOS + Chrome**. Live checks verified binding, play/pause, anchors, TLS sync, manual waits, the paused-seek autoplay fix, and native play/pause propagation. Automated tests cover two extensions, DOM media, real TLS, and three-peer connectivity. **Two remote devices still need testing**; see the [validation record](docs/yifan-validation.md).

Longer-term goals include other browsers, mobile devices, and local software with no UI or configuration UI only, connecting devices and controlling browsers or native apps as platform APIs allow.

## Getting started

Both participants download the [macOS installer](https://github.com/CNJ-Devs/salticus/releases/tag/v0.2.0) and launch Salticus. Use Find browser extension for first-time loading, create/join a room, and open the same episode. The app and extension connect without a pasted local key.

Preview bundles use ad-hoc signing. **Apple distribution signing, notarization, and Chrome Web Store publication are not complete**. First-time extension loading is manual, and macOS may block downloaded apps. Apple silicon startup is verified; Intel needs hardware testing.

Remote devices need a reachable address or the user's virtual LAN. Enter direct candidates in Device and network settings. LAN discovery does not traverse remote NAT.

See the [user guide](docs/getting-started.md) for setup, permissions, and troubleshooting.

## Development and verification

```sh
npm test
npm run check
npm run package
npm run desktop:package
```

Development needs Node.js 22+ and npm. `npm run desktop:dev` launches the app. Tests build the extension and cover automatic alignment, content isolation, anchors, player events, Native Messaging, TLS identity, group connections, and reconnection. DOM media is simulated; live-site evidence is separate. Installers live in ignored `dist/`.

## Product principles

- **Local playback**: no screen, audio, or video transmission and no video proxy. Each person signs in and accesses the source independently.
- **Equal participants**: no permanent controller. Everyone can sync, play, pause, and seek by default.
- **Automatic matching-video alignment**: recognized matching videos use zero offset, fetch current progress when joining, and propagate normal controls.
- **Local alignment for different sources**: manually find the same scene only for different versions and save local offsets. Re-align is an occasional correction.
- **No project-operated services**: the project runs no signaling, room, or relay servers. Connection options must state their dependencies and reachability limits.
- **Try available paths**: attempt encrypted connections to configured or discovered LAN, public, or virtual LAN addresses. Validate Bluetooth and nearby options later.
- **Small groups of people who know each other**: solve watching together for couples and friends before considering very large rooms.
- **Extension as the first client**: keep the synchronization protocol separate from player adapters so other clients can follow.

## First-phase goals

1. Two people open Yifan independently and bind their local video tabs.
2. Join the same room over direct TLS connections between local companions, confirming invitations and device fingerprints.
3. Align matching videos automatically; set matching-scene anchors only for different sources.
4. Request current state automatically on joining. Either participant can still broadcast local progress manually when correction is needed.
5. Share play, pause, and seek controls without rebroadcasting received operations in a loop.
6. Provide Wait for me / I am ready to handle ads and buffering manually at first.
7. Show connection state clearly and allow one-click resynchronization after reconnecting.

Automatic ad detection, automatic resume, continuous drift correction, other sites, and native app control will follow evidence from actual use.

## Connection limits

The project must not operate servers. Direct serverless connectivity on every network cannot be guaranteed.

The connection layer tries reachable IPv6/port mappings, LAN, or a user's virtual LAN and falls back among available paths. Bluetooth is a future local-companion option for nearby devices, not remote connectivity.

The app provides TLS 1.3 direct connections and mDNS discovery. The extension connects through Chrome Native Messaging; development retains an authenticated loopback WebSocket. Identity, rooms, and pairings live in `~/.salticus` on each device. Invitations include fingerprints and addresses; send them only to intended partners.

Room participants can invite others. Paired participants exchange approved device identities and attempt a mesh; TLS fingerprints verify identities. The first inviter has no extra playback rights, and remaining connected participants can continue after they leave.

User-configured signaling, STUN, and TURN are deferred and are not first-version dependencies. Multiple transports cannot create a missing remote network path. Explain why a connection is unavailable and what can be configured.

See the [product and technical baseline](docs/product-direction.md).

## Open source

Licensed under the [MIT License](LICENSE). CNJ-Devs manages the repository; users may use and modify the code under MIT. Organization ownership and licensing are separate.
