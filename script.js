import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, where, increment, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIG
const firebaseConfig = { apiKey: "AIzaSyCJ_XI_fq-yJC909jb9KLIKg3AfGdm6hNs", authDomain: "a2k41nvc-36b0b.firebaseapp.com", projectId: "a2k41nvc-36b0b", storageBucket: "a2k41nvc-36b0b.firebasestorage.app", messagingSenderId: "279516631226", appId: "1:279516631226:web:99012883ed7923ab5c3283" };
const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app); const provider = new GoogleAuthProvider();
const CLOUD_NAME = "dekxvneap"; const UPLOAD_PRESET = "a2k41nvc_upload"; const ADMIN_EMAILS = ["kiet0905478167@gmail.com", "anhkiet119209@gmail.com"];
let dynamicAdminEmails = [...ADMIN_EMAILS]; // Sử dụng biến động cho Admin

// KHO ẢNH MINH HỌA CHO BOT
const BOT_IMAGES = {
    "logo": "https://placehold.co/300x200/2e7d32/ffffff.png?text=Green+School",
    "rac_thai": "https://cdn-icons-png.flaticon.com/512/3299/3299935.png",
    "trong_cay": "https://cdn-icons-png.flaticon.com/512/628/628283.png",
    "phan_loai": "https://cdn-icons-png.flaticon.com/512/8634/8634075.png",
    "admin": "https://cdn-icons-png.flaticon.com/512/2942/2942813.png"
};

let currentUser=null, currentCollection='gallery', currentImgId=null, currentImgCollection=null, activeArchiveTab='gallery', musicId='jfKfPfyJRdk';
let pinnedSettings = null, latestGalleryDocs = [], lastTopPostId = null; // Biến lưu trạng thái ghim và danh sách ảnh
let adminUsersCache = []; // Cache danh sách thành viên cho Admin
let adminPage = 1;
const adminItemsPerPage = 10;
let adminSortField = 'displayName';
let adminSortOrder = 'asc';
const PAGE_SIZE = 12;
const gridLimits = { gallery: PAGE_SIZE, contest: PAGE_SIZE };
const gridParams = {};

// Multi-Key AI Logic (FAIL-OVER)
let aiKeys = [{name: "Mặc định", val: "AIzaSyAnOwbqmpQcOu_ERINF4nSfEL4ZW95fiGc"}]; 

// --- CHAT HISTORY (MEMORY) ---
let chatHistory = [];

const BASE_SYSTEM_PROMPT = `
NHẬP VAI:
Bạn là **Green Bot** 🤖 - Trợ lý AI siêu cấp vip pro của trường THPT **Nguyễn Văn Cừ** và dự án **Green School**.
- Tính cách: Thân thiện, hài hước, năng động (Gen Z), hay dùng emoji (🌱, 🌿, ✨, 😂, 🥰).
- Xưng hô: 'Tớ' (Green Bot) và 'Cậu' (Người dùng).
- Nhiệm vụ: Hỗ trợ giải đáp thắc mắc về website, hướng dẫn phân loại rác, và trò chuyện vui vẻ.

KIẾN THỨC VỀ WEBSITE (Cần nhớ kỹ):
1. 🏠 **Trang Chủ (Home)**: Xem thông báo mới, bảng xếp hạng thi đua, và ảnh "Top 1 Trending".
2. 📸 **Góc Xanh (Green Class)**: Nơi đăng ảnh hoạt động môi trường (trồng cây, dọn rác). Đặc biệt có nút **"AI Soi Rác"** để nhận diện rác tự động.
3. 🏆 **Thi Đua (Contest)**: Nơi các tổ nộp minh chứng thành tích để cộng điểm.
4. 📂 **Lưu Trữ (Archive)**: Kho ảnh kỷ niệm của các mùa trước.
5. 📅 **Hoạt Động (Activities)**: Lịch sự kiện (Đổi giấy lấy cây, Tình nguyện...).
6. 🔍 **Tra Cứu (Guide)**: Từ điển rác (Vỏ sữa, pin, nhựa...).
7. 👤 **Tài Khoản (Profile)**: Đổi avatar, tên hiển thị, xem lớp.

HƯỚNG DẪN TRẢ LỜI:
- **QUAN TRỌNG**: Khi nhắc đến các tính năng chính, từ khóa quan trọng hoặc tên mục (ví dụ: **AI Soi Rác**, **Góc Xanh**, **Thi Đua**...), hãy **in đậm** chúng bằng dấu **...**.
- Nếu từ khóa đó quan trọng, hãy giải thích ngắn gọn công dụng hoặc lợi ích của nó ngay sau đó để người dùng hiểu rõ hơn.
- Dùng *in nghiêng* cho các lưu ý nhỏ hoặc tên riêng.
- **Hỏi cách đăng ảnh**: "Cậu vào mục **Góc Xanh** hoặc **Thi Đua**, bấm nút Camera 📷 màu xanh lá to đùng nhé!"
- **Hỏi về phân loại rác**: "Cậu thử tính năng **AI Soi Rác** ở mục **Góc Xanh** xem, nó giúp nhận diện rác bằng AI đấy! Hoặc vào mục **Tra Cứu** để xem danh sách nhé!"
- **Hỏi Admin là ai**: "Là bạn **Kiệt đẹp trai** (Admin_xinhxinh) chứ ai! 😎"
- **Nếu không biết câu trả lời**: "Câu này khó quá, tớ chưa được học. Cậu hỏi Admin thử xem sao? 😅"
- **Luôn trả lời ngắn gọn, súc tích nhưng đầy đủ thông tin.**
- **CUỐI CÙNG**: Hãy gợi ý 3 câu hỏi ngắn gọn liên quan mà người dùng có thể hỏi tiếp theo.
- **HÌNH ẢNH**: Nếu nội dung cần minh họa, hãy thêm mã {{IMAGE:keyword}} vào cuối câu.
  (Keyword hỗ trợ: logo, rac_thai, trong_cay, phan_loai, admin).
- Định dạng trả về: [Nội dung trả lời] ---SUGGESTIONS--- [Gợi ý 1] | [Gợi ý 2] | [Gợi ý 3]
`;

const getSystemPrompt = () => {
    let p = BASE_SYSTEM_PROMPT;
    if(currentUser) {
        const role = (typeof isAdmin === 'function' && isAdmin(currentUser.email)) ? "Quản trị viên (Admin)" : "Thành viên";
        p += `\n\n--- THÔNG TIN NGƯỜI DÙNG HIỆN TẠI ---\n- Tên: ${currentUser.displayName}\n- Email: ${currentUser.email}\n- ID: ${currentUser.customID}\n- Lớp: ${currentUser.class}\n- Vai trò: ${role}\n\n--- CHỈ DẪN GIAO TIẾP ---\n1. Hãy xưng hô bằng tên "${currentUser.displayName}" để thân thiện.\n2. Nếu họ hỏi về lớp, hãy nhắc đến lớp "${currentUser.class}".\n3. Ghi nhớ thông tin này trong suốt cuộc trò chuyện.`;
    } else {
        p += `\n\n--- TRẠNG THÁI NGƯỜI DÙNG ---\nNgười dùng chưa đăng nhập (Khách). Hãy khuyến khích họ đăng nhập để lưu dữ liệu.`;
    }
    return p;
};

