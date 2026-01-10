import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, where, increment, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. CẤU HÌNH HỆ THỐNG (CONFIG) ---
const firebaseConfig = { apiKey: "AIzaSyCJ_XI_fq-yJC909jb9KLIKg3AfGdm6hNs", authDomain: "a2k41nvc-36b0b.firebaseapp.com", projectId: "a2k41nvc-36b0b", storageBucket: "a2k41nvc-36b0b.firebasestorage.app", messagingSenderId: "279516631226", appId: "1:279516631226:web:99012883ed7923ab5c3283" };
const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app); const provider = new GoogleAuthProvider();
const CLOUD_NAME = "dekxvneap"; const UPLOAD_PRESET = "a2k41nvc_upload"; const ADMIN_EMAILS = ["kiet0905478167@gmail.com", "anhkiet119209@gmail.com"];

// Biến toàn cục
let currentUser=null, currentCollection='gallery', currentImgId=null, currentImgCollection=null, activeArchiveTab='gallery', musicId='jfKfPfyJRdk';
let aiKeys = [{name: "Mặc định", val: "AIzaSyAnOwbqmpQcOu_ERINF4nSfEL4ZW95fiGc"}]; 
let chatHistory = [];
let googleSheetUrl = "https://script.google.com/macros/s/AKfycbzilw2SHG74sfCGNktGLuo46xkLNzVSVl6T3HbjXoWAsm9_CmXmuZQmbDxIOJ5cRhyX/exec"; 
const isAdmin=(e)=>ADMIN_EMAILS.includes(e);
const State = { unsubscribes: {} };

// Setup Chatbot
const SYSTEM_PROMPT = `Bạn là Green Bot - Trợ lý ảo AI thân thiện của lớp A2K41 và trường Green School. Xưng hô Tớ/Cậu. Luôn vui vẻ, dùng emoji.`;
chatHistory.push({ role: "user", parts: [{ text: SYSTEM_PROMPT }] });
chatHistory.push({ role: "model", parts: [{ text: "Okie, tớ nhớ rồi! 🌱" }] });

// --- 2. CÁC HÀM TIỆN ÍCH (UTILS) ---
const Utils = {
    loader: (show, text="Đang xử lý...") => {
        document.getElementById('upload-overlay').style.display = show ? 'flex' : 'none';
        document.getElementById('upload-loading-text').innerText = text;
    }
};

// Hàm tối ưu link ảnh Cloudinary (Nén ảnh tự động)
const optimizeUrl = (url) => {
    if (url && url.includes('cloudinary.com')) return url.replace('/upload/', '/upload/f_auto,q_auto/');
    return url;
};

// --- 3. DARK MODE & UI LOGIC ---
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    // Cập nhật icon
    const icon = document.getElementById('dark-icon');
    if(icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    // Lưu cài đặt
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    // Cập nhật nút gạt trong Settings nếu đang mở
    const toggle = document.getElementById('set-darkmode');
    if(toggle) toggle.checked = isDark;
}

// Chạy khi tải trang
window.addEventListener('load', () => {
    // 1. Check Theme
    if (localStorage.getItem('theme') === 'dark') window.toggleDarkMode();
    
    // 2. Check WebView (Zalo/FB)
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if ((ua.indexOf('Instagram') > -1) || (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("Zalo") > -1)) {
        document.getElementById('webview-warning').style.display = 'flex';
    }
    
    // 3. Init Router
    handleRoute();
});

