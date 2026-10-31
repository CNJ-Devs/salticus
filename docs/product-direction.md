# Product and technical baseline

Updated: 2026-10-31

This document records agreed product direction and separates proposals that have not been validated. No client or synchronization protocol has been implemented yet.

## 1. The problem

Two people in different places want to watch video together. Screen sharing may lag or be restricted for protected content. Calling out timestamps, counting down, and coordinating ad breaks interrupt viewing.

Both people can own their own subscriptions and use their own networks. Salticus coordinates viewing actions; it does not distribute video, share screens or accounts, or proxy network access.

The same content may come from different platforms or contain different intros, ads, or edits. Different sources should still support manual alignment.

## 2. Agreed product direction

### Client scope

- Start with a desktop browser extension, validating Yifan first.
- Support native video apps and other devices over time.
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
- No connection implementation is selected yet. Direct connectivity without relay cannot be promised for all NATs, firewalls, or carriers.

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

### Candidate transports, not yet validated or selected

| Option | User setup | Limits |
| --- | --- | --- |
| Manual WebRTC exchange | Exchange full connection details through an existing chat tool, including later candidates when necessary | Replaces project signaling, but not NAT traversal or relay; reachability is usually more limited without ICE helpers |
| Reachable address | Supply accessible IPv6, mapped ports, or another address and allow connections | Depends on firewalls, carriers, and client transport APIs; browser extensions are not general TCP listeners |
| User LAN or virtual LAN | Put both devices on a mutually reachable network first | Extra networking tools are user-selected; browser candidates and access restrictions still need validation |
| User-configured connection helpers | Choose or host STUN and signaling, and TURN when needed | External dependencies remain; inclusion in the product is undecided |

WebRTC signaling exchanges connection details, STUN discovers external addresses, and TURN relays when direct connections fail. These are different roles. Manual signaling removes project-hosted signaling but does not guarantee connectivity on every network.

Test with the actual remote networks before choosing the default connection flow. Reachability remains a separate problem even for tiny messages.

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

Validate actual video and iframe discovery, timestamp reads, play/pause, seeks, user gestures, fullscreen behavior, and user-versus-programmatic actions. Generic HTML media controls are not assumed to cover the site.

### B. Remote connectivity

Test the real networks without project services. Record any manual exchange, external STUN, user networking, or relay requirement. Explain failed network conditions precisely; possessing an identity code does not establish a connection.

### C. Minimal two-person experience

Connect → bind each video → align manually → sync from either side → share playback and seek controls → wait manually → resync after reconnecting.

### D. Later expansion

Improve ad detection, latency and drift correction, group connections, other sites, and native clients based on real use. Clients may reuse the protocol, but each platform's playback APIs need separate validation.

## 7. Open source and ownership

CNJ-Devs manages the MIT-licensed repository. Organization ownership, participant management, and licensing are independent. Open source requires neither a personal repository nor a project-operated service.
