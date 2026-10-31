# Product and technical baseline

Updated: 2026-10-31

This document records agreed direction and unvalidated proposals. A Chrome extension and Node.js companion developer preview exists; real-site and remote-network checks remain pending. See the [user guide](getting-started.md).

## 1. The problem

Two people in different places want to watch video together. Screen sharing may lag or be restricted for protected content. Calling out timestamps, counting down, and coordinating ad breaks interrupt viewing.

Both people can own their own subscriptions and use their own networks. Salticus coordinates viewing actions; it does not distribute video, share screens or accounts, or proxy network access.

The same content may come from different platforms or contain different intros, ads, or edits. Different sources should still support manual alignment.

## 2. Agreed product direction

### Client scope

- Start with a desktop browser extension, validating Yifan first.
- Support native video apps and other devices over time.
- A local process with no UI or only configuration UI may handle connections and control browsers/apps through extensions or platform APIs. It runs on the user's device without project hosting.
- Separate core synchronization from player adapters. Native app integration depends on operating-system and app APIs; media controls may expose only play/pause, without reading or setting position.

### Rooms and permissions

- Focus on small groups of people who know each other.
- No permanent controller; any participant can send playback and synchronization actions by default.
- Each client stores room IDs, participant pairings, connection state, and source mappings locally.
- Temporary differences between participant views are acceptable; no central directory or strongly consistent membership service is required.
- Room IDs separate message contexts. Identity and connection authorization are separate checks; knowing a room ID never grants control.
- Sharing a video link and binding a local player are separate actions. A sender cannot assume the same platform or authorize control of someone else's tab.

### Synchronization interaction

- Find the same scene manually and record its local timestamp as an anchor on each device.
- Whoever clicks Sync from here broadcasts their state; each receiver converts the position for its own source.
- Propagate user-initiated play, pause, and seek actions. Applying remote actions or background corrections must not create new user-action broadcasts.
- The room waits together for ads or buffering by default. Manual wait and clear-wait controls must work when detection is unavailable.
- Do not optimize for thousand-person rooms. A future room setting may choose whether one participant's ad pauses everyone.

### Hosting constraints

- Require no project-operated room, account, signaling, discovery, or relay service.
- Users may choose their own network or connection helpers independently.
- Exclude workflows requiring manual exchange of WebRTC offers, answers, or ICE details.
- Try supported and reachable transports. User-configured signaling, STUN, and TURN are deferred.
- The preview uses TLS 1.3, LAN mDNS discovery, and multiple addresses. Direct connections without relay cannot be promised for every NAT, firewall, or carrier.

## 3. Synchronizing local anchors

No permanent controller, server clock, or continuously authoritative timeline is needed. Participants still need to confirm that their anchors refer to the same scene.

For example, the same scene is at 600 seconds in source A and 588 seconds in source B. When A reaches 660 seconds and syncs, B seeks to:

```text
B target = B local anchor + (A current position - A anchor)
             = 588 + (660 - 600)
             = 648 seconds
```

Each device stores its own anchors and offsets. Messages must identify the content and alignment session and express the sender's position relative to its anchor. Protocol fields remain to be designed.

This relative distance is a coordinate conversion for one operation, with no server managing the room timeline.

Changing episode, source, or alignment invalidates the old mapping. A fixed offset may fail if edits diverge midway. The first phase allows manual realignment, without automatic scene or edit recognition.

## 4. Finding and connecting to a peer without project servers

A stable identity recognizes a participant but cannot discover their current public address or traverse NAT and firewalls automatically. LAN broadcast normally reaches only the local network.

The Git analogy applies: the protocol can be decentralized while GitHub provides optional hosting. Devices still need a usable path, such as a reachable SSH/HTTP address or an offline exchange in Git.

### Multiple paths and the preview implementation

The desired interaction resembles nearby-sharing tools: identify paired participants, try usable connections, and exchange the same synchronization messages once connected. This does not assume access to Apple's discovery or identity mechanisms or make nearby connections work remotely.

| Option | User setup | Limits |
| --- | --- | --- |
| Reachable network address | Configure accessible IPv6, mapped ports, or another address and allow connections | Depends on firewalls, carriers, and client transport APIs; changed addresses need updates or rediscovery |
| Same LAN | Allow local-network access; discovery details need validation | Usually local only; ordinary desktop extensions cannot handle arbitrary UDP broadcasts or TCP listeners alone |
| User virtual LAN | Put both devices on a mutually reachable network first | Can connect remote devices, but users choose the network tools and Salticus discovery still needs validation |
| Bluetooth or nearby transport | A future native component handles permissions, pairing, and connections | Nearby only; Web Bluetooth is not arbitrary peer networking, and desktop/mobile APIs differ |
| User connection helpers, deferred | Choose or host signaling, STUN, and TURN when necessary | External dependencies; no such service is required for the first version |