// --- 4. SINH NHẬT & CONFESSIONS ---
function checkBirthday(user) {
    if (!user.dob) return;
    const today = new Date();
    const dob = new Date(user.dob);
    if (today.getDate() === dob.getDate() && today.getMonth() === dob.getMonth()) {
        const alertBox = document.getElementById('birthday-alert');
        if(alertBox) {
            alertBox.style.display = 'block';
            // Bắn pháo hoa (nếu thư viện đã load)
            if(typeof confetti === 'function') confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
    }
}

// Logic Confessions
let confessUnsub = null;
function listenConfessions() {
    if(confessUnsub) confessUnsub();
    const q = query(collection(db, "confessions"), orderBy("createdAt", "desc"), limit(20));
    confessUnsub = onSnapshot(q, (snap) => {
        const list = document.getElementById('confession-list');
        if(!list) return;
        if(snap.empty) { list.innerHTML = '<div style="text-align:center;color:var(--text-sec)">Chưa có tâm sự nào...</div>'; return; }
        let html = "";
        snap.forEach(d => {
            const data = d.data();
            const date = data.createdAt ? new Date(data.createdAt.seconds*1000).toLocaleString('vi-VN') : 'Vừa xong';
            let delBtn = "";
            if(currentUser && isAdmin(currentUser.email)) {
                delBtn = `<span class="confess-delete" onclick="deleteConfess('${d.id}')">Xóa</span>`;
            }
            html += `<div class="confess-item"><div class="confess-content">"${data.text}"</div><div class="confess-meta"><span>${date}</span> ${delBtn}</div></div>`;
        });
        list.innerHTML = html;
    });
}

window.postConfession = async () => {
    const txt = document.getElementById('confess-content').value.trim();
    if(!txt) return;
    if(!currentUser) return alert("Bạn cần đăng nhập để gửi (Danh tính sẽ được ẩn)");
    await addDoc(collection(db, "confessions"), { text: txt, authorUid: currentUser.uid, createdAt: serverTimestamp() }); // Lưu uid để chặn spam nếu cần, nhưng không hiển thị tên
    document.getElementById('confess-content').value = "";
    alert("Đã gửi tâm sự lên bảng tin!");
}

window.deleteConfess = async (id) => {
    if(confirm("Xóa tâm sự này?")) await deleteDoc(doc(db, "confessions", id));
}

// --- 5. HỆ THỐNG THÔNG BÁO (NOTIFICATION) ---
function listenForNotifications() {
    onSnapshot(doc(db, "settings", "notifications"), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            const lastMsg = localStorage.getItem('last_notif_id');
            if (data.id && data.id !== lastMsg && data.text) {
                window.showNotification(data.text);
                localStorage.setItem('last_notif_id', data.id);
            }
        }
    });
}

window.showNotification = (text) => {
    const popup = document.getElementById('notification-popup');
    document.getElementById('notif-text').innerText = text;
    popup.classList.add('show');
    setTimeout(() => popup.classList.remove('show'), 8000);
}
window.closeNotification = () => document.getElementById('notification-popup').classList.remove('show');

let notifUnsub = null;
function listenToMyNotifications(uid) {
    if (notifUnsub) notifUnsub();
    const q = query(collection(db, "notifications"), where("recipientUid", "==", uid), limit(50));
    notifUnsub = onSnapshot(q, (snap) => {
        const list = document.getElementById('notif-list-ui');
        const dot = document.getElementById('nav-bell-dot');
        let count = 0; let html = ""; let arr = [];
        if(snap.empty) { list.innerHTML = '<div class="empty-notif">Không có thông báo</div>'; dot.style.display='none'; return; }
        snap.forEach(d => arr.push({id:d.id, ...d.data()}));
        arr.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)); // Sort Client
        arr.forEach(d => {
            if(!d.isRead) count++;
            const time = d.createdAt ? new Date(d.createdAt.seconds*1000).toLocaleString('vi-VN') : 'Vừa xong';
            html += `<div class="notif-item ${d.isRead?'':'unread'}" onclick="clickNotification('${d.id}','${d.collectionRef}','${d.link}')"><img src="${d.senderAvatar||'https://via.placeholder.com/30'}" class="notif-avatar"><div class="notif-body"><p>${d.message}</p><span class="notif-time">${time}</span></div></div>`;
        });
        list.innerHTML = html;
        dot.style.display = count > 0 ? 'block' : 'none';
    });
}

async function pushNotification(uid, type, msg, link, col) { 
    if(currentUser && uid !== currentUser.uid) {
        await addDoc(collection(db,"notifications"), { 
            recipientUid: uid, senderName: currentUser.displayName, senderAvatar: currentUser.photoURL, 
            type, message: msg, link, collectionRef: col, isRead: false, createdAt: serverTimestamp() 
        }); 
    }
}

window.clickNotification = async (id, col, pid) => { 
    await updateDoc(doc(db,"notifications",id), {isRead:true}); 
    if(col&&pid) window.openLightbox(col,pid); 
    document.getElementById('notif-dropdown').classList.remove('active'); 
}
window.toggleNotifDropdown = () => document.getElementById('notif-dropdown').classList.toggle('active');
window.markAllRead = () => document.querySelectorAll('.notif-item.unread').forEach(e=>e.classList.remove('unread'));

// --- 6. XÁC THỰC & NGƯỜI DÙNG (AUTH) ---
window.handleLogout=async()=>{await signOut(auth);alert("Đã đăng xuất");location.reload();}
window.checkAdminLogin=()=>signInWithPopup(auth,provider);

