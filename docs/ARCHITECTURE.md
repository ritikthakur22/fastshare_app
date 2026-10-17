# Architecture

## Layers

```
┌──────────── Native shell (Capacitor 8) ─────────────┐
│ Android: MainActivity, NativeFileSaverPlugin        │
│ iOS:     AppDelegate/SceneDelegate, NativeFileSaver │
│ Plugins: filesystem, toast, local-notifications,    │
│          @cantoo/capacitor-http-server, zeroconf    │
├──────────── WebView: www/ (plain JS) ───────────────┤
│ main.js → UI classes (ui-main.js, ui.js, sidebar)   │
│        → ServerConnection ──► signaling server (WS) │
│        → PeersManager ──► RTCPeer / WSPeer          │
│ localmode.js (offline signaling over LAN HTTP)      │
│ capacitor-fs.js (bundled bridge to native saving)   │
└─────────────────────────────────────────────────────┘
```

All modules communicate through the `Events` bus (`window` CustomEvents, ui-main.js). To trace a flow, grep the event name.

## Startup

`index.html` loads `localization.js`, `persistent-storage.js`, `ui-main.js`, `main.js`, plus `capacitor-fs.js` and `sidebar.js`. `FastShare` (main.js) translates the page, fades in the UI, then lazy-loads `deferredScripts` (util, localmode, network, ui, libs) and calls `hydrate()`, which constructs every dialog, `ServerConnection` and `PeersManager`.

No service worker on native: `main.js` skips registration, and the app's `service-worker.js` only deletes the cache-first worker older versions installed (it served cached v1.1.22 code after app updates), then unregisters itself and reloads once.

The UI does not wait for the server: without a connection it just shows no peers and a "Loading…" placeholder for the own display name.

## Online flow (ip / secret / public-id rooms)

1. `ServerConnection` opens `wss://fastshare-ja1a.onrender.com/server` (or the `setting-wss` override). The server sends `ws-config` (ICE servers, wsFallback flag) and `display-name`.
2. Client joins rooms (`join-ip-room`, `room-secrets`, public room). The server answers with `peers` / `peer-joined` / `peer-left`.
3. `PeersManager` creates an `RTCPeer` per peer (or a `WSPeer` relay if WebRTC is missing and the server allows fallback).
4. SDP/ICE go through the server as `{type:'signal', to, roomType, roomId, ...}`; the server adds `sender`.
5. Once the data channel opens: `peer-connected` → `PeerUI` is drawn, display names are exchanged peer-to-peer.
6. Transfer: `request` → receiver accepts (`ReceiveRequestDialog`) → `header` + `FileChunker` (64 KB chunks, DataChannel backpressure, 16 MB partitions acked by the receiver) → digester → `files-received`.
   - **Under 50 MB, or on the web:** `FileDigester` collects the file in memory → `ReceiveFileDialog` (preview, share, zip) → native save via `window.saveFileToCapacitor`.
   - **50 MB or more in the native app:** `NativeFileDigester` writes ~1 MB pieces to `window.nativeFileSink` (capacitor-fs.js: Android NativeFileSaver start/writeChunk/finish → Downloads/Pictures; iOS `Filesystem` → Documents, visible in the Files app) while receiving. The receiver acks a partition only after the previous one is on disk, so memory stays ~32 MB at most (bridge writes measured at ~5 MB/s on a real Android phone in a release-like build, slower than Wi-Fi). No dialog; a "Saved N file(s)" toast instead.
   - Senders from older app versions or the website don't send partitions, so they can still outrun a native receiver's storage. Port the `FileChunker` partition size to the website too.

## Offline local flow (roomType `local`)

Goal: replace only steps 1–4 when the server is unreachable; everything from step 5 on is unchanged. WebRTC on one LAN connects with host candidates, so no STUN/TURN is needed.

```
Device A                                     Device B
ZeroConf register _fastshare._tcp (port 53214) ◄─ discover ─► ZeroConf watch
HttpServer listens :53214                       HttpServer listens :53214
ServerConnection.send(signal to B) ── localMode.sendMessage ── POST http://B:53214/msg ──►
                                                 request event → Events 'local-message'
                                                 → ServerConnection._onMessage → 'signal' → PeersManager
```

Hook points: `ServerConnection.send()` asks `window.localMode.sendMessage(msg.to, msg)` first; incoming messages arrive via the single `Events.on('local-message')` in the `ServerConnection` constructor.

### How it behaves (Phase 1, Android only)

