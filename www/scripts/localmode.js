if (window.Capacitor && window.Capacitor.Plugins) {
    const { ZeroConf, HttpServer } = window.Capacitor.Plugins;

    class LocalMode {
        constructor() {
            this.localPeers = {};
            this.port = 53214;
            this.myId = 'local-' + Math.random().toString(36).substr(2, 6);
            this.myDisplayName = this.myId;
            
            Events.on('displayName', e => { this.myDisplayName = e.detail; });
            
            this.init();
        }

        async init() {
            try {
                if (HttpServer) {
                    await HttpServer.start({ port: this.port });
                    
                    // Listen for incoming messages from local peers
                    HttpServer.addListener('serverRequest', (request) => {
                        if (request.url === '/msg' && request.method === 'POST') {
                            try {
                                const msg = JSON.parse(request.body);
                                Events.fire('local-message', msg);
                                HttpServer.sendResponse({ requestId: request.requestId, status: 200, body: 'OK' });
                            } catch (e) {
                                HttpServer.sendResponse({ requestId: request.requestId, status: 400, body: 'Bad Request' });
                            }
                        } else {
                            HttpServer.sendResponse({ requestId: request.requestId, status: 404, body: 'Not Found' });
                        }
                    });
                    console.log('LocalMode: HTTP Server started on port ' + this.port);
                }

                if (ZeroConf) {
                    // Watch for others
                    ZeroConf.addListener('discover', (service) => {
                        if (service.name === this.myId) return; // ignore self
                        
                        // Wait for resolved IP
                        if (service.ipv4Addresses && service.ipv4Addresses.length > 0) {
                            const ip = service.ipv4Addresses[0];
                            const port = service.port;
                            const peerId = service.name;
                            const displayName = service.txtRecord?.displayName || peerId;

                            if (!this.localPeers[peerId]) {
                                console.log('LocalMode: Discovered ' + peerId + ' at ' + ip + ':' + port);
                                this.localPeers[peerId] = { ip, port, displayName };
                                
                                // Synthesize join event so UI shows them
                                Events.fire('peer-joined', {
                                    peerId: peerId,
                                    displayName: displayName,
                                    roomType: 'local'
                                });
                            }
                        }
                    });

                    await ZeroConf.watch({ type: '_fastshare._tcp.', domain: 'local.' });
                    
                    // Register self
                    await ZeroConf.register({
                        type: '_fastshare._tcp.',
                        domain: 'local.',
                        name: this.myId,
                        port: this.port,
                        txtRecord: {
                            displayName: this.myDisplayName
                        }
                    });
                    console.log('LocalMode: Registered ZeroConf service ' + this.myId);
                }
            } catch (err) {
                console.error('LocalMode error: ', err);
            }
        }
        
        sendMessage(peerId, msg) {
            const peer = this.localPeers[peerId];
            if (!peer) return false;
            
            // Send HTTP POST to peer's local server
            msg.sender = { id: this.myId };
            fetch(`http://${peer.ip}:${peer.port}/msg`, {
                method: 'POST',
                
                body: JSON.stringify(msg)
            }).catch(e => console.error('LocalMode: failed to send msg to ' + peerId, e));
            
            return true;
        }
    }
    
    window.localMode = new LocalMode();
}
