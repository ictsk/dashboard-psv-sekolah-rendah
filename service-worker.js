// Service Worker - SeniKreatif SK Portal
// Strategi: cache-first untuk aset penting portal (app shell), supaya boleh dibuka
// walaupun rangkaian lemah/terputus di bilik seni. Video YouTube & log masuk Google
// tetap perlukan internet (tidak boleh di-cache).

const CACHE_VERSION = 'senikreatif-v1';
const CORE_ASSETS = [
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Domain yang TIDAK BOLEH dicelah/di-cache oleh service worker ini -- log masuk Google
// (SSO DELIMA) dan video YouTube mesti sentiasa terus ke rangkaian sebenar.
const EXCLUDED_HOSTS = [
    'accounts.google.com',
    'www.youtube.com',
    'youtube.com',
    'oauth2.googleapis.com'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)).catch((err) => {
            console.warn('Gagal cache sebahagian aset teras semasa pemasangan:', err);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Hanya kendalikan permintaan GET
    if (request.method !== 'GET') return;

    let url;
    try {
        url = new URL(request.url);
    } catch (e) {
        return;
    }

    // Jangan celah domain yang dikecualikan (SSO DELIMA / YouTube)
    if (EXCLUDED_HOSTS.some((host) => url.hostname.includes(host))) {
        return;
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Cache-first: kembalikan versi tersimpan serta-merta, kemas kini cache di latar
                fetch(request).then((freshResponse) => {
                    if (freshResponse && freshResponse.status === 200) {
                        caches.open(CACHE_VERSION).then((cache) => cache.put(request, freshResponse.clone()));
                    }
                }).catch(() => { /* offline - guna cache sedia ada sahaja */ });
                return cachedResponse;
            }

            // Tiada dalam cache -- cuba rangkaian, dan simpan ke cache jika berjaya
            return fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const cloned = networkResponse.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(request, cloned));
                }
                return networkResponse;
            }).catch(() => {
                // Tiada rangkaian & tiada cache -- tiada apa boleh dibuat untuk aset ini
                return new Response('Tiada sambungan internet dan aset ini belum di-cache.', {
                    status: 503,
                    statusText: 'Offline'
                });
            });
        })
    );
});