async function syncToGoogleSheet(user) { 
    if (!googleSheetUrl) return; 
    try { 
        const payload = { 
            displayName: user.displayName, email: user.email, customID: user.customID, 
            createdAt: user.createdAt?.toDate ? user.createdAt.toDate().toString() : new Date().toString(),
            classInfo: user.class, lastActive: new Date().toString(), loginCount: user.loginCount, uid: user.uid 
        }; 
        await fetch(googleSheetUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); 
    } catch (e) { console.error("Sync Error:", e); } 
}

onAuthStateChanged(auth, async(u)=>{
    // Load public data first
    renderGrid('gallery', 'gallery-grid', {id:'rank-gallery-user'}, {id:'rank-gallery-class'});
    renderGrid('contest', 'contest-grid', {id:'rank-contest-user'}, {id:'rank-contest-class'});
    listenForNotifications(); // Admin global notifs
    listenConfessions();

    if(u){
        const r=doc(db,"users",u.uid), s=await getDoc(r); let userData;
        if(s.exists()){ 
            const d=s.data(); 
            if(d.banned){alert("Tài khoản bị khóa!");signOut(auth);return;} 
            userData={...d}; await updateDoc(r,{lastActive:serverTimestamp(), loginCount: increment(1)}); 
        } else { 
            userData={uid:u.uid, email:u.email, displayName:isAdmin(u.email)?"Admin":u.displayName, photoURL:u.photoURL, role:isAdmin(u.email)?'admin':'member', status:'active', class:"", customID:"@"+u.uid.slice(0,5), createdAt:serverTimestamp(), loginCount:1}; 
            await setDoc(r,userData); 
        }
        currentUser=userData; syncToGoogleSheet(currentUser); listenToMyNotifications(u.uid); 
        
        handleRoute(); // Redirect logic
        checkBirthday(currentUser); // Birthday logic

        // Fill Profile Data
        document.getElementById('profile-in').style.display='block'; document.getElementById('profile-out').style.display='none'; document.getElementById('home-login-area').style.display='none';
        document.getElementById('p-avatar').src=currentUser.photoURL; document.getElementById('p-name').innerHTML=isAdmin(currentUser.email)?"<span style='color:red'>Admin ✅</span>":currentUser.displayName;
        document.getElementById('p-custom-id').innerText=currentUser.customID||""; document.getElementById('p-email').innerText=currentUser.email;
        document.getElementById('edit-name').value=currentUser.displayName; document.getElementById('edit-custom-id').value=currentUser.customID||""; 
        document.getElementById('edit-class').value=currentUser.class||""; document.getElementById('edit-bio').value=currentUser.bio||"";
        if(currentUser.dob) document.getElementById('edit-dob').value = currentUser.dob;

        if(isAdmin(currentUser.email)){ 
            document.getElementById('menu-pc-admin').style.display='block'; 
            document.getElementById('mob-admin').style.display='flex'; 
            document.getElementById('maintenance-overlay').style.display='none'; // Admin always bypass maintenance
        }
    } else {
        currentUser=null; if(notifUnsub) notifUnsub();
        document.getElementById('profile-in').style.display='none'; document.getElementById('profile-out').style.display='block'; 
        document.getElementById('home-login-area').style.display='block'; 
        document.getElementById('menu-pc-admin').style.display='none'; document.getElementById('mob-admin').style.display='none';
    }
});

window.updateProfile = async (e) => {
    e.preventDefault();
    const name = document.getElementById('edit-name').value;
    const dob = document.getElementById('edit-dob').value;
    const cls = document.getElementById('edit-class').value;
    const bio = document.getElementById('edit-bio').value;
    const cid = document.getElementById('edit-custom-id').value;
    
    // Check ID Unique (Optional - Simplified)
    if(cid !== currentUser.customID) {
        const q = query(collection(db, "users"), where("customID", "==", cid));
        const snap = await getDocs(q);
        if(!snap.empty) return alert("ID này đã có người dùng!");
    }

    await updateDoc(doc(db,"users",currentUser.uid), { displayName: name, dob: dob, class: cls, bio: bio, customID: cid });
    alert("Đã lưu hồ sơ!");
}

