--- START OF FILE script.js ---

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, where, increment, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIG
const firebaseConfig = { apiKey: "AIzaSyCJ_XI_fq-yJC909jb9KLIKg3AfGdm6hNs", authDomain: "a2k41nvc-36b0b.firebaseapp.com", projectId: "a2k41nvc-36b0b", storageBucket: "a2k41nvc-36b0b.firebasestorage.app", messagingSenderId: "279516631226", appId: "1:279516631226:web:99012883ed7923ab5c3283" };
const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app); const provider = new GoogleAuthProvider();
const CLOUD_NAME = "dekxvneap"; const UPLOAD_PRESET = "a2k41nvc_upload"; const ADMIN_EMAILS = ["kiet0905478167@gmail.com", "anhkiet119209@gmail.com"];

let currentUser=null, currentCollection='gallery', currentImgId=null, currentImgCollection=null, activeArchiveTab='gallery', musicId='jfKfPfyJRdk';

// Multi-Key AI Logic (FAIL-OVER)
let aiKeys = [{name: "Mặc định", val: "AIzaSyAnOwbqmpQcOu_ERINF4nSfEL4ZW95fiGc"}]; 

// --- CHAT HISTORY (MEMORY) ---
let chatHistory = [];

const SYSTEM_PROMPT = `
Bạn là Green Bot - Trợ lý ảo AI thân thiện của lớp A2K41 và trường Green School.
Bạn xưng là 'Tớ' và gọi người dùng là 'Cậu'. Dùng nhiều emoji dễ thương (🌱, 🤖, ✨).

HÃY GHI NHỚ THÔNG TIN VỀ WEBSITE NÀY ĐỂ HỖ TRỢ:
1. Trang Chủ (Home): Xem thông báo, tin tức nổi bật và ảnh 'Top 1 yêu thích'.
2. Góc Xanh (Green Class): Nơi upload ảnh hoạt động môi trường. Có tính năng 'AI Soi Rác' để nhận diện rác thải.
3. Thi Đua (Contest): Nơi các tổ/cá nhân upload báo cáo thành tích để cộng điểm thi đua.
4. Lưu Trữ (Archive): Xem lại các ảnh cũ từ các đợt trước.
5. Hoạt Động (Activities): Xem lịch 'Đổi giấy lấy cây' và các tin tức tình nguyện.
6. Tra Cứu (Guide): Từ điển phân loại rác (Vỏ sữa, pin, lá cây...).
7. Tài Khoản (Profile): Chỉnh sửa tên, avatar và xem lớp của mình.

Nếu người dùng hỏi làm sao để đăng ảnh? -> Hướng dẫn vào mục 'Góc Xanh' hoặc 'Thi Đua'.
Nếu người dùng hỏi về rác? -> Hướng dẫn dùng tính năng 'AI Soi Rác' ở Góc Xanh.
Hãy luôn trả lời ngắn gọn, vui vẻ và hướng dẫn cụ thể vào đúng mục trên web.
`;

chatHistory.push({ role: "user", parts: [{ text: SYSTEM_PROMPT }] });
chatHistory.push({ role: "model", parts: [{ text: "Okie, tớ nhớ rồi! Tớ là chuyên gia về web A2K41 đây! 🌱" }] });

let googleSheetUrl = "https://script.google.com/macros/s/AKfycbzilw2SHG74sfCGNktGLuo46xkLNzVSVl6T3HbjXoWAsm9_CmXmuZQmbDxIOJ5cRhyX/exec"; 
// Lưu ý: Bảo mật thực sự cần được xử lý bằng Firestore Rules phía server
const isAdmin=(e)=>ADMIN_EMAILS.includes(e);
const State = { unsubscribes: {} };

