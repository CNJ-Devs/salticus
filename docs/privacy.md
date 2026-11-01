# Salticus privacy policy

[English](privacy.md) · [Simplified Chinese](privacy.zh-CN.md)

Effective date: November 1, 2026. Applies to Salticus 0.4.0, its browser
extension and companion desktop application. Maintained by CNJ-Devs.

## What Salticus does

Salticus lets two people synchronize independently played videos. Each person
uses their own media source, account and network. Salticus does not stream video
or audio to the other person. The project operates no synchronization servers,
account service, analytics service or advertising service.

## Information handled

- **Video selection:** the extension inspects permitted open tabs and frames for
  HTML video elements. It uses page URLs, origins, page/tab titles, player labels,
  duration and playback state to let you select and control a video. The video
  picker can inspect multiple permitted tabs; only your selected video participates
  in playback synchronization. It does not read your browser's history database.
- **Playback synchronization:** while Sync is enabled, the selected partner
  receives playback commands, timestamps, duration, the selected video title,
  an opaque source identifier derived from origin/title, and session identifiers.
  The protocol does not send the page URL, stream URL, cookies, passwords or
  subscription credentials to the partner.
- **Calibration:** starting calibration attempts to capture a readable video
  frame or the visible bound tab. A tab screenshot can include surrounding page
  content and personal information. You review the image and timestamp before
  sending; you can remove or replace the image, or send without one. A file you
  explicitly select is processed as a replacement image. The confirmed image,
  if any, goes to your selected partner, not the maintainers.
- **Device information:** the desktop app generates a device certificate and
  private key and stores connection names, paired certificate fingerprints,
  connection addresses and preferences locally. Sharing My info discloses your
  configured device name, public device fingerprint and connection addresses.
  A direct connection exposes network addresses to the other endpoint. Optional
  LAN discovery advertises device identity and reachability information to the
  local network. It can be turned off in Settings.
- **Saved offsets:** the desktop app stores source-pair identifiers, descriptive
  titles, alignment timestamps and offsets locally for reuse.

## Storage and retention

The extension uses Chrome's local session storage, not Chrome Sync, for its
binding, selected connection, runtime state and calibration draft/request,
including an optional image. Closing the popup does not clear this state;
Chrome clears session storage when the extension/browser session is reset.
The desktop app stores persistent identity, connections, preferences and offsets
in your local `.salticus` directory. Configuration migrations can retain a local
backup. Private keys and local API credentials remain in the native app and are
not included in invitations or sent to partners.

Remove saved connections/offsets in the app where those controls are available.
Removing the extension clears its extension storage; it does not remove desktop
data. To remove all desktop data, quit Salticus and remove the `.salticus`
directory from your home folder, including backups. This also removes the device
identity: pairing again requires sharing the new identity. A recipient controls
their own local copy of information already received; Salticus cannot remotely
delete it.

## Sharing and security

Playback and calibration messages travel through the local Native Messaging
bridge and certificate-pinned TLS connections to devices you have paired.
Certificates must match the fingerprints saved on both devices. No project
relay or third-party synchronization service is included. Your own VPN, DNS,
network provider or virtual LAN may process connection metadata under its own
terms. Local data is protected by operating-system file permissions, not an
additional encrypted database; protect your device and backups.

Salticus does not sell user data, use it for advertising, profiling or model
training, or transfer it to data brokers. Data is used only to provide the
user-facing synchronization, pairing, calibration and configuration features.
The use of information received from Google APIs adheres to the Chrome Web Store
User Data Policy, including its Limited Use requirements.

## Permissions and your choices

Site access allows reading and controlling video elements on permitted pages.
Yifan origins are declared initially; other HTTP(S) sites and embedded-frame
origins require permission. You can revoke site access in Chrome. Scripting and
navigation access locate players and invalidate bindings when pages change.
Active-tab access supports user-triggered visible-tab capture. Native Messaging
connects to the installed companion app. Storage preserves local session state;
alarms reconnect the bridge; notifications announce calibration requests.

Turn Sync off to stop synchronized control of that binding. Disabling a saved
connection stops communication with that device. Turning Sync off does not itself
disconnect the desktop's paired-device transport. You can remove an image before
sending and turn off LAN discovery independently.

## Other services and contact

Video services, Chrome Web Store, Apple distribution services and GitHub have
their own privacy policies. Information you voluntarily publish in a GitHub
issue is public; do not include private keys, invitations or personal screenshots.
Contact the maintainers through the repository's
[support issues](https://github.com/CNJ-Devs/salticus/issues). For a private matter,
use the publisher contact shown on the Chrome Web Store listing once available.
Material changes to this policy will update the date and accompanying release
documentation.