window.changeAvatar=async(i)=>{
    const f=i.files[0];if(!f)return;
    const fd=new FormData();fd.append('file',f);fd.append('upload_preset',UPLOAD_PRESET);
    Utils.loader(true, "Đang tải ảnh...");
    try{
        const r=await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{method:'POST',body:fd});
        const j=await r.json();
        if(j.secure_url){await updateDoc(doc(db,"users",currentUser.uid),{photoURL:j.secure_url});alert("Xong!");location.reload();}
    }catch(e){alert("Lỗi tải ảnh!");}
    Utils.loader(false);
}

// --- 7. UPLOAD ẢNH & HIỂN THỊ (GRID) ---
window.checkLoginAndUpload = (c) => { 
    if(!currentUser) { alert("Vui lòng đăng nhập!"); return; } 
    if(!currentUser.class) { alert("Vui lòng cập nhật Lớp trước!"); showPage('profile'); return; } 
    window.uploadMode = c; currentCollection = (c === 'trash') ? 'gallery' : c; 
    document.getElementById('file-input').click(); 
}

window.executeUpload = async (i) => { 
    const f = i.files[0]; if(!f) return; 
    const isTrash = (window.uploadMode === 'trash'); 
    let aiPrompt = isTrash ? "Đây là loại rác gì? Phân loại (Hữu cơ, Tái chế, Khác)? Hướng dẫn vứt." : "Viết 3 caption ngắn gọn, vui vẻ cho ảnh kỷ yếu lớp học này."; 
    let description = ""; 
    if(!isTrash) { 
        const d = prompt("Nhập mô tả (để trống để AI viết):"); 
        if(d === null) return; description = d; 
    } 
    
    Utils.loader(true, isTrash ? "AI đang soi rác..." : "Đang đăng ảnh...");
    try { 
        const fd = new FormData(); fd.append('file',f); fd.append('upload_preset',UPLOAD_PRESET); 
        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{method:'POST',body:fd}); const j = await r.json(); 
        if(j.secure_url) { 
            if(isTrash || !description) { 
                try { 
                    const base64Img = await fileToBase64(f); 
                    const aiResult = await callGeminiAPI(aiPrompt, base64Img); 
                    if(isTrash) { alert(`🤖 AI Kết luận:\n${aiResult}`); description = aiResult; } else { description = aiResult; } 
                } catch(err) { console.error(err); if(isTrash) alert("AI lỗi, không thể phân loại."); } 
            } 
            await addDoc(collection(db, currentCollection), { 
                url: j.secure_url, desc: description || "", uid: currentUser.uid, 
                authorName: currentUser.displayName, authorID: currentUser.customID, authorAvatar: currentUser.photoURL, 
                className: currentUser.class, type: window.uploadMode, createdAt: serverTimestamp(), likes: [], comments: [], archived: false 
            }); 
            if(!isTrash) alert("Đăng ảnh thành công!"); 
        } 
    } catch(e) { console.error(e); alert("Lỗi: " + e.message); } 
    Utils.loader(false); i.value=""; 
}