window.refreshChatContext = () => {
    chatHistory = [{ role: "user", parts: [{ text: getSystemPrompt() }] }, { role: "model", parts: [{ text: "Okie, tớ đã cập nhật thông tin người dùng! Sẵn sàng hỗ trợ! 🌱" }] }];
};
window.refreshChatContext();

let googleSheetUrl = "https://script.google.com/macros/s/AKfycbzilw2SHG74sfCGNktGLuo46xkLNzVSVl6T3HbjXoWAsm9_CmXmuZQmbDxIOJ5cRhyX/exec"; 
const isAdmin=(e)=>dynamicAdminEmails.includes(e);
const State = { unsubscribes: {} };

// --- UTILS ---
const Utils = {
    loader: (show, text="Đang xử lý...") => {
        document.getElementById('upload-overlay').style.display = show ? 'flex' : 'none';
        document.getElementById('upload-loading-text').innerText = text;
    },
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// --- DARK MODE LOGIC (NEW) ---
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    const icon = document.getElementById('dark-icon');
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

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
});

// --- PULL TO REFRESH LOGIC ---
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
        content.innerText = text;
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

// --- PERSONAL NOTIFICATIONS ---
let notifUnsub = null;
function listenToMyNotifications(uid) {
    if (notifUnsub) notifUnsub(); 
    const q = query(collection(db, "notifications"), where("recipientUid", "==", uid), limit(50));
    notifUnsub = onSnapshot(q, (snap) => {
        const list = document.getElementById('notif-list-ui');
        const dot = document.getElementById('nav-bell-dot');
        let unreadCount = 0; let html = ""; let notifs = [];
        if (snap.empty) {
            list.innerHTML = '<div class="empty-notif">Chưa có thông báo nào</div>';
            dot.style.display = 'none'; return;
        }
        snap.forEach(d => { notifs.push({ id: d.id, ...d.data() }); });
        notifs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        notifs.forEach(data => {
            if (!data.isRead) unreadCount++;
            html += `<div class="notif-item ${data.isRead ? '' : 'unread'}" onclick="clickNotification('${data.id}', '${data.collectionRef}', '${data.link}')"><img src="${data.senderAvatar || 'https://via.placeholder.com/30'}" class="notif-avatar"><div class="notif-body"><p>${data.message}</p><span class="notif-time">${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString('vi-VN') : 'Vừa xong'}</span></div></div>`;
        });
        list.innerHTML = html;
        dot.style.display = unreadCount > 0 ? 'block' : 'none';
    });
}

async function pushNotification(recipientId, type, message, linkId, colRef) {
    if (!currentUser || recipientId === currentUser.uid) return; 
    try {
        await addDoc(collection(db, "notifications"), { recipientUid: recipientId, senderName: currentUser.displayName, senderAvatar: currentUser.photoURL, type: type, message: message, link: linkId, collectionRef: colRef, isRead: false, createdAt: serverTimestamp() });
    } catch (e) { console.error("Lỗi gửi thông báo:", e); }
}

window.clickNotification = async (notifId, col, postId) => {
    await updateDoc(doc(db, "notifications", notifId), { isRead: true });
    if(col && postId && col !== 'undefined') window.openLightbox(col, postId);
    document.getElementById('notif-dropdown').classList.remove('active');
}

window.toggleNotifDropdown = () => { document.getElementById('notif-dropdown').classList.toggle('active'); }
window.markAllRead = async () => {
   const list = document.querySelectorAll('.notif-item.unread');
   list.forEach(item => item.classList.remove('unread'));
   document.getElementById('nav-bell-dot').style.display='none';
}