// --- UTILS ---
const Utils = {
    loader: (show, text="Đang xử lý...") => {
        document.getElementById('upload-overlay').style.display = show ? 'flex' : 'none';
        document.getElementById('upload-loading-text').innerText = text;
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
        let unreadCount = 0; 
        let html = ""; // Tối ưu: Dùng buffer thay vì += innerHTML
        let notifs = [];
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

// --- GEMINI AI ---
async function callGeminiAPI(prompt, imageBase64 = null) {
    let requestContents = [];
    if (imageBase64) {
        requestContents = [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }] }];
    } else {
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        // Tối ưu: Giới hạn context để tránh lỗi token và tiết kiệm bộ nhớ
        // Luôn giữ System Prompt (index 0) và lấy 10 tin nhắn gần nhất
        if (chatHistory.length > 12) {
            chatHistory = [chatHistory[0], ...chatHistory.slice(-11)];
        }
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
window.toggleAIChat = () => { const w = document.getElementById('ai-window'); w.style.display = w.style.display === 'flex' ? 'none' : 'flex'; }
window.fillChat = (text) => { document.getElementById('ai-input').value = text; window.sendMessageToAI(new Event('submit')); }

window.sendMessageToAI = async (e) => {
    e.preventDefault(); const input = document.getElementById('ai-input'); const msg = input.value; if(!msg) return;
    const msgList = document.getElementById('ai-messages'); msgList.innerHTML += `<div class="ai-msg user">${msg}</div>`; 
    input.value = ""; msgList.scrollTop = msgList.scrollHeight;
    const loadingId = "ai-loading-" + Date.now(); 
    msgList.innerHTML += `<div class="ai-msg bot" id="${loadingId}"><i class="fas fa-ellipsis-h fa-fade"></i></div>`; msgList.scrollTop = msgList.scrollHeight;
    try { const responseText = await callGeminiAPI(msg); document.getElementById(loadingId).innerText = responseText; } 
    catch(err) { document.getElementById(loadingId).innerHTML = `<span style="color:red">Lỗi: ${err.message}</span>`; }
    msgList.scrollTop = msgList.scrollHeight;
}

function fileToBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = error => reject(error); }); }

// --- YOUTUBE ID & MUSIC ---
function getYoutubeID(url) { const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/; const match = url.match(regExp); return (match && match[2].length === 11) ? match[2] : url; }
const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api"; var firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
let player; window.onYouTubeIframeAPIReady = function() { player = new YT.Player('player', { height: '0', width: '0', videoId: musicId, events: { 'onStateChange': onPlayerStateChange } }); }
function onPlayerStateChange(event) { const icon = document.getElementById('music-icon-display'); if(event.data == YT.PlayerState.PLAYING) { icon.classList.add('playing'); icon.style.color = 'var(--primary)'; } else { icon.classList.remove('playing'); icon.style.color = 'var(--text)'; } }
window.toggleMusic = () => { try { if(player && player.getPlayerState() == YT.PlayerState.PLAYING) player.pauseVideo(); else if(player) player.playVideo(); } catch(e){} }
window.addNewSong = async () => { const name = document.getElementById('new-song-name').value; let url = document.getElementById('new-song-url').value; if(!name || !url) return alert("Nhập đủ tên và link!"); const id = getYoutubeID(url); await updateDoc(doc(db, "settings", "config"), { playlist: arrayUnion({name, id}) }); alert("Đã thêm bài hát!"); }
window.playSong = async (id) => { await updateDoc(doc(db, "settings", "config"), { musicId: id }); alert("Đã phát bài này!"); }
window.deleteSong = async (name, id) => { if(confirm("Xóa bài này?")) await updateDoc(doc(db, "settings", "config"), { playlist: arrayRemove({name, id}) }); }

