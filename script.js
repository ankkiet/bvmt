// IMPORT TỪ CÁC MODULES
import { auth, db, provider, messaging, getToken, onMessage, onAuthStateChanged, collection, addDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, where, increment, limit, writeBatch } from './modules/firebase.js';
import { CLOUD_NAME, UPLOAD_PRESET, ADMIN_EMAILS, BOT_IMAGES, AI_MODELS, PERSONAS } from './modules/constants.js';
import { Utils, fileToBase64, optimizeUrl, getYoutubeID, speakText, listenOnce } from './modules/utils.js';
import { callGeminiAPI, typeWriterEffect, connectToGemini, startRecording, stopRecording } from './modules/ai.js';
import { toggleLiveChat } from './modules/live.js';
import { exportExcel, exportPDF, generateSitemap } from './modules/admin_utils.js';
import { isAdmin, setDynamicAdminEmails, handleLogout, checkAdminLogin, syncToGoogleSheet, checkUniqueID, requestDeleteAccount, restoreAccount } from './modules/auth.js';
import { renderGrid, loadMore, showUserPosts, closeUserPosts, setPinnedSettings, openLightbox, closeLightbox, toggleDetails, quickReply, pinPost, unpinPost, deletePostFromLB, editPostFromLB, handleLike, deleteComment, setGalleryUser, currentImgId, currentImgCollection } from './modules/gallery.js';

// --- KHAI BÁO BIẾN TOÀN CỤC & CẤU HÌNH ---
let currentUser=null, currentCollection='gallery', activeArchiveTab='gallery', musicId='jfKfPfyJRdk';
let adminUsersCache = []; // Cache danh sách thành viên cho Admin
let adminPage = 1;
const adminItemsPerPage = 10;
let adminSortField = 'displayName';
let adminSortOrder = 'asc';
let isSidebarLoaded = false; // Cờ kiểm tra sidebar đã load chưa

// --- CẤU HÌNH AI & CHATBOT (GEMINI) ---
let aiKeys = [{name: "Mặc định", val: "AIzaSyAnOwbqmpQcOu_ERINF4nSfEL4ZW95fiGc"}]; 

// --- CHAT HISTORY (MEMORY) ---
let chatHistory = [];
let currentPersona = 'green_bot';
let currentAIImageBase64 = null;
let guestChatCount = 0; // Biến đếm lượt chat của khách

// Hàm lấy ngữ cảnh nội dung trên màn hình hiện tại (Context-Awareness)
const getCurrentPageContext = () => {
    const activeSection = document.querySelector('.page-section.active');
    if (!activeSection) return "";
    
    const id = activeSection.id;
    let content = `\n--- THÔNG TIN TRÊN MÀN HÌNH (${id.toUpperCase()}) ---\n`;
    
    try {
        if (id === 'home') {
            const pinned = document.getElementById('pin-title')?.innerText;
            const featured = document.getElementById('feat-title')?.innerText;
            const tip = document.getElementById('daily-tip')?.innerText;
            if(pinned) content += `- Tin ghim: ${pinned}\n`;
            if(featured) content += `- Top 1: ${featured}\n`;
            if(tip) content += `- Thông điệp: ${tip}\n`;
        } 
        else if (id === 'greenclass' || id === 'contest') {
            const timer = document.getElementById(`timer-${id}`)?.innerText;
            if(timer) content += `- Thời gian còn lại: ${timer}\n`;
            const rankRows = document.querySelectorAll(`#rank-${id}-user tr`);
            if(rankRows.length > 0) {
                content += "- Top xếp hạng: ";
                Array.from(rankRows).slice(0, 3).forEach(r => content += r.innerText.replace(/\n/g, ' ') + "; ");
                content += "\n";
            }
        }
        else if (id === 'activities') {
            const cards = activeSection.querySelectorAll('.card h2');
            content += "- Các hoạt động: " + Array.from(cards).map(c => c.innerText).join(", ") + "\n";
        }
    } catch(e) { }
    return content;
};

// Hàm tạo câu lệnh nhắc (System Prompt) cho AI dựa trên ngữ cảnh người dùng
const getSystemPrompt = () => {
    let p = PERSONAS[currentPersona].prompt;
    const now = new Date();
    const timeString = now.toLocaleString('vi-VN');

    // Nâng cấp: Thêm thời gian, quy tắc giao tiếp và khả năng đặc biệt điều khiển web
    p += `\n\n--- THÔNG TIN HỆ THỐNG & MÔI TRƯỜNG ---\n- Thời gian hiện tại: ${timeString}\n`;
    
    p += `\n--- NGUYÊN TẮC GIAO TIẾP & KHẢ NĂNG ĐẶC BIỆT ---\n
    1.  **Giao tiếp chân thật**: Hãy trả lời tự nhiên, gần gũi, tránh dùng từ ngữ quá máy móc. Sử dụng biểu tượng cảm xúc (emoji) hợp lý. Nếu không biết, hãy thẳng thắn thừa nhận.
    2.  **Tạo bảng (Table Generation)**: Nếu được yêu cầu lập lịch trình, danh sách, hãy trả lời bằng thẻ HTML <table> gọn gàng (có <thead>, <th>, <tr>, <td>).
    3.  **Điều khiển Website (Hành động)**: Bạn CÓ THỂ trực tiếp thực hiện một số thao tác trên web giúp người dùng bằng cách CHÈN một thẻ đặc biệt vào CUỐI câu trả lời của mình. Các thẻ hợp lệ:
        - "[ACTION:music]": Bật hoặc Tắt nhạc nền.
        - "[ACTION:dark_mode]": Bật hoặc Tắt giao diện tối (Dark Mode).
        - "[ACTION:navigate_home]": Mở Trang Chủ.
        - "[ACTION:navigate_greenclass]": Mở trang Góc Xanh.
        - "[ACTION:navigate_contest]": Mở trang Thi Đua.
        - "[ACTION:navigate_activities]": Mở trang Hoạt Động.
        - "[ACTION:navigate_guide]": Mở trang Tra Cứu (Soi Rác).
        - "[ACTION:navigate_archive]": Mở trang Lưu Trữ.
        - "[ACTION:navigate_profile]": Mở trang Hồ Sơ.
        *(Ví dụ 1: Nếu nhờ bật nhạc: "Okie, tớ bật nhạc nhé! 🎶 [ACTION:music]")*
        *(Ví dụ 2: Nếu nhờ mở Góc Xanh: "Tớ đưa cậu qua trang Góc Xanh nhé! 🌱 [ACTION:navigate_greenclass]")*`;

    if(currentUser) {
        const role = (typeof isAdmin === 'function' && isAdmin(currentUser.email)) ? "Quản trị viên (Admin)" : "Thành viên";
        p += `\n\n--- THÔNG TIN NGƯỜI DÙNG HIỆN TẠI ---\n- Tên: ${currentUser.displayName}\n- Email: ${currentUser.email}\n- ID: ${currentUser.customID}\n- Lớp: ${currentUser.class}\n- Vai trò: ${role}\n\n--- CHỈ DẪN GIAO TIẾP ---\n1. Hãy xưng hô bằng tên "${currentUser.displayName}" để thân thiện.\n2. Nếu họ hỏi về lớp, hãy nhắc đến lớp "${currentUser.class}".\n3. Ghi nhớ thông tin này trong suốt cuộc trò chuyện.`;
    } else {
        p += `\n\n--- TRẠNG THÁI NGƯỜI DÙNG ---\nNgười dùng chưa đăng nhập (Khách). Hãy khuyến khích họ đăng nhập để lưu dữ liệu.`;
    }
    p += getCurrentPageContext(); // Thêm ngữ cảnh màn hình vào Prompt
    return p;
};

window.refreshChatContext = () => {
    const greeting = currentPersona === 'green_bot' 
        ? "Okie, tớ đã cập nhật thông tin người dùng! Sẵn sàng hỗ trợ! 🌱"
        : "Đã cập nhật thông tin. Tôi sẵn sàng hỗ trợ việc học tập của em.";
    chatHistory = [{ role: "user", parts: [{ text: getSystemPrompt() }] }, { role: "model", parts: [{ text: greeting }] }];
};
window.refreshChatContext();

// --- SYNC USER DATA HELPER ---
// Hàm đồng bộ thông tin user sang các bài viết cũ (Gallery, Contest)
async function syncUserToPosts(uid, data) {
    Utils.loader(true, "Đang đồng bộ dữ liệu toàn hệ thống...");
    const cols = ['gallery', 'contest'];
    const updates = [];
    for (const col of cols) {
        // Tìm tất cả bài viết của user này
        const q = query(collection(db, col), where('uid', '==', uid));
        const snap = await getDocs(q);
        snap.forEach(d => {
            updates.push(updateDoc(doc(db, col, d.id), data));
        });
    }
    await Promise.all(updates);
    Utils.loader(false);
}

// --- VOICE RECOGNITION (SPEECH-TO-TEXT) ---
// Xử lý nhận diện giọng nói để nhập liệu vào ô chat
let recognition;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN'; // Thiết lập tiếng Việt
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        document.getElementById('btn-mic').classList.add('listening');
        document.getElementById('ai-input').placeholder = "Đang nghe bạn nói...";
    };

    recognition.onend = () => {
        document.getElementById('btn-mic').classList.remove('listening');
        document.getElementById('ai-input').placeholder = "Hỏi Green Bot bất cứ điều gì...";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('ai-input').value = transcript;
        window.sendMessageToAI(new Event('submit'), true); // Tự động gửi sau khi nói xong (Voice Mode)
    };
}

window.toggleVoiceInput = () => {
    if (!recognition) return alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói (Hãy thử Chrome/Edge).");
    if (document.getElementById('btn-mic').classList.contains('listening')) recognition.stop();
    else recognition.start();
}

// Xử lý xem trước ảnh khi người dùng chọn ảnh để gửi cho AI
window.previewAIImage = async (input) => {
    const file = input.files[0];
    if(!file) return;

    const previewContainer = document.getElementById('ai-image-preview');
    const previewImg = document.getElementById('ai-preview-img');
    
    // Hiển thị ảnh tạm thời trong khi nén
    if(previewImg) previewImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="; // 1x1 transparent gif
    if(previewContainer) previewContainer.style.display = 'block';

    try {
        // Nén ảnh trước khi hiển thị và lưu
        const compressedBase64 = await fileToBase64(file, 800, 0.7);
        currentAIImageBase64 = compressedBase64;
        if(previewImg) previewImg.src = `data:image/jpeg;base64,${compressedBase64}`;
    } catch (error) {
        console.error("Lỗi nén ảnh:", error);
        alert("Không thể xử lý ảnh này. Vui lòng thử ảnh khác.");
        clearAIImage();
    }
}

window.clearAIImage = () => {
    currentAIImageBase64 = null;
    document.getElementById('ai-image-input').value = "";
    document.getElementById('ai-image-preview').style.display = 'none';
}

// Gán sự kiện cho nút Live Chat mới
const btnLive = document.getElementById('btn-live-chat');
if (btnLive) {
    btnLive.addEventListener('click', () => toggleLiveChat('btn-live-chat', aiKeys));
}

// Chuyển đổi nhân vật AI (Green Bot <-> Giáo Sư)
window.switchPersona = (key) => {
    if (!PERSONAS[key]) return;
    currentPersona = key;
    const p = PERSONAS[key];
    
    // Update UI Header
    const nameEl = document.getElementById('ai-name-display');
    const avtEl = document.getElementById('ai-avatar-display');
    if(nameEl) nameEl.innerText = p.name;
    if(avtEl) avtEl.src = p.avatar;

    // Reset Chat UI
    const msgList = document.getElementById('ai-messages');
    if(msgList) {
        msgList.innerHTML = `<div class="chat-row bot">
            <div class="chat-avatar"><img src="${p.avatar}"></div>
            <div class="chat-content">
                <div class="chat-bubble bot">Xin chào! ${currentPersona === 'green_bot' ? 'Tớ' : 'Tôi'} là <b>${p.name}</b> - ${p.desc}<br>${currentPersona === 'green_bot' ? 'Cậu cần giúp gì không? 😎' : 'Em cần hỗ trợ vấn đề gì hôm nay?'}</div>
            </div>
        </div>`;
    }
    
    refreshChatContext();
}

let googleSheetUrl = "https://script.google.com/macros/s/AKfycbzilw2SHG74sfCGNktGLuo46xkLNzVSVl6T3HbjXoWAsm9_CmXmuZQmbDxIOJ5cRhyX/exec"; 
const State = { unsubscribes: {} };

// --- DARK MODE LOGIC (NEW) ---
// Chuyển đổi giao diện Sáng / Tối
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    const icon = document.getElementById('dark-icon');
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Khởi chạy các chức năng khi trang web tải xong
window.addEventListener('load', () => {
    // Check Theme
    if (localStorage.getItem('theme') === 'dark') {
        window.toggleDarkMode();
    }
    
    // Check WebView
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if ((ua.indexOf('Instagram') > -1) || (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("Zalo") > -1)) {
        document.getElementById('webview-warning').style.display = 'flex';
    }
    
    // Init Router
    handleRoute();
    updateGreeting(); // Gọi hàm chào khi web tải xong
    initSeasonalEffect(); // Khởi chạy hiệu ứng mùa

    // Tắt Splash Screen sau khi tải xong
    const splash = document.getElementById('splash-screen');
    if(splash) {
        // Đợi ít nhất 1.5 giây để người dùng kịp nhìn thấy logo thương hiệu
        setTimeout(() => {
            splash.classList.add('hidden');
            setTimeout(() => splash.remove(), 600); // Xóa khỏi DOM sau khi hiệu ứng mờ kết thúc
        }, 1500);
    }

    // Kiểm tra hiển thị Popup hướng dẫn lần đầu
    if (!localStorage.getItem('seen_guide_v1')) {
        setTimeout(() => {
            const guide = document.getElementById('guide-popup');
            if(guide) guide.style.display = 'flex';
        }, 1500);
    }
});

// --- PULL TO REFRESH LOGIC ---
// Tính năng kéo trang xuống để làm mới (trên Mobile)
let startY = 0;
const ptrElement = document.getElementById('ptr-loader');
const ptrIcon = ptrElement.querySelector('.ptr-icon');

window.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
    }
}, {passive: true});

window.addEventListener('touchmove', (e) => {
    const y = e.touches[0].clientY;
    const diff = y - startY;
    if (window.scrollY === 0 && diff > 0) {
        if (diff < 250) { 
            // Ngăn chặn hành vi cuộn mặc định của trình duyệt (quan trọng cho PWA mượt mà)
            if (e.cancelable) e.preventDefault();
            ptrElement.style.top = (diff / 2.5 - 70) + 'px'; 
            ptrIcon.style.transform = `rotate(${diff * 2}deg)`;
        }
    }
}, {passive: false});

window.addEventListener('touchend', (e) => {
    const top = parseInt(ptrElement.style.top || '-70');
    if (top > 10) { 
        ptrElement.style.top = '10px';
        ptrIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
        setTimeout(() => { location.reload(); }, 800);
    } else {
        ptrElement.style.top = '-70px'; 
    }
});

// --- NOTIFICATION SYSTEM ---
// Hệ thống thông báo toàn cục (Global Admin Notification)
function listenForNotifications() {
    onSnapshot(doc(db, "settings", "notifications"), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            const lastMsg = localStorage.getItem('last_notif_id');
            if (data.id && data.id !== lastMsg && data.text) {
                showNotification(data.text);
                localStorage.setItem('last_notif_id', data.id);
            }
        }
    });
}

window.showNotification = (text) => {
    const popup = document.getElementById('notification-popup');
    const content = document.getElementById('notif-text');
    if(popup && content) {
        content.innerHTML = text; // Cho phép hiển thị HTML (in đậm tên)
        popup.classList.add('show');
        setTimeout(() => { popup.classList.remove('show'); }, 8000);
    }
}