// --- GREETING LOGIC ---
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
async function callGeminiAPI(prompt, imageBase64 = null) {
    let requestContents = [];
    if (imageBase64) {
        requestContents = [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }] }];
    } else {
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        requestContents = chatHistory;
    }
    for (let i = 0; i < aiKeys.length; i++) {
        const keyObj = aiKeys[i];
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keyObj.val}`;
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: requestContents }) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI không phản hồi.";
            if (!imageBase64) {
                chatHistory.push({ role: "model", parts: [{ text: aiText }] });
                if (chatHistory.length > 20) chatHistory = chatHistory.slice(chatHistory.length - 20);
            }
            return aiText;
        } catch (e) { if (i === aiKeys.length - 1) return "Tất cả Key AI đều bận hoặc lỗi."; }
    }
}

window.testAIConnection = async () => {
    const btn = document.querySelector('.btn-ai'); const originalText = btn.innerText; btn.innerText = "Đang test...";
    try { const result = await callGeminiAPI("Chào Green Bot!"); alert("✅ Kết nối AI thành công!\nTrả lời: " + result); } catch(e) { alert("❌ Lỗi: " + e.message); }
    btn.innerText = originalText;
}

window.addAIKey = async () => {
    const name = document.getElementById('new-key-name').value.trim(); const val = document.getElementById('new-key-val').value.trim();
    if(!name || !val) return alert("Nhập đủ tên và Key!");
    await updateDoc(doc(db, "settings", "config"), { aiKeys: arrayUnion({name, val}) });
    document.getElementById('new-key-name').value = ""; document.getElementById('new-key-val').value = ""; alert("Đã thêm Key mới!");
}

window.removeAIKey = async (name, val) => { if(confirm(`Xóa Key "${name}"?`)) { await updateDoc(doc(db, "settings", "config"), { aiKeys: arrayRemove({name, val}) }); } }
window.toggleAIChat = () => { 
    document.getElementById('ai-window').classList.toggle('active'); 
}

window.fillChat = (text) => { document.getElementById('ai-input').value = text; window.sendMessageToAI(new Event('submit')); }

window.sendMessageToAI = async (e) => {
    e.preventDefault(); const input = document.getElementById('ai-input'); const msg = input.value; if(!msg) return;
    
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
    msgList.innerHTML += `<div class="chat-row user"><div class="chat-bubble user">${msg}</div></div>`; 
    input.value = ""; msgList.scrollTop = msgList.scrollHeight;
    const loadingId = "ai-loading-" + Date.now(); 
    
    // Hiệu ứng loading mới (Avatar + Dots)
    msgList.innerHTML += `<div class="chat-row bot"><div class="chat-avatar"><img src="https://cdn-icons-png.flaticon.com/512/8943/8943377.png"></div><div class="chat-content"><div class="chat-bubble bot" id="${loadingId}"><div class="ai-loading-dots"><span></span><span></span><span></span></div></div></div></div>`;
    msgList.scrollTop = msgList.scrollHeight;
    
    try { 
        // INJECT CONTEXT (Trang hiện tại)
        const currentPage = window.location.hash.slice(1) || 'home';
        const rawResponse = await callGeminiAPI(`[Ngữ cảnh: Đang xem trang '${currentPage}'] ${msg}`); 
        // Tách phần trả lời và phần gợi ý
        const parts = rawResponse.split('---SUGGESTIONS---');
        const mainAnswer = parts[0].trim();
        const suggestions = parts[1] ? parts[1].split('|') : [];

        const formatted = mainAnswer.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/(?:^|\n)[-*] (.*?)(?=\n|$)/g, '<div style="display:flex; align-items:flex-start; gap:6px; margin:4px 0;"><span style="color:var(--primary); font-weight:bold; flex-shrink:0; margin-top:2px;">•</span><span>$1</span></div>')
            .replace(/{{IMAGE:(.*?)}}/g, (match, key) => {
                const url = BOT_IMAGES[key.trim()];
                return url ? `<img src="${url}" style="max-width:150px; border-radius:10px; margin:10px 0; border:1px solid #eee; display:block;">` : "";
            })
            .replace(/\n/g, '<br>');
        await typeWriterEffect(document.getElementById(loadingId), formatted);

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

async function typeWriterEffect(element, html, speed = 10) {
    element.innerHTML = "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const nodes = Array.from(tempDiv.childNodes);
    for (const node of nodes) await typeNode(element, node, speed);
}

async function typeNode(parent, node, speed) {
    if (node.nodeType === Node.TEXT_NODE) {
        const textNode = document.createTextNode("");
        parent.appendChild(textNode);
        const text = node.textContent;
        for (let i = 0; i < text.length; i++) {
            textNode.nodeValue += text[i];
            const list = document.getElementById('ai-messages');
            if(list) list.scrollTop = list.scrollHeight;
            if(text[i] !== ' ') await new Promise(r => setTimeout(r, speed));
        }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node.cloneNode(false);
        parent.appendChild(el);
        if (node.tagName === 'BR') await new Promise(r => setTimeout(r, speed));
        for (const child of Array.from(node.childNodes)) await typeNode(el, child, speed);
    }
}

function fileToBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = error => reject(error); }); }

// --- YOUTUBE ID & MUSIC ---
function getYoutubeID(url) { const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/; const match = url.match(regExp); return (match && match[2].length === 11) ? match[2] : url; }
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
onSnapshot(doc(db, "settings", "config"), (docSnap) => {
    if(docSnap.exists()) {
        const cfg = docSnap.data();
        if(cfg.adminEmails && Array.isArray(cfg.adminEmails)) { dynamicAdminEmails = [...new Set([...ADMIN_EMAILS, ...cfg.adminEmails])]; }
        if(cfg.aiKeys && cfg.aiKeys.length > 0) { aiKeys = cfg.aiKeys; const list = document.getElementById('ai-key-list'); if(list) { list.innerHTML = ""; aiKeys.forEach(k => { list.innerHTML += `<div class="key-item"><span class="key-name">${k.name}</span><span class="key-val">******</span><button class="btn btn-sm btn-danger" onclick="removeAIKey('${k.name}', '${k.val}')">X</button></div>`; }); } }
        if(cfg.googleSheetUrl) { googleSheetUrl = cfg.googleSheetUrl; }
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
window.handleLogout=async()=>{await signOut(auth);alert("Đã đăng xuất");location.reload();}
window.checkAdminLogin=()=>signInWithPopup(auth,provider);
async function syncToGoogleSheet(user) { if (!googleSheetUrl) return; try { const payload = { displayName: user.displayName || "Chưa đặt tên", email: user.email, customID: user.customID || "", createdAt: user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'), classInfo: user.class ? `Thành viên lớp ${user.class}` : "Chưa cập nhật lớp", lastActive: new Date().toLocaleString('vi-VN'), loginCount: user.loginCount || 1, uid: user.uid }; await fetch(googleSheetUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); console.log("Synced to Google Sheet"); } catch (e) { console.error("Sync Error:", e); } }

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
        currentUser=userData; syncToGoogleSheet(currentUser);
        listenToMyNotifications(u.uid);
        handleRoute(); // Redirect to Admin if needed
        refreshChatContext(); // Cập nhật ngữ cảnh AI với thông tin user mới

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
            document.getElementById('menu-pc-admin').style.display='block'; document.getElementById('mob-admin').style.display='flex'; document.getElementById('maintenance-overlay').style.display='none'; 
            const cs = document.getElementById('edit-class');
            if(cs) { cs.disabled = true; if(![...cs.options].some(o=>o.value==='Admin')){const o=document.createElement('option');o.value='Admin';o.text='Admin';cs.add(o);} cs.value='Admin'; }
        } else { const cs = document.getElementById('edit-class'); if(cs) cs.disabled = false; }
        updateGreeting(); // Cập nhật lại lời chào khi đã có tên user
    }else{ 
        currentUser=null; 
        if(notifUnsub) notifUnsub(); 
        refreshChatContext(); // Reset ngữ cảnh AI về khách
        document.getElementById('profile-in').style.display='none'; document.getElementById('profile-out').style.display='block'; document.getElementById('home-login-area').style.display='block'; document.getElementById('menu-pc-admin').style.display='none'; document.getElementById('mob-admin').style.display='none'; 
    }
});

window.changeAvatar=async(i)=>{const f=i.files[0];if(!f)return;const fd=new FormData();fd.append('file',f);fd.append('upload_preset',UPLOAD_PRESET);document.getElementById('upload-overlay').style.display='flex';try{const r=await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{method:'POST',body:fd});const j=await r.json();if(j.secure_url){await updateDoc(doc(db,"users",currentUser.uid),{photoURL:j.secure_url});alert("Xong!");location.reload();}}catch(e){alert("Lỗi tải ảnh!")}document.getElementById('upload-overlay').style.display='none';}
window.checkLoginAndUpload = (c) => { if(!currentUser) { alert("Vui lòng đăng nhập!"); return; } if(!currentUser.class || !currentUser.customID || !currentUser.dob) { alert("Vui lòng cập nhật đầy đủ thông tin (Lớp, ID, Ngày sinh)!"); showPage('profile'); return; } window.uploadMode = c; currentCollection = (c === 'trash' || c === 'plant') ? 'gallery' : c; document.getElementById('file-input').click(); }

window.executeUpload = async (i) => { 
    const f = i.files[0]; if(!f) return; const isTrash = (window.uploadMode === 'trash'); const isPlant = (window.uploadMode === 'plant');
    
    let aiPrompt = "";
    if (isTrash) aiPrompt = "Đây là loại rác gì? Nó thuộc nhóm (Hữu cơ, Tái chế, hay Rác thải còn lại)? Hãy hướng dẫn cách vứt ngắn gọn.";
    else if (isPlant) aiPrompt = "Bạn là một chuyên gia nông nghiệp (Bác sĩ cây trồng). Hãy nhìn ảnh này và cho biết: 1. Đây là cây gì? 2. Cây có dấu hiệu bị bệnh, héo hay sâu hại không? 3. Nếu có, hãy đưa ra phác đồ điều trị cụ thể. Nếu cây khỏe mạnh, hãy khen và hướng dẫn cách chăm sóc cơ bản. Trả lời ngắn gọn, súc tích.";
    else aiPrompt = "Đóng vai một học sinh lớp A2K41 đăng ảnh lên mạng xã hội của lớp. Hãy viết 3 dòng trạng thái (caption) ngắn gọn, tự nhiên, xưng hô 'mình' hoặc 'lớp tớ' về bức ảnh này. Gợi ý 1: Vui vẻ. Gợi ý 2: Ý nghĩa. Gợi ý 3: Hài hước. Mỗi gợi ý 1 dòng gạch đầu dòng."; 
    
    let description = ""; 
    if(!isTrash && !isPlant) { const d = prompt("Nhập mô tả cho ảnh (Hoặc để trống để AI gợi ý caption):"); if(d === null) return; description = d; } 
    
    let loadingText = "AI đang viết caption...";
    if(isTrash) loadingText = "AI đang soi rác...";
    if(isPlant) loadingText = "Bác sĩ cây đang chẩn đoán...";

    document.getElementById('upload-loading-text').innerText = loadingText; document.getElementById('upload-overlay').style.display='flex'; 
    try { 
        const fd = new FormData(); fd.append('file',f); fd.append('upload_preset',UPLOAD_PRESET); 
        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{method:'POST',body:fd}); const j = await r.json(); 
        if(j.secure_url) { 
            if(isTrash || isPlant || !description) { 
                try { const base64Img = await fileToBase64(f); const aiResult = await callGeminiAPI(aiPrompt, base64Img); 
                    
                    // Clean * for Alert, Format HTML for Caption
                    const cleanResult = aiResult.replace(/\*\*\*(.*?)\*\*\*/g, '$1').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
                    const formattedResult = aiResult.replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');

                    if(isTrash) { alert(`🤖 AI Kết luận:\n${cleanResult}`); description = formattedResult; } 
                    else if(isPlant) { alert(`🌿 Bác sĩ cây chẩn đoán:\n${cleanResult}`); description = formattedResult; }
                    else { description = formattedResult; } 
                } catch(err) { console.error(err); if(isTrash || isPlant) alert("AI lỗi, không thể phân tích."); } 
            } 
            await addDoc(collection(db, currentCollection), { url: j.secure_url, desc: description || "Không có mô tả", uid: currentUser.uid, authorName: currentUser.displayName, authorID: currentUser.customID || "@unknown", authorAvatar: currentUser.photoURL, className: currentUser.class, type: window.uploadMode, createdAt: serverTimestamp(), likes: [], comments: [], archived: false }); 
            if(!isTrash && !isPlant) alert("Đăng ảnh thành công!\n(AI đã tự viết caption cho bạn nếu bạn để trống)"); 
        } 
    } catch(e) { console.error(e); alert("Lỗi tải ảnh: " + e.message); } 
    document.getElementById('upload-overlay').style.display='none'; i.value=""; 
}

// --- OPTIMIZE IMAGE & RENDER GRID ---
const optimizeUrl = (url, width) => {
    if (url.includes('cloudinary.com')) {
        let params = 'f_auto,q_auto';
        if (width) params += `,w_${width}`;
        return url.replace('/upload/', `/upload/${params}/`);
    }
    return url;
};

function renderGrid(col, elId, uR, cR) {
    gridParams[col] = { elId, uR, cR };
    if(State.unsubscribes[col]) State.unsubscribes[col]();
    
    // Query phân trang: Lọc archived -> Sort archived (bắt buộc) -> Sort createdAt -> Limit
    const q = query(collection(db, col), where("archived", "!=", true), orderBy("archived"), orderBy("createdAt", "desc"), limit(gridLimits[col]));

    const unsub = onSnapshot(q, (snap) => {
        const g = document.getElementById(elId); if(!g) return;
        let htmlBuffer = ""; let uS={}, cS={}, docs=[];
        snap.forEach(d=>docs.push({id:d.id,...d.data()})); 
        // docs.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)); // Đã sort bằng Query
        
        if(col === 'gallery') {
            latestGalleryDocs = docs;
            updateFeaturedUI();
        }

        docs.forEach(d => {
            const l = d.likes?d.likes.length:0; if(!uS[d.authorName])uS[d.authorName]=0; uS[d.authorName]+=l; const cl=d.className||"Khác"; if(!cS[cl])cS[cl]=0; cS[cl]+=l;
            let ctrls=""; 
            if(currentUser && (currentUser.uid===d.uid || isAdmin(currentUser.email))){ ctrls=`<div class="owner-controls"><button class="ctrl-btn" onclick="event.stopPropagation();editPost('${col}','${d.id}','${d.desc}')"><i class="fas fa-pen"></i></button><button class="ctrl-btn" onclick="event.stopPropagation();deletePost('${col}','${d.id}')" style="color:red;margin-left:5px"><i class="fas fa-trash"></i></button></div>`; }
            let badge = "";
            if(d.type === 'trash') badge = `<span style="position:absolute; top:10px; left:10px; background:#ff9800; color:white; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; z-index:5;">AI Soi Rác</span>`;
            else if(d.type === 'contest') badge = `<span style="position:absolute; top:10px; left:10px; background:var(--info); color:white; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; z-index:5;">Thi Đua</span>`;
            else if(d.type === 'plant') badge = `<span style="position:absolute; top:10px; left:10px; background:#4caf50; color:white; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; z-index:5;">Bác sĩ cây</span>`;
            
            // LAZY LOADING + OPTIMIZED URL
            // Load ảnh siêu nhỏ (w=50) làm placeholder, ảnh thật (w=400) để trong data-src
            const tinyUrl = optimizeUrl(d.url, 50);
            const realUrl = optimizeUrl(d.url, 400);
            const isAdm = d.className === 'Admin' || d.authorName === 'Admin_xinhxinh';
            const admBadge = isAdm ? ' <i class="fas fa-check-circle" style="color:#2e7d32; font-size:0.8em;" title="Admin"></i>' : '';
            const nameStyle = isAdm ? 'color:#d32f2f;font-weight:bold' : '';
            htmlBuffer += `<div class="gallery-item" onclick="openLightbox('${col}','${d.id}')">${badge}${ctrls}<div class="gallery-img-container"><img src="${tinyUrl}" data-src="${realUrl}" class="gallery-img lazy-blur"></div><div class="gallery-info"><div class="gallery-title">${d.desc}</div><div class="gallery-meta"><div style="display:flex;align-items:center"><img src="${d.authorAvatar||'https://lh3.googleusercontent.com/a/default-user=s96-c'}" class="post-avatar" onerror="this.src='https://lh3.googleusercontent.com/a/default-user=s96-c'"> <span style="${nameStyle}">${d.authorID||d.authorName}${admBadge}</span></div><span><i class="fas fa-heart" style="color:${d.likes?.includes(currentUser?.uid)?'red':'#ccc'}"></i> ${l}</span></div><div class="grid-actions"><button class="grid-act-btn" onclick="event.stopPropagation(); alert('Link ảnh: ${d.url}')"><i class="fas fa-share"></i> Share</button></div></div></div>`;
        });
        
        if(snap.docs.length >= gridLimits[col]) {
            htmlBuffer += `<div style="grid-column:1/-1;text-align:center;margin-top:10px"><button class="btn btn-outline" onclick="loadMore('${col}')">Xem thêm</button></div>`;
        }

        g.innerHTML = htmlBuffer;
        lazyLoadImages(); // Kích hoạt observer sau khi render
        renderRank(uR.id, uS); renderRank(cR.id, cS);
    }, (error) => {
        console.error("RenderGrid Error:", error);
        if(error.code === 'failed-precondition') alert("⚠️ Admin cần tạo Index Firestore (archived + createdAt) để phân trang hoạt động! Xem Console để lấy link tạo.");
    });
    State.unsubscribes[col] = unsub;
}

window.loadMore = (col) => {
    gridLimits[col] += PAGE_SIZE;
    const p = gridParams[col];
    if(p) renderGrid(col, p.elId, p.uR, p.cR);
}

// --- FEATURED POST LOGIC (PIN & TOP 1) ---
onSnapshot(doc(db, "settings", "featured"), (snap) => {
    pinnedSettings = snap.exists() ? snap.data() : null;
    updateFeaturedUI();
});

async function updateFeaturedUI() {
    // 1. Xử lý Bài Ghim (Pinned Post)
    const pinSection = document.getElementById('pinned-post');
    if (pinSection) {
        let pinnedPost = null;
        if (pinnedSettings && pinnedSettings.id) {
            if (pinnedSettings.col === 'gallery') pinnedPost = latestGalleryDocs.find(d => d.id === pinnedSettings.id);
            if (!pinnedPost) { 
                try { const s = await getDoc(doc(db, pinnedSettings.col, pinnedSettings.id)); if(s.exists()) pinnedPost = {id:s.id, ...s.data()}; } catch(e){}
            }
        }
        if (pinnedPost) {
            pinSection.style.display = 'flex';
            document.getElementById('pin-img').src = optimizeUrl(pinnedPost.url, 400);
            document.getElementById('pin-desc').innerText = pinnedPost.desc;
            document.getElementById('pin-author').innerText = "— " + pinnedPost.authorName;
        } else {
            pinSection.style.display = 'none';
        }
    }

    // 2. Xử lý Top 1 (Top Trending)
    const featSection = document.getElementById('featured-post');
    if (featSection && latestGalleryDocs.length > 0) {
        const topPost = [...latestGalleryDocs].sort((a,b) => (b.likes?b.likes.length:0) - (a.likes?a.likes.length:0))[0];
        if (topPost) {
        featSection.style.display = 'flex';
            document.getElementById('feat-img').src = optimizeUrl(topPost.url, 400);
            document.getElementById('feat-title').innerText = "TOP 1 ĐƯỢC YÊU THÍCH";
            document.getElementById('feat-desc').innerText = topPost.desc;
            document.getElementById('feat-author').innerText = "— " + topPost.authorName;
            if (currentUser && topPost.uid === currentUser.uid) {
                if (topPost.id !== lastTopPostId) triggerFireworks();
            }
            lastTopPostId = topPost.id;
        } else {
            featSection.style.display = 'none';
            lastTopPostId = null;
        }
    } else {
        featSection.style.display = 'none';
        lastTopPostId = null;
    }
}

function lazyLoadImages() {
    const imgObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.onload = () => {
                    img.classList.remove('lazy-blur');
                    img.classList.add('loaded');
                };
                observer.unobserve(img);
            }
        });
    });
    document.querySelectorAll('img.lazy-blur').forEach(img => imgObserver.observe(img));
}

function renderRank(eid, obj) { 
    const s=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,5); 
    const b=document.getElementById(eid); if(!b) return; b.innerHTML=""; 
    s.forEach((i,x)=>{ 
        b.innerHTML+=`<tr class="${x===0?'rank-top-1':''}" onclick="${x===0?'triggerFireworks()':''}" style="${x===0?'cursor:pointer':''}"><td><span class="rank-num">${x+1}</span> ${i[0]}</td><td style="text-align:right;font-weight:bold;color:var(--primary)">${i[1]} <i class="fas fa-heart"></i></td></tr>`; 
    }); 
    if(!s.length)b.innerHTML="<tr><td style='text-align:center'>Chưa có dữ liệu</td></tr>"; 
}

window.openLightbox = async (c, i) => { 
    currentImgId=i; currentImgCollection=c; document.getElementById('lightbox').style.display='flex'; 
    const s=await getDoc(doc(db,c,i)); const d=s.data(); 
    const imgArea = document.getElementById('lb-zoom-area'); imgArea.classList.remove('zoomed'); 
    const imgEl = document.getElementById('lb-img'); imgEl.style.transform = "scale(1)"; 
    imgEl.src=optimizeUrl(d.url, 1200); 
    const avt = document.getElementById('lb-author-avatar'); avt.src=d.authorAvatar||'https://lh3.googleusercontent.com/a/default-user=s96-c'; avt.onerror = function(){this.src='https://lh3.googleusercontent.com/a/default-user=s96-c'};
    const nameEl = document.getElementById('lb-author-name'); 
    const isAdm = d.className === 'Admin' || d.authorName === 'Admin_xinhxinh';
    nameEl.innerHTML = d.authorName + (isAdm ? ' <i class="fas fa-check-circle" style="color:#2e7d32; margin-left:5px;" title="Admin"></i>' : '');
    nameEl.style.color = isAdm ? '#d32f2f' : ''; nameEl.style.fontWeight = isAdm ? 'bold' : '';
    document.getElementById('lb-custom-id').innerText=d.authorID || ""; document.getElementById('lb-desc').innerHTML=d.desc; document.getElementById('lb-like-count').innerText=d.likes?d.likes.length:0; 
    const btn = document.getElementById('lb-like-btn'); 
    if(currentUser && d.likes?.includes(currentUser.uid)) { btn.classList.add('liked'); btn.style.color='#e53935'; } else { btn.classList.remove('liked'); btn.style.color='var(--text-sec)'; } 
    const controls = document.getElementById('lb-owner-controls');
    if(currentUser && (currentUser.uid === d.uid || isAdmin(currentUser.email))) { 
        controls.style.display = 'flex'; 
        const pinBtn = document.querySelector('.lb-btn-pin');
        if(isAdmin(currentUser.email)) {
            pinBtn.style.display = 'block';
            const isPinned = pinnedSettings && pinnedSettings.id === i && pinnedSettings.col === c;
            pinBtn.innerHTML = isPinned ? '<i class="fas fa-times-circle"></i>' : '<i class="fas fa-thumbtack"></i>';
            pinBtn.onclick = isPinned ? window.unpinPost : window.pinPost;
            pinBtn.title = isPinned ? "Bỏ ghim" : "Ghim";
            pinBtn.style.color = isPinned ? '#d32f2f' : '#ffa000';
        } else { pinBtn.style.display = 'none'; }
    } else { controls.style.display = 'none'; }
    document.getElementById('lb-details-sheet').classList.remove('open'); renderComments(d.comments||[]); 
}

window.closeLightbox = () => { document.getElementById('lightbox').style.display='none'; document.getElementById('lb-details-sheet').classList.remove('open'); }
window.toggleDetails = () => { document.getElementById('lb-details-sheet').classList.toggle('open'); }

let lastTap = 0; const imgEl = document.getElementById('lb-img'); const zoomArea = document.getElementById('lb-zoom-area');
zoomArea.addEventListener('touchend', (e) => { const currentTime = new Date().getTime(); const tapLength = currentTime - lastTap; if (tapLength < 300 && tapLength > 0) { toggleZoom(e); e.preventDefault(); } lastTap = currentTime; });
zoomArea.addEventListener('dblclick', toggleZoom);
function toggleZoom(e) { if (zoomArea.classList.contains('zoomed')) { zoomArea.classList.remove('zoomed'); imgEl.style.transform = "scale(1)"; } else { zoomArea.classList.add('zoomed'); let clientX, clientY; if (e.changedTouches && e.changedTouches.length > 0) { clientX = e.changedTouches[0].clientX; clientY = e.changedTouches[0].clientY; } else { clientX = e.clientX; clientY = e.clientY; } const rect = zoomArea.getBoundingClientRect(); const x = clientX - rect.left; const y = clientY - rect.top; imgEl.style.transformOrigin = `${x}px ${y}px`; imgEl.style.transform = "scale(2.5)"; } }

window.quickReply = async (text) => {
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    const list = document.getElementById('lb-comments-list');
    const fakeDiv = document.createElement('div'); fakeDiv.className = 'lb-comment-item';
    fakeDiv.innerHTML = `<img src="${currentUser.photoURL}" class="lb-comment-avatar"><div class="lb-comment-content"><div class="lb-comment-bubble"><span class="lb-comment-user">${currentUser.displayName}</span><span class="lb-comment-text">${text}</span></div></div>`;
    list.appendChild(fakeDiv); list.scrollTop = list.scrollHeight;
    const c = { uid: currentUser.uid, name: currentUser.displayName, avatar: currentUser.photoURL, text: text, time: Date.now() };
    await updateDoc(doc(db, currentCollection, currentImgId), { comments: arrayUnion(c) });
    const postSnap = await getDoc(doc(db, currentCollection, currentImgId));
    if(postSnap.exists()){ const ownerId = postSnap.data().uid; pushNotification(ownerId, 'comment', `<b>${currentUser.displayName}</b> đã bình luận: "${text}"`, currentImgId, currentCollection); }
}

window.pinPost = async () => { 
    await setDoc(doc(db, "settings", "featured"), { col: currentCollection, id: currentImgId }); 
    // Gửi thông báo Global
    await setDoc(doc(db, "settings", "notifications"), { text: "📌 Một bài viết mới vừa được ghim lên Trang Chủ! Xem ngay!", id: Date.now().toString(), createdAt: serverTimestamp() });
    alert("Đã ghim và gửi thông báo!"); 
    const pinBtn = document.querySelector('.lb-btn-pin');
    if(pinBtn) { pinBtn.innerHTML = '<i class="fas fa-times-circle"></i>'; pinBtn.onclick = window.unpinPost; pinBtn.title = "Bỏ ghim"; pinBtn.style.color = '#d32f2f'; }
}

window.unpinPost = async () => {
    if(confirm("Bỏ ghim bài viết này?")) {
        await deleteDoc(doc(db, "settings", "featured"));
        alert("Đã bỏ ghim!");
        const pinBtn = document.querySelector('.lb-btn-pin');
        if(pinBtn) { pinBtn.innerHTML = '<i class="fas fa-thumbtack"></i>'; pinBtn.onclick = window.pinPost; pinBtn.title = "Ghim"; pinBtn.style.color = '#ffa000'; }
    }
}

window.deletePostFromLB = async () => { if(confirm("Bạn chắc chắn muốn xóa bài viết này chứ?")) { await deleteDoc(doc(db, currentCollection, currentImgId)); closeLightbox(); alert("Đã xóa bài viết!"); } }
window.editPostFromLB = async () => { const newDesc = prompt("Nhập mô tả mới:"); if(newDesc) { await updateDoc(doc(db, currentCollection, currentImgId), { desc: newDesc }); document.getElementById('lb-desc').innerHTML = newDesc; } }

window.handleLike = async () => { 
    if(!currentUser) return alert("Vui lòng đăng nhập để thả tim!"); 
    const btn = document.getElementById('lb-like-btn'); const countSpan = document.getElementById('lb-like-count');
    let currentCount = parseInt(countSpan.innerText); const isLiked = btn.classList.contains('liked');
    if (isLiked) { btn.classList.remove('liked'); btn.style.color = 'var(--text-sec)'; countSpan.innerText = Math.max(0, currentCount - 1); await updateDoc(doc(db, currentCollection, currentImgId), { likes: arrayRemove(currentUser.uid) }); } 
    else { btn.classList.add('liked'); btn.style.color = '#e53935'; countSpan.innerText = currentCount + 1; await updateDoc(doc(db, currentCollection, currentImgId), { likes: arrayUnion(currentUser.uid) });
    const postSnap = await getDoc(doc(db, currentCollection, currentImgId)); if(postSnap.exists()){ const ownerId = postSnap.data().uid; pushNotification(ownerId, 'like', `<b>${currentUser.displayName}</b> đã thả tim ảnh của bạn ❤️`, currentImgId, currentCollection); } }
}

function renderComments(arr) { 
    const l=document.getElementById('lb-comments-list'); l.innerHTML=""; 
    arr.forEach((c, index)=>{ 
        const delBtn = (currentUser && (isAdmin(currentUser.email) || currentUser.uid === c.uid)) ? `<span onclick="deleteComment(${index})" style="color:#d32f2f; cursor:pointer; margin-left:8px; font-size:0.8rem;" title="Xóa">✕</span>` : '';
        const isAdm = c.name === 'Admin_xinhxinh';
        const admBadge = isAdm ? ' <i class="fas fa-check-circle" style="color:#2e7d32; font-size:0.8em;"></i>' : '';
        const nameStyle = isAdm ? 'color:#d32f2f;font-weight:bold' : '';
        l.innerHTML+=`<div class="lb-comment-item"><img src="${c.avatar||'https://lh3.googleusercontent.com/a/default-user=s96-c'}" class="lb-comment-avatar" onerror="this.src='https://lh3.googleusercontent.com/a/default-user=s96-c'"><div class="lb-comment-content"><div class="lb-comment-bubble"><span class="lb-comment-user" style="${nameStyle}">${c.name}${admBadge}</span><span class="lb-comment-text">${c.text}</span></div>${delBtn}</div></div>`; 
    }); l.scrollTop = l.scrollHeight; 
}

window.deleteComment = async (index) => {
    if(!confirm("Xóa bình luận này?")) return;
    const docRef = doc(db, currentImgCollection, currentImgId);
    const snap = await getDoc(docRef);
    if(snap.exists()) {
        const comments = snap.data().comments || [];
        if(index >= 0 && index < comments.length) {
            const newComments = [...comments];
            newComments.splice(index, 1);
            await updateDoc(docRef, { comments: newComments });
            renderComments(newComments);
        }
    }
}

window.exportExcel = async (type) => { 
    if(!currentUser || !isAdmin(currentUser.email)) return; 
    Utils.loader(true, "Đang tạo file Excel chuẩn..."); const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('DuLieu'); 
    if (type === 'users') { 
        sheet.columns = [ { header: 'STT', key: 'stt', width: 6 }, { header: 'Tên người dùng', key: 'name', width: 25 }, { header: 'Ngày sinh', key: 'dob', width: 15 }, { header: 'Email', key: 'email', width: 30 }, { header: 'ID', key: 'id', width: 15 }, { header: 'Ngày đăng ký', key: 'created', width: 20 }, { header: 'Lớp', key: 'class', width: 15 }, { header: 'Hoạt động cuối', key: 'active', width: 20 }, { header: 'Số lần đăng nhập', key: 'count', width: 15 } ]; 
        const snap = await getDocs(collection(db, "users")); let i=1; snap.forEach(d => { const u = d.data(); sheet.addRow({ stt: i++, name: u.displayName || '', dob: u.dob || '', email: u.email || '', id: u.customID || '', created: u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleString('vi-VN') : '', class: u.class || '', active: u.lastActive ? new Date(u.lastActive.seconds * 1000).toLocaleString('vi-VN') : '', count: u.loginCount || 1 }); }); 
    } else { 
        sheet.columns = [ { header: 'STT', key: 'stt', width: 6 }, { header: 'Người đăng', key: 'author', width: 25 }, { header: 'ID', key: 'uid', width: 15 }, { header: 'Lớp', key: 'class', width: 10 }, { header: 'Mô tả', key: 'desc', width: 40 }, { header: 'Tim', key: 'likes', width: 10 }, { header: 'Link ảnh', key: 'url', width: 40 }, { header: 'Ngày đăng', key: 'date', width: 20 } ]; 
        const snap = await getDocs(collection(db, type)); let i=1; snap.forEach(d => { const p = d.data(); sheet.addRow({ stt: i++, author: p.authorName, uid: p.authorID || '', class: p.className || '', desc: p.desc || '', likes: p.likes ? p.likes.length : 0, url: p.url, date: p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleString('vi-VN') : '' }); }); 
    } 
    const headerRow = sheet.getRow(1); headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }; headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } }; headerRow.alignment = { vertical: 'middle', horizontal: 'center' }; headerRow.height = 30; 
    sheet.eachRow((row, rowNumber) => { row.eachCell((cell) => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; cell.alignment = { vertical: 'middle', wrapText: true }; }); }); 
    const buffer = await workbook.xlsx.writeBuffer(); const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); saveAs(blob, `GreenSchool_${type}_${new Date().toISOString().slice(0,10)}.xlsx`); Utils.loader(false); 
}

// --- PDF EXPORT LOGIC ---
window.exportPDF = async (type) => {
    if(!currentUser || !isAdmin(currentUser.email)) return;
    Utils.loader(true, "Đang tạo PDF...");
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Tiêu đề
    doc.setFontSize(18);
    doc.text("BAO CAO THI DUA - GREEN SCHOOL A2K41", 14, 22);
    doc.setFontSize(11);
    doc.text(`Ngay xuat: ${new Date().toLocaleString('vi-VN')}`, 14, 30);

    // Lấy dữ liệu
    const snap = await getDocs(collection(db, type));
    let bodyData = [];
    snap.forEach(d => {
        const p = d.data();
        // Lưu ý: jsPDF mặc định không hỗ trợ tiếng Việt có dấu tốt nếu không nhúng font.
        // Ở đây ta dùng toLocaleString để format ngày, và lấy các trường cơ bản.
        bodyData.push([p.className || '', p.authorName, p.desc || '', p.likes ? p.likes.length : 0, p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleDateString('vi-VN') : '']);
    });

    // Tạo bảng
    doc.autoTable({
        head: [['Lop', 'Nguoi Dang', 'Mo Ta', 'Tim', 'Ngay']],
        body: bodyData,
        startY: 40,
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [46, 125, 50] } // Màu xanh Green School
    });

    doc.save(`BaoCao_${type}_${Date.now()}.pdf`);
    Utils.loader(false);
}

// --- CHART JS LOGIC ---
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

// --- FIREWORKS EFFECT ---
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
window.updateAIConfig = async () => { await setDoc(doc(db,"settings","config"),{geminiKey:document.getElementById('cfg-ai-key').value},{merge:true}); alert("Đã lưu API Key! Vui lòng tải lại trang."); location.reload(); }
window.updateMainConfig = async () => { await setDoc(doc(db,"settings","config"),{maintenance:document.getElementById('cfg-maintenance').checked},{merge:true}); alert("Đã lưu!"); }
window.updateLocks = async () => { await setDoc(doc(db,"settings","config"),{locks:{home:document.getElementById('lock-home').checked,greenclass:document.getElementById('lock-greenclass').checked,contest:document.getElementById('lock-contest').checked,activities:document.getElementById('lock-activities').checked,guide:document.getElementById('lock-guide').checked,archive:document.getElementById('lock-archive').checked}},{merge:true}); alert("Đã lưu!"); }
window.updateDeadlines = async () => { await setDoc(doc(db,"settings","config"),{deadlines:{gallery:document.getElementById('time-gallery').value,contest:document.getElementById('time-contest').value}},{merge:true}); alert("Đã lưu!"); }
window.archiveSeason = async (c) => { if(!confirm("Lưu trữ?"))return; const n=prompt("Tên đợt:"); if(!n)return; const q=query(collection(db,c),where("archived","!=",true)); const s=await getDocs(q); const u=[]; s.forEach(d=>u.push(updateDoc(doc(db,c,d.id),{archived:true,archiveLabel:n}))); await Promise.all(u); await addDoc(collection(db,"archives_meta"),{collection:c,label:n,archivedAt:serverTimestamp()}); alert("Xong!"); }
window.loadArchiveSeasons = async () => { const s=document.getElementById('archive-season-select'); s.innerHTML='<option value="ALL">📂 Tất cả ảnh lưu trữ</option>'; const q=query(collection(db,"archives_meta"),where("collection","==",activeArchiveTab)); const sn=await getDocs(q); const docs = []; sn.forEach(d => docs.push(d.data())); docs.sort((a,b) => (b.archivedAt?.seconds || 0) - (a.archivedAt?.seconds || 0)); docs.forEach(d=>s.innerHTML+=`<option value="${d.label}">${d.label}</option>`); }
window.loadArchiveGrid = Utils.debounce(async () => { const l=document.getElementById('archive-season-select').value; const k=document.getElementById('archive-search').value.toLowerCase(); const g=document.getElementById('archive-grid'); g.innerHTML="Loading..."; let q; if(l === 'ALL') q = query(collection(db,activeArchiveTab),where("archived","==",true)); else q = query(collection(db,activeArchiveTab),where("archived","==",true),where("archiveLabel","==",l)); const s=await getDocs(q); g.innerHTML=""; if(s.empty) { g.innerHTML = "<p>Không có dữ liệu.</p>"; return; } s.forEach(d=>{ const da=d.data(); if(k && !da.authorName.toLowerCase().includes(k) && !da.desc.toLowerCase().includes(k) && !(da.authorID||"").toLowerCase().includes(k)) return; g.innerHTML+=`<div class="gallery-item" onclick="openLightbox('${activeArchiveTab}','${d.id}')"><div class="gallery-img-container"><img src="${da.url}" class="gallery-img"></div><div class="gallery-info"><div class="gallery-title">${da.desc}</div><div class="gallery-meta"><span>${da.authorID||da.authorName}</span></div></div></div>`; }); }, 300);
window.switchArchiveTab = (t) => { activeArchiveTab=t; document.querySelectorAll('.archive-tab').forEach(e=>e.classList.remove('active')); document.getElementById(`tab-ar-${t}`).classList.add('active'); loadArchiveSeasons(); loadArchiveGrid(); }

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
window.requestDeleteAccount = async () => { if(confirm("Xóa tk?")) { await updateDoc(doc(db, "users", currentUser.uid), { status: 'deleted' }); location.reload(); } }
window.restoreAccount = async () => { await updateDoc(doc(db, "users", currentUser.uid), { status: 'active' }); location.reload(); }
async function checkUniqueID(id) { const q = query(collection(db, "users"), where("customID", "==", id)); const snap = await getDocs(q); return snap.empty; }
window.updateProfile = async (e) => { 
    e.preventDefault(); 
    const n = document.getElementById('edit-name').value; const cid = document.getElementById('edit-custom-id').value; const c = document.getElementById('edit-class').value; const d = document.getElementById('edit-dob').value; const b = document.getElementById('edit-bio').value; 
    if(cid !== currentUser.customID) { const isUnique = await checkUniqueID(cid); if(!isUnique) return alert("ID này đã có người dùng!"); } 
    const f = isAdmin(currentUser.email) ? "Admin_xinhxinh" : n; const finalClass = isAdmin(currentUser.email) ? "Admin" : c;
    
    await updateDoc(doc(db, "users", currentUser.uid), { displayName: f, customID: cid, class: finalClass, dob: d, bio: b }); 
    
    // CẬP NHẬT NGAY LẬP TỨC BIẾN currentUser ĐỂ MỞ KHÓA
    currentUser.displayName = f; currentUser.customID = cid; currentUser.class = finalClass; currentUser.dob = d; currentUser.bio = b;
    
    alert("Đã lưu hồ sơ thành công! Bạn có thể sử dụng web bình thường."); 
    if(currentUser.class && currentUser.customID && currentUser.dob) { showPage('home'); window.location.hash = 'home'; }
}

// --- ROUTING LOGIC ---
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
    document.querySelectorAll('nav.pc-nav a, nav.mobile-nav a').forEach(a => a.classList.remove('active-menu'));
    if(document.getElementById('menu-pc-'+targetId)) document.getElementById('menu-pc-'+targetId).classList.add('active-menu');
    if(document.getElementById('mob-'+targetId)) document.getElementById('mob-'+targetId).classList.add('active-menu');
    if(targetId === 'archive') { loadArchiveSeasons(); switchArchiveTab('gallery'); }
    const titles = { 'home': 'Trang Chủ', 'greenclass': 'Góc Xanh', 'contest': 'Thi Đua', 'archive': 'Lưu Trữ', 'activities': 'Hoạt Động', 'guide': 'Tra Cứu', 'profile': 'Hồ Sơ', 'admin': '🛠 Quản Trị Hệ Thống' };
    document.title = `Green School - ${titles[targetId] || 'A2K41'}`;
}

const trashDB = [ {n:"Vỏ sữa",t:"Tái chế",c:"bin-recycle"}, {n:"Chai nhựa",t:"Tái chế",c:"bin-recycle"}, {n:"Giấy vụn",t:"Tái chế",c:"bin-recycle"}, {n:"Vỏ trái cây",t:"Hữu cơ",c:"bin-organic"}, {n:"Lá cây",t:"Hữu cơ",c:"bin-organic"}, {n:"Túi nilon",t:"Rác khác",c:"bin-other"} ];
window.filterTrash = Utils.debounce(() => { const k = document.getElementById('trashSearchInput').value.toLowerCase(); const r = document.getElementById('trashContainer'); r.innerHTML=""; trashDB.filter(i=>i.n.toLowerCase().includes(k)).forEach(i=>{ r.innerHTML+=`<div class="gallery-item" style="padding:10px;text-align:center"><div class="${i.c}" style="font-weight:bold">${i.t}</div><strong>${i.n}</strong></div>`; }); }, 200); window.filterTrash();
document.getElementById('daily-tip').innerText = ["Tắt đèn khi ra khỏi lớp.", "Trồng thêm cây xanh.", "Phân loại rác."][Math.floor(Math.random()*3)];
const mainLoginBtn = document.getElementById('main-login-btn'); if(mainLoginBtn) { mainLoginBtn.addEventListener('click', () => { console.log("Login clicked"); signInWithPopup(auth, provider); }); }

let deferredPrompt; const pcMenu = document.querySelector('nav.pc-nav ul'); const installLi = document.createElement('li'); installLi.innerHTML = '<a id="btn-install-pc" style="display:none; color:yellow; cursor:pointer"><i class="fas fa-download"></i> Tải App</a>'; pcMenu.appendChild(installLi); const mobNav = document.querySelector('.mobile-nav-inner'); const installMob = document.createElement('a'); installMob.className = 'nav-item'; installMob.id = 'btn-install-mob'; installMob.style.display = 'none'; installMob.innerHTML = '<i class="fas fa-download"></i><span>TảiApp</span>'; mobNav.insertBefore(installMob, mobNav.firstChild);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; document.getElementById('btn-install-pc').style.display = 'inline-block'; document.getElementById('btn-install-mob').style.display = 'flex'; });
async function installPWA() { if (!deferredPrompt) return; deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; deferredPrompt = null; document.getElementById('btn-install-pc').style.display = 'none'; document.getElementById('btn-install-mob').style.display = 'none'; }
document.getElementById('btn-install-pc').addEventListener('click', installPWA); document.getElementById('btn-install-mob').addEventListener('click', installPWA);
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').then(reg => console.log('SW Registered!', reg)).catch(err => console.log('SW Error:', err)); }); }

// --- SEASONAL EFFECT LOGIC ---
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