// --- GLOBAL LISTENER ---
onSnapshot(doc(db, "settings", "config"), (docSnap) => {
    if(docSnap.exists()) {
        const cfg = docSnap.data();
        if(cfg.aiKeys && cfg.aiKeys.length > 0) { aiKeys = cfg.aiKeys; const list = document.getElementById('ai-key-list'); if(list) { let html = ""; aiKeys.forEach(k => { html += `<div class="key-item"><span class="key-name">${k.name}</span><span class="key-val">******</span><button class="btn btn-sm btn-danger" onclick="removeAIKey('${k.name}', '${k.val}')">X</button></div>`; }); list.innerHTML = html; } }
        if(cfg.googleSheetUrl) { googleSheetUrl = cfg.googleSheetUrl; }
        if(cfg.musicId && cfg.musicId !== musicId) { musicId = cfg.musicId; try{if(player) player.loadVideoById(musicId);}catch(e){} }
        const plDiv = document.getElementById('music-playlist-container'); if(plDiv && cfg.playlist) { let html = ""; cfg.playlist.forEach(s => { const style = s.id === cfg.musicId ? 'background:rgba(46, 125, 50, 0.1); border-left:4px solid green;' : ''; html += `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border); ${style}"><span>${s.name}</span> <div><button class="btn btn-sm" onclick="playSong('${s.id}')">▶</button> <button class="btn btn-sm btn-danger" onclick="deleteSong('${s.name}','${s.id}')">🗑</button></div></div>`; }); plDiv.innerHTML = html; }
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
        if(s.exists()){ const d=s.data(); if(d.banned){alert("Bạn đã bị khóa!");signOut(auth);return;} userData = { ...d, loginCount: (d.loginCount || 0) + 1 }; await updateDoc(r, { lastActive: serverTimestamp(), loginCount: increment(1) }); } 
        else { userData = { uid:u.uid, email:u.email, displayName:isAdmin(u.email)?"Admin_xinhxinh":u.displayName, photoURL:u.photoURL, role:isAdmin(u.email)?'admin':'member', status:'active', class:"", customID:"@"+u.uid.slice(0,5), createdAt: serverTimestamp(), lastActive: serverTimestamp(), loginCount: 1 }; await setDoc(r,userData); }
        currentUser=userData; syncToGoogleSheet(currentUser);
        listenToMyNotifications(u.uid);
        handleRoute(); // Redirect to Admin if needed

        document.getElementById('profile-in').style.display='block'; document.getElementById('profile-out').style.display='none'; document.getElementById('home-login-area').style.display='none';
        document.getElementById('p-avatar').src=currentUser.photoURL; document.getElementById('p-name').innerHTML=(currentUser.role==='admin'||isAdmin(currentUser.email))?`<span style="color:red;font-weight:bold">Admin_xinhxinh ✅</span>`:currentUser.displayName;
        document.getElementById('p-custom-id').innerText = currentUser.customID || "@chua_co_id"; document.getElementById('p-email').innerText=currentUser.email; document.getElementById('edit-name').value=currentUser.displayName; document.getElementById('edit-custom-id').value=currentUser.customID || ""; document.getElementById('edit-class').value=currentUser.class||""; document.getElementById('edit-bio').value=currentUser.bio||"";
        if(isAdmin(currentUser.email)){ document.getElementById('menu-pc-admin').style.display='block'; document.getElementById('mob-admin').style.display='flex'; document.getElementById('maintenance-overlay').style.display='none'; }
    }else{ 
        currentUser=null; 
        if(notifUnsub) notifUnsub(); 
        document.getElementById('profile-in').style.display='none'; document.getElementById('profile-out').style.display='block'; document.getElementById('home-login-area').style.display='block'; document.getElementById('menu-pc-admin').style.display='none'; document.getElementById('mob-admin').style.display='none'; 
    }
});

window.changeAvatar=async(i)=>{const f=i.files[0];if(!f)return;const fd=new FormData();fd.append('file',f);fd.append('upload_preset',UPLOAD_PRESET);document.getElementById('upload-overlay').style.display='flex';try{const r=await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{method:'POST',body:fd});const j=await r.json();if(j.secure_url){await updateDoc(doc(db,"users",currentUser.uid),{photoURL:j.secure_url});alert("Xong!");location.reload();}}catch(e){alert("Lỗi tải ảnh!")}document.getElementById('upload-overlay').style.display='none';}
window.checkLoginAndUpload = (c) => { if(!currentUser) { alert("Vui lòng đăng nhập!"); return; } if(!currentUser.class) { alert("Vui lòng cập nhật Lớp!"); showPage('profile'); return; } window.uploadMode = c; currentCollection = (c === 'trash') ? 'gallery' : c; document.getElementById('file-input').click(); }

