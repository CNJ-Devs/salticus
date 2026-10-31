# Contributing to Salticus

Start with the [product baseline](docs/product-direction.md) and [maintenance notes](docs/maintenance.md). Describe a proposed behavior change in an issue or pull request, including the viewing problem it addresses and the platforms it affects.

## Set up and verify

Use Node.js 22 or newer and npm:

```sh
npm ci
npm run check
npm test
npm run package
```

`npm run check` checks JavaScript syntax and repository language. `npm test` builds the extension and runs the protocol, companion, desktop bridge, and player integration tests. On macOS, run `npm run desktop:package` when changing installer inputs or desktop startup. Generated files belong in ignored `dist/`.

Use temporary identities, data directories, and ports for tests. Do not read, rewrite, or delete a contributor's real room data or browser registration. Record live browser checks separately in [Yifan validation](docs/yifan-validation.md), identifying the version and what was actually observed.

## Write and review changes

All authored repository content and GitHub release text must be English, including test fixtures and commit messages. Personal names, identifiers, and user-provided data are not language restrictions on the application. Keep documentation links current when moving files.

Use a short English commit subject describing the change. In the body, state why it is needed, the checks you ran, and any unverified behavior. A pull request should make changes in permissions, network dependencies, stored data, and installation steps clear when they apply.

Preserve local playback, equal participant control, two-person room limits, room isolation, and suppression of received-event echoes. A new transport must state its setup and reachability requirements. Keep the protocol independent of browser and native-player adapters.

## Release evidence

Report automated results, packaged startup checks, live-site checks, and remote-device checks separately. Use the [release procedure](docs/maintenance.md#publishing-a-preview) and retain explicit preview limitations until verified.

Contributions are distributed under the repository's [MIT License](LICENSE).
