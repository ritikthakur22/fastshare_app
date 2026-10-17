# Security

## Model

- File contents travel peer-to-peer over WebRTC (DTLS-encrypted). The signaling server sees only metadata: peer ids, display names, room ids, SDP/ICE.
- Receivers must accept each transfer unless they enabled auto-accept for a paired device.
- Pairing secrets (`room_secrets`) are stored in the device's IndexedDB and sent to the signaling server to join the secret room, so the server operator can see them.
- Peers show a connection hash (from the DTLS fingerprints) so users can compare it out of band.

## Rules

- Never commit keystores, passwords, `releases/`, `play-store-key.json`, or `local.properties`. Signing secrets live in GitHub Actions secrets only.
- Anything received from the network (signaling messages, `/msg` bodies, file names, text) is untrusted: never `innerHTML` it, never use it as a path without sanitizing.
- The local HTTP server must run only while offline mode is needed, and must reject unknown senders.
- Keep cleartext HTTP limited to LAN signaling; everything else stays HTTPS/WSS.

## Known issues (2026-10-17)

| Severity | Issue | Action |
|---|---|---|
| **High** | `fix_build.sh` (tracked in git) contains the release keystore password `fastshare123` in plain text | If that keystore signs Play builds: treat the password as leaked, remove it from the script (read from env), and consider Play App Signing key upgrade. Git history still contains it |
| Medium | Local `/msg` endpoint accepts POSTs from anyone on the LAN → spoofed signaling / fake peers | Phase 1: accept only senders discovered via ZeroConf. Later: sign messages with a per-session key exchanged in the TXT record |
| Medium | Local HTTP server starts on every launch, listening on the LAN even when online | Phase 1: start only when offline |
| Low | Offline mode will need cleartext HTTP (Android `usesCleartextTraffic` / iOS `NSAllowsLocalNetworking`) | Accept; only LAN signaling uses it |

## Reporting

Report vulnerabilities privately to the maintainer (GitHub: ritikthakur22), not in public issues.
