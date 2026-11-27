# Protocol & Architecture Overview

High-level technical summary of how FastShare discovers peers and streams data across platforms.

---

## 1. Local Network (LAN & Offline Hotspot)

* **Discovery:**
  * **DNS-SD / mDNS:** Advertises `_fastshare._tcp` and `_localsend._tcp` on port `53317`.
  * **UDP Multicast:** Broadcasts/listens on `224.0.0.167:53317` for full interoperability with LocalSend v2.2 clients.
* **Transport & Identity:**
  * Encrypted via **TLS 1.2 / 1.3** on port `53317` with `P-256` self-signed certificates and SHA-256 fingerprint verification.
  * Paired FastShare devices authenticate via **mutual TLS (`mTLS`)** and support **6-digit SAS code pairing** (`commit-then-reveal` nonces) and QR pairing tokens.
* **Native Byte-Streaming:**
  * File payloads stream directly between native sockets (`OkHttp` / `ServerSocket` on Android, `Network.framework` on iOS) and platform storage without buffering chunks in the JavaScript runtime.
  * Resumable transfers track byte offsets per file fingerprint/resume key.

---

## 2. Online Sharing (WebRTC)

* **Signaling:** Lightweight WebSocket (`WSS`) room signaling for peer presence, public 5-character rooms, and secret paired rooms.
* **Data Plane:** Encrypted **WebRTC DataChannels (`DTLS-SRTP`)** using 64 KB chunks and 16 MiB flow-control partition acknowledgments, compatible with the [FastShare Web Client](https://fastshare.ritikthakur.com.np).
* **Dual-Transport Merging:** Devices seen on both LAN and WebRTC collapse into one radar entry (`Wi-Fi + Internet`), letting the user pick the route per transfer.
