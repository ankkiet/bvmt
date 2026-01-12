const CACHE_NAME = 'nvc-green-v54-email-fix'; 
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    'https://placehold.co/192x192/2e7d32/ffffff.png?text=NVC+192',
    'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Quicksand:wght@500;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js'
];

// 1. INSTALL: Cài đặt SW và Cache file tĩnh
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// 2. ACTIVATE: Xóa cache cũ khi có phiên bản mới
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

// 3. FETCH: Chiến lược Network First cho HTML (để luôn thấy web mới nhất)
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = event.request.url;

    // Bỏ qua các API động (Firestore, Cloudinary, YouTube, Gemini...)
    if (url.includes('firestore') || 
        url.includes('cloudinary') ||
        url.includes('youtube') ||
        url.includes('generativelanguage') || 
        url.includes('script.google.com')) {
        return; 
    }

    // Với file HTML chính (điều hướng): Ưu tiên mạng -> Nếu lỗi thì dùng Cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // Mất mạng thì trả về trang offline
                    return caches.match('./index.html');
                })
        );
        return;
    }

    // Với ảnh, font, css: Ưu tiên Cache -> Nếu không có thì tải mạng
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});
