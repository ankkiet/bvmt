const CACHE_NAME = 'nvc-green-v42-stable';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Recycle_symbol_%28green%29.svg/512px-Recycle_symbol_%28green%29.svg.png',
    'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Quicksand:wght@500;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. Install
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching assets...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Activate (Xóa cache cũ ngay lập tức)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Deleting old cache:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

// 3. Fetch (Xử lý khi mất mạng hoặc lỗi)
self.addEventListener('fetch', (event) => {
    // Bỏ qua các request không phải GET hoặc request API
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('firestore') || 
        event.request.url.includes('googleapis') || 
        event.request.url.includes('cloudinary') ||
        event.request.url.includes('youtube')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Ưu tiên Cache, nếu không có thì tải từ mạng
            return cachedResponse || fetch(event.request).catch(() => {
                // Nếu cả mạng và cache đều lỗi, và đang gọi file HTML, trả về index.html từ cache
                if (event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