window.closeNotification = () => {
    const popup = document.getElementById('notification-popup');
    if(popup) popup.classList.remove('show');
}

window.sendAdminNotification = async () => {
    const text = document.getElementById('admin-notif-msg').value;
    if(!text) return;
    await setDoc(doc(db, "settings", "notifications"), { text: text, id: Date.now().toString(), createdAt: serverTimestamp() });
    alert("Đã gửi thông báo!");
    document.getElementById('admin-notif-msg').value = "";
}

// --- ADMIN SEND PUSH NOTIFICATION (FCM) ---
window.sendPushToAll = async () => {
    if(!currentUser || !isAdmin(currentUser.email)) return alert("Bạn không có quyền Admin!");
    
    // Với v1, ta dùng URL của Google Apps Script thay vì Server Key
    // Bạn hãy dán link Web App (Apps Script) vào ô Server Key trên giao diện Admin nhé!
    const gasUrl = document.getElementById('push-server-key').value.trim(); 
    const title = document.getElementById('push-title').value.trim();
    const body = document.getElementById('push-body').value.trim();
    const url = document.getElementById('push-url').value.trim();
    const scheduleTime = document.getElementById('push-schedule-time').value;

    // Tự động lưu Server Key vào LocalStorage để lần sau không phải nhập lại
    if(gasUrl) {
        localStorage.setItem('fcm_server_key', gasUrl);
        setDoc(doc(db, "settings", "config"), { fcmServerKey: gasUrl }, { merge: true }).catch(e => console.log("Lỗi lưu URL:", e));
    }

    if(!gasUrl) return alert("Thiếu URL Server! Hãy nhập Link Google Apps Script Web App vào ô Server Key.");
    if(!title || !body) return alert("Vui lòng nhập tiêu đề và nội dung!");

    // LOGIC HẸN GIỜ
    if (scheduleTime) {
        const sendTime = new Date(scheduleTime).getTime();
        if (sendTime <= Date.now()) return alert("Thời gian hẹn phải lớn hơn hiện tại!");
        
        await addDoc(collection(db, "scheduled_notifications"), {
            title, body, url, gasUrl,
            scheduledAt: sendTime,
            status: 'pending',
            createdAt: serverTimestamp(),
            createdBy: currentUser.email
        });
        alert(`✅ Đã lên lịch gửi vào lúc ${new Date(scheduleTime).toLocaleString('vi-VN')}`);
        document.getElementById('push-body').value = "";
        loadPushHistory();
        return;
    }

    if(!confirm("Gửi NGAY LẬP TỨC đến tất cả người dùng?")) return;

    Utils.loader(true, "Đang lấy danh sách thiết bị...");
    
    try {
        // 1. Lấy tất cả user có fcmToken
        const q = query(collection(db, "users"));
        const snap = await getDocs(q);
        const tokens = [];
        snap.forEach(d => {
            const data = d.data();
            if(data.fcmToken) tokens.push(data.fcmToken);
        });

        if(tokens.length === 0) {
            Utils.loader(false);
            return alert("Chưa có người dùng nào đăng ký nhận thông báo!");
        }

        Utils.loader(true, `Đang gửi đến ${tokens.length} thiết bị...`);

        // 2. Gửi request đến Google Apps Script (Server trung gian)
        // Server này sẽ lo việc xác thực OAuth2 và gọi FCM v1
        const response = await fetch(gasUrl, {
            method: 'POST',
            mode: 'no-cors', // Quan trọng: Apps Script yêu cầu no-cors hoặc redirect handling
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tokens: tokens,
                title: title,
                body: body,
                url: url ? (window.location.origin + "/" + url) : window.location.origin,
                image: 'https://placehold.co/192x192/2e7d32/ffffff.png?text=NVC+Green'
            })
        });
        
        // Lưu ý: mode 'no-cors' sẽ không trả về nội dung response chi tiết, 
        // nhưng nó cần thiết để tránh lỗi CORS khi gọi Apps Script từ trình duyệt.

        // 3. Lưu vào Lịch sử (Notification History)
        await addDoc(collection(db, "notification_history"), {
            title, body, url,
            sentAt: serverTimestamp(),
            createdAt: serverTimestamp(), // Dùng field này để sort
            sentBy: currentUser.email,
            deviceCount: tokens.length
        });

        Utils.loader(false);
        alert(`✅ Đã gửi thành công cho ${tokens.length} thiết bị!`);
        document.getElementById('push-body').value = "";
        loadPushHistory(); // Refresh list
    } catch (e) {
        console.error(e);
        Utils.loader(false);
        alert("Lỗi khi gửi: " + e.message);
    }
}

// --- ADMIN: PUSH HISTORY & SCHEDULER ---
window.loadPushHistory = async () => {
    const list = document.getElementById('push-history-list');
    if(!list) return;
    list.innerHTML = "Loading...";

    // Lấy danh sách đang chờ
    const qPending = query(collection(db, "scheduled_notifications"), where("status", "==", "pending"), orderBy("scheduledAt", "asc"));
    const snapPending = await getDocs(qPending);

    // Lấy lịch sử đã gửi
    const qHistory = query(collection(db, "notification_history"), orderBy("createdAt", "desc"), limit(10));
    const snapHistory = await getDocs(qHistory);

    let html = "";

    // Render Pending
    if(!snapPending.empty) {
        html += `<div style="font-weight:bold; color:#ff9800; margin-bottom:5px;">⏳ Đang chờ gửi:</div>`;
        snapPending.forEach(d => {
            const data = d.data();
            const time = new Date(data.scheduledAt).toLocaleString('vi-VN');
            html += `<div style="padding:5px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
                <div><b>${time}</b>: ${data.title}</div>
                <button class="btn btn-sm btn-danger" onclick="deleteDoc(doc(db,'scheduled_notifications','${d.id}')).then(loadPushHistory)">Hủy</button>
            </div>`;
        });
    }

    // Render History
    html += `<div style="font-weight:bold; color:#2e7d32; margin:10px 0 5px 0;">📜 Đã gửi gần đây:</div>`;
    snapHistory.forEach(d => {
        const data = d.data();
        const time = data.createdAt ? new Date(data.createdAt.seconds*1000).toLocaleString('vi-VN') : 'N/A';
        html += `<div style="padding:5px; border-bottom:1px solid #eee;">
            <div style="font-weight:bold">${data.title} <span style="font-weight:normal; font-size:0.8em; color:#666">(${time})</span></div>
            <div style="font-size:0.9em">${data.body}</div>
            <button class="btn btn-sm btn-outline" style="margin-top:2px; padding:2px 5px; font-size:0.7rem;" onclick="resendPush('${data.title}', '${data.body}', '${data.url}')">🔄 Điền lại để gửi</button>
        </div>`;
    });

    list.innerHTML = html || "Chưa có dữ liệu.";
}

window.resendPush = (t, b, u) => {
    document.getElementById('push-title').value = t;
    document.getElementById('push-body').value = b;
    document.getElementById('push-url').value = u;
    document.getElementById('push-schedule-time').value = ""; // Reset giờ
}

// --- AUTO SCHEDULER CHECKER (CLIENT-SIDE CRON) ---
// Hàm này sẽ chạy mỗi 60s nếu người dùng là Admin
setInterval(async () => {
    if (!currentUser || !isAdmin(currentUser.email)) return;
    
    // Kiểm tra các task đến hạn
    const now = Date.now();
    const q = query(collection(db, "scheduled_notifications"), where("status", "==", "pending"), where("scheduledAt", "<=", now));
    const snap = await getDocs(q);

    if (!snap.empty) {
        console.log(`Found ${snap.size} scheduled tasks to run...`);
        snap.forEach(async (d) => {
            const data = d.data();
            // Đánh dấu là đang xử lý để tránh Admin khác chạy trùng (Optimistic locking đơn giản)
            await updateDoc(doc(db, "scheduled_notifications", d.id), { status: 'processing' });

            try {
                // Tái sử dụng logic gửi (Copy logic từ sendPushToAll nhưng không alert)
                // 1. Lấy tokens
                const qUsers = query(collection(db, "users"));
                const snapUsers = await getDocs(qUsers);
                const tokens = [];
                snapUsers.forEach(u => { if(u.data().fcmToken) tokens.push(u.data().fcmToken); });

                if(tokens.length > 0) {
                    // 2. Gửi qua GAS
                    await fetch(data.gasUrl, {
                        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tokens: tokens, title: data.title, body: data.body,
                            url: data.url ? (window.location.origin + "/" + data.url) : window.location.origin,
                            image: 'https://placehold.co/192x192/2e7d32/ffffff.png?text=NVC+Green'
                        })
                    });

                    // 3. Lưu lịch sử
                    await addDoc(collection(db, "notification_history"), {
                        title: data.title, body: data.body, url: data.url,
                        sentAt: serverTimestamp(), createdAt: serverTimestamp(),
                        sentBy: 'Scheduler', deviceCount: tokens.length
                    });
                }

                // 4. Xóa hoặc đánh dấu hoàn thành task
                await updateDoc(doc(db, "scheduled_notifications", d.id), { status: 'completed', completedAt: serverTimestamp() });
                console.log(`Task ${d.id} completed.`);
                
                // Refresh UI nếu đang mở Admin
                if(document.getElementById('push-history-list')) loadPushHistory();

            } catch (e) {
                console.error("Scheduler Error:", e);
                await updateDoc(doc(db, "scheduled_notifications", d.id), { status: 'failed', error: e.message });
            }
        });
    }
}, 60000); // Check mỗi 1 phút

// --- PERSONAL NOTIFICATIONS ---
// Hệ thống thông báo cá nhân (Like, Comment, Reply)
let notifUnsub = null;
let globalNotifUnsub = null;

function listenToMyNotifications(uid) {
    if (notifUnsub) notifUnsub(); 
    if (globalNotifUnsub) globalNotifUnsub();

    // 1. Lắng nghe thông báo cá nhân
    const qPersonal = query(collection(db, "notifications"), where("recipientUid", "==", uid), limit(30));
    // 2. Lắng nghe thông báo chung (Global Push) từ lịch sử
    const qGlobal = query(collection(db, "notification_history"), orderBy("createdAt", "desc"), limit(20));
    
    let personalNotifs = [];
    let globalNotifs = [];

    const mergeAndRender = () => {
        const list = document.getElementById('notif-list-ui');
        const dot = document.getElementById('nav-bell-dot');
        let html = ""; 
        
        // Lấy danh sách ID thông báo chung đã bị người dùng xóa (Lưu ở LocalStorage)
        const deletedGlobals = JSON.parse(localStorage.getItem('deleted_global_notifs') || '[]');

        // Lọc thông báo chung: Bỏ những cái đã xóa
        const activeGlobals = globalNotifs.filter(n => !deletedGlobals.includes(n.id));

        // Gộp 2 danh sách lại
        let allNotifs = [...personalNotifs, ...activeGlobals];
        
        // Sắp xếp theo thời gian mới nhất
        allNotifs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        let unreadCount = 0;
        
        if (allNotifs.length === 0) {
            list.innerHTML = '<div class="empty-notif">Chưa có thông báo nào</div>';
            dot.style.display = 'none'; return;
        }

        allNotifs.forEach(data => {
            // Kiểm tra đã đọc chưa (Với Global thì check localStorage, với Personal thì check field isRead)
            let isRead = data.isRead;
            if (data.type === 'global_push') {
                const readGlobals = JSON.parse(localStorage.getItem('read_global_notifs') || '[]');
                isRead = readGlobals.includes(data.id);
            }

            if (!data.isRead) unreadCount++;
            
            // Phân biệt icon xóa
            // isGlobal: true nếu là thông báo chung
            const isGlobal = data.type === 'global_push';

            html += `<div class="notif-item ${isRead ? '' : 'unread'}">
                        <div class="notif-content-wrapper" onclick="clickNotification('${data.id}', '${data.collectionRef}', '${data.link}', ${isGlobal})">
                            <img src="${data.senderAvatar || 'https://via.placeholder.com/30'}" class="notif-avatar">
                            <div class="notif-body">
                                <p>${data.message}</p>
                                <span class="notif-time">${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString('vi-VN') : 'Vừa xong'}</span>
                            </div>
                        </div>
                        <button class="notif-delete-btn" onclick="deleteNotification('${data.id}', ${isGlobal})" title="Xóa">✕</button>
                    </div>`;
        });
        list.innerHTML = html;
        // Logic chấm đỏ: Chỉ tính personal chưa đọc (Global coi như đọc rồi để đỡ phiền, hoặc tùy chỉnh)
        const personalUnread = personalNotifs.filter(n => !n.isRead).length;
        dot.style.display = personalUnread > 0 ? 'block' : 'none';
    };

    // Listener 1: Personal
    notifUnsub = onSnapshot(qPersonal, (snap) => {
        personalNotifs = [];
        snap.forEach(d => personalNotifs.push({ id: d.id, ...d.data() }));
        
        // Toast cho tin nhắn mới
        snap.docChanges().forEach(change => {
            if (change.type === "added") {
                const d = change.doc.data();
                if (Date.now() - (d.createdAt?.seconds * 1000 || 0) < 60000) {
                    showNotification(d.message);
                    if(navigator.vibrate) navigator.vibrate([50, 30, 50]);
                }
            }
        });
        mergeAndRender();
    });

    // Listener 2: Global History (Push)
    globalNotifUnsub = onSnapshot(qGlobal, (snap) => {
        globalNotifs = [];
        snap.forEach(d => {
            const data = d.data();
            // Giả lập cấu trúc giống notification cá nhân
            globalNotifs.push({
                id: d.id,
                recipientUid: 'ALL',
                senderName: 'Hệ thống',
                senderAvatar: 'https://cdn-icons-png.flaticon.com/512/3239/3239952.png',
                type: 'global_push',
                message: `<b>${data.title}</b>: ${data.body}`,
                link: data.url,
                collectionRef: null, // Link thường là URL ngoài hoặc hash
                createdAt: data.createdAt,
                isRead: false // Trạng thái đọc xử lý ở client
            });
        });
        mergeAndRender();
    });
}

async function pushNotification(recipientId, type, message, linkId, colRef) {
    if (!currentUser || recipientId === currentUser.uid) return; 
    try {
        await addDoc(collection(db, "notifications"), { recipientUid: recipientId, senderName: currentUser.displayName, senderAvatar: currentUser.photoURL, type: type, message: message, link: linkId, collectionRef: colRef, isRead: false, createdAt: serverTimestamp() });
    } catch (e) { console.error("Lỗi gửi thông báo:", e); }
}

window.clickNotification = async (notifId, col, postId, isGlobal) => {
    if (isGlobal) {
        // Lưu trạng thái đã đọc vào LocalStorage
        const readGlobals = JSON.parse(localStorage.getItem('read_global_notifs') || '[]');
        if (!readGlobals.includes(notifId)) {
            readGlobals.push(notifId);
            localStorage.setItem('read_global_notifs', JSON.stringify(readGlobals));
        }
        // Mở link (nếu có)
        if (postId && postId.startsWith('http')) window.open(postId, '_blank');
        else if (postId && postId.startsWith('#')) window.location.hash = postId;
    } else {
        // Update Firestore
        await updateDoc(doc(db, "notifications", notifId), { isRead: true });
        if(col && postId && col !== 'undefined') window.openLightbox(col, postId);
    }
    document.getElementById('notif-dropdown').classList.remove('active');
}

window.toggleNotifDropdown = () => { document.getElementById('notif-dropdown').classList.toggle('active'); }

