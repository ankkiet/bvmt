const CACHE_NAME = 'nvc-green-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Quicksand:wght@500;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. Cài đặt (Install) - Lưu các file tĩnh
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Kích hoạt (Activate) - Xóa cache cũ nếu có update
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
});

// 3. Fetch - Trả về dữ liệu từ Cache hoặc Tải mới
self.addEventListener('fetch', (event) => {
    // Chỉ cache các request GET thông thường (bỏ qua API Firebase/Google)
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('firestore') || event.request.url.includes('googleapis') || event.request.url.includes('cloudinary')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});
