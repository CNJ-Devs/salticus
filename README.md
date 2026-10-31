# Salticus

**Play locally. Watch together.**

Salticus is a planned open-source P2P watch-together tool. Everyone plays video with their own device, account, source, and network. Salticus exchanges playback controls and progress so people in different places can watch together.

## Project status

The project is gathering requirements and validating technical options. No installable software is available yet. The first phase targets desktop browser extensions and Yifan. Other browsers, mobile devices, and native clients are longer-term goals, subject to platform APIs.

## Product principles

- **Local playback**: no screen, audio, or video transmission and no video proxy. Each person signs in and accesses the source independently.
- **Equal participants**: no permanent controller. Everyone can sync, play, pause, and seek by default.
- **Local anchors**: participants find the same scene manually and save their own anchor and offset. Different sources may use different timestamps.
- **Broadcast on demand**: whoever clicks Sync broadcasts their current state to connected room participants.
- **No project-operated services**: the project runs no signaling, room, or relay servers. Connection options must state their dependencies and reachability limits.
- **Small groups of people who know each other**: solve watching together for couples and friends before considering very large rooms.
- **Extension as the first client**: keep the synchronization protocol separate from player adapters so other clients can follow.

## First-phase goals

1. Two people open Yifan independently and bind their local video tabs.
2. Establish a P2P connection and join the same room; validate the transport first.
3. Set local anchors at the same scene manually.
4. Either participant clicks Sync from here; the other seeks to the corresponding position and adopts that playback state.
5. Share play, pause, and seek controls without rebroadcasting received operations in a loop.
6. Provide Wait for me / I am ready to handle ads and buffering manually at first.
7. Show connection state clearly and allow one-click resynchronization after reconnecting.

Automatic ad detection, automatic resume, continuous drift correction, other sites, and native app control will follow evidence from actual use.

## Connection limits

The project must not operate servers. Direct serverless connectivity on every network cannot be guaranteed.

Candidates include manually exchanged WebRTC connection details, reachable IPv6 or port mappings, and a user's LAN or virtual LAN. STUN, TURN, and signaling have different roles. User-selected services remain to be validated; public third-party services must be disclosed as dependencies.

See the [product and technical baseline](docs/product-direction.md).

## Open source

Licensed under the [MIT License](LICENSE). CNJ-Devs manages the repository; users may use and modify the code under MIT. Organization ownership and licensing are separate.