// Hàm xóa thông báo
window.deleteNotification = async (id, isGlobal) => {
    if(!isGlobal) {
        await deleteDoc(doc(db, "notifications", id));
    } else {
        const deleted = JSON.parse(localStorage.getItem('deleted_global_notifs') || '[]');
        deleted.push(id);
        localStorage.setItem('deleted_global_notifs', JSON.stringify(deleted));
        // Refresh UI
        const u = currentUser ? currentUser.uid : null;
        if(u) listenToMyNotifications(u);
    }
}

// Hàm đánh dấu đã đọc tất cả (Cập nhật lên Server)
window.markAllRead = async () => {
    if(!currentUser) return;
    const q = query(collection(db, "notifications"), where("recipientUid", "==", currentUser.uid), where("isRead", "==", false));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach(d => {
        batch.update(doc(db, "notifications", d.id), { isRead: true });
    });
    await batch.commit();
    document.getElementById('nav-bell-dot').style.display='none';
}

// --- PUSH NOTIFICATIONS (FCM) ---
async function setupPushNotifications(user) {
    try {
        // 1. Xin quyền thông báo
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // 2. Lấy Token thiết bị (Thay VAPID Key của bạn vào đây)
            // Lấy Key tại: Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates
            const VAPID_KEY = "BMWUXySgKnXX-HhnIqtt2p3oMCaOAgw6nMhizr0tEgrg3m_F0pGtUo1X9kdFRfNHlu9EbkBEer8BBMWsGx7b9ik"; 
            
            const currentToken = await getToken(messaging, { 
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: await navigator.serviceWorker.ready 
            });

            if (currentToken) {
                console.log("FCM Token:", currentToken);
                // 3. Lưu Token vào Firestore của user để Admin gửi thông báo sau này
                await updateDoc(doc(db, "users", user.uid), {
                    fcmToken: currentToken
                });
            }
        }
    } catch (error) {
        console.log("Lỗi Push Notification:", error);
    }

    // 4. Lắng nghe tin nhắn khi web đang mở (Foreground)
    onMessage(messaging, (payload) => {
        console.log('Message received. ', payload);
        showNotification(`🔔 ${payload.notification.title}: ${payload.notification.body}`);
    });
}

// --- GREETING LOGIC ---
// Hiển thị lời chào theo thời gian trong ngày
window.updateGreeting = () => {
    const h = new Date().getHours();
    let g = "Xin chào";
    if (h >= 5 && h < 11) g = "Chào buổi sáng ☀️";
    else if (h >= 11 && h < 14) g = "Chào buổi trưa 🍚";
    else if (h >= 14 && h < 18) g = "Chào buổi chiều 🌇";
    else g = "Chào buổi tối 🌙";
    
    const name = currentUser ? currentUser.displayName : "bạn mới";
    const el = document.getElementById('greeting-msg');
    if(el) el.innerText = `${g}, ${name}! Chúc bạn một ngày năng lượng! 🌿`;
}

// --- GEMINI AI ---
// Các hàm xử lý gọi API Gemini, quản lý Key và gửi tin nhắn
window.testAIConnection = async () => {
    const btn = document.querySelector('.btn-outline'); const originalText = btn.innerText; btn.innerText = "Đang test...";
    try { const result = await callGeminiAPI("Chào Green Bot!", null, false, 'main', aiKeys, chatHistory); alert("✅ Kết nối AI thành công!\nTrả lời: " + result); } catch(e) { alert("❌ Lỗi: " + e.message); }
    btn.innerText = originalText;
}

window.addAIKey = async () => {
    const name = document.getElementById('new-key-name').value.trim(); const val = document.getElementById('new-key-val').value.trim();
    if(!name || !val) return alert("Nhập đủ tên và Key!");
    await updateDoc(doc(db, "settings", "config"), { aiKeys: arrayUnion({name, val}) });
    document.getElementById('new-key-name').value = ""; document.getElementById('new-key-val').value = ""; alert("Đã thêm Key mới!");
}

window.removeAIKey = async (name, val) => { if(confirm(`Xóa Key "${name}"?`)) { await updateDoc(doc(db, "settings", "config"), { aiKeys: arrayRemove({name, val}) }); } }

// Hàm ghi nhận đánh giá của người dùng để cải thiện AI
window.rateAIResponse = async (elementId, rating, promptText, responseText) => {
    const el = document.getElementById(elementId);
    if(el) {
        const btns = el.querySelector('.ai-feedback-btns');
        if(btns) btns.innerHTML = rating === 'up' ? '<span style="color:#2e7d32;font-size:0.85rem;font-weight:bold;">Cảm ơn bạn đã góp ý! ❤️</span>' : '<span style="color:#d32f2f;font-size:0.85rem;font-weight:bold;">Green Bot sẽ cố gắng hơn! 🛠️</span>';
    }
    try {
        await addDoc(collection(db, "ai_feedback"), {
            uid: currentUser ? currentUser.uid : 'guest',
            userName: currentUser ? currentUser.displayName : 'Khách',
            prompt: promptText,
            response: responseText,
            rating: rating,
            timestamp: serverTimestamp()
        });
    } catch(e) { console.error("Lỗi gửi feedback:", e); }
}

window.toggleAIChat = () => { 
    document.getElementById('ai-window').classList.toggle('active'); 
}

window.fillChat = (text) => { document.getElementById('ai-input').value = text; window.sendMessageToAI(new Event('submit')); }

// Hàm chính gửi tin nhắn đến AI và xử lý phản hồi
window.sendMessageToAI = async (e, isVoice = false) => {
    e.preventDefault(); const input = document.getElementById('ai-input'); const msg = input.value; 
    if(!msg && !currentAIImageBase64) return;
    
    // GIỚI HẠN CHAT CHO KHÁCH
    if (!currentUser) {
        if (guestChatCount >= 3) {
            alert("🔒 Bạn đã hết 3 lượt chat miễn phí!\nVui lòng Đăng nhập/Đăng ký để tiếp tục trò chuyện với Green Bot nhé! 🌱");
            showPage('profile'); // Chuyển hướng đến trang đăng nhập
            return;
        }
        guestChatCount++;
    }

    const msgList = document.getElementById('ai-messages'); 
    
    let userContent = "";
    if(currentAIImageBase64) {
        userContent += `<img src="data:image/jpeg;base64,${currentAIImageBase64}" style="max-width:200px; border-radius:10px; margin-bottom:8px; display:block;">`;
    }
    userContent += msg;

    msgList.innerHTML += `<div class="chat-row user"><div class="chat-bubble user">${userContent}</div></div>`; 
    
    const imgToSend = currentAIImageBase64;

    // Xây dựng lượt của người dùng và thêm vào lịch sử chat
    const userTurnParts = [];
    let finalPrompt = msg;

    if (imgToSend) {
        if (!msg) { // Chỉ có ảnh, không có text
            finalPrompt = (currentPersona === 'teacher_bot')
                ? "Hãy phân tích và giải bài tập trong ảnh này một cách chi tiết."
                : "Hãy mô tả hoặc phân tích nội dung trong bức ảnh này.";
        }
    } else { // Chỉ có text, không có ảnh
        const currentPage = window.location.hash.slice(1) || 'home';
        finalPrompt = `[Ngữ cảnh: Đang xem trang '${currentPage}'] ${msg}`;
    }

    if (finalPrompt) userTurnParts.push({ text: finalPrompt });
    if (imgToSend) userTurnParts.push({ inline_data: { mime_type: "image/jpeg", data: imgToSend } });

    if (userTurnParts.length > 0) chatHistory.push({ role: "user", parts: userTurnParts });

    input.value = ""; 
    clearAIImage();

    msgList.scrollTop = msgList.scrollHeight;
    const loadingId = "ai-loading-" + Date.now(); 
    
    // Hiệu ứng loading mới (Avatar + Dots)
    msgList.innerHTML += `<div class="chat-row bot"><div class="chat-avatar"><img src="${PERSONAS[currentPersona].avatar}"></div><div class="chat-content"><div class="chat-bubble bot" id="${loadingId}"><div class="ai-loading-dots"><span></span><span></span><span></span></div></div></div></div>`;
    msgList.scrollTop = msgList.scrollHeight;
    
    try { 
        // Chọn model dựa trên ngữ cảnh
        let modelType = 'main';
        if (isVoice) modelType = 'voice';
        else if (currentPersona === 'teacher_bot') modelType = 'advanced';

        const rawResponse = await callGeminiAPI(null, null, true, modelType, aiKeys, chatHistory); // Gọi API ở chế độ chat (dùng history)
        // Tách phần trả lời và phần gợi ý
        const parts = rawResponse.split('---SUGGESTIONS---');
        let mainAnswer = parts[0].trim();
        const suggestions = parts[1] ? parts[1].split('|') : [];

        // AI NÂNG CẤP: Xử lý thẻ điều khiển Website [ACTION:...]
        const actionRegex = /\[ACTION:([a-zA-Z0-9_]+)\]/g;
        let match;
        while ((match = actionRegex.exec(mainAnswer)) !== null) {
            const action = match[1];
            mainAnswer = mainAnswer.replace(match[0], '').trim(); // Xóa thẻ khỏi câu trả lời hiển thị
            
            // Trì hoãn thực thi một chút để AI kịp gõ chữ ra
            setTimeout(() => {
                if (action === 'music' && window.toggleMusic) window.toggleMusic();
                else if (action === 'dark_mode' && window.toggleDarkMode) window.toggleDarkMode();
                else if (action.startsWith('navigate_')) {
                    const page = action.replace('navigate_', '');
                    if (window.showPage) { 
                        window.showPage(page); 
                        window.location.hash = page; 
                        // Tự động đóng khung chat để dễ nhìn trang mới
                        document.getElementById('ai-window').classList.remove('active'); 
                    }
                }
            }, 1000);
        }

        // Xử lý format tin nhắn (Giữ nguyên thẻ Table, Escape các thẻ khác)
        const escapeHTML = (str) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const contentParts = mainAnswer.split(/(<table[\s\S]*?<\/table>)/gi);

        const formatted = contentParts.map(part => {
            if (part.match(/^<table[\s\S]*?<\/table>$/i)) return part; // Giữ nguyên HTML bảng
            return escapeHTML(part)
                .replace(/\*\*([\s\S]*?)\*\*/g, '<b>$1</b>')
                .replace(/\*([^\s][\s\S]*?)\*/g, '<i>$1</i>')
                .replace(/(?:^|\n)[-*] (.*?)(?=\n|$)/g, '<div style="display:flex; align-items:flex-start; gap:6px; margin:4px 0;"><span style="color:var(--primary); font-weight:bold; flex-shrink:0; margin-top:2px;">•</span><span>$1</span></div>')
                .replace(/{{IMAGE:(.*?)}}/g, (match, key) => {
                    const url = BOT_IMAGES[key.trim()];
                    return url ? `<img src="${url}" style="max-width:150px; border-radius:10px; margin:10px 0; border:1px solid #eee; display:block;">` : "";
                })
                .replace(/\n/g, '<br>');
        }).join('');

        await typeWriterEffect(document.getElementById(loadingId), formatted, 15); // Tăng tốc độ cơ bản lên một chút

        // THU THẬP TRẢI NGHIỆM: Thêm nút đánh giá phản hồi AI
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'ai-feedback-btns';
        const btnUp = document.createElement('button');
        btnUp.innerHTML = '<i class="fas fa-thumbs-up"></i>';
        btnUp.onclick = () => window.rateAIResponse(loadingId, 'up', finalPrompt, mainAnswer);
        const btnDown = document.createElement('button');
        btnDown.innerHTML = '<i class="fas fa-thumbs-down"></i>';
        btnDown.onclick = () => window.rateAIResponse(loadingId, 'down', finalPrompt, mainAnswer);
        feedbackDiv.appendChild(btnUp);
        feedbackDiv.appendChild(btnDown);
        document.getElementById(loadingId).appendChild(feedbackDiv);

        // Hiển thị gợi ý nếu có
        if (suggestions.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'ai-msg-actions';
            actionsDiv.innerHTML = suggestions.map(s => `<button class="suggestion-chip" onclick="fillChat('${s.trim()}')">${s.trim()}</button>`).join('');
            msgList.appendChild(actionsDiv);
        }
    } 
    catch(err) { document.getElementById(loadingId).innerHTML = `<span style="color:red">Lỗi: ${err.message}</span>`; }
    msgList.scrollTop = msgList.scrollHeight;
}

// --- YOUTUBE ID & MUSIC ---
// Trình phát nhạc nền sử dụng YouTube IFrame API

const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api"; var firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
let player; window.onYouTubeIframeAPIReady = function() { player = new YT.Player('player', { height: '0', width: '0', videoId: musicId, events: { 'onStateChange': onPlayerStateChange } }); }
function onPlayerStateChange(event) { const icon = document.getElementById('music-icon-display'); if(event.data == YT.PlayerState.PLAYING) { icon.classList.add('playing'); icon.style.color = 'var(--primary)'; } else { icon.classList.remove('playing'); icon.style.color = 'var(--text)'; } }

window.toggleMusic = () => { 
    try { 
        if(!player || !player.getPlayerState) {
            alert("⏳ Nhạc đang tải, vui lòng đợi 2 giây rồi thử lại!");
            return;
        }
        if(player.getPlayerState() == YT.PlayerState.PLAYING) player.pauseVideo(); 
        else player.playVideo(); 
    } catch(e){ console.error(e); } 
}

window.addNewSong = async () => { const name = document.getElementById('new-song-name').value; let url = document.getElementById('new-song-url').value; if(!name || !url) return alert("Nhập đủ tên và link!"); const id = getYoutubeID(url); await updateDoc(doc(db, "settings", "config"), { playlist: arrayUnion({name, id}) }); alert("Đã thêm bài hát!"); }
window.playSong = async (id) => { await updateDoc(doc(db, "settings", "config"), { musicId: id }); alert("Đã phát bài này!"); }
window.deleteSong = async (name, id) => { if(confirm("Xóa bài này?")) await updateDoc(doc(db, "settings", "config"), { playlist: arrayRemove({name, id}) }); }