function renderGrid(col, elId, uR, cR) {
    if(State.unsubscribes[col]) State.unsubscribes[col]();
    // Bỏ qua ảnh đã lưu trữ (archived)
    const unsub = onSnapshot(query(collection(db, col), where("archived", "!=", true)), (snap) => {
        const g = document.getElementById(elId); if(!g) return;
        g.innerHTML = ""; let uS={}, cS={}, docs=[];
        snap.forEach(d=>docs.push({id:d.id,...d.data()})); 
        docs.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
        
        // Logic Featured Post (Top 1)
        if(col === 'gallery' && docs.length > 0) {
            const topPost = [...docs].sort((a,b) => (b.likes?b.likes.length:0) - (a.likes?a.likes.length:0))[0];
            if(topPost) {
                const featDiv = document.getElementById('featured-post');
                if(featDiv) {
                    featDiv.style.display = 'flex';
                    document.getElementById('feat-img').src = optimizeUrl(topPost.url); 
                    document.getElementById('feat-desc').innerText = topPost.desc; 
                    document.getElementById('feat-author').innerText = "— " + topPost.authorName;
                }
            }
        }

        docs.forEach(d => {
            const l = d.likes?d.likes.length:0; 
            if(!uS[d.authorName])uS[d.authorName]=0; uS[d.authorName]+=l; 
            const cl=d.className||"Khác"; if(!cS[cl])cS[cl]=0; cS[cl]+=l;
            
            let ctrls=""; 
            if(currentUser && (currentUser.uid===d.uid || isAdmin(currentUser.email))){ 
                ctrls=`<div class="owner-controls"><button class="ctrl-btn" onclick="event.stopPropagation();editPost('${col}','${d.id}','${d.desc}')"><i class="fas fa-pen"></i></button><button class="ctrl-btn" onclick="event.stopPropagation();deletePost('${col}','${d.id}')" style="color:red;margin-left:5px"><i class="fas fa-trash"></i></button></div>`; 
            }
            
            let badge = "";
            if(d.type === 'trash') badge = `<span style="position:absolute;top:10px;left:10px;background:#ff9800;color:white;padding:4px 8px;border-radius:4px;font-size:0.7rem;z-index:5;">AI Soi Rác</span>`;
            
            // LAZY LOADING & OPTIMIZED URL
            g.innerHTML += `<div class="gallery-item" onclick="openLightbox('${col}','${d.id}')">${badge}${ctrls}<div class="gallery-img-container"><img src="${optimizeUrl(d.url)}" class="gallery-img" loading="lazy"></div><div class="gallery-info"><div class="gallery-title">${d.desc}</div><div class="gallery-meta"><span>${d.authorName}</span><span><i class="fas fa-heart" style="color:${d.likes?.includes(currentUser?.uid)?'red':'#ccc'}"></i> ${l}</span></div></div></div>`;
        });
        renderRank(uR.id, uS); renderRank(cR.id, cS);
    });
    State.unsubscribes[col] = unsub;
}
function renderRank(eid, obj) { const s=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,5); const b=document.getElementById(eid); if(!b) return; b.innerHTML=""; s.forEach((i,x)=>{ b.innerHTML+=`<tr class="${x===0?'rank-top-1':''}"><td><span class="rank-num">${x+1}</span> ${i[0]}</td><td style="text-align:right;font-weight:bold;color:var(--primary)">${i[1]} <i class="fas fa-heart"></i></td></tr>`; }); }

// --- 8. LIGHTBOX & INTERACTION ---
window.openLightbox = async (c, i) => { 
    currentImgId=i; currentImgCollection=c; document.getElementById('lightbox').style.display='flex'; 
    const s=await getDoc(doc(db,c,i)); const d=s.data(); 
    document.getElementById('lb-img').src=optimizeUrl(d.url); 
    document.getElementById('lb-author-avatar').src=d.authorAvatar; 
    document.getElementById('lb-author-name').innerHTML=d.authorName; 
    document.getElementById('lb-custom-id').innerText=d.authorID||""; 
    document.getElementById('lb-desc').innerText=d.desc; 
    document.getElementById('lb-like-count').innerText=d.likes?d.likes.length:0; 
    
    const btn = document.getElementById('lb-like-btn'); 
    if(currentUser && d.likes?.includes(currentUser.uid)) { btn.classList.add('liked'); btn.style.color='#e53935'; } 
    else { btn.classList.remove('liked'); btn.style.color='var(--text-sec)'; } 
    
    const controls = document.getElementById('lb-owner-controls');
    if(currentUser && (currentUser.uid === d.uid || isAdmin(currentUser.email))) { controls.style.display = 'flex'; } else { controls.style.display = 'none'; }
    document.getElementById('lb-details-sheet').classList.remove('open'); renderComments(d.comments||[]); 
}

window.closeLightbox = () => { document.getElementById('lightbox').style.display='none'; document.getElementById('lb-details-sheet').classList.remove('open'); }
window.toggleDetails = () => { document.getElementById('lb-details-sheet').classList.toggle('open'); }

window.handleLike = async () => { 
    if(!currentUser) return alert("Vui lòng đăng nhập!"); 
    const btn = document.getElementById('lb-like-btn'); const countSpan = document.getElementById('lb-like-count');
    let currentCount = parseInt(countSpan.innerText); const isLiked = btn.classList.contains('liked');
    if (isLiked) { 
        btn.classList.remove('liked'); btn.style.color='var(--text-sec)'; countSpan.innerText = Math.max(0, currentCount - 1); 
        await updateDoc(doc(db, currentCollection, currentImgId), { likes: arrayRemove(currentUser.uid) }); 
    } else { 
        btn.classList.add('liked'); btn.style.color='#e53935'; countSpan.innerText = currentCount + 1; 
        await updateDoc(doc(db, currentCollection, currentImgId), { likes: arrayUnion(currentUser.uid) });
        const postSnap = await getDoc(doc(db, currentCollection, currentImgId)); 
        if(postSnap.exists()){ pushNotification(postSnap.data().uid, 'like', `<b>${currentUser.displayName}</b> đã thả tim ảnh của bạn ❤️`, currentImgId, currentCollection); } 
    }
}

