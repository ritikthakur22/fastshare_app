# Security

## Model

- File contents travel peer-to-peer over WebRTC (DTLS-encrypted). The signaling server sees only metadata: peer ids, display names, room ids, SDP/ICE.
- Receivers must accept each transfer unless they enabled auto-accept for a paired device.
- Pairing secrets (`room_secrets`) are stored in the device's IndexedDB and sent to the signaling server to join the secret room, so the server operator can see them.
- Peers show a connection hash (from the DTLS fingerprints) so users can compare it out of band.

## Rules

- Never commit keystores, passwords, `releases/`, `play-store-key.json`, or `local.properties`. Signing secrets live in GitHub Actions secrets only.
- Anything received from the network (signaling messages, `/msg` bodies, file names, text) is untrusted: never `innerHTML` it, never use it as a path without sanitizing.
- The local HTTP server must run only while offline mode is needed, and must accept only signaling from discovered senders.
- Keep cleartext HTTP limited to LAN signaling; everything else stays HTTPS/WSS.

## Known issues (2026-10-17)

| Severity | Issue | Action |
|---|---|---|
| **High** | `fix_build.sh` (tracked in git) contains the release keystore password `fastshare123` in plain text | If that keystore signs Play builds: treat the password as leaked, remove it from the script (read from env), and consider Play App Signing key upgrade. Git history still contains it |
| Medium | Anyone on the same LAN can advertise a fake `_fastshare._tcp` device or send `/msg` signals as a discovered id | Mitigated: `/msg` accepts only `type: 'signal'` to this device from a discovered sender, and every transfer still needs the receiver to accept. Not authenticated; a real fix would sign messages with a key exchanged in the TXT record |
| Fixed | Local HTTP server started on every launch, listening on the LAN even when online | Now runs only while the signaling server is unreachable (Android); disabled on iOS |
| Low | Android `usesCleartextTraffic="true"` is set for LAN signaling (iOS will need `NSAllowsLocalNetworking`) | Accepted; app content loads from `https://localhost` and the server is `wss://` |

## Reporting

Report vulnerabilities privately to the maintainer (GitHub: ritikthakur22), not in public issues.
