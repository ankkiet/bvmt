const CACHE_NAME = 'nvc-green-v46-pro'; // Tăng version khi sửa code
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    'https://placehold.co/512x512/2e7d32/ffffff.png?text=NVC+Green',
    'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Quicksand:wght@500;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. INSTALL: Caching tài nguyên tĩnh ngay lập tức
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Kích hoạt SW mới ngay lập tức
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching core assets...');
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// 2. ACTIVATE: Dọn dẹp cache cũ
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Removing old cache:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim(); // Kiểm soát các clients ngay lập tức
});

// 3. FETCH: Chiến lược hỗn hợp (Hybrid Strategy)
self.addEventListener('fetch', (event) => {
    // Chỉ xử lý GET request
    if (event.request.method !== 'GET') return;

    const url = event.request.url;

    // A. Bỏ qua các API động (Firestore, Cloudinary, YouTube, Gemini...)
    // Để tránh cache dữ liệu realtime hoặc video lớn
    if (url.includes('firestore.googleapis.com') || 
        url.includes('cloudinary.com') ||
        url.includes('youtube.com') ||
        url.includes('generativelanguage.googleapis.com')) {
        return; 
    }

    // B. Chiến lược cho file HTML chính (Navigation): NETWORK FIRST
    // Ưu tiên lấy từ mạng để update code mới nhất. Nếu mất mạng -> dùng Cache.
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
                    // Nếu mất mạng, trả về trang offline (index.html đã cache)
                    return caches.match('./index.html');
                })
        );
        return;
    }

    // C. Chiến lược cho tài nguyên tĩnh (Fonts, CSS, Images): CACHE FIRST
    // Ưu tiên tốc độ.
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).then((networkResponse) => {
                // Tùy chọn: Cache thêm các tài nguyên mới phát sinh nếu cần
                return networkResponse; 
            });
        })
    );
});