- **Mode:** `localStorage['setting-mode']` = `auto` | `online` | `offline` (sidebar, Android only; change fires `connection-mode-changed`). `offline` also makes `ServerConnection` disconnect and refuse to reconnect.
- **Background:** Android 12+ refuses to start the foreground service while the app is in the background (`mAllowStartForeground false`). A failed start is retried on the next `visibilitychange` to visible.
- **When (auto):** `localmode.js` waits 10 s after the WebSocket is down (or `offline` fires) before starting, so a cold Render server doesn't trigger it. Repeated `ws-disconnected` events (one per failed reconnect) don't push that timer back. On `ws-connected` it stops everything, so the Android foreground notification ("FastShare offline sharing") appears only while offline.
- **Discovery:** each device registers `_fastshare._tcp.` with id `local-xxxxxxxx` and `props.displayName`. Android delivers results through the `ZeroConf.watch(options, callback)` callback (`{action, service}`); `resolved` adds a peer, `removed` fires `peer-left`.
- **Peer shape:** standard `{ peer: {id, name, rtcSupported}, roomType: 'local', roomId: 'local' }`. Both devices discover each other, so the lower id is the caller (`peers` event) and the other waits (`peer-joined`).
- **Sending:** `Capacitor.Plugins.CapacitorHttp.post` (native, avoids WebView mixed-content blocking; needs `usesCleartextTraffic`). One queue per peer keeps SDP before ICE. A `409` means "they haven't discovered me yet", so it retries every 500 ms, up to 20 times.
- **Receiving:** `/msg` only accepts `type: 'signal'` addressed to this device from a discovered sender.
- **Display name:** offline, the server never sends one, so local mode uses the edited name or `FastShare xxxx` and fires `display-name` itself.
- **Back online:** local peers are removed (an in-flight offline transfer is dropped; see the `shortcut:` comment).
- Self-check: `npm test` (`test/localmode.test.js`, two simulated devices with mocked plugins).

### Still open

| Problem | Effect |
|---|---|
| iOS: offline mode disabled; `Info.plist` has `NSLocalNetworkUsageDescription`/`NSBonjourServices` duplicated 4x, some inside scene dictionaries; no `NSAllowsLocalNetworking` | Phase 2 |
| Not yet tested on real devices | WebView mDNS-obfuscated ICE candidates and Wi-Fi client isolation on some routers/hotspots could still block the WebRTC connection |
| ZeroConf advertisements are unauthenticated | See SECURITY.md |

Fixed: duplicate `local-message` listeners (b6f054c); Phase 1 rewrite of `localmode.js`.

## Native code

- **NativeFileSaverPlugin** (Android `android/app/src/main/java/com/crdy/fastshare/plugins/`, iOS `ios/App/App/`): receives base64 chunks and appends them to a file, then publishes it (MediaStore on Android, Photos/Files on iOS). JS side: `src_cap_fs.js`.
- `MainActivity` registers the plugin. `AppDelegate`/`SceneDelegate`/`PendingFile` handle iOS share-in and file opening.

## Storage (there is no server database)

| Where | What |
|---|---|
| IndexedDB `fastshare_store` v5 (`persistent-storage.js`) | `keyval` (e.g. `edited_display_name`), `room_secrets` (paired devices: secret, display_name, device_name, auto_accept), `share_target_files` |
| localStorage | `setting-wss`, `setting-color`, `setting-icon`, `setting-autodownload`, `theme`, `language_code`, `approve-share-text`, `fastshare-clipboard-history`, `peer_ids_browser` |
| sessionStorage | `peer_id`, `peer_id_hash` (re-authenticate as the same peer on reload) |

Schema changes go in `onupgradeneeded` as a new `if (e.oldVersion <= N)` step, bumping the open version.

## UI / design

- No framework. DOM in `www/index.html`; components are classes in `ui.js` (`Dialog` subclasses own one `<x-dialog>`).
- Tokens: CSS custom properties in `www/styles/styles-main.css` (`--primary-color`, `--bg-color`, `--text-color`; light `--lt-*`, dark `--dt-*`, dark via `prefers-color-scheme` and the `theme` setting).
- `sidebar.js` generates the primary palette from a seed color (8 presets) and syncs the status bar through `<meta name="theme-color">`.
- Font: Open Sans (bundled in `www/fonts`). Icons: inline SVG `<symbol>`s in index.html.

## Build & release

- CI (`ci.yml`): on push/PR to main — `npm install`, `cap sync`, Android `assembleDebug`, iOS build. Compile check only.
- Release (`release.yml`): on tag `v*` — signed APK + AAB (keystore from secrets), IPA, GitHub release with flattened artifact paths.
- `fix_build.sh` is a legacy local script with absolute paths; prefer CI.
