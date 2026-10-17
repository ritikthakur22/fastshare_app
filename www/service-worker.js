// App-only kill switch (differs from the website's service worker on purpose).
// Older app versions registered a cache-first worker, so app updates kept running cached v1.1.22 code.
// Every file now ships inside the APK/IPA, so this worker deletes all caches, unregisters itself and
// reloads open pages once. main.js no longer registers a worker on native platforms, so this can't loop.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    windows.forEach(client => client.navigate(client.url).catch(e => console.log('sw: reload failed', e)));
})()));
