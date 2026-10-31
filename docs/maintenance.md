# Maintaining Salticus

## Where behavior lives

| Area | Responsibility | Entry points |
| --- | --- | --- |
| Shared protocol | Event and invitation validation, deduplication, local-anchor conversion | [`shared/protocol.mjs`](../shared/protocol.mjs) |
| Local companion | TLS identity, peer authorization, room membership, waiting state, local API and discovery | [`companion/server.mjs`](../companion/server.mjs), [`companion/identity.mjs`](../companion/identity.mjs) |
| Browser client | Page and frame discovery, player bindings, initial alignment, control propagation | [`extension/worker.mjs`](../extension/worker.mjs), [`extension/content.mjs`](../extension/content.mjs), [`extension/media-controller.mjs`](../extension/media-controller.mjs) |
| Desktop app | Runtime lifecycle, room and network configuration, Chrome Native Messaging registration | [`desktop/main.mjs`](../desktop/main.mjs), [`desktop/runtime.mjs`](../desktop/runtime.mjs), [`desktop/native-registration.mjs`](../desktop/native-registration.mjs) |
| Distribution | Extension builds, source archives, macOS bundles and CI | [`scripts/`](../scripts/), [`package.json`](../package.json), [`ci.yml`](../.github/workflows/ci.yml) |

Keep synchronization decisions outside page UI code. Validate inbound messages before applying them. Each room authorizes its own partner; knowing a room ID alone grants no permissions. Each player binding has its own source identity and local anchor.

## Keeping changes verifiable

The [contributor guide](../CONTRIBUTING.md) lists local commands. CI runs checks, tests, and archive creation on Linux and macOS, then builds macOS previews. A passing workflow does not replace live playback or remote-network testing.

`node scripts/check-language.mjs --history` audits all reachable local Git refs, including commit messages and historical paths/content. The normal check includes tracked and non-ignored new files; source archives can also be checked outside a Git checkout. The guard rejects non-Latin writing systems in authored text. English wording still needs human review; symbols and emoji are allowed. Bundled dependencies, binary assets, and user data require separate review when applicable.

## Publishing a preview

1. Choose a version in `package.json` and the lockfile. Describe the actual behavior and limitations in `docs/releases/v<version>.md`; update README and user instructions for the same version.
2. Run `npm run check`, `npm test`, and `npm run package` from a clean checkout. On macOS, run `npm run desktop:package`. Check that source and extension archives correspond to the intended commit.
3. Verify packaged startup and Native Messaging on supported hardware. Record untested architectures, live sites, and remote connections explicitly. Do not claim Developer ID signing, notarization, or store publication before those steps exist.
4. Tag the verified commit, publish English release notes, upload the intended installers and archives, and generate `SHA256SUMS.txt` from those exact uploads. Confirm downloaded checksums and tag targets.
5. Preserve user identities and rooms through upgrades. If published files must be replaced, back up the originals and disclose the replacement and changed checksums in the release notes.

Historical releases describe their own behavior. Moving to two-person rooms in development does not change what an older preview implemented.

## English history migration

On 2026-10-31, the initial nine commits were rewritten so their complete snapshots use English from the root commit onward. The v0.2.0 and v0.2.1 tags were moved to their equivalent rewritten commits, and their release files were rebuilt with new checksums. Original author identities, dates, commit subjects, and the sequence of product changes were preserved.

Existing clones should use a fresh clone or carefully rebase unpublished work onto the new history. Merging an old branch can reintroduce the previous history. Old commit URLs and external caches may remain available even though current branches and tags use the rewritten history.
