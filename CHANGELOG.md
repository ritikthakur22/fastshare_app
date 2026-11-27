# Changelog

All notable changes to **FastShare** are documented here.

---

## [2.0.2] - 2026-11-20

### Fixed & Improved
- **Expanded Device Support:** Marked screen orientation (`portrait` / `landscape`), touchscreen, and location sub-features as optional (`android:required="false"`) so FastShare installs cleanly across tablets, foldables, Chromebooks, desktop Android, and Android XR devices.
- **iOS Unsigned IPA:** Updated iOS build for v2.0.2 (`FastShare-v2.0.2-unsigned.ipa`).

---

## [2.0.1] - 2026-11-20

### Added
- **Unified Radar for Dual-Transport Peers:** Devices reachable over both local Wi-Fi and the internet (WebRTC) now merge into a single radar avatar labeled `Wi-Fi + Internet`.
- **Transfer Route Selector:** Added a `[ Wi-Fi (Fast direct) | Internet ]` switch inside the Send sheet, defaulting to high-speed local Wi-Fi while allowing instant fallback to WebRTC.
- **Auto-Connect Wi-Fi Hotspot via QR:** Scanning another device's FastShare hotspot QR code connects automatically through Android's native Wi-Fi specifier without typing the password.

### Fixed
- **Internet Transfer Progress:** Fixed live byte progress, speed calculation, and throttled foreground notification updates during WebRTC transfers.
- **Scan Screen Navigation:** Improved back button hit target, added fallback routing, and handled Android system back gestures cleanly.

---

## [2.0.0] - 2026-11-16

### Highlights
- **Complete Native Rewrite:** Built with React Native (New Architecture), Kotlin (Android), and Swift (iOS).
- **Native Byte-Streaming:** Files stream directly between TLS sockets and device storage (`MediaStore` / Files) without passing file bytes through JavaScript, keeping memory flat for multi-gigabyte transfers.
- **LocalSend v2.2 Interoperability:** Discover and exchange files/text with LocalSend desktop and mobile apps on port `53317`.
- **mTLS Pairing & Rooms:** Cryptographic P-256 device identity, 6-digit SAS code pairing, QR linking, and public room codes for browser sharing.
- **Offline Local Hotspot:** Spin up a local-only Wi-Fi hotspot with QR codes when no router is available.
- **Android Quick Settings Tile & Share-In:** Share directly from any app's Share sheet or send clipboard text from the Quick Settings tile.