window.executeUpload = async (i) => { 
    const f = i.files[0]; if(!f) return; const isTrash = (window.uploadMode === 'trash'); 
    let aiPrompt = isTrash ? "Đây là loại rác gì? Nó thuộc nhóm (Hữu cơ, Tái chế, hay Rác thải còn lại)? Hãy hướng dẫn cách vứt ngắn gọn." : "Đóng vai một học sinh lớp A2K41 đăng ảnh lên mạng xã hội của lớp. Hãy viết 3 dòng trạng thái (caption) ngắn gọn, tự nhiên, xưng hô 'mình' hoặc 'lớp tớ' về bức ảnh này. Gợi ý 1: Vui vẻ. Gợi ý 2: Ý nghĩa. Gợi ý 3: Hài hước. Mỗi gợi ý 1 dòng gạch đầu dòng."; 
    let description = ""; 
    if(!isTrash) { const d = prompt("Nhập mô tả cho ảnh (Hoặc để trống để AI gợi ý caption):"); if(d === null) return; description = d; } 
    document.getElementById('upload-loading-text').innerText = isTrash ? "AI đang soi rác..." : "AI đang viết caption..."; document.getElementById('upload-overlay').style.display='flex'; 
    try { 
        const fd = new FormData(); fd.append('file',f); fd.append('upload_preset',UPLOAD_PRESET); 
        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{method:'POST',body:fd}); const j = await r.json(); 
        if(j.secure_url) { 
            if(isTrash || !description) { 
                try { const base64Img = await fileToBase64(f); const aiResult = await callGeminiAPI(aiPrompt, base64Img); if(isTrash) { alert(`🤖 AI Kết luận:\n${aiResult}`); description = aiResult; } else { description = aiResult; } } catch(err) { console.error(err); if(isTrash) alert("AI lỗi, không thể phân loại."); } 
            } 
            await addDoc(collection(db, currentCollection), { url: j.secure_url, desc: description || "Không có mô tả", uid: currentUser.uid, authorName: currentUser.displayName, authorID: currentUser.customID || "@unknown", authorAvatar: currentUser.photoURL, className: currentUser.class, type: window.uploadMode, createdAt: serverTimestamp(), likes: [], comments: [], archived: false }); 
            if(!isTrash) alert("Đăng ảnh thành công!\n(AI đã tự viết caption cho bạn nếu bạn để trống)"); 
        } 
    } catch(e) { console.error(e); alert("Lỗi tải ảnh: " + e.message); } 
    document.getElementById('upload-overlay').style.display='none'; i.value=""; 
}

// --- OPTIMIZE IMAGE & RENDER GRID ---
// Cải tiến: Thêm tham số width để Cloudinary resize ảnh nhỏ lại
const optimizeUrl = (url, width) => {
    if (url.includes('cloudinary.com')) {
        let params = 'f_auto,q_auto';
        if (width) params += `,w_${width}`;
        return url.replace('/upload/', `/upload/${params}/`);
    }
    return url;
};

