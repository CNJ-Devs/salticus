# Salticus

**Play locally. Watch together.**

Salticus is a planned open-source P2P watch-together tool. Everyone plays video with their own device, account, source, and network. Salticus exchanges playback controls and progress so people in different places can watch together.

## Project status

The project is gathering requirements and validating technical options; no installable software exists yet. Start with desktop browser extensions and Yifan. Longer-term targets include other browsers, mobile devices, and a local service with no UI or only configuration UI to connect devices and control browsers or native apps, subject to platform APIs.

The first environment is confirmed: both users run **macOS + Chrome** on [Yifan](https://www.yifan.tv/). Initial public-page and script inspection is complete. Actual controls and two-device connectivity remain untested; see the [validation record](docs/yifan-validation.md).

## Product principles

- **Local playback**: no screen, audio, or video transmission and no video proxy. Each person signs in and accesses the source independently.
- **Equal participants**: no permanent controller. Everyone can sync, play, pause, and seek by default.
- **Local anchors**: participants find the same scene manually and save their own anchor and offset. Different sources may use different timestamps.
- **Broadcast on demand**: whoever clicks Sync broadcasts their current state to connected room participants.
- **No project-operated services**: the project runs no signaling, room, or relay servers. Connection options must state their dependencies and reachability limits.
- **Try available paths**: use configured direct addresses, LAN, or the user's virtual LAN as supported. Validate Bluetooth and other nearby transports later. Users should not exchange WebRTC internals manually.
- **Small groups of people who know each other**: solve watching together for couples and friends before considering very large rooms.
- **Extension as the first client**: keep the synchronization protocol separate from player adapters so other clients can follow.

## First-phase goals

1. Two people open Yifan independently and bind their local video tabs.
2. Connect through a reachable transport supported by the devices and join the same room. Validate whether a local companion is necessary; avoid manual WebRTC detail exchange.
3. Set local anchors at the same scene manually.
4. Either participant clicks Sync from here; the other seeks to the corresponding position and adopts that playback state.
5. Share play, pause, and seek controls without rebroadcasting received operations in a loop.
6. Provide Wait for me / I am ready to handle ads and buffering manually at first.
7. Show connection state clearly and allow one-click resynchronization after reconnecting.

Automatic ad detection, automatic resume, continuous drift correction, other sites, and native app control will follow evidence from actual use.

## Connection limits

The project must not operate servers. Direct serverless connectivity on every network cannot be guaranteed.

The connection layer tries reachable IPv6/port mappings, LAN, or a user's virtual LAN and falls back among available paths. Bluetooth is a future local-companion option for nearby devices, not remote connectivity.

Desktop browser network APIs are limited. Do not assume extensions can independently broadcast discovery, listen on arbitrary ports, or connect arbitrary Bluetooth peers. Add a minimal local companion if validation requires it.

User-configured signaling, STUN, and TURN are deferred and are not first-version dependencies. Multiple transports cannot create a missing remote network path. Explain why a connection is unavailable and what can be configured.

See the [product and technical baseline](docs/product-direction.md).

## Open source

Licensed under the [MIT License](LICENSE). CNJ-Devs manages the repository; users may use and modify the code under MIT. Organization ownership and licensing are separate.
