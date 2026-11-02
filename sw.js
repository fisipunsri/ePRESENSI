/* ePRESENSI - service worker minimal.
   Hanya menangani pemuatan halaman wrapper (network-first). Permintaan lain
   (Apps Script, Worker login, API) tidak disentuh sama sekali. */
const CACHE = 'epresensi-shell-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || r.mode !== 'navigate') return;
  e.respondWith(
    fetch(r)
      .then((res) => {
        if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then((x) => x.put('./', c)); }
        return res;
      })
      .catch(() => caches.match('./').then((m) => m || new Response('Tidak ada koneksi internet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })))
  );
});
