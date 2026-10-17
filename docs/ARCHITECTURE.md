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

The UI does not wait for the server: without a connection it just shows no peers and a "Loading…" placeholder for the own display name.

## Online flow (ip / secret / public-id rooms)

1. `ServerConnection` opens `wss://fastshare-ja1a.onrender.com/server` (or the `setting-wss` override). The server sends `ws-config` (ICE servers, wsFallback flag) and `display-name`.
2. Client joins rooms (`join-ip-room`, `room-secrets`, public room). The server answers with `peers` / `peer-joined` / `peer-left`.
3. `PeersManager` creates an `RTCPeer` per peer (or a `WSPeer` relay if WebRTC is missing and the server allows fallback).
4. SDP/ICE go through the server as `{type:'signal', to, roomType, roomId, ...}`; the server adds `sender`.
5. Once the data channel opens: `peer-connected` → `PeerUI` is drawn, display names are exchanged peer-to-peer.
6. Transfer: `request` → receiver accepts (`ReceiveRequestDialog`) → `header` + `FileChunker` partitions with backpressure → `FileDigester` reassembles → `ReceiveFileDialog` → native save via `window.saveFileToCapacitor` (capacitor-fs.js → NativeFileSaver plugin).

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

### Known bugs (as of 2026-10-17, Phase 1 not yet fixed)

| # | Problem | Effect |
|---|---|---|
| 1 | `HttpServer.start()` runs at every launch with no `android.notificationTitle` | Permanent Android foreground notification "HTTP server running", even online |
| 2 | Uses `addListener('serverRequest')`, `request.url`, `request.body`, `sendResponse` — real API is `'request'`, `path`, `bodyText`, `respond` | Incoming messages never handled; sender waits until the plugin's 60 s timeout |
| 3 | Android ZeroConf delivers results through the `watch(options, callback)` callback as `{action, service}`, not a `discover` event; `register` takes `props`, not `txtRecord` | No device is ever discovered; display name not advertised |
| 4 | Synthetic `peer-joined` is `{peerId, displayName, roomType}`; PeersManager/PeersUI read `message.peer.id` | Would throw even if discovery worked |
| 5 | `removed` action ignored | Departed devices never leave the list |
| 6 | `fetch('http://<ip>')` from the `https://localhost` WebView | Blocked as mixed content; native HTTP (CapacitorHttp) also needs cleartext allowed on targetSdk 36 |
| 7 | Android ZeroConf takes a `MulticastLock`; app manifest lacks `CHANGE_WIFI_MULTICAST_STATE` | Discovery may fail on real Wi-Fi |
| 8 | `ios/App/App/Info.plist` has `NSLocalNetworkUsageDescription`/`NSBonjourServices` duplicated 4×, some inside scene dictionaries; no `NSAllowsLocalNetworking` | iOS scene config at risk; local HTTP blocked by ATS |
| 9 | `/msg` accepts any sender | Spoofed signaling from anyone on the LAN (see SECURITY.md) |

Fixed: duplicate `local-message` listeners (commit b6f054c).

### Phase 1 plan (Android)

1. Start HttpServer + ZeroConf only after the WebSocket has been down for a grace period (or `navigator.onLine` is false); stop both on `ws-connected`. Pass `android.notificationTitle/Text`.
2. Rewrite `localmode.js` against the real plugin APIs; emit peers in the standard shape with `roomType: 'local'`; fire `peer-left` on `removed`.
3. Send with `Capacitor.Plugins.CapacitorHttp` (core, no new dependency); allow cleartext for LAN; add the multicast permission.
4. Accept `/msg` only from senders discovered via ZeroConf.

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
