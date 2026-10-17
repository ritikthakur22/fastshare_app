# FastShare — Product Requirements

## What it is

A native Android/iOS app for sending files and text between nearby devices, fast and without accounts. The transfer is peer-to-peer (WebRTC); a signaling server only introduces devices.

## Users

People who want AirDrop-style sharing across platforms (Android ↔ iOS ↔ desktop browser) without cables, cloud uploads, or sign-up.

## Sharing modes

| Mode | Who sees whom | Needs internet | `roomType` |
|---|---|---|---|
| **Local / LAN** | Devices behind the same public IP (same Wi-Fi) | Yes (signaling server) | `ip` |
| **Paired devices** | Devices paired once via 6-digit key / QR; see each other anywhere | Yes | `secret` |
| **Public room** | Anyone who enters the same 5-letter room code ("global") | Yes | `public-id` |
| **Offline local** | Devices on the same Wi-Fi/hotspot with **no internet** | No | `local` |

Web users get the same first three modes through the website; offline local is app-only.

## Requirements

- Send any number of files of any size; large files must not crash the WebView (chunked native saving).
- Receiver must accept/decline unless auto-accept is enabled for a paired device.
- Received files are saved natively (Android MediaStore Downloads/Pictures; iOS Files/Photos).
- Send/receive text and keep clipboard history.
- Custom display name and device icon; Material theme color picker synced to the status bar.
- 35+ languages (English is the source).
- Self-hostable signaling server via a settings URL.

### Offline local mode (decided 2026-10-17)

- Scope: devices on the **same Wi-Fi or one phone's hotspot, no internet**. Not Wi-Fi Direct, not Bluetooth.
- Transfer still uses WebRTC; only signaling moves to ZeroConf discovery + a local HTTP server.
- Turns on **automatically** when the signaling server is unreachable; turns off when it is back.
- The Android foreground-service notification must be visible **only while offline mode is running**, with a clear title.
- Android first; iOS after Android works.

## Non-goals

- Cloud storage, accounts, file history on a server.
- Wi-Fi Direct / Nearby / Multipeer (no shared network).
- Manual offline-mode toggle (unless asked later).

## Roadmap

1. **Phase 1 (in progress):** make offline local mode work on Android — see ARCHITECTURE.md "Known bugs".
2. **Phase 2:** iOS offline mode (Info.plist cleanup, ATS local networking), test on device.
