// Self-check for NativeFileDigester (www/scripts/network.js): large received files are written to
// storage in ~1 MB pieces, in order, and only reported as received after the file is finished.
// Run: node test/native-digester.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '../www/scripts/network.js'), 'utf8');
const tick = ms => new Promise(r => setTimeout(r, ms));

function load(sink) {
    const fired = [];
    const ctx = {
        window: { nativeFileSink: sink },
        Events: { fire: (name, detail) => fired.push({ name, detail }), on() {} },
        Localization: { getTranslation: k => k },
        console: { log() {}, warn() {}, error() {} },
        Blob, Promise, setTimeout
    };
    vm.runInNewContext(SRC + '\nthis.NativeFileDigester = NativeFileDigester; this.NATIVE_STREAM_THRESHOLD = NATIVE_STREAM_THRESHOLD;', ctx);
    return { ctx, fired };
}

function fakeSink({ failOnWrite = -1 } = {}) {
    const log = [];
    return {
        log,
        open: async (name, mime, size) => {
            log.push(['open', name, mime, size]);
            await tick(5);
            let n = 0;
            return {
                write: async blob => {
                    const i = n++;
                    await tick(Math.random() * 5); // slow, uneven storage
                    if (i === failOnWrite) throw new Error('disk full');
                    log.push(['write', i, (await blob.arrayBuffer()).byteLength]);
                },
                finish: async () => log.push(['finish']),
                cancel: async () => log.push(['cancel'])
            };
        }
    };
}

(async () => {
    // 1. Happy path: 10 chunks of 300 KB -> ~1 MB writes in order, then finish, then callback
    {
        const sink = fakeSink();
        const { ctx } = load(sink);
        const size = 10 * 300 * 1024;
        let received = null;
        const d = new ctx.NativeFileDigester({ size, name: 'big.mp4', mime: 'video/mp4' }, size, 0, f => received = f);
        for (let i = 0; i < 10; i++) d.unchunk(new ArrayBuffer(300 * 1024));
        assert.strictEqual(d.progress, 1);
        assert.strictEqual(received, null, 'not reported before storage finished');
        await tick(100);

        const writes = sink.log.filter(e => e[0] === 'write');
        assert.deepStrictEqual(writes.map(w => w[1]), writes.map((_, i) => i), 'writes in order');
        assert.strictEqual(writes.reduce((sum, w) => sum + w[2], 0), size, 'every byte written once');
        assert.ok(writes.every(w => w[2] <= 1024 * 1024 + 300 * 1024), 'pieces stay around 1 MB');
        assert.deepStrictEqual(sink.log[0], ['open', 'big.mp4', 'video/mp4', size]);
        assert.deepStrictEqual(sink.log[sink.log.length - 1], ['finish'], 'finish after the last write');
        assert.deepStrictEqual({ ...received }, { name: 'big.mp4', size, type: 'video/mp4', savedNatively: true });
    }

    // 2. Storage error: partial file cancelled, user told, never reported as received
    {
        const sink = fakeSink({ failOnWrite: 1 });
        const { ctx, fired } = load(sink);
        const size = 4 * 1024 * 1024;
        let received = null;
        const d = new ctx.NativeFileDigester({ size, name: 'x.bin' }, size, 0, f => received = f);
        for (let i = 0; i < 4; i++) d.unchunk(new ArrayBuffer(1024 * 1024));
        await tick(100);
        assert.strictEqual(received, null);
        assert.ok(sink.log.some(e => e[0] === 'cancel'), 'partial file removed');
        assert.ok(!sink.log.some(e => e[0] === 'finish'));
        assert.ok(fired.some(e => e.name === 'notify-user'), 'user is told');
    }

    // 3. flush() resolves only after everything received so far is on disk
    {
        const sink = fakeSink();
        const { ctx } = load(sink);
        const size = 40 * 1024 * 1024;
        const d = new ctx.NativeFileDigester({ size, name: 'p.bin' }, size, 0, () => {});
        for (let i = 0; i < 5; i++) d.unchunk(new ArrayBuffer(300 * 1024)); // 1.5 MB, last 0.5 MB still pending
        await d.flush();
        const written = sink.log.filter(e => e[0] === 'write').reduce((sum, w) => sum + w[2], 0);
        assert.strictEqual(written, 5 * 300 * 1024, 'flush writes pending bytes and waits for them');
    }

    // 4. Threshold sanity
    {
        const { ctx } = load(fakeSink());
        assert.strictEqual(ctx.NATIVE_STREAM_THRESHOLD, 50 * 1024 * 1024);
    }

    console.log('native digester self-check: OK');
})().catch(e => { console.error(e); process.exit(1); });