### Discovery, connection, and transport

- **Discovery**: obtain candidate addresses from local pairings, user settings, or supported discovery. A stable identity is not an Internet address lookup service.
- **Connection**: try suitable candidate paths and select a stable connection with verified identity. Combining several links is not required.
- **Transport**: exchange the same synchronization messages once connected. Recognize the same participant across paths to prevent duplicate execution.
- **Recovery**: try other known paths after a disconnect; resync after reconnection without replaying stale controls.
- **No path**: explain missing reachability and configuration options without assuming a central discovery service or asking users to copy WebRTC internals.

WebRTC remains a candidate, not the only selected transport. If used, connection details should flow through an existing path or future user-configured service. Existing paths can also carry synchronization directly.

### Browser and native component boundaries

Validate player control through the extension first. Native discovery, listeners, and Bluetooth cannot be assumed to work in an extension, which lacks general native networking APIs.

The preview uses an extension plus Node.js companion, connected by an authenticated loopback WebSocket. Native Messaging and native installers may follow. For now, start the companion and load the extension manually.

Test actual remote networks first. Nearby transports can improve local use but cannot replace the reachable path required between remote devices.

## 5. Distributed actions and waiting

Peer equality still requires handling duplicate, stale, and looping messages. The protocol needs:

- Operation identity, deduplication, sender sessions, and sequence information.
- Alignment contexts to keep previous-episode or obsolete-anchor messages away from the current video.
- Player control on received synchronization, without treating programmatic changes as fresh user actions.
- A defined rule for simultaneous operations. Initial versions may briefly diverge and recover through another Sync action; no globally unique last-operation order is promised.
- Disconnect notices, reconnection, and explicit resynchronization without replaying queued stale seeks.
- Each person clears only their own wait when several participants are waiting.
- Distinguish waiting from a deliberate user pause so ad completion or readiness does not resume playback incorrectly.

Visible connection and synchronization state matters more than claiming everyone successfully applied an operation.

## 6. Validation phases

### A. Yifan player control

Confirmed target: macOS + Chrome at `https://www.yifan.tv/`. Initial findings are in the [Yifan validation record](yifan-validation.md).

Validate actual video and iframe discovery, timestamp reads, play/pause, seeks, user gestures, fullscreen behavior, and user-versus-programmatic actions. Generic HTML media controls are not assumed to cover the site.

### B. Remote connectivity

Validate real networks without project services or manual WebRTC exchange. Prioritize reachable addresses and user networking; record whether a minimal companion is needed. Validate path selection and reconnection. External helpers and Bluetooth come later.

Explain failed conditions and missing capabilities precisely. An identity code is not connectivity, and a successful LAN test does not validate remote direct connections.

### C. Minimal two-person experience

Connect → bind each video → align manually → sync from either side → share playback and seek controls → wait manually → resync after reconnecting.

### D. Later expansion

Improve ad detection, latency and drift correction, group connections, other sites, and native clients based on real use. Clients may reuse the protocol, but each platform's playback APIs need separate validation.

### Implemented behavior and validation limits

- Implemented: standard HTML video and open Shadow DOM scans, frame bindings, anchor conversion, content isolation, echo suppression, manual waits, TLS fingerprints, local API keys, invitations, reconnection, and participant introduction/mesh.
- Trust: accepting an invitation trusts its fingerprint. First inbound connections require fingerprint comparison and approval. Approved participants may introduce devices for that room; receivers save identities and verify direct TLS connections.
- Group test: three companions form a mesh; after the inviter leaves, the remaining two still synchronize. Unreachable participants remain disconnected. Controls are not forwarded through other participants.
- Resume: each person clears their own wait, then clicks Play together. Automatic resume is excluded initially to respect deliberate pauses.
- Verified media behavior comes from local DOM and built-extension tests; live Yifan support is not claimed.

## 7. Open source and ownership

CNJ-Devs manages the MIT-licensed repository. Organization ownership, participant management, and licensing are independent. Open source requires neither a personal repository nor a project-operated service.