function renderGrid(col, elId, uR, cR) {
    if(State.unsubscribes[col]) State.unsubscribes[col]();
    const unsub = onSnapshot(query(collection(db, col), where("archived", "!=", true)), (snap) => {
        const g = document.getElementById(elId); if(!g) return;
        
        // Tối ưu: Dùng buffer để render 1 lần
        let gridHtml = ""; 
        let uS={}, cS={}, docs=[];
        snap.forEach(d=>docs.push({id:d.id,...d.data()})); docs.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
        
        if(col === 'gallery' && docs.length > 0) {
            const topPost = [...docs].sort((a,b) => (b.likes?b.likes.length:0) - (a.likes?a.likes.length:0))[0];
            if(topPost) {
                document.getElementById('featured-post').style.display = 'flex';
                // Load ảnh top chất lượng cao hơn chút (w_800)
                document.getElementById('feat-img').src = optimizeUrl(topPost.url, 800); 
                document.getElementById('feat-title').innerText = "TOP 1 ĐƯỢC YÊU THÍCH"; document.getElementById('feat-desc').innerText = topPost.desc; document.getElementById('feat-author').innerText = "— " + topPost.authorName;
            }
        }

        docs.forEach(d => {
            const l = d.likes?d.likes.length:0; if(!uS[d.authorName])uS[d.authorName]=0; uS[d.authorName]+=l; const cl=d.className||"Khác"; if(!cS[cl])cS[cl]=0; cS[cl]+=l;
            let ctrls=""; 
            if(currentUser && (currentUser.uid===d.uid || isAdmin(currentUser.email))){ ctrls=`<div class="owner-controls"><button class="ctrl-btn" onclick="event.stopPropagation();editPost('${col}','${d.id}','${d.desc}')"><i class="fas fa-pen"></i></button><button class="ctrl-btn" onclick="event.stopPropagation();deletePost('${col}','${d.id}')" style="color:red;margin-left:5px"><i class="fas fa-trash"></i></button></div>`; }
            let badge = "";
            if(d.type === 'trash') badge = `<span style="position:absolute; top:10px; left:10px; background:#ff9800; color:white; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; z-index:5;">AI Soi Rác</span>`;
            else if(d.type === 'contest') badge = `<span style="position:absolute; top:10px; left:10px; background:var(--info); color:white; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; z-index:5;">Thi Đua</span>`;
            
            // LAZY LOADING + OPTIMIZED URL (w_400 cho thumbnail)
            gridHtml += `<div class="gallery-item" onclick="openLightbox('${col}','${d.id}')">${badge}${ctrls}<div class="gallery-img-container"><img src="${optimizeUrl(d.url, 400)}" class="gallery-img" loading="lazy"></div><div class="gallery-info"><div class="gallery-title">${d.desc}</div><div class="gallery-meta"><div style="display:flex;align-items:center"><img src="${d.authorAvatar||'https://via.placeholder.com/20'}" class="post-avatar"> <span>${d.authorID||d.authorName}</span></div><span><i class="fas fa-heart" style="color:${d.likes?.includes(currentUser?.uid)?'red':'#ccc'}"></i> ${l}</span></div><div class="grid-actions"><button class="grid-act-btn" onclick="event.stopPropagation(); alert('Link ảnh: ${d.url}')"><i class="fas fa-share"></i> Share</button></div></div></div>`;
        });
        
        g.innerHTML = gridHtml; // Gán 1 lần duy nhất
        renderRank(uR.id, uS); renderRank(cR.id, cS);
    });
    State.unsubscribes[col] = unsub;
}
function renderRank(eid, obj) { const s=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,5); const b=document.getElementById(eid); if(!b) return; b.innerHTML=""; s.forEach((i,x)=>{ b.innerHTML+=`<tr class="${x===0?'rank-top-1':''}"><td><span class="rank-num">${x+1}</span> ${i[0]}</td><td style="text-align:right;font-weight:bold;color:var(--primary)">${i[1]} <i class="fas fa-heart"></i></td></tr>`; }); if(!s.length)b.innerHTML="<tr><td style='text-align:center'>Chưa có dữ liệu</td></tr>"; }

