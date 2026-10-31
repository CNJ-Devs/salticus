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

## Live checks still pending

Browser-tab reads repeatedly timed out. Native Chrome observation worked, but clicks returned stale elements or `noWindowsAvailable`. Playback-page entry and controls were not reliable, leaving these checks pending:

- The main media element's DOM, iframe, or Shadow DOM location and required host permissions.
- Time, playback state, and seekable ranges read from the extension.
- Consistency between video and site controls after pause, play, and seeks.
- Chrome gesture restrictions on remote playback commands.
- Whether main content, ads, and previews share media elements.
- Reliable ad events and whether a page-context bridge is needed.
- Rebinding after episode, source, and fullscreen changes.
- Two-device connectivity and synchronization.

## Next integration checks

1. Locate the actual media element and record its states and events.
2. Try standard media controls in the content script; consider a minimal page-context bridge only if the instance API is inaccessible.
3. Explicitly select the main player when a page has several media elements, avoiding ads and previews.
4. Verify that programmatic operations do not become new user-action broadcasts.
5. Verify anchor conversion and one-click synchronization with two different anchors before connecting real peers.

The first usable version keeps manual waiting. Promise automatic ad detection only after testing the actual playback page.

## Implemented preview

The Manifest V3 extension and local companion are implemented. `npm test` runs two built-extension contexts bound to DOM media, exchanging events over two real TLS companions to verify anchors, play/pause, waiting, and content isolation. A separate test covers three-peer discovery and inviter departure.

Media behavior is simulated in tests. These verify code and messaging, not actual Chrome/Yifan playback. There is no automatic ad detection or continuous drift correction.
