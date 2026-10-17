// Offline local mode: when the signaling server is unreachable, discover devices on the same
// Wi-Fi via ZeroConf and carry WebRTC signaling over a local HTTP server. Transfers still use WebRTC.
// shortcut: Android only until iOS plugin behaviour and Info.plist are fixed (Phase 2 in docs/PRD.md).
if (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android') {
    const { ZeroConf, HttpServer, CapacitorHttp } = window.Capacitor.Plugins;
    const SERVICE = { type: '_fastshare._tcp.', domain: 'local.' };
    const START_DELAY_MS = 10000; // grace period so a slow/cold signaling server doesn't trigger offline mode
    const RETRY_MS = 500;
    const MAX_RETRIES = 20;

    class LocalMode {
        constructor() {
            this.port = 53214;
            this.myId = 'local-' + Math.random().toString(36).substring(2, 10);
            this.peers = {}; // peerId -> { ip, port, queue }
            this.running = false;
            this._wsConnected = false;
            this._startTimer = null;
            this._serverDisplayName = null;
            this._lifecycle = Promise.resolve(); // serializes start/stop

            Events.on('display-name', e => this._serverDisplayName = e.detail.displayName);
            Events.on('ws-connected', _ => this._onWsConnected());
            Events.on('ws-disconnected', _ => this._scheduleStart());
            Events.on('offline', _ => this._scheduleStart());

            HttpServer.addListener('request', e => this._onRequest(e));
            HttpServer.addListener('server-error', e => {
                console.error('LocalMode: server error', e);
                if (e.fatal) this._enqueue(() => this._stop());
            });

            // covers the case where the server never answers at all
            this._scheduleStart();
        }

        _onWsConnected() {
            this._wsConnected = true;
            clearTimeout(this._startTimer);
            this._startTimer = null;
            this._enqueue(() => this._stop());
        }

        _scheduleStart() {
            this._wsConnected = false;
            // ws-disconnected fires on every failed reconnect (~1/s): don't restart the timer
            if (this._startTimer || this.running) return;
            this._startTimer = setTimeout(() => {
                this._startTimer = null;
                if (!this._wsConnected) this._enqueue(() => this._start());
            }, START_DELAY_MS);
        }

        _enqueue(fn) {
            this._lifecycle = this._lifecycle.then(fn).catch(e => console.error('LocalMode:', e));
        }

        async _start() {
            if (this.running || this._wsConnected) return;
            this.running = true;
            try {
                await HttpServer.start({
                    port: this.port,
                    android: {
                        notificationTitle: Localization.getTranslation('notifications.offline-mode-title'),
                        notificationText: Localization.getTranslation('notifications.offline-mode-text')
                    }
                });

                const displayName = await this._displayName();
                await ZeroConf.register({ ...SERVICE, name: this.myId, port: this.port, props: { displayName } });
                // Android delivers watch results through this callback, not through a 'discover' event
                await ZeroConf.watch(SERVICE, result => this._onDiscover(result));
                console.log('LocalMode: started as ' + this.myId);
            }
            catch (e) {
                console.error('LocalMode: start failed', e);
                await this._stop();
            }
        }

        async _stop() {
            if (!this.running) return;
            this.running = false;
            // shortcut: drops an in-flight offline transfer when the internet comes back; keep peers if users hit this
            Object.keys(this.peers).forEach(peerId => this._removePeer(peerId));
            await ZeroConf.unwatch(SERVICE).catch(e => console.warn('LocalMode: unwatch', e));
            await ZeroConf.unregister({ ...SERVICE, name: this.myId }).catch(e => console.warn('LocalMode: unregister', e));
            await HttpServer.stop().catch(e => console.warn('LocalMode: stop', e));
            console.log('LocalMode: stopped');
        }

        async _displayName() {
            const name = await PersistentStorage.get('edited_display_name').catch(_ => null)
                || this._serverDisplayName
                || 'FastShare ' + this.myId.slice(-4);
            // Offline the server never sends our display name: give the UI one
            if (!this._serverDisplayName) Events.fire('display-name', { displayName: name, deviceName: '' });
            return name;
        }

        _onDiscover(result) {
            if (!this.running || !result || !result.service) return; // watch() first resolves without a service
            const { action, service } = result;
            const peerId = service.name;
            if (!peerId || peerId === this.myId || !peerId.startsWith('local-')) return;

            if (action === 'removed') {
                this._removePeer(peerId);
                return;
            }
            if (action !== 'resolved' || !service.ipv4Addresses || !service.ipv4Addresses.length) return;

            const known = this.peers[peerId];
            this.peers[peerId] = { ip: service.ipv4Addresses[0], port: service.port, queue: known ? known.queue : Promise.resolve() };
            if (known) return;

            console.log('LocalMode: discovered ' + peerId + ' at ' + service.ipv4Addresses[0] + ':' + service.port);
            const peer = {
                id: peerId,
                rtcSupported: true,
                name: {
                    displayName: (service.txtRecord && service.txtRecord.displayName) || peerId,
                    deviceName: '',
                    type: 'mobile'
                }
            };
            // Both sides discover each other: the lower id calls ('peers'), the other waits ('peer-joined')
            const isCaller = this.myId < peerId;
            if (isCaller) Events.fire('peers', { peers: [peer], roomType: 'local', roomId: 'local' });
            else Events.fire('peer-joined', { peer, roomType: 'local', roomId: 'local' });
        }

        _removePeer(peerId) {
            if (!this.peers[peerId]) return;
            delete this.peers[peerId];
            Events.fire('peer-left', { peerId, roomType: 'local', disconnect: true });
        }

        _onRequest(req) {
            const reply = (status, bodyText) => HttpServer.respond({ requestId: req.requestId, status, bodyText });

            if (req.method !== 'POST' || req.path !== '/msg') return reply(404, 'Not Found');

            let msg;
            try {
                msg = JSON.parse(req.bodyText);
            }
            catch (e) {
                return reply(400, 'Bad Request');
            }
            // Only WebRTC signaling may come over the LAN; everything else is the real server's job
            if (!msg || msg.type !== 'signal' || msg.to !== this.myId || !msg.sender || !msg.sender.id) {
                return reply(400, 'Bad Request');
            }
            // Sender may have found us before we found them: 409 makes them retry
            if (!this.peers[msg.sender.id]) return reply(409, 'Unknown sender');

            reply(200, 'OK');
            Events.fire('local-message', msg);
        }

        // Called by ServerConnection.send(). Returns true if the message was handled locally.
        sendMessage(peerId, msg) {
            const peer = this.peers[peerId];
            if (!peer) return false;

            const data = { ...msg, sender: { id: this.myId } };
            // Queue per peer: the SDP offer must arrive before its ICE candidates
            peer.queue = peer.queue.then(() => this._post(peerId, data));
            return true;
        }

        async _post(peerId, data) {
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                const peer = this.peers[peerId]; // re-read: ip may change on re-resolve
                if (!peer) return;
                try {
                    const res = await CapacitorHttp.post({
                        url: `http://${peer.ip}:${peer.port}/msg`,
                        headers: { 'Content-Type': 'application/json' },
                        data,
                        connectTimeout: 3000,
                        readTimeout: 3000
                    });
                    if (res.status !== 409) return;
                }
                catch (e) {
                    console.warn('LocalMode: send to ' + peerId + ' failed', e);
                }
                await new Promise(resolve => setTimeout(resolve, RETRY_MS));
            }
            console.error('LocalMode: gave up sending to ' + peerId);
        }
    }

    window.localMode = new LocalMode();
}