window.quickReply = async (text) => {
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    const c = { uid: currentUser.uid, name: currentUser.displayName, avatar: currentUser.photoURL, text: text, time: Date.now() };
    await updateDoc(doc(db, currentCollection, currentImgId), { comments: arrayUnion(c) });
    renderComments([...document.querySelectorAll('.lb-comment-item')].map(e=>({})).concat([c])); // Fake render for speed
    const postSnap = await getDoc(doc(db, currentCollection, currentImgId));
    if(postSnap.exists()){ pushNotification(postSnap.data().uid, 'comment', `<b>${currentUser.displayName}</b> đã bình luận: "${text}"`, currentImgId, currentCollection); }
}
function renderComments(arr) { const l=document.getElementById('lb-comments-list'); l.innerHTML=""; arr.forEach(c=>{ l.innerHTML+=`<div class="lb-comment-item"><img src="${c.avatar}" class="lb-comment-avatar"><div class="lb-comment-content"><div class="lb-comment-bubble"><span class="lb-comment-user">${c.name}</span><span class="lb-comment-text">${c.text}</span></div></div></div>`; }); l.scrollTop = l.scrollHeight; }

window.pinPost = async () => { await setDoc(doc(db, "settings", "featured"), { col: currentCollection, id: currentImgId }); alert("Đã ghim!"); }
window.deletePostFromLB = async () => { if(confirm("Xóa bài?")) { await deleteDoc(doc(db, currentCollection, currentImgId)); closeLightbox(); alert("Đã xóa!"); } }
window.editPostFromLB = async () => { const n = prompt("Sửa mô tả:"); if(n) { await updateDoc(doc(db, currentCollection, currentImgId), { desc: n }); document.getElementById('lb-desc').innerText = n; } }
window.deletePost = async (c, i) => { if(confirm("Xóa bài?")) await deleteDoc(doc(db, c, i)); }
window.editPost = async (c, i, o) => { const n = prompt("Sửa:", o); if(n) await updateDoc(doc(db, c, i), { desc: n }); }

// --- 9. ADMIN PANEL & EXCEL ---
window.sendAdminNotification = async () => {
    const text = document.getElementById('admin-notif-msg').value; if(!text) return;
    await setDoc(doc(db, "settings", "notifications"), { text: text, id: Date.now().toString(), createdAt: serverTimestamp() });
    alert("Đã gửi!");
}
window.addAIKey = async () => {
    const name = document.getElementById('new-key-name').value; const val = document.getElementById('new-key-val').value;
    if(!name || !val) return;
    await updateDoc(doc(db, "settings", "config"), { aiKeys: arrayUnion({name, val}) }); alert("Đã thêm!");
}
window.testAIConnection = async () => { try { await callGeminiAPI("Hello"); alert("OK!"); } catch(e) { alert("Lỗi!"); } }
window.updateSheetConfig = async () => { await setDoc(doc(db,"settings","config"),{googleSheetUrl: document.getElementById('cfg-sheet-url').value},{merge:true}); alert("Lưu!"); }
window.updateMainConfig = async () => { await setDoc(doc(db,"settings","config"),{maintenance:document.getElementById('cfg-maintenance').checked},{merge:true}); }
window.updateLocks = async () => { 
    const locks = {
        home:document.getElementById('lock-home').checked, greenclass:document.getElementById('lock-greenclass').checked,
        contest:document.getElementById('lock-contest').checked, activities:document.getElementById('lock-activities').checked,
        guide:document.getElementById('lock-guide').checked, archive:document.getElementById('lock-archive').checked
    };
    await setDoc(doc(db,"settings","config"),{locks},{merge:true}); alert("Lưu!"); 
}
window.updateDeadlines = async () => { await setDoc(doc(db,"settings","config"),{deadlines:{gallery:document.getElementById('time-gallery').value,contest:document.getElementById('time-contest').value}},{merge:true}); alert("Lưu!"); }
window.archiveSeason = async (c) => { 
    if(!confirm("Lưu trữ?"))return; const n=prompt("Tên đợt:"); if(!n)return; 
    const q=query(collection(db,c),where("archived","!=",true)); const s=await getDocs(q); 
    const u=[]; s.forEach(d=>u.push(updateDoc(doc(db,c,d.id),{archived:true,archiveLabel:n}))); 
    await Promise.all(u); await addDoc(collection(db,"archives_meta"),{collection:c,label:n,archivedAt:serverTimestamp()}); alert("Xong!"); 
}
window.loadAdminData = async () => { 
    const b=document.getElementById('user-table-body'); b.innerHTML="Loading..."; const s=await getDocs(collection(db,"users")); b.innerHTML=""; 
    s.forEach(d=>{const u=d.data(); const btn=u.banned?`<button onclick="togBan('${d.id}',0)">Mở</button>`:`<button onclick="togBan('${d.id}',1)" style="color:red">Khóa</button>`; b.innerHTML+=`<tr><td>${u.displayName}</td><td>${u.email}</td><td>${u.class||'-'}</td><td>${u.banned?'KHÓA':'Active'}</td><td>${btn}</td></tr>`}); 
}
window.togBan = async (id, st) => { if(confirm("Đổi trạng thái?")) { await updateDoc(doc(db, "users", id), { banned: !!st }); loadAdminData(); } }

