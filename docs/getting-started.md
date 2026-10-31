# Salticus user guide

## Normal use: install the app

Both participants need **macOS 13+ and Chrome 120+**. No Node.js, npm, OpenSSL, commands, or open terminal are required.

1. Download the appropriate DMG from [v0.2.0](https://github.com/CNJ-Devs/salticus/releases/tag/v0.2.0): `arm64` for Apple silicon, `x64` for Intel.
2. Open the DMG, drag **Salticus** into Applications, and launch it.
3. When the app shows Ready on this device, click Find browser extension.
4. In Chrome, open `chrome://extensions`, enable Developer mode, click Load unpacked, and select the revealed `extension` folder. Do this once per computer; the extension is not in the Chrome Web Store yet.
5. Create a room in Salticus; its invitation is copied automatically. Send it through your own chat tool. Your partner pastes it into the app to join.
6. For the first connection, compare the complete device fingerprint and click Allow this device. The app shows actual connected participants.
7. Open the same Yifan episode independently and click Play to load it. The extension tries to select the main video in the current tab and connect to the app without a pasted local key.

**Recognized matching videos need no manual anchors or repeated Sync clicks.** A joining participant fetches the connected participant's progress and playback state. Subsequent page play, pause, and seek actions propagate automatically.

If selection has not happened, open the extension to retry. Use Choose another video only when multiple players are ambiguous. Media under one minute is excluded from automatic selection to avoid short ads, but remains manually selectable.

Closing the window leaves Salticus in the menu bar and keeps connections running. Use the Salticus menu to quit completely.

### Preview limitations

- Bundles use ad-hoc signing, **without Developer ID distribution signing or Apple notarization**. macOS may block Internet downloads. General distribution still needs signing, notarization, and Chrome Web Store publication; do not disable system security checks.
- Automatic matching hashes page identity, episode parameters, title, and duration. It does not use title/duration alone or inspect frames. Different sources, edits, and uncertain matches need manual alignment.
- Packaged Apple silicon startup, window actions, and the native bridge are verified. Intel bundles are available but have not run on Intel hardware.
- Both 0.1.x users should upgrade to the matching 0.2.0 app and extension. Disable the old Chrome extension before loading the bundled one to prevent duplicate controls. Existing identity and rooms are preserved.

## Different sources: manual alignment when needed

1. Open Align different sources in both extensions.
2. Enter the same content label, such as Episode 1, and click Manual alignment.
3. Pause at the same scene and click Set current scene as anchor on each device.
4. Either participant clicks Re-align from here when needed; the other seeks to their corresponding local position.

Offsets stay local. Play, pause, and seek continue automatically without calling out timestamps. Confirm offsets after changing episodes or edits, or choose Restore automatic source alignment.

Initial alignment creates no permanent controller. Joiners request a connected participant's state and accept only a matching request, room, and content reply. Simultaneous starts use deterministic device-identity ordering for that request only; everyone retains control. Offline actions are never replayed.

## Ads and buffering

Click Wait for me to pause together. When ready, click I am ready. Once every wait is cleared, click Play together. Readiness does not resume automatically, preserving deliberate pauses.

Ads are neither automatically detected nor skipped. The initial feature is reliable manual waiting.

## Remote connectivity and settings

The installer handles startup and configuration, but devices still need a reachable network path. Salticus operates no room, signaling, or relay service.

- **Same LAN**: invitations include local addresses; mDNS discovers paired devices. Allow requested local-network or inbound access. Guest Wi-Fi, client isolation, and firewalls may block connections.
- **Your virtual LAN**: connect through your own network tool, then enter your virtual LAN address under Device and network settings → Direct addresses. Save and copy a new invitation. Enter one candidate per line.
- **Public IPv6 / port mapping**: enter your reachable address in the same settings. Forward public TCP 37843 to this computer's TCP 37843 if needed. Keep local extension port 37842 private.

Addresses are tried individually. Missing paths never appear connected. Bluetooth and user-configured STUN/TURN helpers are not implemented.

Use the app UI to name devices, configure addresses, create/join rooms, copy invitations, and approve devices. Room selection stays coordinated with the extension.

## Permissions and local data

- Default host access covers only `yifan.tv` and subdomains; request other player origins as needed.
- Chrome Native Messaging connects to the app without a pasted local key. The app registers a bridge in the current user's Chrome configuration and allows only the matching extension identity.
- `activeTab` and `scripting` control selected video pages; `webNavigation` tracks frames/navigation/bindings; `storage` saves settings; `alarms` restores connections; `clipboardWrite` copies invitations.
- Certificates, private keys, rooms, and participants live in `~/.salticus` and survive app upgrades. Video bindings and manual anchors live in memory.
- Peers exchange only controls, relative positions, content digests, device identities, and addresses. Salticus reads no sign-in credentials, transmits no media, and does not proxy traffic.

Chrome may still require a local Play gesture. Closed Shadow DOM, inaccessible frames, custom players, source changes, and fullscreen behavior need site-specific checks. Revocation and invitation-expiry UI are not yet available; use the preview with people you know.

## Developers: run from source

These commands are for development only and require Node.js 22+ and npm.

```sh
git clone https://github.com/CNJ-Devs/salticus.git
cd salticus
npm ci
npm run build
npm run desktop:dev
```

Alternatively run `npm start -- --name My-device` for the standalone companion. In Connect Salticus app → Developer connection settings, paste its address and local key. Custom ports, advertised addresses, and data directories remain supported.

```sh
npm test
npm run check
npm run package
npm run desktop:package
```

The last command creates Apple silicon and Intel DMG/ZIP bundles on macOS under `dist/desktop`. Extension/source archives live in `dist/packages`. Reload the extension and refresh open video pages after extension changes.

See [Yifan validation](yifan-validation.md) for live evidence and testing limits.
