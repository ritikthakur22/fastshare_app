// Self-check for www/scripts/localmode.js: two simulated Android devices with mocked plugins.
// Run: node test/localmode.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '../www/scripts/localmode.js'), 'utf8');
const network = {}; // ip -> device, the simulated Wi-Fi
const tick = ms => new Promise(r => setTimeout(r, ms));

function makeDevice(ip) {
    const events = {};
    const fired = [];
    const dev = { ip, fired, httpRunning: false, registered: null, watchCb: null };

    const Events = {
        on: (name, fn) => (events[name] = events[name] || []).push(fn),
        fire: (name, detail) => { fired.push({ name, detail }); (events[name] || []).forEach(fn => fn({ detail })); }
    };
    let requestListener;
    const HttpServer = {
        addListener: (name, fn) => { if (name === 'request') requestListener = fn; },
        start: async opts => { assert.ok(opts.android.notificationTitle, 'notification title required'); dev.httpRunning = true; return { port: opts.port }; },
        stop: async () => { dev.httpRunning = false; },
        respond: async r => dev._responses[r.requestId](r)
    };
    dev._responses = {};
    const ZeroConf = {
        register: async r => { dev.registered = r; },
        unregister: async () => { dev.registered = null; },
        watch: async (req, cb) => { dev.watchCb = cb; cb({}); }, // first callback has no service, like Android
        unwatch: async () => { dev.watchCb = null; }
    };
    let reqId = 0;
    const CapacitorHttp = {
        post: ({ url, data }) => new Promise((resolve, reject) => {
            const target = network[new URL(url).hostname];
            if (!target || !target.httpRunning) return reject(new Error('ECONNREFUSED'));
            const id = String(++reqId) + ip;
            target._responses[id] = r => resolve({ status: r.status });
            setTimeout(() => target._request({ requestId: id, method: 'POST', path: '/msg', bodyText: JSON.stringify(data) }), Math.random() * 20);
        })
    };

    const storage = {};
    dev.storage = storage;
    const ctx = {
        document: { hidden: false, querySelector: () => null },
        localStorage: { getItem: k => (k in storage ? storage[k] : null), setItem: (k, v) => storage[k] = String(v) },
        window: { Capacitor: { getPlatform: () => 'android', Plugins: { ZeroConf, HttpServer, CapacitorHttp } } },
        Events, console: { log() {}, warn() {}, error() {} },
        Localization: { getTranslation: k => k },
        PersistentStorage: { get: async () => null },
        setTimeout, clearTimeout, Promise, Math, URL
    };
    vm.runInNewContext(SRC, ctx);
    dev._request = r => requestListener(r);
    dev.lm = ctx.window.localMode;
    dev.plugins = { HttpServer, ZeroConf, CapacitorHttp };
    dev.Events = Events;
    network[ip] = dev;
    return dev;
}

function announce(from, to, action = 'resolved') {
    to.watchCb && to.watchCb({ action, service: { name: from.lm.myId, port: 53214, ipv4Addresses: [from.ip], txtRecord: from.registered.props } });
}