window.exportExcel = async (type) => { 
    if(!currentUser || !isAdmin(currentUser.email)) return; 
    Utils.loader(true, "Xuất Excel..."); const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Data'); 
    if (type === 'users') { 
        sheet.columns = [ { header: 'Tên', key: 'n' }, { header: 'Email', key: 'e' }, { header: 'Lớp', key: 'c' }, { header: 'ID', key: 'i' } ]; 
        const snap = await getDocs(collection(db, "users")); snap.forEach(d => { const u = d.data(); sheet.addRow({ n: u.displayName, e: u.email, c: u.class, i: u.customID }); }); 
    } else { 
        sheet.columns = [ { header: 'Người đăng', key: 'a' }, { header: 'Mô tả', key: 'd' }, { header: 'Link', key: 'u' }, { header: 'Tim', key: 'l' } ]; 
        const snap = await getDocs(collection(db, type)); snap.forEach(d => { const p = d.data(); sheet.addRow({ a: p.authorName, d: p.desc, u: p.url, l: p.likes?.length||0 }); }); 
    } 
    const buf = await workbook.xlsx.writeBuffer(); saveAs(new Blob([buf]), `Backup_${type}.xlsx`); Utils.loader(false); 
}

// --- 10. NHẠC & GEMINI ---
function getYoutubeID(url) { const m = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/); return (m && m[2].length === 11) ? m[2] : url; }
const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api"; var firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
let player; window.onYouTubeIframeAPIReady = function() { player = new YT.Player('player', { height: '0', width: '0', videoId: musicId, events: { 'onStateChange': onPlayerStateChange } }); }
function onPlayerStateChange(event) { const icon = document.getElementById('music-icon-display'); if(event.data == YT.PlayerState.PLAYING) { icon.classList.add('playing'); icon.style.color = 'var(--primary)'; } else { icon.classList.remove('playing'); icon.style.color = 'var(--text)'; } }
window.toggleMusic = () => { try { if(player && player.getPlayerState() == YT.PlayerState.PLAYING) player.pauseVideo(); else if(player) player.playVideo(); } catch(e){} }
window.addNewSong = async () => { const n = document.getElementById('new-song-name').value; let u = document.getElementById('new-song-url').value; if(!n || !u) return; await updateDoc(doc(db, "settings", "config"), { playlist: arrayUnion({name:n, id:getYoutubeID(u)}) }); alert("Thêm xong!"); }
window.playSong = async (id) => { await updateDoc(doc(db, "settings", "config"), { musicId: id }); alert("Đã đổi nhạc!"); }
window.deleteSong = async (n, id) => { if(confirm("Xóa?")) await updateDoc(doc(db, "settings", "config"), { playlist: arrayRemove({name:n, id}) }); }

