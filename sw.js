const CACHE_NAME = 'nvc-green-v44-final';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    'https://placehold.co/512x512/2e7d32/ffffff.png?text=NVC+Green',
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
    
    // Bỏ qua các API bên ngoài để tránh lỗi CORS
    if (event.request.url.includes('firestore') || 
        event.request.url.includes('googleapis') || 
        event.request.url.includes('cloudinary') ||
        event.request.url.includes('youtube')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).catch(() => {
                // Nếu mất mạng và đang tải trang chính, trả về index.html từ cache
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