window.openLightbox = async (c, i) => { 
    currentImgId=i; currentImgCollection=c; document.getElementById('lightbox').style.display='flex'; 
    const s=await getDoc(doc(db,c,i)); const d=s.data(); 
    const imgArea = document.getElementById('lb-zoom-area'); imgArea.classList.remove('zoomed'); 
    const imgEl = document.getElementById('lb-img'); imgEl.style.transform = "scale(1)"; 
    // Load ảnh full HD khi xem chi tiết (không truyền width hoặc truyền 1200)
    imgEl.src=optimizeUrl(d.url, 1200); 
    document.getElementById('lb-author-avatar').src=d.authorAvatar||'https://via.placeholder.com/35'; document.getElementById('lb-author-name').innerHTML=d.authorName; document.getElementById('lb-custom-id').innerText=d.authorID || ""; document.getElementById('lb-desc').innerText=d.desc; document.getElementById('lb-like-count').innerText=d.likes?d.likes.length:0; 
    const btn = document.getElementById('lb-like-btn'); 
    if(currentUser && d.likes?.includes(currentUser.uid)) { btn.classList.add('liked'); btn.style.color='#e53935'; } else { btn.classList.remove('liked'); btn.style.color='var(--text-sec)'; } 
    const controls = document.getElementById('lb-owner-controls');
    if(currentUser && (currentUser.uid === d.uid || isAdmin(currentUser.email))) { controls.style.display = 'flex'; document.querySelector('.lb-btn-pin').style.display = isAdmin(currentUser.email) ? 'block' : 'none'; } else { controls.style.display = 'none'; }
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

window.pinPost = async () => { await setDoc(doc(db, "settings", "featured"), { col: currentCollection, id: currentImgId }); alert("Đã ghim bài viết lên trang chủ!"); }
window.deletePostFromLB = async () => { if(confirm("Bạn chắc chắn muốn xóa bài viết này chứ?")) { await deleteDoc(doc(db, currentCollection, currentImgId)); closeLightbox(); alert("Đã xóa bài viết!"); } }
window.editPostFromLB = async () => { const newDesc = prompt("Nhập mô tả mới:"); if(newDesc) { await updateDoc(doc(db, currentCollection, currentImgId), { desc: newDesc }); document.getElementById('lb-desc').innerText = newDesc; } }

window.handleLike = async () => { 
    if(!currentUser) return alert("Vui lòng đăng nhập để thả tim!"); 
    const btn = document.getElementById('lb-like-btn'); const countSpan = document.getElementById('lb-like-count');
    let currentCount = parseInt(countSpan.innerText); const isLiked = btn.classList.contains('liked');
    if (isLiked) { btn.classList.remove('liked'); btn.style.color = 'var(--text-sec)'; countSpan.innerText = Math.max(0, currentCount - 1); await updateDoc(doc(db, currentCollection, currentImgId), { likes: arrayRemove(currentUser.uid) }); } 
    else { btn.classList.add('liked'); btn.style.color = '#e53935'; countSpan.innerText = currentCount + 1; await updateDoc(doc(db, currentCollection, currentImgId), { likes: arrayUnion(currentUser.uid) });
    const postSnap = await getDoc(doc(db, currentCollection, currentImgId)); if(postSnap.exists()){ const ownerId = postSnap.data().uid; pushNotification(ownerId, 'like', `<b>${currentUser.displayName}</b> đã thả tim ảnh của bạn ❤️`, currentImgId, currentCollection); } }
}

function renderComments(arr) { 
    const l=document.getElementById('lb-comments-list'); 
    let html = "";
    arr.forEach(c=>{ html += `<div class="lb-comment-item"><img src="${c.avatar||'https://via.placeholder.com/30'}" class="lb-comment-avatar"><div class="lb-comment-content"><div class="lb-comment-bubble"><span class="lb-comment-user">${c.name}</span><span class="lb-comment-text">${c.text}</span></div></div></div>`; }); 
    l.innerHTML = html;
    l.scrollTop = l.scrollHeight; 
}

window.exportExcel = async (type) => { 
    if(!currentUser || !isAdmin(currentUser.email)) return; 
    Utils.loader(true, "Đang tạo file Excel chuẩn..."); const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('DuLieu'); 
    if (type === 'users') { 
        sheet.columns = [ { header: 'Tên người dùng', key: 'name', width: 25 }, { header: 'Email', key: 'email', width: 30 }, { header: 'ID', key: 'id', width: 15 }, { header: 'Ngày đăng ký', key: 'created', width: 20 }, { header: 'Lớp', key: 'class', width: 15 }, { header: 'Hoạt động cuối', key: 'active', width: 20 }, { header: 'Số lần đăng nhập', key: 'count', width: 15 } ]; 
        const snap = await getDocs(collection(db, "users")); snap.forEach(d => { const u = d.data(); sheet.addRow({ name: u.displayName || '', email: u.email || '', id: u.customID || '', created: u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleString('vi-VN') : '', class: u.class || '', active: u.lastActive ? new Date(u.lastActive.seconds * 1000).toLocaleString('vi-VN') : '', count: u.loginCount || 1 }); }); 
    } else { 
        sheet.columns = [ { header: 'Người đăng', key: 'author', width: 25 }, { header: 'ID', key: 'uid', width: 15 }, { header: 'Lớp', key: 'class', width: 10 }, { header: 'Mô tả', key: 'desc', width: 40 }, { header: 'Tim', key: 'likes', width: 10 }, { header: 'Link ảnh', key: 'url', width: 40 }, { header: 'Ngày đăng', key: 'date', width: 20 } ]; 
        const snap = await getDocs(collection(db, type)); snap.forEach(d => { const p = d.data(); sheet.addRow({ author: p.authorName, uid: p.authorID || '', class: p.className || '', desc: p.desc || '', likes: p.likes ? p.likes.length : 0, url: p.url, date: p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleString('vi-VN') : '' }); }); 
    } 
    const headerRow = sheet.getRow(1); headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }; headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } }; headerRow.alignment = { vertical: 'middle', horizontal: 'center' }; headerRow.height = 30; 
    sheet.eachRow((row, rowNumber) => { row.eachCell((cell) => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; cell.alignment = { vertical: 'middle', wrapText: true }; }); }); 
    const buffer = await workbook.xlsx.writeBuffer(); const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); saveAs(blob, `GreenSchool_${type}_${new Date().toISOString().slice(0,10)}.xlsx`); Utils.loader(false); 
}