// --- GLOBAL LISTENER ---
// Lắng nghe thay đổi cấu hình từ Firebase (Realtime) để cập nhật giao diện ngay lập tức
onSnapshot(doc(db, "settings", "config"), (docSnap) => {
    if(docSnap.exists()) {
        const cfg = docSnap.data();
        if(cfg.adminEmails && Array.isArray(cfg.adminEmails)) { setDynamicAdminEmails(cfg.adminEmails); }
        if(cfg.aiKeys && cfg.aiKeys.length > 0) { aiKeys = cfg.aiKeys; const list = document.getElementById('ai-key-list'); if(list) { list.innerHTML = ""; aiKeys.forEach(k => { list.innerHTML += `<div class="key-item"><span class="key-name">${k.name}</span><span class="key-val">******</span><button class="btn btn-sm btn-danger" onclick="removeAIKey('${k.name}', '${k.val}')">X</button></div>`; }); } }
        if(cfg.aiModels) {
            // AI_MODELS là hằng số import từ constants.js, không thể gán lại trực tiếp. 
            // Nếu muốn update dynamic, cần dùng biến let localAIModels = {...AI_MODELS}
            // Ở đây tạm thời bỏ qua việc update AI_MODELS từ Firestore để code chạy ổn định
            if(document.getElementById('model-main')) document.getElementById('model-main').value = AI_MODELS.main;
            if(document.getElementById('model-voice')) document.getElementById('model-voice').value = AI_MODELS.voice;
            if(document.getElementById('model-backup')) document.getElementById('model-backup').value = AI_MODELS.backup;
            if(document.getElementById('model-advanced')) document.getElementById('model-advanced').value = AI_MODELS.advanced;
        }
        if(cfg.googleSheetUrl) { googleSheetUrl = cfg.googleSheetUrl; }
        if(cfg.fcmServerKey && document.getElementById('push-server-key')) { document.getElementById('push-server-key').value = cfg.fcmServerKey; }
        if(cfg.musicId && cfg.musicId !== musicId) { musicId = cfg.musicId; try{if(player) player.loadVideoById(musicId);}catch(e){} }
        const plDiv = document.getElementById('music-playlist-container'); if(plDiv && cfg.playlist) { plDiv.innerHTML = ""; cfg.playlist.forEach(s => { const style = s.id === cfg.musicId ? 'background:rgba(46, 125, 50, 0.1); border-left:4px solid green;' : ''; plDiv.innerHTML += `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border); ${style}"><span>${s.name}</span> <div><button class="btn btn-sm" onclick="playSong('${s.id}')">▶</button> <button class="btn btn-sm btn-danger" onclick="deleteSong('${s.name}','${s.id}')">🗑</button></div></div>`; }); }
        const mDiv = document.getElementById('maintenance-overlay'); if(cfg.maintenance && (!currentUser || !isAdmin(currentUser.email))) mDiv.style.display='flex'; else mDiv.style.display='none';
        applyLock('home',cfg.locks?.home); applyLock('greenclass',cfg.locks?.greenclass); applyLock('contest',cfg.locks?.contest); applyLock('activities',cfg.locks?.activities); applyLock('guide',cfg.locks?.guide); applyLock('archive',cfg.locks?.archive);
        handleTimer('timer-gallery','cd-gallery',cfg.deadlines?.gallery); handleTimer('timer-contest','cd-contest',cfg.deadlines?.contest);
        if(currentUser && isAdmin(currentUser.email)) {
            document.getElementById('cfg-maintenance').checked=cfg.maintenance; document.getElementById('lock-home').checked=cfg.locks?.home; document.getElementById('lock-greenclass').checked=cfg.locks?.greenclass; document.getElementById('lock-contest').checked=cfg.locks?.contest; document.getElementById('lock-activities').checked=cfg.locks?.activities; document.getElementById('lock-guide').checked=cfg.locks?.guide; document.getElementById('lock-archive').checked=cfg.locks?.archive;
            document.getElementById('time-gallery').value=cfg.deadlines?.gallery||""; document.getElementById('time-contest').value=cfg.deadlines?.contest||"";
            if(cfg.googleSheetUrl) { document.getElementById('cfg-sheet-url').value = cfg.googleSheetUrl; }
        }
    }
});

function applyLock(s,l){const o=document.getElementById(`locked-${s}`), c=document.getElementById(`content-${s}`); if(l&&(!currentUser||!isAdmin(currentUser.email))){if(o)o.style.display='block';if(c)c.style.display='none';}else{if(o)o.style.display='none';if(c)c.style.display='block';}}
let intervals={}; function handleTimer(e,b,d){if(!d){document.getElementById(b).style.display='none';return;}document.getElementById(b).style.display='block';if(intervals[e])clearInterval(intervals[e]);const end=new Date(d).getTime();intervals[e]=setInterval(()=>{const now=new Date().getTime(),dist=end-now;if(dist<0){clearInterval(intervals[e]);document.getElementById(e).innerHTML="HẾT GIỜ";}else{const d=Math.floor(dist/(1000*60*60*24)),h=Math.floor((dist%(1000*60*60*24))/(1000*60*60)),m=Math.floor((dist%(1000*60*60))/(1000*60));document.getElementById(e).innerHTML=`${d}d ${h}h ${m}p`;}},1000);}

// --- AUTH ---

// Lắng nghe trạng thái đăng nhập của người dùng
onAuthStateChanged(auth, async(u)=>{
    renderGrid('gallery', 'gallery-grid', {id:'rank-gallery-user'}, {id:'rank-gallery-class'}); 
    renderGrid('contest', 'contest-grid', {id:'rank-contest-user'}, {id:'rank-contest-class'});
    
    listenForNotifications();

    if(u){
        const r=doc(db,"users",u.uid), s=await getDoc(r); let userData;
        if(s.exists()){ 
            const d=s.data(); if(d.banned){alert("Bạn đã bị khóa!");signOut(auth);return;} 
            userData = { ...d, loginCount: (d.loginCount || 0) + 1 }; 
            
            // TỰ ĐỘNG SỬA HỒ SƠ ADMIN (Để hiện màu đỏ)
            if(isAdmin(u.email)) {
                if(d.class !== 'Admin' || d.displayName !== 'Admin_xinhxinh' || d.photoURL !== u.photoURL) {
                    await updateDoc(r, { class: 'Admin', displayName: 'Admin_xinhxinh', photoURL: u.photoURL });
                    userData.class = 'Admin'; userData.displayName = 'Admin_xinhxinh'; userData.photoURL = u.photoURL;
                }
            }
            await updateDoc(r, { lastActive: serverTimestamp(), loginCount: increment(1) }); 
        } 
        else { userData = { uid:u.uid, email:u.email, displayName:isAdmin(u.email)?"Admin_xinhxinh":u.displayName, photoURL:u.photoURL, role:isAdmin(u.email)?'admin':'member', status:'active', class:"", customID:"@"+u.uid.slice(0,5), createdAt: serverTimestamp(), lastActive: serverTimestamp(), loginCount: 1 }; await setDoc(r,userData); }
        currentUser=userData; setGalleryUser(currentUser);
        syncToGoogleSheet(currentUser, googleSheetUrl);
        listenToMyNotifications(u.uid);
        handleRoute(); // Redirect to Admin if needed
        refreshChatContext(); // Cập nhật ngữ cảnh AI với thông tin user mới
        setupPushNotifications(u); // Kích hoạt Push Notification

        // KIỂM TRA THÔNG TIN CÁ NHÂN (BẮT BUỘC)
        if(!currentUser.class || !currentUser.customID || !currentUser.dob) {
            if(window.location.hash !== '#profile') {
                alert("Chào bạn mới! Vui lòng cập nhật đầy đủ thông tin (Lớp, Ngày sinh, ID) để tiếp tục hoạt động nhé! 🌱");
                showPage('profile');
                window.location.hash = 'profile';
            }
        }

        document.getElementById('profile-in').style.display='block'; document.getElementById('profile-out').style.display='none'; document.getElementById('home-login-area').style.display='none';
        const pAvt = document.getElementById('p-avatar'); pAvt.src = currentUser.photoURL || 'https://lh3.googleusercontent.com/a/default-user=s96-c'; pAvt.onerror = function(){this.src='https://lh3.googleusercontent.com/a/default-user=s96-c'};
        document.getElementById('p-name').innerHTML=(currentUser.role==='admin'||isAdmin(currentUser.email))?`<span style="color:#d32f2f;font-weight:bold">Admin_xinhxinh <i class="fas fa-check-circle" style="color:#2e7d32"></i></span>`:currentUser.displayName;
        document.getElementById('p-custom-id').innerText = currentUser.customID || "@chua_co_id"; document.getElementById('p-email').innerText=currentUser.email; document.getElementById('edit-name').value=currentUser.displayName; document.getElementById('edit-custom-id').value=currentUser.customID || ""; document.getElementById('edit-class').value=currentUser.class||""; document.getElementById('edit-dob').value=currentUser.dob||""; document.getElementById('edit-bio').value=currentUser.bio||"";
        if(isAdmin(currentUser.email)){ 
            document.getElementById('menu-pc-admin').style.display='block'; document.getElementById('maintenance-overlay').style.display='none'; 
            const cs = document.getElementById('edit-class');
            if(cs) { cs.disabled = true; if(![...cs.options].some(o=>o.value==='Admin')){const o=document.createElement('option');o.value='Admin';o.text='Admin';cs.add(o);} cs.value='Admin'; }
            // Show Admin in Sidebar
        loadPushHistory(); // Tải lịch sử push

            // Tự động điền Server Key nếu đã lưu trước đó (Tiện ích Admin)
            const savedKey = localStorage.getItem('fcm_server_key');
            if(savedKey && document.getElementById('push-server-key')) document.getElementById('push-server-key').value = savedKey;
        } else { const cs = document.getElementById('edit-class'); if(cs) cs.disabled = false; }
        
        // Update Sidebar Profile
        updateSidebarUI();
        
        updateGreeting(); // Cập nhật lại lời chào khi đã có tên user
    }else{ 
        currentUser=null; 
        setGalleryUser(null);
        if(notifUnsub) notifUnsub(); 
        refreshChatContext(); // Reset ngữ cảnh AI về khách
        document.getElementById('profile-in').style.display='none'; document.getElementById('profile-out').style.display='block'; document.getElementById('home-login-area').style.display='block'; document.getElementById('menu-pc-admin').style.display='none'; 
        
        // Reset Sidebar Profile
        updateSidebarUI();
    }
});

window.changeAvatar=async(i)=>{
    const f=i.files[0];if(!f)return;
    const fd=new FormData();fd.append('file',f);fd.append('upload_preset',UPLOAD_PRESET);
    document.getElementById('upload-overlay').style.display='flex';
    try{
        const r=await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{method:'POST',body:fd});
        const j=await r.json();
        if(j.secure_url){
            await updateDoc(doc(db,"users",currentUser.uid),{photoURL:j.secure_url});
            // Đồng bộ Avatar sang tất cả bài viết cũ
            await syncUserToPosts(currentUser.uid, { authorAvatar: j.secure_url });
            alert("Đổi ảnh đại diện thành công! Dữ liệu đã được đồng bộ.");
            location.reload();
        }
    }catch(e){alert("Lỗi tải ảnh!")}
    document.getElementById('upload-overlay').style.display='none';
}
window.checkLoginAndUpload = (c) => { if(!currentUser) { alert("Vui lòng đăng nhập!"); return; } if(!currentUser.class || !currentUser.customID || !currentUser.dob) { alert("Vui lòng cập nhật đầy đủ thông tin (Lớp, ID, Ngày sinh)!"); showPage('profile'); return; } window.uploadMode = c; currentCollection = (c === 'trash' || c === 'plant' || c === 'bio') ? 'gallery' : c; document.getElementById('file-input').click(); }

// Xử lý logic tải ảnh lên Cloudinary và lưu vào Firestore (bao gồm cả AI phân tích ảnh)
window.executeUpload = async (i) => { 
    const f = i.files[0]; if(!f) return; 
    const isTrash = (window.uploadMode === 'trash'); 
    const isPlant = (window.uploadMode === 'plant');
    const isBio = (window.uploadMode === 'bio');
    
    let description = "";
    let aiShouldWrite = false;
    let captionStyle = "tự nhiên và gần gũi"; // Style mặc định
    let trashCategory = null; // Biến lưu loại rác

    if (!isTrash && !isPlant && !isBio) {
        const userInput = prompt("Nhập mô tả cho ảnh.\n\n✨ MẸO: Để AI viết giúp, bạn có thể:\n- Để trống và nhấn OK (style tự do)\n- Gõ 'vui', 'ý nghĩa', hoặc 'hài hước'");
        if (userInput === null) return; // Người dùng nhấn Cancel

        const lowerInput = userInput.trim().toLowerCase();
        if (lowerInput === '' || lowerInput === 'vui' || lowerInput === 'ý nghĩa' || lowerInput === 'hài hước' || lowerInput === 'sâu sắc') {
            aiShouldWrite = true;
            if (lowerInput === 'vui') captionStyle = 'vui vẻ, năng động';
            else if (lowerInput === 'ý nghĩa' || lowerInput === 'sâu sắc') captionStyle = 'sâu sắc và ý nghĩa';
            else if (lowerInput === 'hài hước') captionStyle = 'hài hước, dí dỏm';
        } else {
            description = userInput; // Người dùng tự viết mô tả
        }
    }

    // --- AI CONTENT MODERATION (KIỂM DUYỆT ẢNH) ---
    // Bước này ngăn chặn ảnh nhạy cảm trước khi tải lên Server
    Utils.loader(true, "🛡️ AI đang kiểm duyệt nội dung...");
    try {
        const base64Mod = await fileToBase64(f);
        // Prompt yêu cầu AI đóng vai kiểm duyệt viên trường học
        const modPrompt = "Bạn là hệ thống kiểm duyệt an toàn cho trường học (School Safety Filter). Hãy phân tích bức ảnh này. Nếu ảnh chứa nội dung: Khỏa thân, Khiêu dâm, Bạo lực, Máu me, Kinh dị, Vũ khí, hoặc Ngón tay thối. Hãy trả lời duy nhất từ: 'UNSAFE'. Nếu ảnh an toàn và phù hợp với học sinh, hãy trả lời: 'SAFE'.";
        
        // Gọi model 'main' (Flash) để kiểm tra nhanh
        const modResult = await callGeminiAPI(modPrompt, base64Mod, false, 'main', aiKeys, []);
        
        if (modResult && modResult.toUpperCase().includes("UNSAFE")) {
            Utils.loader(false);
            alert("🚫 ẢNH BỊ TỪ CHỐI!\n\nHệ thống AI phát hiện ảnh có nội dung nhạy cảm hoặc không phù hợp với môi trường học đường.\nVui lòng chọn ảnh khác văn minh hơn nhé! 🌸");
            i.value = ""; // Reset input file để người dùng chọn lại
            return; // Dừng toàn bộ quá trình upload
        }
    } catch (e) {
        console.warn("Lỗi kiểm duyệt (Bỏ qua để không chặn người dùng):", e);
    }

    let aiPrompt = "";
    if (isTrash) aiPrompt = "Bạn là chuyên gia phân loại rác. Hãy nhìn ảnh và phân loại. BẮT BUỘC trả lời theo định dạng: CATEGORY|NAME|INSTRUCTION. Trong đó CATEGORY chỉ được chọn 1 trong 3: 'Hữu cơ', 'Tái chế', 'Rác còn lại'. NAME là tên ngắn gọn của rác. INSTRUCTION là hướng dẫn xử lý ngắn gọn. Ví dụ: Tái chế|Vỏ lon|Rửa sạch và ép dẹp.";
    else if (isPlant) aiPrompt = "Bạn là một chuyên gia nông nghiệp (Bác sĩ cây trồng). Hãy nhìn ảnh này và cho biết: 1. Đây là cây gì? 2. Cây có dấu hiệu bị bệnh, héo hay sâu hại không? 3. Nếu có, hãy đưa ra phác đồ điều trị cụ thể. Nếu cây khỏe mạnh, hãy khen và hướng dẫn cách chăm sóc cơ bản. Trả lời ngắn gọn, súc tích.";
    else if (isBio) aiPrompt = "Bạn là một nhà sinh học vui tính dành cho học sinh. Hãy nhìn bức ảnh này và cho biết: 1. Tên cây (Tiếng Việt & Tên khoa học). 2. Đặc điểm nhận dạng nổi bật. 3. Công dụng hoặc ý nghĩa của cây (Vd: làm thuốc, bóng mát, trang trí...). Trả lời ngắn gọn, dễ hiểu, dùng emoji sinh động.";
    else if (aiShouldWrite) {
        aiPrompt = `Đóng vai một học sinh, hãy viết MỘT caption ngắn gọn, chân thật về bức ảnh này theo phong cách ${captionStyle}. Xưng hô là 'mình', 'tớ' hoặc 'lớp tớ'.`;
    }
    
    let loadingText = "AI đang viết caption...";
    if(isTrash) loadingText = "AI đang soi rác...";
    if(isPlant) loadingText = "Bác sĩ cây đang chẩn đoán...";
    if(isBio) loadingText = "Nhà sinh học đang tra cứu...";

    document.getElementById('upload-loading-text').innerText = (isTrash || isPlant || isBio || aiShouldWrite) ? loadingText : "Đang tải ảnh lên...";
    document.getElementById('upload-overlay').style.display='flex'; 
    try { 
        const fd = new FormData(); fd.append('file',f); fd.append('upload_preset',UPLOAD_PRESET); 
        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{method:'POST',body:fd}); const j = await r.json(); 
        if(j.secure_url) { 
            let shouldPost = true;

            if(isTrash || isPlant || isBio || aiShouldWrite) { 
                try { const base64Img = await fileToBase64(f); const aiResult = await callGeminiAPI(aiPrompt, base64Img, false, 'main', aiKeys, chatHistory); 

                    const cleanResult = aiResult.replace(/\*/g, ''); // Xóa dấu * cho alert
                    const formattedForDesc = aiResult.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');

                    if(isTrash) { 
                        // Xử lý kết quả phân loại rác
                        const parts = aiResult.split('|');
                        let cat = "Rác còn lại"; let name = "Rác không xác định"; let instr = aiResult;
                        if (parts.length >= 3) {
                            cat = parts[0].trim(); name = parts[1].trim(); instr = parts[2].trim();
                            // Chuẩn hóa danh mục
                            if(cat.toLowerCase().includes('hữu cơ')) cat = 'Hữu cơ';
                            else if(cat.toLowerCase().includes('tái chế')) cat = 'Tái chế';
                            else cat = 'Rác còn lại';
                        }
                        trashCategory = cat;
                        alert(`🤖 AI Kết luận:\n- Loại: ${cat}\n- Tên: ${name}\n- Hướng dẫn: ${instr}`); 
                        description = `[${cat}] <b>${name}</b>: ${instr}`; 
                    } 
                    else if(isPlant) { 
                        alert(`🌿 Bác sĩ cây chẩn đoán:\n${cleanResult}`); 
                        description = formattedForDesc; 
                        shouldPost = confirm("Bạn có muốn đăng kết quả chẩn đoán này lên Góc Xanh không?");
                    }
                    else if(isBio) { 
                        alert(`🔍 Nhà Sinh Học Nhí:\n${cleanResult}`); 
                        description = formattedForDesc; 
                        shouldPost = confirm("Bạn có muốn chia sẻ kiến thức này lên Góc Xanh không?");
                    }
                    else { description = formattedForDesc; } // Dùng caption AI vừa tạo
                } catch(err) { 
                    console.error(err); 
                    if(isTrash || isPlant || isBio) {
                        alert("AI lỗi, không thể phân tích.");
                        shouldPost = false;
                    }
                    else if (aiShouldWrite) {
                        alert("AI đang bận, không thể viết caption. Bạn hãy tự nhập mô tả nhé.");
                        description = "Ảnh đẹp quá! ✨"; // Mô tả dự phòng
                    }
                } 
            } 
            
            if (shouldPost) {
                await addDoc(collection(db, currentCollection), { url: j.secure_url, desc: description, uid: currentUser.uid, authorName: currentUser.displayName, authorID: currentUser.customID || "@unknown", authorAvatar: currentUser.photoURL, className: currentUser.class, type: window.uploadMode, trashCategory: trashCategory, createdAt: serverTimestamp(), likes: [], comments: [], archived: false }); 
                if (aiShouldWrite) alert("Đăng ảnh thành công!\n(AI đã viết caption giúp bạn)");
                else if (!isTrash && !isPlant && !isBio) alert("Đăng ảnh thành công!");
                else if (isPlant || isBio) alert("Đã đăng bài thành công!");
            }
        } 
    } catch(e) { console.error(e); alert("Lỗi tải ảnh: " + e.message); } 
    document.getElementById('upload-overlay').style.display='none'; i.value=""; 
}