(async () => {
    // Faster timers for the test: patch the grace period by firing the start manually
    const a = makeDevice('10.0.0.1');
    const b = makeDevice('10.0.0.2');

    // 1. Online: server connects before the grace period -> nothing starts (no notification)
    a.Events.fire('ws-connected');
    a.lm._enqueue(() => a.lm._start()); // even a queued start must not run while connected
    await tick(10);
    assert.strictEqual(a.httpRunning, false, 'must not run while online');

    // 2. Offline: both start
    a.lm._wsConnected = false;
    a.lm._enqueue(() => a.lm._start());
    b.lm._enqueue(() => b.lm._start());
    await tick(10);
    assert.ok(a.httpRunning && b.httpRunning, 'both servers running offline');
    assert.ok(a.registered.props.displayName, 'display name advertised in props');

    // 3. Caller discovers callee first; callee hasn't discovered caller -> 409 then retry succeeds
    const [caller, callee] = a.lm.myId < b.lm.myId ? [a, b] : [b, a];
    announce(callee, caller);
    const peersEvt = caller.fired.find(e => e.name === 'peers');
    assert.ok(peersEvt && peersEvt.detail.peers[0].id === callee.lm.myId && peersEvt.detail.roomType === 'local', 'caller gets peers event in standard shape');

    for (let i = 0; i < 5; i++) caller.lm.sendMessage(callee.lm.myId, { type: 'signal', to: callee.lm.myId, seq: i });
    await tick(100);
    announce(caller, callee); // callee discovers caller late
    const joined = callee.fired.find(e => e.name === 'peer-joined');
    assert.ok(joined && joined.detail.peer.id === caller.lm.myId, 'callee gets peer-joined in standard shape');
    await tick(1500);
    const got = callee.fired.filter(e => e.name === 'local-message').map(e => e.detail.seq);
    assert.deepStrictEqual(got, [0, 1, 2, 3, 4], 'all signals delivered once, in order');
    assert.strictEqual(callee.fired.find(e => e.name === 'local-message').detail.sender.id, caller.lm.myId);

    // 4. Non-signal messages from the LAN are rejected
    const before = callee.fired.length;
    let status;
    callee._responses.x = r => status = r.status;
    callee._request({ requestId: 'x', method: 'POST', path: '/msg', bodyText: JSON.stringify({ type: 'peers', to: callee.lm.myId, sender: { id: caller.lm.myId } }) });
    assert.strictEqual(status, 400);
    assert.strictEqual(callee.fired.length, before, 'rejected message fires nothing');

    // 5. Unknown peers are not handled locally (falls through to the real server)
    assert.strictEqual(caller.lm.sendMessage('someone-else', { type: 'signal' }), false);

    // 6. Peer removed -> peer-left
    announce(callee, caller, 'removed');
    assert.ok(caller.fired.some(e => e.name === 'peer-left' && e.detail.peerId === callee.lm.myId));

    // 7. Back online -> stops, notification gone, local peers removed
    callee.Events.fire('ws-connected');
    await tick(10);
    assert.strictEqual(callee.httpRunning, false, 'stops when server is back');
    assert.strictEqual(callee.registered, null);
    assert.ok(callee.fired.some(e => e.name === 'peer-left' && e.detail.peerId === caller.lm.myId));

    // 8. Repeated ws-disconnected (one per failed reconnect) must not keep pushing the start back
    const t1 = a.lm._startTimer;
    a.lm.running = false;
    a.lm._startTimer = null;
    a.Events.fire('ws-disconnected');
    const t2 = a.lm._startTimer;
    a.Events.fire('ws-disconnected');
    assert.ok(t2 && a.lm._startTimer === t2, 'start timer not reset by repeated disconnects');
    clearTimeout(t1); clearTimeout(t2);
    [a, b].forEach(d => clearTimeout(d.lm._startTimer));

    // 9. Connection mode "online": never runs, even with the server down
    const c = makeDevice('10.0.0.3');
    c.storage['setting-mode'] = 'online';
    c.Events.fire('connection-mode-changed');
    c.Events.fire('ws-disconnected');
    await tick(10);
    assert.strictEqual(c.httpRunning, false, 'online mode never starts local mode');
    assert.strictEqual(c.lm._startTimer, null, 'online mode schedules nothing');

    // 10. Connection mode "offline": starts at once and ignores the server coming back
    c.storage['setting-mode'] = 'offline';
    c.Events.fire('connection-mode-changed');
    await tick(10);
    assert.ok(c.httpRunning, 'offline mode starts immediately');
    c.Events.fire('ws-connected');
    await tick(10);
    assert.ok(c.httpRunning, 'offline mode keeps running when the server connects');

    // 11. Switching back to online stops it
    c.storage['setting-mode'] = 'online';
    c.Events.fire('connection-mode-changed');
    await tick(10);
    assert.strictEqual(c.httpRunning, false, 'switching to online stops local mode');
    clearTimeout(c.lm._startTimer);

    // 12. Start rejected in the background (Android 12+) -> retried when the app becomes visible
    const d = makeDevice('10.0.0.4');
    d.storage['setting-mode'] = 'offline';
    let blocked = true;
    const { HttpServer } = d.plugins;
    const origStart = HttpServer.start;
    HttpServer.start = async opts => { if (blocked) throw new Error('startForegroundService() not allowed'); return origStart(opts); };
    d.Events.fire('connection-mode-changed');
    await tick(10);
    assert.strictEqual(d.httpRunning, false, 'background start fails');
    blocked = false;
    d.Events.fire('visibilitychange');
    await tick(10);
    assert.ok(d.httpRunning, 'retried and running once visible');

    console.log('localmode self-check: OK');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