window.updateSheetConfig = async () => { const url = document.getElementById('cfg-sheet-url').value; await setDoc(doc(db,"settings","config"),{googleSheetUrl: url},{merge:true}); alert("Đã lưu Link Google Sheet!"); }
window.updateAIConfig = async () => { await setDoc(doc(db,"settings","config"),{geminiKey:document.getElementById('cfg-ai-key').value},{merge:true}); alert("Đã lưu API Key! Vui lòng tải lại trang."); location.reload(); }
window.updateMainConfig = async () => { await setDoc(doc(db,"settings","config"),{maintenance:document.getElementById('cfg-maintenance').checked},{merge:true}); alert("Đã lưu!"); }
window.updateLocks = async () => { await setDoc(doc(db,"settings","config"),{locks:{home:document.getElementById('lock-home').checked,greenclass:document.getElementById('lock-greenclass').checked,contest:document.getElementById('lock-contest').checked,activities:document.getElementById('lock-activities').checked,guide:document.getElementById('lock-guide').checked,archive:document.getElementById('lock-archive').checked}},{merge:true}); alert("Đã lưu!"); }
window.updateDeadlines = async () => { await setDoc(doc(db,"settings","config"),{deadlines:{gallery:document.getElementById('time-gallery').value,contest:document.getElementById('time-contest').value}},{merge:true}); alert("Đã lưu!"); }
window.archiveSeason = async (c) => { if(!confirm("Lưu trữ?"))return; const n=prompt("Tên đợt:"); if(!n)return; const q=query(collection(db,c),where("archived","!=",true)); const s=await getDocs(q); const u=[]; s.forEach(d=>u.push(updateDoc(doc(db,c,d.id),{archived:true,archiveLabel:n}))); await Promise.all(u); await addDoc(collection(db,"archives_meta"),{collection:c,label:n,archivedAt:serverTimestamp()}); alert("Xong!"); }
window.loadArchiveSeasons = async () => { const s=document.getElementById('archive-season-select'); s.innerHTML='<option value="ALL">📂 Tất cả ảnh lưu trữ</option>'; const q=query(collection(db,"archives_meta"),where("collection","==",activeArchiveTab)); const sn=await getDocs(q); const docs = []; sn.forEach(d => docs.push(d.data())); docs.sort((a,b) => (b.archivedAt?.seconds || 0) - (a.archivedAt?.seconds || 0)); docs.forEach(d=>s.innerHTML+=`<option value="${d.label}">${d.label}</option>`); }
window.loadArchiveGrid = async () => { const l=document.getElementById('archive-season-select').value; const k=document.getElementById('archive-search').value.toLowerCase(); const g=document.getElementById('archive-grid'); g.innerHTML="Loading..."; let q; if(l === 'ALL') q = query(collection(db,activeArchiveTab),where("archived","==",true)); else q = query(collection(db,activeArchiveTab),where("archived","==",true),where("archiveLabel","==",l)); const s=await getDocs(q); g.innerHTML=""; if(s.empty) { g.innerHTML = "<p>Không có dữ liệu.</p>"; return; } 
    let html = "";
    s.forEach(d=>{ const da=d.data(); if(k && !da.authorName.toLowerCase().includes(k) && !da.desc.toLowerCase().includes(k) && !(da.authorID||"").toLowerCase().includes(k)) return; html += `<div class="gallery-item" onclick="openLightbox('${activeArchiveTab}','${d.id}')"><div class="gallery-img-container"><img src="${optimizeUrl(da.url, 400)}" class="gallery-img"></div><div class="gallery-info"><div class="gallery-title">${da.desc}</div><div class="gallery-meta"><span>${da.authorID||da.authorName}</span></div></div></div>`; }); 
    g.innerHTML = html;
}
window.switchArchiveTab = (t) => { activeArchiveTab=t; document.querySelectorAll('.archive-tab').forEach(e=>e.classList.remove('active')); document.getElementById(`tab-ar-${t}`).classList.add('active'); loadArchiveSeasons(); loadArchiveGrid(); }
window.pinPost = async () => { await setDoc(doc(db, "settings", "featured"), { col: currentImgCollection, id: currentImgId }); alert("Đã ghim!"); }
window.loadAdminData = async () => { if(!currentUser||!isAdmin(currentUser.email))return; const b=document.getElementById('user-table-body'); b.innerHTML="Loading..."; const s=await getDocs(collection(db,"users")); let html = ""; s.forEach(d=>{const u=d.data(); const btn=u.banned?`<button onclick="togBan('${d.id}',0)">Mở</button>`:`<button onclick="togBan('${d.id}',1)" style="color:red">Khóa</button>`; html+=`<tr><td>${u.displayName}</td><td>${u.email}</td><td>${u.class||'-'}</td><td>${u.banned?'KHÓA':'Active'}</td><td>${btn}</td></tr>`}); b.innerHTML = html; }
window.togBan = async (id, st) => { if(confirm("Xác nhận?")) { await updateDoc(doc(db, "users", id), { banned: !!st }); loadAdminData(); } }
window.deletePost = async (c, i) => { if(confirm("Xóa bài?")) await deleteDoc(doc(db, c, i)); }
window.editPost = async (c, i, o) => { const n = prompt("Sửa:", o); if(n) await updateDoc(doc(db, c, i), { desc: n }); }
window.requestDeleteAccount = async () => { if(confirm("Xóa tk?")) { await updateDoc(doc(db, "users", currentUser.uid), { status: 'deleted' }); location.reload(); } }
window.restoreAccount = async () => { await updateDoc(doc(db, "users", currentUser.uid), { status: 'active' }); location.reload(); }
async function checkUniqueID(id) { const q = query(collection(db, "users"), where("customID", "==", id)); const snap = await getDocs(q); return snap.empty; }
window.updateProfile = async (e) => { e.preventDefault(); const n = document.getElementById('edit-name').value; const cid = document.getElementById('edit-custom-id').value; const c = document.getElementById('edit-class').value; const b = document.getElementById('edit-bio').value; if(cid !== currentUser.customID) { const isUnique = await checkUniqueID(cid); if(!isUnique) return alert("ID này đã có người dùng!"); } const f = isAdmin(currentUser.email) ? "Admin_xinhxinh" : n; await updateDoc(doc(db, "users", currentUser.uid), { displayName: f, customID: cid, class: c, bio: b }); alert("Đã lưu!"); }

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
window.filterTrash = () => { const k = document.getElementById('trashSearchInput').value.toLowerCase(); const r = document.getElementById('trashContainer'); let html = ""; trashDB.filter(i=>i.n.toLowerCase().includes(k)).forEach(i=>{ html+=`<div class="gallery-item" style="padding:10px;text-align:center"><div class="${i.c}" style="font-weight:bold">${i.t}</div><strong>${i.n}</strong></div>`; }); r.innerHTML = html; }; window.filterTrash();
document.getElementById('daily-tip').innerText = ["Tắt đèn khi ra khỏi lớp.", "Trồng thêm cây xanh.", "Phân loại rác."][Math.floor(Math.random()*3)];
const mainLoginBtn = document.getElementById('main-login-btn'); if(mainLoginBtn) { mainLoginBtn.addEventListener('click', () => { console.log("Login clicked"); signInWithPopup(auth, provider); }); }