// --- FEATURED POST LOGIC (PIN & TOP 1) ---
// Xử lý hiển thị bài ghim và bài Top 1 Trending
onSnapshot(doc(db, "settings", "featured"), (snap) => {
    setPinnedSettings(snap.exists() ? snap.data() : null);
});

let lastTap = 0; const imgEl = document.getElementById('lb-img'); const zoomArea = document.getElementById('lb-zoom-area');
zoomArea.addEventListener('touchend', (e) => { const currentTime = new Date().getTime(); const tapLength = currentTime - lastTap; if (tapLength < 300 && tapLength > 0) { toggleZoom(e); e.preventDefault(); } lastTap = currentTime; });
zoomArea.addEventListener('dblclick', toggleZoom);
function toggleZoom(e) { if (zoomArea.classList.contains('zoomed')) { zoomArea.classList.remove('zoomed'); imgEl.style.transform = "scale(1)"; } else { zoomArea.classList.add('zoomed'); let clientX, clientY; if (e.changedTouches && e.changedTouches.length > 0) { clientX = e.changedTouches[0].clientX; clientY = e.changedTouches[0].clientY; } else { clientX = e.clientX; clientY = e.clientY; } const rect = zoomArea.getBoundingClientRect(); const x = clientX - rect.left; const y = clientY - rect.top; imgEl.style.transformOrigin = `${x}px ${y}px`; imgEl.style.transform = "scale(2.5)"; } }

// --- SWIPE TO CLOSE LIGHTBOX (MOBILE GESTURE) ---
let touchStartY = 0;
let touchCurrentY = 0;
const lightboxEl = document.getElementById('lightbox');
const lbContainer = document.querySelector('.lb-container');

lightboxEl.addEventListener('touchstart', (e) => {
    // Chỉ kích hoạt khi không zoom và chạm vào vùng ảnh
    if (zoomArea.classList.contains('zoomed')) return;
    touchStartY = e.touches[0].clientY;
}, {passive: true});

lightboxEl.addEventListener('touchmove', (e) => {
    if (zoomArea.classList.contains('zoomed') || touchStartY === 0) return;
    touchCurrentY = e.touches[0].clientY;
    const diff = touchCurrentY - touchStartY;

    // Nếu vuốt xuống > 0
    if (diff > 0) {
        e.preventDefault(); // Chặn cuộn trang
        // Hiệu ứng kéo ảnh xuống và mờ dần nền
        lbContainer.style.transform = `translateY(${diff}px)`;
        lightboxEl.style.background = `rgba(0, 0, 0, ${1 - Math.min(diff/500, 0.8)})`;
    }
}, {passive: false});

lightboxEl.addEventListener('touchend', (e) => {
    if (zoomArea.classList.contains('zoomed') || touchStartY === 0) return;
    const diff = touchCurrentY - touchStartY;
    
    // Nếu vuốt xuống quá 150px thì đóng
    if (diff > 150) {
        closeLightbox();
    } else {
        // Reset lại vị trí nếu chưa đủ ngưỡng
        lbContainer.style.transform = '';
        lightboxEl.style.background = '#000';
    }
    touchStartY = 0;
    touchCurrentY = 0;
});

// Gán các hàm từ module vào window để HTML gọi được (onclick)
window.exportExcel = async (type) => {
    if(!currentUser || !isAdmin(currentUser.email)) return;
    await exportExcel(type);
}
window.exportPDF = async (type) => {
    if(!currentUser || !isAdmin(currentUser.email)) return;
    await exportPDF(type);
}
window.generateSitemap = async () => {
    if(!currentUser || !isAdmin(currentUser.email)) return;
    await generateSitemap();
}
window.handleLogout = handleLogout;
window.checkAdminLogin = checkAdminLogin;
window.requestDeleteAccount = () => requestDeleteAccount(currentUser.uid);
window.restoreAccount = () => restoreAccount(currentUser.uid);
window.loadMore = loadMore;
window.showUserPosts = showUserPosts;
window.closeUserPosts = closeUserPosts;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.toggleDetails = toggleDetails;
window.quickReply = quickReply;
window.pinPost = pinPost;
window.unpinPost = unpinPost;
window.deletePostFromLB = deletePostFromLB;
window.editPostFromLB = editPostFromLB;
window.handleLike = handleLike;
window.deleteComment = deleteComment;

// --- CHART JS LOGIC ---
// Vẽ biểu đồ thống kê (Admin)
window.drawClassChart = async () => {
    if(!currentUser || !isAdmin(currentUser.email)) return;
    Utils.loader(true, "Đang tổng hợp dữ liệu...");
    const filter = document.getElementById('chart-filter').value;
    const now = new Date();
    
    // Lấy dữ liệu từ cả 2 bộ sưu tập
    const gallerySnap = await getDocs(collection(db, 'gallery'));
    const contestSnap = await getDocs(collection(db, 'contest'));
    
    let stats = {};
    const process = (snap) => {
        snap.forEach(doc => {
            const d = doc.data();
            
            // Logic lọc thời gian
            if (d.createdAt) {
                const docDate = new Date(d.createdAt.seconds * 1000);
                if (filter === 'month' && (docDate.getMonth() !== now.getMonth() || docDate.getFullYear() !== now.getFullYear())) return;
                if (filter === 'week') {
                    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                    if (docDate < oneWeekAgo) return;
                }
            }

            const c = d.className || "Chưa cập nhật";
            if(!stats[c]) stats[c] = 0;
            stats[c]++;
        });
    };
    process(gallerySnap);
    process(contestSnap);

    const labels = Object.keys(stats).sort();
    const data = labels.map(k => stats[k]);

    const ctx = document.getElementById('classChart');
    if(window.myClassChart) window.myClassChart.destroy(); // Xóa biểu đồ cũ nếu có

    window.myClassChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Số lượng bài đăng', data: data, backgroundColor: '#2e7d32', borderColor: '#1b5e20', borderWidth: 1 }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
    Utils.loader(false);
}

window.drawAIChart = async () => {
    if(!currentUser || !isAdmin(currentUser.email)) return;
    Utils.loader(true, "Đang tải thống kê AI...");
    
    try {
        const docSnap = await getDoc(doc(db, "stats", "ai"));
        let s = 0, f = 0;
        if (docSnap.exists()) {
            const data = docSnap.data();
            s = data.success || 0;
            f = data.fail || 0;
        }

        const ctx = document.getElementById('aiChart');
        if(window.myAIChart) window.myAIChart.destroy();

        window.myAIChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Thành công', 'Thất bại'],
                datasets: [{ data: [s, f], backgroundColor: ['#4caf50', '#f44336'], borderWidth: 1 }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' }, title: { display: true, text: `Tổng requests: ${s + f}` } } }
        });
    } catch (e) { console.error(e); }
    Utils.loader(false);
}

// --- FIREWORKS EFFECT ---
// Hiệu ứng pháo hoa chúc mừng
window.triggerFireworks = () => {
    const duration = 3000; const end = Date.now() + duration;
    // Phát nhạc
    const audio = document.getElementById('fireworks-audio');
    if(audio) { audio.currentTime = 0; audio.play().catch(e => console.log("Audio play failed (Autoplay policy):", e)); }
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}

window.updateSheetConfig = async () => { const url = document.getElementById('cfg-sheet-url').value; await setDoc(doc(db,"settings","config"),{googleSheetUrl: url},{merge:true}); alert("Đã lưu Link Google Sheet!"); }
window.updateAIModels = async () => {
    const models = {
        main: document.getElementById('model-main').value.trim() || "gemini-2.5-flash",
        voice: document.getElementById('model-voice').value.trim() || "gemini-2.5-flash-preview-native-audio-dialog",
        backup: document.getElementById('model-backup').value.trim() || "gemini-2.5-flash-lite",
        advanced: document.getElementById('model-advanced').value.trim() || "gemini-3-flash"
    };
    await setDoc(doc(db, "settings", "config"), { aiModels: models }, { merge: true });
    alert("Đã cập nhật cấu hình Model AI!");
}
window.updateAIConfig = async () => { await setDoc(doc(db,"settings","config"),{geminiKey:document.getElementById('cfg-ai-key').value},{merge:true}); alert("Đã lưu API Key! Vui lòng tải lại trang."); location.reload(); }
window.updateMainConfig = async () => { await setDoc(doc(db,"settings","config"),{maintenance:document.getElementById('cfg-maintenance').checked},{merge:true}); alert("Đã lưu!"); }
window.updateLocks = async () => { await setDoc(doc(db,"settings","config"),{locks:{home:document.getElementById('lock-home').checked,greenclass:document.getElementById('lock-greenclass').checked,contest:document.getElementById('lock-contest').checked,activities:document.getElementById('lock-activities').checked,guide:document.getElementById('lock-guide').checked,archive:document.getElementById('lock-archive').checked}},{merge:true}); alert("Đã lưu!"); }
window.updateDeadlines = async () => { await setDoc(doc(db,"settings","config"),{deadlines:{gallery:document.getElementById('time-gallery').value,contest:document.getElementById('time-contest').value}},{merge:true}); alert("Đã lưu!"); }
window.archiveSeason = async (c) => { if(!confirm("Lưu trữ?"))return; const n=prompt("Tên đợt:"); if(!n)return; const q=query(collection(db,c),where("archived","!=",true)); const s=await getDocs(q); const u=[]; s.forEach(d=>u.push(updateDoc(doc(db,c,d.id),{archived:true,archiveLabel:n}))); await Promise.all(u); await addDoc(collection(db,"archives_meta"),{collection:c,label:n,archivedAt:serverTimestamp()}); alert("Xong!"); }
// Tải danh sách các đợt lưu trữ cũ
window.loadArchiveSeasons = async () => { const s=document.getElementById('archive-season-select'); s.innerHTML='<option value="ALL">📂 Tất cả ảnh lưu trữ</option>'; const q=query(collection(db,"archives_meta"),where("collection","==",activeArchiveTab)); const sn=await getDocs(q); const docs = []; sn.forEach(d => docs.push(d.data())); docs.sort((a,b) => (b.archivedAt?.seconds || 0) - (a.archivedAt?.seconds || 0)); docs.forEach(d=>s.innerHTML+=`<option value="${d.label}">${d.label}</option>`); }
window.loadArchiveGrid = Utils.debounce(async () => { const l=document.getElementById('archive-season-select').value; const k=document.getElementById('archive-search').value.toLowerCase(); const g=document.getElementById('archive-grid'); g.innerHTML="Loading..."; let q; if(l === 'ALL') q = query(collection(db,activeArchiveTab),where("archived","==",true)); else q = query(collection(db,activeArchiveTab),where("archived","==",true),where("archiveLabel","==",l)); const s=await getDocs(q); g.innerHTML=""; if(s.empty) { g.innerHTML = "<p>Không có dữ liệu.</p>"; return; } s.forEach(d=>{ const da=d.data(); if(k && !da.authorName.toLowerCase().includes(k) && !da.desc.toLowerCase().includes(k) && !(da.authorID||"").toLowerCase().includes(k)) return; g.innerHTML+=`<div class="gallery-item" onclick="openLightbox('${activeArchiveTab}','${d.id}')"><div class="gallery-img-container"><img src="${da.url}" class="gallery-img"></div><div class="gallery-info"><div class="gallery-title">${da.desc}</div><div class="gallery-meta"><span>${da.authorID||da.authorName}</span></div></div></div>`; }); }, 300);
window.switchArchiveTab = (t) => { activeArchiveTab=t; document.querySelectorAll('.archive-tab').forEach(e=>e.classList.remove('active')); document.getElementById(`tab-ar-${t}`).classList.add('active'); loadArchiveSeasons(); loadArchiveGrid(); }

// Tải dữ liệu người dùng cho trang quản trị Admin
window.loadAdminData = async () => { 
    if(!currentUser||!isAdmin(currentUser.email))return; 
    const b=document.getElementById('user-table-body'); b.innerHTML="<tr><td colspan='6' style='text-align:center'>Đang tải dữ liệu...</td></tr>"; 
    const s=await getDocs(collection(db,"users")); 
    adminUsersCache = []; s.forEach(d => adminUsersCache.push({id: d.id, ...d.data()}));
    adminPage = 1; // Reset về trang 1 khi tải lại
    filterAdminUsers();
}

