# Security Policy

FastShare is designed around local-first, zero-cloud transfers. Files and clipboard text travel directly between devices without ever touching a FastShare storage server.

---

## Core Security Principles

1. **Zero Cloud Storage:** LAN transfers stay completely on your local network. Online transfers use peer-to-peer WebRTC DataChannels (`DTLS-SRTP`).
2. **End-to-End Transport Encryption:**
   - **Local Wi-Fi / Hotspot:** TLS 1.2+ (TLS 1.3 preferred) with mutual TLS (`mTLS`) and pinned SHA-256 certificate fingerprints. No plaintext HTTP is used.
   - **Online (WebRTC):** `DTLS-SRTP` encrypted DataChannels, with signaling over encrypted WebSockets (`WSS`).
3. **Explicit Consent:** Incoming file transfers require user approval unless the sender is an explicitly paired device and **Auto download** is enabled.
4. **Device Identity:** Each installation generates a hardware-backed `P-256` key pair on first launch (Android Keystore / iOS Keychain) and a self-signed X.509 certificate.
5. **MITM Protection:** 6-digit pairing uses a commit-then-reveal SAS handshake so codes cannot be brute-forced offline, and certificate pinning detects any identity mismatch.

---

## Supported Versions

Only the latest release receives security updates.

| Version | Supported |
|---|---|
| `2.0.2` (latest) | Yes |
| `1.x` (legacy) | No |

---

## Reporting a Vulnerability

If you discover a security issue, **please do not open a public GitHub issue**.

Instead, report it privately via **GitHub Security Advisories** on this repository (Security -> Advisories -> Report a vulnerability). Please include:
- App version and device OS
- Clear steps to reproduce the issue
- Expected vs. actual behavior

We aim to acknowledge reports within 7 days.
