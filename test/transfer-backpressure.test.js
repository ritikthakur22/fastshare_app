// End-to-end self-check of the real Peer transfer protocol (www/scripts/network.js) with a native
// receiver whose storage is much slower than the network: the file must arrive intact and the
// receiver's unwritten backlog must stay bounded (partition acks wait for the disk).
// Run: node test/transfer-backpressure.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '../www/scripts/network.js'), 'utf8');
const MB = 1024 * 1024;

class FileReaderShim {
    addEventListener(type, fn) { this['on' + type] = fn; }
    readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => this.onload({ target: { result } })); }
}

(async () => {
    const stats = { received: 0, written: 0, maxBacklog: 0, finished: false };
    const handlers = {};
    const sink = {
        open: async () => ({
            write: async blob => {
                await new Promise(r => setTimeout(r, 8)); // ~125 MB/s "disk" vs. instant "network"
                stats.written += blob.size;
            },
            finish: async () => { stats.finished = true; },
            cancel: async () => {}
        })
    };
    const ctx = {
        window: { nativeFileSink: sink },
        Events: {
            on: (n, f) => (handlers[n] = handlers[n] || []).push(f),
            fire: (n, d) => (handlers[n] || []).forEach(f => f({ detail: d })),
            off() {}
        },
        Localization: { getTranslation: k => k },
        PersistentStorage: { getRoomSecretEntry: async () => null },
        BrowserTabsConnector: { peerIsSameBrowser: () => false },
        console: { log() {}, warn() {}, error() {} },
        FileReader: FileReaderShim,
        Blob, File, Promise, setTimeout, Math, JSON, isNaN
    };
    vm.runInNewContext(SRC + '\nthis.Peer = Peer;', ctx);

    class PipePeer extends ctx.Peer {
        _send(message) {
            if (typeof message !== 'string') {
                stats.received += message.byteLength;
                stats.maxBacklog = Math.max(stats.maxBacklog, stats.received - stats.written);
            }
            setTimeout(() => this.other._onMessage(message), 0);
        }
    }
    const sender = new PipePeer(null, true, 'receiver', 'local', 'local');
    const receiver = new PipePeer(null, false, 'sender', 'local', 'local');
    sender.other = receiver;
    receiver.other = sender;

    let receivedFile = null;
    ctx.Events.on('files-transfer-request', () => receiver._respondToFileTransferRequest(true));
    ctx.Events.on('files-received', e => receivedFile = e.detail.files[0]);

    const size = 120 * MB + 12345;
    const file = new File([new Uint8Array(size)], 'movie.mov', { type: 'video/quicktime' });
    await sender.requestFileTransfer([file]);

    for (let i = 0; i < 600 && !receivedFile; i++) await new Promise(r => setTimeout(r, 50));

    assert.ok(receivedFile, 'transfer completed');
    assert.ok(receivedFile.savedNatively, 'large transfer was streamed to storage');
    assert.strictEqual(receivedFile.size, size);
    assert.strictEqual(stats.written, size, 'every byte written');
    assert.ok(stats.finished);
    // one partition (16 MB) in flight + the one being written + a 4 MB read block of slack
    assert.ok(stats.maxBacklog <= 36 * MB, `backlog bounded, was ${(stats.maxBacklog / MB).toFixed(1)} MB`);

    // Small transfer: unchanged in-memory path (preview, share, zip still work), partitions acked at once
    receivedFile = null;
    const small = new File([new Uint8Array(20 * MB).fill(9)], 'photo.jpg', { type: 'image/jpeg' });
    ctx.getThumbnailAsDataUrl = async () => '';
    await sender.requestFileTransfer([small]);
    for (let i = 0; i < 200 && !receivedFile; i++) await new Promise(r => setTimeout(r, 50));
    assert.ok(receivedFile && !receivedFile.savedNatively, 'small transfer stays in memory');
    assert.strictEqual(receivedFile.size, 20 * MB);
    assert.strictEqual(new Uint8Array(await receivedFile.arrayBuffer())[123], 9, 'content intact');

    console.log(`transfer backpressure self-check: OK (max backlog ${(stats.maxBacklog / MB).toFixed(1)} MB of ${(size / MB).toFixed(0)} MB)`);
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