async function callGeminiAPI(prompt, imageBase64 = null) {
    let contents = imageBase64 ? [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }] }] : chatHistory.concat([{ role: "user", parts: [{ text: prompt }] }]);
    for (let i = 0; i < aiKeys.length; i++) {
        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${aiKeys[i].val}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }) });
            const d = await r.json(); const txt = d.candidates?.[0]?.content?.parts?.[0]?.text || "AI Error";
            if(!imageBase64) chatHistory.push({ role: "model", parts: [{ text: txt }] });
            return txt;
        } catch (e) { if(i===aiKeys.length-1) return "Hết quota AI!"; }
    }
}
window.sendMessageToAI = async (e) => {
    e.preventDefault(); const inp = document.getElementById('ai-input'); const msg = inp.value; if(!msg) return;
    const box = document.getElementById('ai-messages'); box.innerHTML += `<div class="ai-msg user">${msg}</div>`; inp.value=""; box.scrollTop=box.scrollHeight;
    const id = Date.now(); box.innerHTML += `<div class="ai-msg bot" id="${id}">...</div>`;
    const res = await callGeminiAPI(msg); document.getElementById(id).innerText = res; box.scrollTop=box.scrollHeight;
}
window.fillChat = (t) => { document.getElementById('ai-input').value = t; window.sendMessageToAI(new Event('submit')); }
window.toggleAIChat = () => { const w = document.getElementById('ai-window'); w.style.display = w.style.display === 'flex' ? 'none' : 'flex'; }
function fileToBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = error => reject(error); }); }

// --- 11. ROUTING & TRASH ---
function handleRoute() { const hash = window.location.hash.slice(1) || 'home'; showPage(hash); }
window.addEventListener('hashchange', handleRoute);
window.showPage = (id) => {
    const valid = ['home','greenclass','contest','archive','activities','guide','profile','admin','settings'];
    let tid = valid.includes(id)?id:'home';
    if(tid==='admin' && (!currentUser || !isAdmin(currentUser.email))) { alert("Khu vực cấm!"); tid='home'; window.location.hash='home'; }
    
    document.querySelectorAll('.page-section').forEach(p=>p.classList.remove('active'));
    document.getElementById(tid).classList.add('active');
    
    document.querySelectorAll('nav.pc-nav a, nav.mobile-nav a').forEach(a => a.classList.remove('active-menu'));
    if(document.getElementById('menu-pc-'+tid)) document.getElementById('menu-pc-'+tid).classList.add('active-menu');
    if(document.getElementById('mob-'+tid)) document.getElementById('mob-'+tid).classList.add('active-menu');

    if(tid==='archive') { loadArchiveSeasons(); window.switchArchiveTab = (t) => { activeArchiveTab=t; loadArchiveGrid(); }; window.loadArchiveGrid(); }
    if(tid==='settings') {
        if(document.getElementById('set-darkmode')) document.getElementById('set-darkmode').checked = document.body.classList.contains('dark-mode');
    }
    document.title = `Green School - ${tid.toUpperCase()}`;
}

const trashDB = [ {n:"Vỏ sữa",t:"Tái chế",c:"bin-recycle"}, {n:"Chai nhựa",t:"Tái chế",c:"bin-recycle"}, {n:"Giấy vụn",t:"Tái chế",c:"bin-recycle"}, {n:"Vỏ trái cây",t:"Hữu cơ",c:"bin-organic"}, {n:"Lá cây",t:"Hữu cơ",c:"bin-organic"}, {n:"Túi nilon",t:"Rác khác",c:"bin-other"} ];
window.filterTrash = () => { const k = document.getElementById('trashSearchInput').value.toLowerCase(); const r = document.getElementById('trashContainer'); r.innerHTML=""; trashDB.filter(i=>i.n.toLowerCase().includes(k)).forEach(i=>{ r.innerHTML+=`<div class="gallery-item" style="padding:10px;text-align:center"><div class="${i.c}" style="font-weight:bold">${i.t}</div><strong>${i.n}</strong></div>`; }); }; 
window.filterTrash();
document.getElementById('daily-tip').innerText = ["Tắt đèn khi ra khỏi lớp.", "Trồng thêm cây xanh.", "Phân loại rác."][Math.floor(Math.random()*3)];
const mainLoginBtn = document.getElementById('main-login-btn'); if(mainLoginBtn) { mainLoginBtn.addEventListener('click', () => { signInWithPopup(auth, provider); }); }

// --- 12. PWA ---
let deferredPrompt;
const installMob = document.createElement('a'); installMob.className = 'nav-item'; installMob.id = 'btn-install-mob'; installMob.style.display = 'none'; installMob.innerHTML = '<i class="fas fa-download"></i><span>TảiApp</span>'; document.querySelector('.mobile-nav-inner').prepend(installMob);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; document.getElementById('btn-install-mob').style.display = 'flex'; });
async function installPWA() { if (!deferredPrompt) return; deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; deferredPrompt = null; document.getElementById('btn-install-mob').style.display = 'none'; }
document.getElementById('btn-install-mob').addEventListener('click', installPWA);
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js'); }); }
