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

The second peer was an independent process on the same computer using the normal API and real TLS. The receiver was the installed Chrome extension controlling the actual site player. This checks the receive path, not a complete viewing session across two remote devices.

### Findings and fixes from live testing

Yifan resumes automatically after seeking. The initial seek-and-pause resumed playback and echoed a `play` event. Media protection now suppresses site autoplay during and shortly after a remote paused seek. Trusted page input or an explicit Play command clears protection.

Regression tests verify paused asynchronous seeks, no autoplay echo, and subsequent real or explicit playback. The fix is built; live retesting awaits extension reload.

## Live checks still pending

- Retest the fixed paused seek and absence of echo on the actual playback page.
- Verify that native site controls and extension state remain consistent after seeking.
- Test remote Play gesture restrictions in a fresh browser session.
- Whether main content, ads, and previews share media elements.
- Reliable ad events and whether a page-context bridge is needed.
- Rebinding after episode, source, and fullscreen changes.
- Two-device connectivity and synchronization.

## Next integration checks

1. Reload the extension and page; retest remote paused seeks and no echo.
2. Continue native play/pause/seek propagation and fresh-session gesture checks.
3. Verify the full flow on both users' actual remote macOS + Chrome networks.
4. Add adapters based on real ad, episode-change, and source-change behavior.

The first usable version keeps manual waiting. Promise automatic ad detection only after testing the actual playback page.

## Implemented preview

The Manifest V3 extension and local companion are implemented. `npm test` runs two built-extension contexts bound to DOM media, exchanging events over two real TLS companions to verify anchors, play/pause, waiting, and content isolation. A separate test covers three-peer discovery and inviter departure.

Media behavior is simulated in tests. These verify code and messaging, not actual Chrome/Yifan playback. There is no automatic ad detection or continuous drift correction.