window.filterAdminUsers = () => {
    const k = document.getElementById('admin-user-search').value.toLowerCase();
    const b = document.getElementById('user-table-body'); b.innerHTML = "";
    
    // 1. Lọc dữ liệu
    let filtered = adminUsersCache.filter(u => (u.displayName||"").toLowerCase().includes(k) || (u.email||"").toLowerCase().includes(k) || (u.customID||"").toLowerCase().includes(k) || (u.class||"").toLowerCase().includes(k));

    // 2. Sắp xếp
    filtered.sort((a, b) => {
        let valA = (a[adminSortField] || "").toString().toLowerCase();
        let valB = (b[adminSortField] || "").toString().toLowerCase();
        if (valA < valB) return adminSortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return adminSortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    // 3. Phân trang
    const totalPages = Math.ceil(filtered.length / adminItemsPerPage);
    if (adminPage > totalPages) adminPage = totalPages || 1;
    if (adminPage < 1) adminPage = 1;
    
    const start = (adminPage - 1) * adminItemsPerPage;
    const paginatedItems = filtered.slice(start, start + adminItemsPerPage);

    paginatedItems.forEach((u, index) => {
        const realIndex = start + index + 1;
        const btn = u.banned ? `<button onclick="togBan('${u.id}',0)">Mở</button>` : `<button onclick="togBan('${u.id}',1)" style="color:red">Khóa</button>`; 
        b.innerHTML+=`<tr><td>${realIndex}</td><td>${u.displayName}</td><td>${u.email}</td><td>${u.class||'-'}</td><td>${u.banned?'KHÓA':'Active'}</td><td>${btn}</td></tr>`;
    });

    if(filtered.length === 0) b.innerHTML = "<tr><td colspan='6' style='text-align:center'>Không tìm thấy thành viên nào.</td></tr>";

    // Cập nhật UI phân trang
    const pageInfo = document.getElementById('admin-page-info');
    if(pageInfo) pageInfo.innerText = `Trang ${adminPage} / ${totalPages || 1}`;
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');
    if(btnPrev) btnPrev.disabled = adminPage === 1;
    if(btnNext) btnNext.disabled = adminPage >= (totalPages || 1);
}

window.sortAdminUsers = (field) => {
    if (adminSortField === field) { adminSortOrder = adminSortOrder === 'asc' ? 'desc' : 'asc'; } 
    else { adminSortField = field; adminSortOrder = 'asc'; }
    
    // Cập nhật icon chỉ dẫn
    document.querySelectorAll('.sort-icon').forEach(i => i.className = 'fas fa-sort sort-icon');
    const activeHeader = document.getElementById(`th-${field}`);
    if(activeHeader) {
        const icon = activeHeader.querySelector('.sort-icon');
        if(icon) icon.className = `fas fa-sort-${adminSortOrder === 'asc' ? 'up' : 'down'} sort-icon`;
    }
    filterAdminUsers();
}

window.changeAdminPage = (delta) => {
    adminPage += delta;
    filterAdminUsers();
}

window.togBan = async (id, st) => { if(confirm("Xác nhận?")) { await updateDoc(doc(db, "users", id), { banned: !!st }); loadAdminData(); } }
window.deletePost = async (c, i) => { if(confirm("Xóa bài?")) await deleteDoc(doc(db, c, i)); }
window.editPost = async (c, i, o) => { const n = prompt("Sửa:", o); if(n) await updateDoc(doc(db, c, i), { desc: n }); }
window.updateProfile = async (e) => { 
    e.preventDefault(); 
    const n = document.getElementById('edit-name').value; const cid = document.getElementById('edit-custom-id').value; const c = document.getElementById('edit-class').value; const d = document.getElementById('edit-dob').value; const b = document.getElementById('edit-bio').value; 
    if(cid !== currentUser.customID) { const isUnique = await checkUniqueID(cid); if(!isUnique) return alert("ID này đã có người dùng!"); } 
    const f = isAdmin(currentUser.email) ? "Admin_xinhxinh" : n; const finalClass = isAdmin(currentUser.email) ? "Admin" : c;
    
    await updateDoc(doc(db, "users", currentUser.uid), { displayName: f, customID: cid, class: finalClass, dob: d, bio: b }); 
    
    // CẬP NHẬT NGAY LẬP TỨC BIẾN currentUser ĐỂ MỞ KHÓA
    currentUser.displayName = f; currentUser.customID = cid; currentUser.class = finalClass; currentUser.dob = d; currentUser.bio = b;
    
    // Update Sidebar immediately
    updateSidebarUI();
    
    // Đồng bộ Tên, ID, Lớp sang tất cả bài viết cũ
    await syncUserToPosts(currentUser.uid, { authorName: f, authorID: cid, className: finalClass });

    alert("Đã lưu hồ sơ thành công! Bạn có thể sử dụng web bình thường."); 
    if(currentUser.class && currentUser.customID && currentUser.dob) { showPage('home'); window.location.hash = 'home'; }
}

// --- ROUTING LOGIC ---
// Xử lý điều hướng trang (SPA - Single Page Application)
function handleRoute() {
    const hash = window.location.hash.slice(1) || 'home';
    showPage(hash);
}
window.addEventListener('hashchange', handleRoute);
window.addEventListener('load', handleRoute);

window.showPage = (id) => {
    const validPages = ['home', 'greenclass', 'contest', 'archive', 'activities', 'guide', 'profile', 'admin'];
    let targetId = validPages.includes(id) ? id : 'home';

    // CHẶN ĐIỀU HƯỚNG NẾU THIẾU THÔNG TIN (BẮT BUỘC)
    if (currentUser && (!currentUser.class || !currentUser.customID || !currentUser.dob) && targetId !== 'profile') {
        alert("⚠️ Vui lòng cập nhật đầy đủ thông tin (Lớp, ID, Ngày sinh) để tiếp tục sử dụng!");
        targetId = 'profile';
        window.location.hash = 'profile';
    }

    if (targetId === 'admin') {
        if (!currentUser) { alert("Vui lòng đăng nhập quyền Admin trước!"); targetId = 'profile'; window.location.hash = 'profile'; } 
        else if (!isAdmin(currentUser.email)) { alert("⛔ Bạn không có quyền truy cập khu vực này!"); targetId = 'home'; window.location.hash = 'home'; }
    }
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    const section = document.getElementById(targetId); if(section) section.classList.add('active');
    document.querySelectorAll('nav.pc-nav a, .sidebar-item').forEach(a => a.classList.remove('active-menu'));
    if(document.getElementById('menu-pc-'+targetId)) document.getElementById('menu-pc-'+targetId).classList.add('active-menu');
    if(document.getElementById('sidebar-'+targetId)) {
        const el = document.getElementById('sidebar-'+targetId);
        el.classList.add('active-menu');
        // el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); // Không cần scroll trong sidebar
    }
    if(targetId === 'archive') { loadArchiveSeasons(); switchArchiveTab('gallery'); }
    
    // --- DYNAMIC SEO UPDATE ---
    const seoConfig = {
        'home': { title: 'Trang Chủ', desc: 'Trang chủ chính thức của lớp A2K41 - Green School. Cập nhật tin tức, thông báo và hoạt động mới nhất.' },
        'greenclass': { title: 'Góc Xanh', desc: 'Thư viện ảnh Góc Xanh, chia sẻ khoảnh khắc thiên nhiên, cây trồng và hoạt động bảo vệ môi trường của A2K41.' },
        'contest': { title: 'Thi Đua', desc: 'Bảng xếp hạng thi đua, nộp báo cáo hoạt động và theo dõi thành tích của các thành viên.' },
        'archive': { title: 'Lưu Trữ', desc: 'Kho lưu trữ hình ảnh và hoạt động của các mùa trước.' },
        'activities': { title: 'Hoạt Động', desc: 'Lịch trình các hoạt động ngoại khóa, tin tức và sự kiện sắp tới.' },
        'guide': { title: 'Tra Cứu', desc: 'Công cụ AI Soi Rác, hướng dẫn phân loại rác và tra cứu thông tin môi trường.' },
        'profile': { title: 'Hồ Sơ', desc: 'Quản lý thông tin cá nhân, cài đặt giao diện và tiện ích.' },
        'admin': { title: '🛠 Quản Trị Hệ Thống', desc: 'Trang quản trị dành cho Ban Cán Sự lớp.' }
    };

    const currentSEO = seoConfig[targetId] || seoConfig['home'];
    const fullTitle = `Green School - ${currentSEO.title}`;

    // 1. Cập nhật Title
    document.title = fullTitle;

    // 2. Cập nhật Meta Description & OG Tags
    const metaDesc = document.querySelector('meta[name="description"]');
    if(metaDesc) metaDesc.setAttribute("content", currentSEO.desc);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if(ogTitle) ogTitle.setAttribute("content", fullTitle);

    // 3. Cập nhật Canonical URL (Giúp GSC hiểu link chính thức)
    let canonicalLink = document.querySelector("link[rel='canonical']");
    if (!canonicalLink) {
        canonicalLink = document.createElement("link");
        canonicalLink.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", window.location.href.split('#')[0] + (targetId !== 'home' ? '#' + targetId : ''));

    // --- GOOGLE ANALYTICS TRACKING (SPA) ---
    if (typeof window.gtag === 'function') {
        window.gtag('event', 'page_view', {
            page_title: fullTitle,
            page_location: window.location.href,
            page_path: '/' + targetId
        });
    }

    // Haptic Feedback khi chuyển trang (Rung nhẹ)
    if(navigator.vibrate) navigator.vibrate(15);
}

// --- TRASH GUIDE LOGIC ---
// Dữ liệu và logic cho phần Tra Cứu Rác
const trashDB = [
    {n:"Vỏ sữa",t:"Tái chế",c:"bin-recycle", img: "https://provietnam.com.vn/wp-content/uploads/2021/05/02-GIAIRAC-01.jpg", desc: "Vỏ hộp sữa (Tetra Pak) là rác tái chế. Chúng được cấu tạo từ nhiều lớp giấy, nhựa và nhôm. Cần được làm sạch và ép dẹp trước khi bỏ vào thùng rác tái chế."},
    {n:"Chai nhựa",t:"Tái chế",c:"bin-recycle", img: "https://t-tech.vn/data/uploads/2025/09/coc-tien-chai-nhua-vo-chai.png", desc: "Chai nhựa PET, HDPE (thường là chai nước, chai sữa tắm) có thể tái chế thành sợi polyester, đồ dùng mới. Hãy làm sạch và tháo nắp trước khi vứt."},
    {n:"Giấy vụn",t:"Tái chế",c:"bin-recycle", img: "https://baochithongminh.wordpress.com/wp-content/uploads/2018/02/tu-than.jpg", desc: "Các loại giấy báo, giấy văn phòng, bìa carton đều có thể tái chế. Tránh để giấy bị dính dầu mỡ hoặc thức ăn."},
    {n:"Lon nhôm",t:"Tái chế",c:"bin-recycle", img: "https://blog.sendmoney.jp/wp-content/uploads/2025/05/Gia-tang-toi-pham-trom-rac-tai-che-o-Nhat.png", desc: "Lon nước ngọt, bia làm từ nhôm có giá trị tái chế cao, tiết kiệm đến 95% năng lượng so với sản xuất mới. Hãy làm sạch và ép dẹp chúng."},
    {n:"Vỏ trái cây",t:"Hữu cơ",c:"bin-organic", img: "https://afamilycdn.com/2017/img20170919103225617.jpg", desc: "Vỏ các loại rau củ quả là rác hữu cơ, có thể được ủ để làm phân compost bón cho cây trồng, rất tốt cho đất."},
    {n:"Thức ăn thừa",t:"Hữu cơ",c:"bin-organic", img: "https://hacheco.vn/wp-content/uploads/2020/04/rac-thai.jpeg", desc: "Thức ăn thừa không chứa dầu mỡ nhiều có thể được ủ làm phân hữu cơ. Tránh đổ thức ăn có dầu mỡ vào bồn rửa vì có thể gây tắc cống."},
    {n:"Túi nilon",t:"Rác còn lại",c:"bin-other", img: "https://images.unsplash.com/photo-1621451537084-482c73073a0f?q=80&w=400", desc: "Túi nilon rất khó phân hủy và khó tái chế. Hãy hạn chế sử dụng, tái sử dụng nhiều lần và bỏ vào thùng rác còn lại khi không thể dùng nữa."},
    {n:"Pin/Acquy",t:"Rác nguy hại",c:"bin-other", img: "https://hnm.1cdn.vn/2016/06/04/hanoimoi.com.vn-uploads-tuandiep-2016-6-4-_pin-phe-thai.jpg", desc: "Pin và acquy chứa nhiều kim loại nặng độc hại. TUYỆT ĐỐI KHÔNG vứt vào thùng rác thông thường. Cần được thu gom tại các điểm thu hồi rác thải nguy hại riêng."}
];
window.filterTrash = Utils.debounce(() => { 
    const k = document.getElementById('trashSearchInput').value.toLowerCase(); 
    const r = document.getElementById('trashContainer'); 
    r.innerHTML=""; 
    
    const iconMap = { 'bin-recycle': 'fa-recycle', 'bin-organic': 'fa-leaf', 'bin-other': 'fa-trash' };

    trashDB.filter(i=>i.n.toLowerCase().includes(k)).forEach(i=>{ 
        const icon = iconMap[i.c] || 'fa-question-circle';
        r.innerHTML+=`
        <div class="flip-card" onclick="this.classList.toggle('flipped')">
            <div class="flip-card-inner">
                <div class="flip-card-front">
                    <div class="${i.c} flip-card-icon"><i class="fas ${icon}"></i></div>
                    <div class="${i.c}" style="font-weight:bold; font-size:0.85rem; text-transform:uppercase; margin-bottom:5px;">${i.t}</div>
                    <strong style="font-size:1.1rem; color:var(--text);">${i.n}</strong>
                    <div style="font-size:0.75rem; color:var(--text-sec); margin-top:15px; opacity:0.6;"><i class="fas fa-hand-pointer"></i> Chạm để xem</div>
                </div>
                <div class="flip-card-back">
                    <img src="${i.img}" style="width:100%; height:100px; object-fit:cover; border-radius:8px; margin-bottom:5px;">
                    <p style="font-size:0.8rem; color:var(--text); margin:0 0 5px 0; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; line-height:1.3;">${i.desc}</p>
                    <button class="btn btn-sm btn-outline" style="width:100%; padding:5px; font-size:0.8rem;" onclick="event.stopPropagation(); showTrashDetail('${i.n}')">Chi tiết / Chat AI</button>
                </div>
            </div>
        </div>`; 
    }); 
}, 200); 
window.filterTrash();

let trashChatHistory = [];
let currentTrashItem = null;

window.showTrashDetail = (itemName) => {
    currentTrashItem = trashDB.find(item => item.n === itemName);
    if (!currentTrashItem) return;

    document.getElementById('trash-detail-title').innerText = currentTrashItem.n;
    document.getElementById('trash-detail-img').src = currentTrashItem.img;
    document.getElementById('trash-detail-desc').innerHTML = `<p>${currentTrashItem.desc}</p>`;
    
    const modal = document.getElementById('trash-detail-modal');
    modal.style.display = 'flex';

    // Reset chat
    const chatMessages = document.getElementById('trash-chat-messages');
    chatMessages.innerHTML = `<div style="color:var(--text-sec)">Ví dụ: Nó có thể tái chế thành gì?</div>`;
    
    const systemPrompt = `Bạn là một chuyên gia tái chế, chỉ trả lời các câu hỏi liên quan đến '${currentTrashItem.n}'. Hãy trả lời ngắn gọn, tập trung vào việc xử lý và tái chế. (Trả lời bằng Tiếng Việt)`;
    trashChatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Sẵn sàng giải đáp!" }] }
    ];
}

window.closeTrashDetail = () => {
    document.getElementById('trash-detail-modal').style.display = 'none';
    currentTrashItem = null;
}

window.sendTrashChatMessage = async (e) => {
    e.preventDefault();
    if (!currentTrashItem) return;

    const input = document.getElementById('trash-chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const chatMessages = document.getElementById('trash-chat-messages');
    if (chatMessages.querySelector('div[style*="color:var(--text-sec)"]')) {
        chatMessages.innerHTML = ''; // Clear placeholder
    }
    chatMessages.innerHTML += `<div style="text-align:right; margin-bottom:5px;"><b>Bạn:</b> ${msg}</div>`;
    input.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    trashChatHistory.push({ role: "user", parts: [{ text: msg }] });

    const loadingDiv = document.createElement('div');
    loadingDiv.innerHTML = '<b>AI:</b> <i class="fas fa-spinner fa-spin"></i>';
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const response = await callGeminiAPI(null, null, true, 'main', aiKeys, trashChatHistory);
        loadingDiv.innerHTML = `<b>AI:</b> ${response.replace(/\n/g, '<br>')}`;
    } catch (err) {
        loadingDiv.innerHTML = `<b>AI:</b> <span style="color:red">Lỗi!</span>`;
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- QR SCANNER LOGIC ---
let qrScanner = null;
window.startQRScanner = () => {
    if (typeof Html5QrcodeScanner === 'undefined') {
        alert("Đang tải thư viện quét mã... Vui lòng thử lại sau vài giây!");
        return;
    }
    const modal = document.getElementById('qr-scanner-modal');
    if(modal) modal.style.display = 'flex';
    
    if (!qrScanner) {
        qrScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
        qrScanner.render(onScanSuccess);
    }
}

function onScanSuccess(decodedText, decodedResult) {
    window.stopQRScanner();
    const searchInput = document.getElementById('trashSearchInput');
    if(searchInput) {
        searchInput.value = decodedText;
        window.filterTrash(); // Gọi hàm lọc rác
        
        // Tự động mở chi tiết nếu khớp chính xác tên rác trong DB
        const exact = trashDB.find(i => i.n.toLowerCase() === decodedText.toLowerCase());
        if(exact) window.showTrashDetail(exact.n);
        else alert(`Đã quét được: "${decodedText}". Đang tìm kiếm kết quả tương ứng...`);
    }
}

window.stopQRScanner = () => {
    const modal = document.getElementById('qr-scanner-modal');
    if(modal) modal.style.display = 'none';
    if(qrScanner) {
        qrScanner.clear().then(() => { qrScanner = null; }).catch(err => console.error(err));
    }
}

// --- QR GENERATOR LOGIC ---
window.createTrashQR = () => {
    if(!currentTrashItem) return;
    const modal = document.getElementById('qr-gen-modal');
    const container = document.getElementById('qr-code-display');
    const nameEl = document.getElementById('qr-trash-name');
    
    container.innerHTML = ""; // Clear old QR
    nameEl.innerText = currentTrashItem.n;
    
    // Generate QR
    new QRCode(container, {
        text: currentTrashItem.n,
        width: 200,
        height: 200,
        colorDark : "#2e7d32",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
    
    modal.style.display = 'flex';
}

window.downloadQRLabel = () => {
    const qrCanvas = document.querySelector('#qr-code-display canvas') || document.querySelector('#qr-code-display img');
    if(!qrCanvas) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 400;
    const height = 500;
    
    canvas.width = width; canvas.height = height;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#2e7d32"; ctx.lineWidth = 10; ctx.strokeRect(0, 0, width, height);
    
    ctx.fillStyle = "#2e7d32"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center"; ctx.fillText("QUÉT ĐỂ TRA CỨU", width/2, 50);
    ctx.drawImage(qrCanvas, (width-250)/2, 80, 250, 250);
    ctx.fillStyle = "#000"; ctx.font = "bold 40px Arial"; ctx.fillText(currentTrashItem.n.toUpperCase(), width/2, 380);
    ctx.fillStyle = "#666"; ctx.font = "italic 20px Arial"; ctx.fillText("Green School - A2K41", width/2, 430);
    
    const link = document.createElement('a'); link.download = `QR_${currentTrashItem.n}.png`; link.href = canvas.toDataURL(); link.click();
}

let trashItemsCache = [];
window.loadTrashStats = () => {
    const q = query(collection(db, 'gallery'), where('type', '==', 'trash'));
    onSnapshot(q, (snap) => {
        trashItemsCache = [];
        let counts = { 'Tái chế': 0, 'Hữu cơ': 0, 'Rác còn lại': 0 };
        
        snap.forEach(d => {
            const data = {id: d.id, ...d.data()};
            trashItemsCache.push(data);
            if(data.trashCategory && counts[data.trashCategory] !== undefined) {
                counts[data.trashCategory]++;
            } else {
                counts['Rác còn lại']++; // Mặc định nếu chưa phân loại
            }
        });

        const elRecycle = document.getElementById('count-recycle'); if(elRecycle) elRecycle.innerText = `${counts['Tái chế']} ảnh`;
        const elOrganic = document.getElementById('count-organic'); if(elOrganic) elOrganic.innerText = `${counts['Hữu cơ']} ảnh`;
        const elOther = document.getElementById('count-other'); if(elOther) elOther.innerText = `${counts['Rác còn lại']} ảnh`;
    });
}

window.filterTrashView = (category) => {
    document.getElementById('trash-categories').style.display = 'none';
    document.getElementById('trash-gallery-container').style.display = 'block';
    document.getElementById('trash-view-title').innerText = `Danh sách: ${category}`;
    
    const grid = document.getElementById('trash-dynamic-grid'); grid.innerHTML = "";
    const items = trashItemsCache.filter(i => i.trashCategory === category || (category === 'Rác còn lại' && !i.trashCategory));
    
    items.forEach(d => {
        grid.innerHTML += `<div class="gallery-item" onclick="openLightbox('gallery','${d.id}', 'reference')"><div class="gallery-img-container"><img src="${optimizeUrl(d.url, 200)}" class="gallery-img lazy-blur" data-src="${optimizeUrl(d.url, 400)}"></div><div class="gallery-info"><div class="gallery-title">${d.desc}</div></div></div>`;
    });
    if(items.length === 0) grid.innerHTML = "<p style='text-align:center; width:100%'>Chưa có ảnh nào trong mục này.</p>";
    lazyLoadImages(); // Kích hoạt lazy load cho ảnh mới
}
window.resetTrashView = () => { document.getElementById('trash-categories').style.display = 'flex'; document.getElementById('trash-gallery-container').style.display = 'none'; }
window.addEventListener('load', loadTrashStats); // Tải thống kê khi vào web

document.getElementById('daily-tip').innerText = ["Tắt đèn khi ra khỏi lớp.", "Trồng thêm cây xanh.", "Phân loại rác."][Math.floor(Math.random()*3)];
const mainLoginBtn = document.getElementById('main-login-btn'); if(mainLoginBtn) { mainLoginBtn.addEventListener('click', () => { console.log("Login clicked"); signInWithPopup(auth, provider); }); }

let deferredPrompt; const pcMenu = document.querySelector('nav.pc-nav ul'); const installLi = document.createElement('li'); installLi.innerHTML = '<a id="btn-install-pc" style="display:none; color:yellow; cursor:pointer"><i class="fas fa-download"></i> Tải App</a>'; pcMenu.appendChild(installLi); 

// PWA Install Button for Sidebar
window.addEventListener('beforeinstallprompt', (e) => { 
    e.preventDefault(); 
    deferredPrompt = e; 
    const btnPc = document.getElementById('btn-install-pc');
    if (btnPc) btnPc.style.display = 'inline-block';
    // Safely update mobile button if it exists
    const btnMob = document.getElementById('btn-install-mob');
    if (btnMob) btnMob.style.display = 'flex';
});
async function installPWA() { 
    if (!deferredPrompt) return; 
    deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; deferredPrompt = null; 
    if (document.getElementById('btn-install-pc')) document.getElementById('btn-install-pc').style.display = 'none'; 
    if (document.getElementById('btn-install-mob')) document.getElementById('btn-install-mob').style.display = 'none'; 
}
document.getElementById('btn-install-pc').addEventListener('click', installPWA);
// The listener for btn-install-mob is added dynamically in loadMobileSidebar, so we remove the global one.
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').then(reg => console.log('SW Registered!', reg)).catch(err => console.log('SW Error:', err)); }); }

window.toggleMobileMenu = () => {
    if (!isSidebarLoaded) loadMobileSidebar(); // Lazy load nếu chưa có
    const sb = document.getElementById('mobile-sidebar');
    const ov = document.querySelector('.mobile-sidebar-overlay');
    if(sb) sb.classList.toggle('active');
    if(ov) ov.classList.toggle('active');
    document.body.classList.toggle('no-scroll');
}

// --- LAZY LOAD SIDEBAR FUNCTIONS ---
function loadMobileSidebar() {
    const sb = document.getElementById('mobile-sidebar');
    if (!sb) return;
    
    sb.innerHTML = `
        <div class="sidebar-header">
            <div class="sidebar-profile" id="sidebar-profile-box" style="display:none" onclick="showPage('profile'); toggleMobileMenu()">
                <img id="sb-avatar" src="" onerror="this.src='https://lh3.googleusercontent.com/a/default-user=s96-c'">
                <div class="sb-info">
                    <div id="sb-name">Name</div>
                    <div id="sb-id">@id</div>
                </div>
            </div>
            <h3 id="sb-default-title">Menu</h3>
            <button class="sidebar-close" onclick="toggleMobileMenu()"><i class="fas fa-times"></i></button>
        </div>
        <div class="sidebar-content">
            <a href="#home" id="sidebar-home" class="sidebar-item" onclick="showPage('home'); toggleMobileMenu()"><i class="fas fa-home"></i> Trang Chủ</a>
            <a href="#greenclass" id="sidebar-greenclass" class="sidebar-item" onclick="showPage('greenclass'); toggleMobileMenu()"><i class="fas fa-leaf"></i> Góc Xanh</a>
            <a href="#contest" id="sidebar-contest" class="sidebar-item" onclick="showPage('contest'); toggleMobileMenu()"><i class="fas fa-trophy"></i> Thi Đua</a>
            <a href="#activities" id="sidebar-activities" class="sidebar-item" onclick="showPage('activities'); toggleMobileMenu()"><i class="fas fa-calendar-alt"></i> Hoạt Động</a>
            <a href="#guide" id="sidebar-guide" class="sidebar-item" onclick="showPage('guide'); toggleMobileMenu()"><i class="fas fa-search"></i> Tra Cứu</a>
            <a href="#archive" id="sidebar-archive" class="sidebar-item" onclick="showPage('archive'); toggleMobileMenu()"><i class="fas fa-box"></i> Lưu Trữ</a>
            <a href="#profile" id="sidebar-profile" class="sidebar-item" onclick="showPage('profile'); toggleMobileMenu()"><i class="fas fa-user"></i> Tài Khoản</a>
            <a href="#admin" id="sidebar-admin" class="sidebar-item" style="display:none; color:var(--danger)"><i class="fas fa-cogs"></i> Admin</a>
            <div id="sidebar-install-area"></div>
        </div>`;

    isSidebarLoaded = true;
    updateSidebarUI(); // Cập nhật thông tin user ngay sau khi render

    // Highlight menu hiện tại
    const hash = window.location.hash.slice(1) || 'home';
    const activeItem = document.getElementById('sidebar-'+hash);
    if(activeItem) activeItem.classList.add('active-menu');

    // Xử lý nút cài đặt PWA (Dynamic)
    const sidebarInstallArea = document.getElementById('sidebar-install-area');
    if(sidebarInstallArea) {
        const installMob = document.createElement('a'); 
        installMob.className = 'sidebar-item'; 
        installMob.id = 'btn-install-mob'; 
        installMob.style.display = deferredPrompt ? 'flex' : 'none'; 
        installMob.innerHTML = '<i class="fas fa-download"></i> Tải App Về Máy'; 
        installMob.style.color = '#ffca28'; 
        installMob.style.cursor = 'pointer';
        installMob.addEventListener('click', installPWA);
        sidebarInstallArea.appendChild(installMob);
    }
}

function updateSidebarUI() {
    const sbProfile = document.getElementById('sidebar-profile-box');
    if (!sbProfile) return; // Sidebar chưa load thì bỏ qua

    if (currentUser) {
        sbProfile.style.display = 'flex';
        document.getElementById('sb-default-title').style.display = 'none';
        document.getElementById('sb-avatar').src = currentUser.photoURL || 'https://lh3.googleusercontent.com/a/default-user=s96-c';
        document.getElementById('sb-name').innerText = currentUser.displayName;
        document.getElementById('sb-id').innerText = currentUser.customID || "@...";
        
        const sbAdmin = document.getElementById('sidebar-admin');
        if(sbAdmin) sbAdmin.style.display = isAdmin(currentUser.email) ? 'flex' : 'none';
    } else {
        sbProfile.style.display = 'none';
        document.getElementById('sb-default-title').style.display = 'block';
        const sbAdmin = document.getElementById('sidebar-admin');
        if(sbAdmin) sbAdmin.style.display = 'none';
    }
}

// --- SEASONAL EFFECT LOGIC ---
// Hiệu ứng theo mùa (Tuyết rơi, Lá rơi...)
let effectCtx, effectCanvas, effectParticles = [], effectAnimationId;
let effectConfig = { active: true, type: 'snow', img: new Image() };

window.initSeasonalEffect = () => {
    const mode = localStorage.getItem('seasonal_mode') || 'auto';
    const canvas = document.getElementById('seasonal-canvas');
    const icon = document.getElementById('effect-icon');
    
    if (mode === 'off') { 
        effectConfig.active = false; 
        canvas.style.display = 'none'; 
        icon.className = 'fas fa-ban'; 
        if(effectAnimationId) cancelAnimationFrame(effectAnimationId);
        effectAnimationId = null;
        return; 
    }

    effectConfig.active = true;
    canvas.style.display = 'block';
    
    let type = 'snow';
    if (mode === 'auto') {
        const month = new Date().getMonth() + 1;
        if (month >= 2 && month <= 4) type = 'spring';
        else if (month >= 5 && month <= 7) type = 'summer';
        else if (month >= 8 && month <= 10) type = 'autumn';
        else type = 'winter';
    } else { type = mode; }

    // Cập nhật ảnh và icon theo mùa
    if (type === 'spring') { effectConfig.img.src = 'https://cdn-icons-png.flaticon.com/512/5904/5904292.png'; icon.className = 'fas fa-seedling'; } // Hoa đào hồng
    else if (type === 'summer') { effectConfig.img.src = 'https://cdn-icons-png.flaticon.com/512/403/403543.png'; icon.className = 'fas fa-leaf'; } // Lá xanh tươi
    else if (type === 'autumn') { effectConfig.img.src = 'https://cdn-icons-png.flaticon.com/512/2913/2913520.png'; icon.className = 'fab fa-canadian-maple-leaf'; } // Lá phong cam
    else { effectConfig.img.src = 'https://cdn-icons-png.flaticon.com/512/642/642000.png'; icon.className = 'fas fa-snowflake'; } // Tuyết tinh thể

    effectCanvas = document.getElementById('seasonal-canvas');
    effectCtx = effectCanvas.getContext('2d');
    
    if (!effectAnimationId) {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        createParticles();
        animateEffect();
    }
}

function resizeCanvas() { effectCanvas.width = window.innerWidth; effectCanvas.height = window.innerHeight; }

function createParticles() {
    effectParticles = [];
    const count = window.innerWidth < 768 ? 20 : 35; // Giảm số lượng vì ảnh nặng hơn nét vẽ
    for (let i = 0; i < count; i++) {
        effectParticles.push({
            x: Math.random() * effectCanvas.width, y: Math.random() * effectCanvas.height,
            size: Math.random() * 15 + 15, // Kích thước 15px - 30px để nhìn rõ ảnh
            d: Math.random() * count,
            speed: Math.random() * 1 + 1, // Rơi nhanh hơn xíu cho tự nhiên
            swing: Math.random() * 2,
            rotation: Math.random() * 360, // Góc xoay ban đầu
            rotationSpeed: Math.random() * 2 - 1 // Tốc độ xoay (-1 đến 1 độ mỗi khung hình)
        });
    }
}

function animateEffect() {
    if (!effectConfig.active) return;
    effectCtx.clearRect(0, 0, effectCanvas.width, effectCanvas.height);
    
    if (effectConfig.img.complete) { // Chỉ vẽ khi ảnh đã tải xong
        for (let i = 0; i < effectParticles.length; i++) {
            const p = effectParticles[i];
            
            // Lưu trạng thái canvas, dịch chuyển tới tâm hạt, xoay, vẽ, rồi khôi phục
            effectCtx.save();
            effectCtx.translate(p.x + p.size/2, p.y + p.size/2);
            effectCtx.rotate(p.rotation * Math.PI / 180);
            effectCtx.drawImage(effectConfig.img, -p.size/2, -p.size/2, p.size, p.size);
            effectCtx.restore();
            
            p.y += p.speed; p.x += Math.sin(p.d) * 0.5; p.d += 0.02; 
            p.rotation += p.rotationSpeed; // Cập nhật góc xoay
            if (p.y > effectCanvas.height) { p.y = -40; p.x = Math.random() * effectCanvas.width; } 
        }
    }
    effectAnimationId = requestAnimationFrame(animateEffect);
}

let fabTimer;
window.toggleFabGroup = () => {
    const g = document.getElementById('fab-group');
    const b = document.querySelector('.fab-main-btn');
    g.classList.toggle('open');
    b.classList.toggle('active');
    document.getElementById('effect-menu').classList.remove('active'); 

    if(fabTimer) clearTimeout(fabTimer);
    if(g.classList.contains('open')) {
        fabTimer = setTimeout(() => {
            g.classList.remove('open');
            b.classList.remove('active');
        }, 5000);
    }
}

// Reset timer on interaction
const fabGroupEl = document.getElementById('fab-group');
if(fabGroupEl) {
    fabGroupEl.addEventListener('click', () => {
        if(fabTimer) clearTimeout(fabTimer);
        if(fabGroupEl.classList.contains('open')) {
            fabTimer = setTimeout(() => {
                fabGroupEl.classList.remove('open');
                document.querySelector('.fab-main-btn').classList.remove('active');
            }, 5000);
        }
    });
}

window.toggleSeasonalMenu = () => { document.getElementById('effect-menu').classList.toggle('active'); }

window.setEffectMode = (mode) => {
    localStorage.setItem('seasonal_mode', mode);
    document.getElementById('effect-menu').classList.remove('active');
    gameScore = 0; // Reset điểm khi đổi mùa
    const scoreEl = document.getElementById('seasonal-score');
    if(scoreEl) scoreEl.style.display = 'none';
    initSeasonalEffect();
}

// --- SEASONAL GAME LOGIC (HỨNG QUÀ) ---
// Mini game hứng vật phẩm rơi trên màn hình
let gameScore = 0;
window.addEventListener('pointerdown', (e) => {
    // Chỉ chơi khi: Hiệu ứng bật, Canvas đã tải, và đang ở Trang Chủ
    if (!effectConfig.active || !effectCanvas || !document.getElementById('home').classList.contains('active')) return;
    
    const rect = effectCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    for (let i = 0; i < effectParticles.length; i++) {
        const p = effectParticles[i];
        // Tính khoảng cách từ điểm click đến tâm hạt
        const centerX = p.x + p.size / 2;
        const centerY = p.y + p.size / 2;
        const dist = Math.sqrt((clickX - centerX) ** 2 + (clickY - centerY) ** 2);
        
        // Hitbox rộng hơn kích thước hạt 1.2 lần để dễ bấm trên điện thoại
        if (dist < p.size * 1.2) { 
            gameScore++;
            updateScoreDisplay();
            showFloatingText(e.clientX, e.clientY, "+1");
            
            // Reset hạt lên trên cùng (coi như đã hứng xong)
            p.y = -50;
            p.x = Math.random() * effectCanvas.width;
            break; // Chỉ hứng 1 hạt mỗi lần click
        }
    }
});

function updateScoreDisplay() {
    let el = document.getElementById('seasonal-score');
    if (!el) {
        el = document.createElement('div');
        el.id = 'seasonal-score';
        document.body.appendChild(el);
    }
    el.style.display = 'block';
    el.innerHTML = `<i class="fas fa-star" style="color:#fbc02d"></i> Điểm: ${gameScore}`;
}

function showFloatingText(x, y, text) {
    const el = document.createElement('div');
    el.className = 'floating-score';
    el.innerText = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

// --- HÀM CỨU HỘ DỮ LIỆU (CHẠY 1 LẦN) ---
// Công cụ sửa lỗi dữ liệu cũ (Admin Tool)
window.fixOldData = async () => {
    if(!currentUser || !isAdmin(currentUser.email)) return alert("Cần quyền Admin!");

    // BƯỚC 1: Quét kiểm tra trước (Không sửa ngay)
    Utils.loader(true, "Đang quét dữ liệu cũ...");
    const cols = ['gallery', 'contest'];
    let docsToFix = [];

    for (const colName of cols) {
        const q = query(collection(db, colName)); 
        const snap = await getDocs(q);
        
        snap.forEach(d => {
            const data = d.data();
            // Chỉ ghi nhận những ảnh THIẾU trường archived
            if (data.archived === undefined) {
                docsToFix.push({ col: colName, id: d.id });
            }
        });
    }
    
    Utils.loader(false);

    // BƯỚC 2: Báo cáo số lượng và hỏi xác nhận
    if(docsToFix.length === 0) return alert("✅ Dữ liệu sạch! Không có ảnh nào bị ẩn.");

    const confirmFix = confirm(`⚠️ Tìm thấy ${docsToFix.length} ảnh cũ đang bị ẩn do cập nhật mới.\n\nBạn có muốn hiển thị lại chúng không?\n(Yên tâm: Ảnh đã xóa sẽ không quay lại).`);
    if(!confirmFix) return;

    // BƯỚC 3: Thực hiện sửa lỗi
    Utils.loader(true, `Đang khôi phục ${docsToFix.length} ảnh...`);
    const updates = docsToFix.map(item => updateDoc(doc(db, item.col, item.id), { archived: false }));
    
    await Promise.all(updates);
    
    Utils.loader(false);
    alert(`✅ Đã khôi phục ${docsToFix.length} ảnh thành công!\nHãy tải lại trang.`);
    location.reload();
}

// --- GEMINI LIVE API (HYBRID MODE: STT -> API -> TTS) ---
// Chế độ hội thoại trực tiếp với AI (Giọng nói)
let isLiveMode = false;
let currentRecognition = null;

window.toggleGeminiLive = () => {
    const btn = document.getElementById('btn-live-mode');
    
    if (isLiveMode) {
        // TẮT LIVE
        isLiveMode = false;
        window.speechSynthesis.cancel(); // Dừng đọc ngay lập tức
        if (currentRecognition) {
            try { currentRecognition.stop(); } catch(e){}
        }
        
        if(btn) {
            btn.classList.remove('listening');
            btn.innerHTML = '<i class="fas fa-broadcast-tower"></i>';
            btn.title = "Chế độ Live (Realtime)";
        }
        document.getElementById('ai-input').placeholder = "Hỏi Green Bot bất cứ điều gì...";
        
        // Ẩn giao diện Overlay
        const overlay = document.getElementById('gemini-live-overlay');
        if(overlay) overlay.style.display = 'none';
        
    } else {
        // BẬT LIVE
        isLiveMode = true;
        
        if(btn) {
            btn.classList.add('listening');
            btn.innerHTML = '<i class="fas fa-stop"></i>';
            btn.title = "Dừng Live";
        }
        
        // Hiển thị giao diện Overlay
        const overlay = document.getElementById('gemini-live-overlay');
        if(overlay) {
            overlay.style.display = 'flex';
            // Reset trạng thái UI
            updateLiveStatus("Đang khởi động...");
        }

        // Tự động chào người dùng bằng giọng nói
        const name = currentUser ? currentUser.displayName.split(' ').pop() : "bạn";
        const greeting = `Chào ${name}, tớ có thể giúp gì cho cậu?`;

        updateLiveStatus("Green Bot đang nói...");
        speakText(greeting, () => {
            if (isLiveMode) runLiveLoop();
        });
    }
}

window.stopGeminiLive = () => {
    if (isLiveMode) window.toggleGeminiLive();
    else {
        const overlay = document.getElementById('gemini-live-overlay');
        if(overlay) overlay.style.display = 'none';
    }
}

window.interruptGemini = () => {
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel(); // Ngắt giọng đọc -> onEnd sẽ kích hoạt runLiveLoop lại
    }
}

async function runLiveLoop() {
    if (!isLiveMode) return;

    updateLiveStatus("Đang nghe bạn nói...");
    let hasSpeech = false;

    currentRecognition = listenOnce(
        // B1: Khi có kết quả giọng nói
        async (text) => {
            hasSpeech = true;
            if (!isLiveMode) return;

            updateLiveStatus("Đang suy nghĩ...");
            document.getElementById('ai-input').value = text; // Hiển thị text để user biết

            try {
                // B2: Gọi API Gemini (dùng model 'voice' hoặc 'main')
                const response = await callGeminiAPI(text, null, true, 'voice', aiKeys, chatHistory);
                
                if (!isLiveMode) return;

                updateLiveStatus("Green Bot đang nói...");
                
                // B3: Đọc phản hồi
                speakText(response, () => {
                    // B4: Đọc xong -> Tự động lặp lại vòng nghe
                    if (isLiveMode) runLiveLoop();
                });

            } catch (e) {
                console.error("Lỗi Live Loop:", e);
                speakText("Xin lỗi, mình gặp chút trục trặc.", () => {
                    if (isLiveMode) runLiveLoop();
                });
            }
        },
        // Khi kết thúc phiên nghe (onEnd)
        () => {
            // Nếu kết thúc mà không có giọng nói (im lặng) -> Tự động nghe lại
            if (!hasSpeech && isLiveMode) {
                setTimeout(() => runLiveLoop(), 500);
            }
        }
    );
}

function updateLiveStatus(text) {
    const el = document.getElementById('live-status');
    if(el) el.innerText = text;
    const input = document.getElementById('ai-input');
    if(input) input.placeholder = text;
    
    // Điều khiển hiển thị giữa Canvas (chờ) và Visualizer (nói)
    const canvas = document.getElementById('live-canvas');
    const visualizer = document.getElementById('live-visualizer-css');
    const interruptBtn = document.getElementById('btn-live-interrupt');

    if (text === "Green Bot đang nói...") {
        if (canvas) canvas.style.display = 'none';
        if (visualizer) visualizer.classList.add('speaking');
        if (interruptBtn) interruptBtn.style.display = 'flex';
    } else {
        if (visualizer) visualizer.classList.remove('speaking');
        if (interruptBtn) interruptBtn.style.display = 'none';
        if (canvas) {
            canvas.style.display = 'block';
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = "20px Arial";
            ctx.fillStyle = "#2e7d32";
            ctx.textAlign = "center";
            ctx.fillText("🎙️ Hybrid Live Mode", canvas.width/2, canvas.height/2);
        }
    }
}

// Tự động thêm nút Live vào giao diện Chatbot
window.addEventListener('load', () => {
    // Tạm ẩn tính năng Live Chat để phát triển sau
    /*
    setTimeout(() => {
        const area = document.querySelector('.ai-input-area');
        const mic = document.getElementById('btn-mic');
        if (area && mic && !document.getElementById('btn-live-mode')) {
            const btn = document.createElement('button');
            btn.id = 'btn-live-mode';
            btn.className = 'btn-ai-send';
            btn.innerHTML = '<i class="fas fa-broadcast-tower"></i>';
            btn.onclick = window.toggleGeminiLive;
            btn.style.marginRight = '5px';
            btn.title = "Chế độ Live (Realtime)";
            area.insertBefore(btn, mic);
        }
    }, 1500);
    */

    // --- LOGIC KÉO GIÃN KHUNG CHAT (RESIZABLE) ---
    const chatWindow = document.getElementById('ai-window');
    if (chatWindow) {
        const handles = chatWindow.querySelectorAll('.resize-handle');
        let startX, startY, startWidth, startHeight;

        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startX = e.clientX;
                startY = e.clientY;
                startWidth = parseInt(document.defaultView.getComputedStyle(chatWindow).width, 10);
                startHeight = parseInt(document.defaultView.getComputedStyle(chatWindow).height, 10);

                const onMouseMove = (e) => {
                    if (handle.classList.contains('resize-left') || handle.classList.contains('resize-corner')) {
                        chatWindow.style.width = (startWidth + startX - e.clientX) + 'px';
                    }
                    if (handle.classList.contains('resize-top') || handle.classList.contains('resize-corner')) {
                        chatWindow.style.height = (startHeight + startY - e.clientY) + 'px';
                    }
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    }
});
/*
    for (const colName of cols) {
        // Lấy tất cả ảnh (không dùng bộ lọc để tìm được ảnh cũ)
        const q = query(collection(db, colName)); 
        const snap = await getDocs(q);
        const updates = [];
        
        snap.forEach(d => {
            const data = d.data();
            // Nếu ảnh chưa có trường archived, thêm vào
            if (data.archived === undefined) {
                updates.push(updateDoc(doc(db, colName, d.id), { archived: false }));
            }
        });
        
        await Promise.all(updates);
        count += updates.length;
    }
    
    Utils.loader(false);
    alert(`✅ Đã khôi phục thành công ${count} ảnh cũ!\nHãy tải lại trang để kiểm tra.`);
    location.reload();
} 
*/

// Đóng popup hướng dẫn
window.closeGuidePopup = () => {
    document.getElementById('guide-popup').style.display = 'none';
    localStorage.setItem('seen_guide_v1', 'true');
}

// --- SWIPE SIDEBAR LOGIC ---
let sideTouchStartX = 0;
let sideTouchStartY = 0;

document.addEventListener('touchstart', (e) => {
    sideTouchStartX = e.changedTouches[0].clientX;
    sideTouchStartY = e.changedTouches[0].clientY;
}, {passive: true});

document.addEventListener('touchend', (e) => {
    const sideTouchEndX = e.changedTouches[0].clientX;
    const sideTouchEndY = e.changedTouches[0].clientY;
    handleSidebarSwipe(sideTouchStartX, sideTouchStartY, sideTouchEndX, sideTouchEndY);
}, {passive: true});

function handleSidebarSwipe(startX, startY, endX, endY) {
    const diffX = endX - startX;
    const diffY = endY - startY;
    const sb = document.getElementById('mobile-sidebar');
    
    // 1. Vuốt từ cạnh trái sang phải để MỞ (Start < 40px từ mép trái)
    if (startX < 40 && diffX > 70 && Math.abs(diffY) < 60) {
        if (sb && !sb.classList.contains('active')) toggleMobileMenu();
    }
    
    // 2. Vuốt từ phải sang trái để ĐÓNG (Khi menu đang mở)
    if (sb && sb.classList.contains('active')) {
        if (diffX < -70 && Math.abs(diffY) < 60) toggleMobileMenu();
    }
}
