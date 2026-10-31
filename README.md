# Salticus

**Play locally. Watch together.**

Salticus is an open-source P2P watch-together tool. Everyone uses their own device, account, source, and network. Salticus exchanges playback controls and progress so people in different places can watch together.

## Project status

**Current development direction: two participants per room.** The app can keep several independent rooms with equal permissions. Version 0.3.0 source rejects third participants and removes introductions/mesh; its installer has not been released.

A **v0.2.1 desktop preview** is available: a macOS installer and Chrome extension. Runtime, room/device/network UI, automatic matching-video selection and initial alignment are included. Users need no Node.js, OpenSSL, or terminal. Different versions use manual anchors.

The first target is [Yifan](https://www.yifan.tv/) on **macOS + Chrome**. Live checks verified binding, play/pause, anchors, TLS sync, waiting, the paused-seek fix, and native play/pause propagation. Automated coverage includes two extensions, DOM players, real TLS, pair limits, and room isolation. **Remote two-device testing remains pending**; see the [validation record](docs/yifan-validation.md).

Longer-term goals include other browsers, mobile devices, and local software with no UI or configuration UI only, connecting devices and controlling browsers or native apps as platform APIs allow.

## Getting started

Both participants download the [macOS installer](https://github.com/CNJ-Devs/salticus/releases/tag/v0.2.1), launch Salticus, and use Find browser extension for first-time loading. Create/join a room and open the same episode. The app and extension connect without a pasted local key.

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

Development requires Node.js 22+ and npm. `npm run desktop:dev` launches the app. Tests build the extension and cover automatic alignment, content isolation, anchors, media events, Native Messaging, TLS, pair limits, room isolation, and reconnection. DOM media is simulated; live results are separate. Ignored `dist/` holds installers.

## Product principles

- **Local playback**: no screen, audio, or video transmission and no video proxy. Each person signs in and accesses the source independently.
- **Equal participants**: no permanent controller. Everyone can sync, play, pause, and seek by default.
- **Automatic matching-video alignment**: recognized matching videos use zero offset, fetch current progress when joining, and propagate normal controls.
- **Local alignment for different sources**: manually find the same scene only for different versions and save local offsets. Re-align is an occasional correction.
- **No project-operated services**: the project runs no signaling, room, or relay servers. Connection options must state their dependencies and reachability limits.
- **Try available paths**: attempt encrypted connections to configured or discovered LAN, public, or virtual LAN addresses. Validate Bluetooth and nearby options later.
- **Two-person rooms first**: one partner per room, with multiple independent rooms saved. Design group viewing separately later.
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

Each development-version room binds one partner with TLS fingerprint verification. Both can control playback. Offline partners keep their pairing; create another room to watch with someone else. Room controls stay isolated, and the player selects one active room at a time.

User-configured signaling, STUN, and TURN are deferred and are not first-version dependencies. Multiple transports cannot create a missing remote network path. Explain why a connection is unavailable and what can be configured.

See the [product and technical baseline](docs/product-direction.md).

## Open source

Licensed under the [MIT License](LICENSE). CNJ-Devs manages the repository; users may use and modify the code under MIT. Organization ownership and licensing are separate.
