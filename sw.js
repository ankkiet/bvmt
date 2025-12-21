const CACHE_NAME = 'nvc-green-v2-fix';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Recycle_symbol_%28green%29.svg/512px-Recycle_symbol_%28green%29.svg.png',
    'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Quicksand:wght@500;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching assets...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('firestore') || 
        event.request.url.includes('googleapis') || 
        event.request.url.includes('cloudinary')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Trả về cache nếu có, nếu không thì tải mới
            return cachedResponse || fetch(event.request).catch(() => {
                // Nếu mất mạng và không có cache, có thể trả về trang offline (nếu có)
                // Ở đây ta giữ nguyên logic cũ để tránh lỗi
            });
        })
    );
});
