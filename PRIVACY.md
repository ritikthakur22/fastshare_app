# Privacy Policy

**Last updated:** November 2026

FastShare is built to respect your privacy. There are **no user accounts, no analytics SDKs, no crash telemetry trackers, and no ads**.

---

## 1. Data Handling

* **Files & Text:** Files, photos, videos, and clipboard clips are sent directly from device to device over your local Wi-Fi/hotspot or peer-to-peer WebRTC. FastShare never uploads, logs, or stores your shared content on any server.
* **Local History & Settings:** Transfer history, paired device fingerprints, and preferences stay strictly on your own device. Uninstalling the app deletes local app data (received files saved to your Downloads or Gallery remain yours).
* **Online Signaling (WebRTC):** When connecting to the Web Client or paired devices over the internet, the signaling server transiently processes your display name, peer ID, room membership, and IP address in memory to establish the peer-to-peer connection. No file names or contents ever pass through the signaling server.
* **STUN / TURN:** Public STUN (and optional TURN relay for paired devices) only sees network routing metadata needed to traverse NAT/firewalls; WebRTC payloads remain DTLS-encrypted end-to-end.

---

## 2. Permissions Explained

FastShare requests permissions only when you use the feature that needs them:

| Permission | Why It Is Needed |
|---|---|
| **Local Network / Wi-Fi** | Discover nearby FastShare and LocalSend devices on your Wi-Fi or hotspot. |
| **Camera** | Scan QR codes for device pairing or joining an offline hotspot. Never used in the background. |
| **Notifications (Android)** | Show live transfer progress while sending/receiving in the background and alert you to incoming requests. |
| **Photos / Storage** | Let you pick media/files to share and save incoming files to `Download/FastShare` or your Gallery. |

---

## 3. Contact

For privacy questions, visit [fastshare.ritikthakur.com.np](https://fastshare.ritikthakur.com.np) or reach out via GitHub.
