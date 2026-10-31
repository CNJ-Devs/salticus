# Working on Salticus

Salticus lets two people watch independently while exchanging playback controls directly. Read [the product baseline](docs/product-direction.md) before changing room, connection, or alignment behavior.

- Write all repository content in English: code comments, UI text, errors, fixtures, documentation, filenames, commit messages, and release metadata. User-entered names and content remain unrestricted. Do not translate or reset existing user data.
- Keep each room limited to two participants with equal control. Preserve isolation between saved rooms and prevent received playback actions from echoing back.
- Keep media, accounts, and network access local. Do not add project-operated services or silently introduce connection dependencies.
- Treat identity keys, local API keys, invitations, and device addresses as sensitive user data. Tests must use temporary directories and ephemeral ports, never the real `~/.salticus` directory or browser configuration.
- Explain actual checks and their limits. DOM tests do not establish compatibility with a live site; a local TLS test does not establish connectivity between remote networks.
- Before committing, run the relevant checks in [CONTRIBUTING.md](CONTRIBUTING.md). Use an English commit subject and a body describing the change, checks performed, and any remaining limitations.
- Preserve the distinction between development source and published installers. Do not describe unreleased behavior as already available to users.

See [maintenance notes](docs/maintenance.md) for module boundaries and release handling.
