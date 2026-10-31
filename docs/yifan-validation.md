# Yifan validation record

Date: 2026-10-31

## Validation target

- User-confirmed site: [https://www.yifan.tv/](https://www.yifan.tv/), branded as Yifan International in the page title.
- Both devices: macOS.
- Preferred browser: Chrome.
- First goal: find the local main player, read its time, and apply play, pause, and seek through the extension.

## Checks completed in this session

1. The homepage returned HTTP 200; Chrome accessibility data and a screenshot also confirmed it displayed correctly.
2. The homepage links to films under `/play/…`. JavaScript renders the app dynamically; initial HTML does not describe the live playback DOM.
3. Public app scripts reference `vg-player` and media wrappers: time reads/writes reach `vgMedia.currentTime`, and playback calls `vgMedia.play()` and `vgMedia.pause()`.
4. Public scripts handle `play`, `pause`, `seeking`, `seeked`, `timeupdate`, and `waiting` media events.
5. Public scripts contain clues for `startads` / `endads` and `isPlayingAds`.

These findings support testing HTML media-element controls. Public bundles may contain unused components, so this is not proof that the live player is supported.

### Public scripts inspected

| Resource | SHA-256 |
| --- | --- |
| [main.13a9d73514a11f5e53c7.js](https://www.yifan.tv/app/main.13a9d73514a11f5e53c7.js) | `ed847f0e0807d5fc976b6fddd42ab1704f01166cfaa1c6f08def18d2c52c616e` |
| [scripts.b9215aaa63f6c179f405.js](https://www.yifan.tv/app/scripts.b9215aaa63f6c179f405.js) | `02a3ebfd157973a542e0747890c95db6181bf2fff9d3ec4848be08f8fdc39b8d` |

Resource filenames change with site releases. The project records inspection evidence without storing site bundles, video sources, or user sign-in data.

## Completed live Chrome checks

After the user loaded `dist/extension`, native Chrome UI interactions tested the installed extension on the [test film's playback page](https://www.yifan.tv/play/uE22Zj9bavD):

| Check | Observation |
| --- | --- |
| Local connection | The extension showed Local app connected and created a room |
| Scan and bind | Default Yifan permissions found the visible main film (160:25) and a hidden, unloaded element; main-film binding succeeded |
| Read state | Displayed film position and state, for example 00:22 and Playing |
| Play and pause | Pause showed 00:26 and Paused; Play resumed playback |
| Peer joins | A second independent local companion joined by invitation and fingerprint approval; the UI showed one directly connected peer |
| Local anchor | Paused at 56.13376 seconds and saved an anchor; the extension showed 00:56 |
| Remote seek | A relative position of 60 seconds sought locally to about 116.13 seconds; the actual film then advanced |
| Wait and ready | Wait paused at 02:41 while preserving position; Ready left playback paused and prompted an explicit Play |
| Local broadcast | Sync from here sent paused state and relative position about 105.65 seconds, matching local 161.79 minus the 56.13-second anchor |
| Fixed paused seek | After extension/page reload and rebinding, remote sync to 120 seconds stayed paused at 02:00 without extra play/pause echoes |
| Subsequent playback | An explicit remote Play advanced to 02:06 without being blocked by pause protection |
| Site controls and propagation | Remote paused sync to 180 seconds showed the site's play button and 00:03:00; clicking Play sent one play event (about 180.01 seconds), and Pause sent one pause event (about 193.10 seconds) |

The second peer was an independent process on the same computer using the normal API and real TLS. The receiver was the installed Chrome extension controlling the actual site player. This checks the receive path, not a complete viewing session across two remote devices.

### Findings and fixes from live testing

Yifan resumes automatically after seeking. The initial seek-and-pause resumed playback and echoed a `play` event. Media protection now suppresses site autoplay during and shortly after a remote paused seek. Trusted page input or an explicit Play command clears protection.

Regression tests cover asynchronous autoplay suppression, no echo, and subsequent playback. After reload and rebinding, live retesting passed: remote paused seeks stayed paused without extra events; remote and native page play/pause still worked.

All 19 automated tests, syntax checks, packaging, and the fix's macOS/Ubuntu GitHub CI passed.

## Live checks still pending

- Consistency of native controls across durations, quality settings, and sources.
- Native seek propagation.
- Test remote Play gesture restrictions in a fresh browser session.
- Whether main content, ads, and previews share media elements.
- Reliable ad events and whether a page-context bridge is needed.
- Rebinding after episode, source, and fullscreen changes.
- Two-device connectivity and synchronization.

## Next integration checks

1. Verify the complete flow across the users' actual remote macOS + Chrome devices.
2. Continue native seek propagation and fresh-session gesture checks.
3. Add support based on real ad, episode-change, and source-change behavior.

The first usable version keeps manual waiting. Promise automatic ad detection only after testing the actual playback page.

## Implemented preview

The Manifest V3 extension and local companion are implemented. `npm test` runs two built-extension contexts bound to DOM media, exchanging events over two real TLS companions to verify anchors, play/pause, waiting, and content isolation. A separate test covers three-peer discovery and inviter departure.

Media behavior is simulated in tests. These verify code and messaging, not actual Chrome/Yifan playback. There is no automatic ad detection or continuous drift correction.

## v0.2.0 installer and automatic alignment checks (2026-10-31)

- All 27 automated tests passed, including desktop runtime, native bridge, automatic initial alignment, episode isolation, and desktop-created/joined rooms.
- Two built-extension contexts aligned simulated DOM players over two real TLS companions without manual anchors or Sync clicks. Subsequent controls propagate both ways.
- The packaged Apple silicon app launched successfully; windows, existing rooms, and invitation copying worked. Its bundled Electron ran the native bridge and read local status without separately installed Node.js or OpenSSL.
- Apple silicon and Intel DMG/ZIP bundles were built. Intel hardware execution is untested.
- The matching v0.2.0 extension has not been reinstalled and tested in real Chrome. Earlier live Yifan checks used v0.1.x. Remote devices, live automatic selection, and initial alignment remain pending.
- Developer ID signing, notarization, and Chrome Web Store publication are incomplete; this remains a developer preview.

### v0.2.1 cold-start fix

Final cold-start testing found that the native bridge passed `ELECTRON_RUN_AS_NODE` when opening the app. Clearing it before launch fixed background startup. The bundled Electron ran the fixed bridge, launched the app, and read existing rooms. v0.2.1 includes this fix.