let deferredPrompt; const pcMenu = document.querySelector('nav.pc-nav ul'); const installLi = document.createElement('li'); installLi.innerHTML = '<a id="btn-install-pc" style="display:none; color:yellow; cursor:pointer"><i class="fas fa-download"></i> Tải App</a>'; pcMenu.appendChild(installLi); const mobNav = document.querySelector('.mobile-nav-inner'); const installMob = document.createElement('a'); installMob.className = 'nav-item'; installMob.id = 'btn-install-mob'; installMob.style.display = 'none'; installMob.innerHTML = '<i class="fas fa-download"></i><span>TảiApp</span>'; mobNav.insertBefore(installMob, mobNav.firstChild);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; document.getElementById('btn-install-pc').style.display = 'inline-block'; document.getElementById('btn-install-mob').style.display = 'flex'; });
async function installPWA() { if (!deferredPrompt) return; deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; deferredPrompt = null; document.getElementById('btn-install-pc').style.display = 'none'; document.getElementById('btn-install-mob').style.display = 'none'; }
document.getElementById('btn-install-pc').addEventListener('click', installPWA); document.getElementById('btn-install-mob').addEventListener('click', installPWA);
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').then(reg => console.log('SW Registered!', reg)).catch(err => console.log('SW Error:', err)); }); }
