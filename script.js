import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, where, increment, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIG ---
const firebaseConfig = { apiKey: "AIzaSyCJ_XI_fq-yJC909jb9KLIKg3AfGdm6hNs", authDomain: "a2k41nvc-36b0b.firebaseapp.com", projectId: "a2k41nvc-36b0b", storageBucket: "a2k41nvc-36b0b.firebasestorage.app", messagingSenderId: "279516631226", appId: "1:279516631226:web:99012883ed7923ab5c3283" };
const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app); const provider = new GoogleAuthProvider();
const CLOUD_NAME = "dekxvneap"; const UPLOAD_PRESET = "a2k41nvc_upload"; const ADMIN_EMAILS = ["kiet0905478167@gmail.com", "anhkiet119209@gmail.com"];

let currentUser=null, currentCollection='gallery', currentImgId=null, currentImgCollection=null, activeArchiveTab='gallery', musicId='jfKfPfyJRdk';
let aiKeys = [{name: "Mặc định", val: "AIzaSyAnOwbqmpQcOu_ERINF4nSfEL4ZW95fiGc"}]; 
let chatHistory = [];
let googleSheetUrl = "https://script.google.com/macros/s/AKfycbzilw2SHG74sfCGNktGLuo46xkLNzVSVl6T3HbjXoWAsm9_CmXmuZQmbDxIOJ5cRhyX/exec"; 
const isAdmin=(e)=>ADMIN_EMAILS.includes(e);
const State = { unsubscribes: {} };

const SYSTEM_PROMPT = `Bạn là Green Bot...`;
chatHistory.push({ role: "user", parts: [{ text: SYSTEM_PROMPT }] });
chatHistory.push({ role: "model", parts: [{ text: "Okie!" }] });

// --- UTILS ---
const Utils = {
    loader: (show, text="Đang xử lý...") => {
        document.getElementById('upload-overlay').style.display = show ? 'flex' : 'none';
        document.getElementById('upload-loading-text').innerText = text;
    }
};
const optimizeUrl = (url) => { if (url && url.includes('cloudinary.com')) return url.replace('/upload/', '/upload/f_auto,q_auto/'); return url; };

// --- DARK MODE ---
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    const icon = document.getElementById('dark-icon'); if(icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if(document.getElementById('set-darkmode')) document.getElementById('set-darkmode').checked = isDark;
}
window.addEventListener('load', () => {
    if (localStorage.getItem('theme') === 'dark') window.toggleDarkMode();
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if ((ua.indexOf('Instagram') > -1) || (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("Zalo") > -1)) document.getElementById('webview-warning').style.display = 'flex';
    handleRoute();
});

// --- ADMIN FEATURES (KHÔI PHỤC) ---
// 1. Quản lý AI Key
window.addAIKey = async () => {
    const name = document.getElementById('new-key-name').value.trim();
    const val = document.getElementById('new-key-val').value.trim();
    if(!name || !val) return alert("Nhập đủ tên và key!");
    await updateDoc(doc(db, "settings", "config"), { aiKeys: arrayUnion({name, val}) });
    document.getElementById('new-key-name').value = "";
    document.getElementById('new-key-val').value = "";
    alert("Đã thêm Key!");
}
window.removeAIKey = async (name, val) => {
    if(confirm(`Xóa Key "${name}"?`)) await updateDoc(doc(db, "settings", "config"), { aiKeys: arrayRemove({name, val}) });
}
function renderAIKeys() {
    const list = document.getElementById('ai-key-list');
    if(!list) return;
    list.innerHTML = "";
    aiKeys.forEach(k => {
        list.innerHTML += `<div class="key-item"><span class="key-name">${k.name}</span><span class="key-val">******</span><button class="btn btn-sm btn-danger" onclick="removeAIKey('${k.name}', '${k.val}')">X</button></div>`;
    });
}

// 2. Export Excel (KHÔI PHỤC VÀ SỬA LỖI)
window.exportExcel = async (type) => {
    if(!currentUser || !isAdmin(currentUser.email)) return;
    Utils.loader(true, "Đang xuất Excel...");
    
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Data');
        
        if (type === 'users') {
            sheet.columns = [
                { header: 'Tên hiển thị', key: 'name', width: 25 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'ID', key: 'id', width: 15 },
                { header: 'Lớp', key: 'class', width: 15 },
                { header: 'Ngày tạo', key: 'created', width: 20 },
                { header: 'Login Count', key: 'count', width: 15 }
            ];
            const snap = await getDocs(collection(db, "users"));
            snap.forEach(d => {
                const u = d.data();
                sheet.addRow({
                    name: u.displayName, email: u.email, id: u.customID, class: u.class,
                    created: u.createdAt?.toDate ? u.createdAt.toDate().toLocaleString() : '',
                    count: u.loginCount || 0
                });
            });
        } else {
            // Gallery or Contest
            sheet.columns = [
                { header: 'Người đăng', key: 'author', width: 25 },
                { header: 'ID', key: 'uid', width: 15 },
                { header: 'Mô tả', key: 'desc', width: 40 },
                { header: 'Tim', key: 'likes', width: 10 },
                { header: 'Link ảnh', key: 'url', width: 40 },
                { header: 'Ngày đăng', key: 'date', width: 20 }
            ];
            const snap = await getDocs(collection(db, type));
            snap.forEach(d => {
                const p = d.data();
                sheet.addRow({
                    author: p.authorName, uid: p.uid, desc: p.desc, 
                    likes: p.likes ? p.likes.length : 0, url: p.url,
                    date: p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString() : ''
                });
            });
        }

        // Style header
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        saveAs(blob, `GreenSchool_${type}_${new Date().toISOString().slice(0,10)}.xlsx`);
        alert("Đã tải xuống thành công!");
    } catch (e) {
        console.error(e);
        alert("Lỗi xuất Excel: " + e.message);
    }
    Utils.loader(false);
}

// --- GLOBAL LISTENER (Load Settings & Keys) ---
onSnapshot(doc(db, "settings", "config"), (docSnap) => {
    if(docSnap.exists()) {
        const cfg = docSnap.data();
        // Load AI Keys
        if(cfg.aiKeys && cfg.aiKeys.length > 0) { 
            aiKeys = cfg.aiKeys; 
            renderAIKeys(); // Gọi hàm render để hiện key ra màn hình
        }
        
        if(cfg.googleSheetUrl) { googleSheetUrl = cfg.googleSheetUrl; }
        if(cfg.musicId && cfg.musicId !== musicId) { musicId = cfg.musicId; try{if(player) player.loadVideoById(musicId);}catch(e){} }
        
        // Playlist
        const plDiv = document.getElementById('music-playlist-container'); 
        if(plDiv && cfg.playlist) { 
            plDiv.innerHTML = ""; 
            cfg.playlist.forEach(s => { 
                const style = s.id === cfg.musicId ? 'background:rgba(46, 125, 50, 0.1); border-left:4px solid green;' : ''; 
                plDiv.innerHTML += `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border); ${style}"><span>${s.name}</span> <div><button class="btn btn-sm" onclick="playSong('${s.id}')">▶</button> <button class="btn btn-sm btn-danger" onclick="deleteSong('${s.name}','${s.id}')">🗑</button></div></div>`; 
            }); 
        }
        
        // Locks & Maintenance
        const mDiv = document.getElementById('maintenance-overlay'); 
        if(cfg.maintenance && (!currentUser || !isAdmin(currentUser.email))) mDiv.style.display='flex'; else mDiv.style.display='none';
        applyLock('home',cfg.locks?.home); applyLock('greenclass',cfg.locks?.greenclass); applyLock('contest',cfg.locks?.contest); applyLock('activities',cfg.locks?.activities); applyLock('guide',cfg.locks?.guide); applyLock('archive',cfg.locks?.archive);
        handleTimer('timer-gallery','cd-gallery',cfg.deadlines?.gallery); handleTimer('timer-contest','cd-contest',cfg.deadlines?.contest);
        
        // Update Admin UI Inputs
        if(currentUser && isAdmin(currentUser.email)) {
            if(document.getElementById('cfg-maintenance')) document.getElementById('cfg-maintenance').checked=cfg.maintenance;
            if(document.getElementById('lock-home')) document.getElementById('lock-home').checked=cfg.locks?.home;
            if(document.getElementById('lock-greenclass')) document.getElementById('lock-greenclass').checked=cfg.locks?.greenclass;
            if(document.getElementById('lock-contest')) document.getElementById('lock-contest').checked=cfg.locks?.contest;
            if(document.getElementById('lock-activities')) document.getElementById('lock-activities').checked=cfg.locks?.activities;
            if(document.getElementById('lock-guide')) document.getElementById('lock-guide').checked=cfg.locks?.guide;
            if(document.getElementById('lock-archive')) document.getElementById('lock-archive').checked=cfg.locks?.archive;
            if(document.getElementById('time-gallery')) document.getElementById('time-gallery').value=cfg.deadlines?.gallery||""; 
            if(document.getElementById('time-contest')) document.getElementById('time-contest').value=cfg.deadlines?.contest||"";
            if(document.getElementById('cfg-sheet-url') && cfg.googleSheetUrl) document.getElementById('cfg-sheet-url').value = cfg.googleSheetUrl;
        }
    }
});

function applyLock(s,l){const o=document.getElementById(`locked-${s}`), c=document.getElementById(`content-${s}`); if(l&&(!currentUser||!isAdmin(currentUser.email))){if(o)o.style.display='block';if(c)c.style.display='none';}else{if(o)o.style.display='none';if(c)c.style.display='block';}}
let intervals={}; function handleTimer(e,b,d){if(!d){document.getElementById(b).style.display='none';return;}document.getElementById(b).style.display='block';if(intervals[e])clearInterval(intervals[e]);const end=new Date(d).getTime();intervals[e]=setInterval(()=>{const now=new Date().getTime(),dist=end-now;if(dist<0){clearInterval(intervals[e]);document.getElementById(e).innerHTML="HẾT GIỜ";}else{const d=Math.floor(dist/(1000*60*60*24)),h=Math.floor((dist%(1000*60*60*24))/(1000*60*60)),m=Math.floor((dist%(1000*60*60))/(1000*60));document.getElementById(e).innerHTML=`${d}d ${h}h ${m}p`;}},1000);}

// --- AUTH & DATA ---
onAuthStateChanged(auth, async(u)=>{
    renderGrid('gallery', 'gallery-grid', {id:'rank-gallery-user'}, {id:'rank-gallery-class'});
    renderGrid('contest', 'contest-grid', {id:'rank-contest-user'}, {id:'rank-contest-class'});
    listenForNotifications(); listenConfessions();

    if(u){
        const r=doc(db,"users",u.uid), s=await getDoc(r); let userData;
        if(s.exists()){ const d=s.data(); if(d.banned){alert("Banned!");signOut(auth);return;} userData={...d}; await updateDoc(r,{lastActive:serverTimestamp(), loginCount: increment(1)}); } 
        else { userData={uid:u.uid, email:u.email, displayName:isAdmin(u.email)?"Admin":u.displayName, photoURL:u.photoURL, role:isAdmin(u.email)?'admin':'member', status:'active', class:"", customID:"@"+u.uid.slice(0,5), createdAt:serverTimestamp(), loginCount:1}; await setDoc(r,userData); }
        currentUser=userData; syncToGoogleSheet(currentUser); listenToMyNotifications(u.uid); handleRoute(); checkBirthday(currentUser);

        document.getElementById('profile-in').style.display='block'; document.getElementById('profile-out').style.display='none'; document.getElementById('home-login-area').style.display='none';
        document.getElementById('p-avatar').src=currentUser.photoURL; document.getElementById('p-name').innerHTML=isAdmin(currentUser.email)?"<span style='color:red'>Admin ✅</span>":currentUser.displayName;
        document.getElementById('p-custom-id').innerText=currentUser.customID||""; document.getElementById('p-email').innerText=currentUser.email;
        document.getElementById('edit-name').value=currentUser.displayName; document.getElementById('edit-custom-id').value=currentUser.customID||""; 
        document.getElementById('edit-class').value=currentUser.class||""; document.getElementById('edit-bio').value=currentUser.bio||"";
        if(currentUser.dob) document.getElementById('edit-dob').value = currentUser.dob;

        if(isAdmin(currentUser.email)){ 
            document.getElementById('menu-pc-admin').style.display='block'; 
            document.getElementById('mob-admin').style.display='flex'; 
            document.getElementById('maintenance-overlay').style.display='none';
        }
    } else {
        currentUser=null; if(notifUnsub) notifUnsub();
        document.getElementById('profile-in').style.display='none'; document.getElementById('profile-out').style.display='block'; 
        document.getElementById('home-login-area').style.display='block'; 
        document.getElementById('menu-pc-admin').style.display='none'; document.getElementById('mob-admin').style.display='none';
    }
});

// --- BASIC FUNCTIONS (Upload, Like, etc.) ---
window.updateProfile = async (e) => {
    e.preventDefault();
    const name = document.getElementById('edit-name').value;
    const dob = document.getElementById('edit-dob').value;
    const cls = document.getElementById('edit-class').value;
    const bio = document.getElementById('edit-bio').value;
    const cid = document.getElementById('edit-custom-id').value;
    await updateDoc(doc(db,"users",currentUser.uid), { displayName: name, dob: dob, class: cls, bio: bio, customID: cid });
    alert("Đã lưu hồ sơ!");
}
window.checkLoginAndUpload = (c) => { if(!currentUser) { alert("Vui lòng đăng nhập!"); return; } if(!currentUser.class) { alert("Vui lòng cập nhật Lớp!"); showPage('profile'); return; } window.uploadMode = c; currentCollection = (c === 'trash') ? 'gallery' : c; document.getElementById('file-input').click(); }
window.executeUpload = async (i) => { 
    const f = i.files[0]; if(!f) return; const isTrash = (window.uploadMode === 'trash'); 
    let aiPrompt = isTrash ? "Đây là rác gì? Phân loại? Hướng dẫn vứt." : "Caption ảnh kỷ yếu vui vẻ."; 
    let description = ""; if(!isTrash) { const d = prompt("Nhập mô tả:"); if(d === null) return; description = d; } 
    Utils.loader(true, "Đang xử lý...");
    try { 
        const fd = new FormData(); fd.append('file',f); fd.append('upload_preset',UPLOAD_PRESET); 
        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{method:'POST',body:fd}); const j = await r.json(); 
        if(j.secure_url) { 
            if(isTrash || !description) { 
                try { const base64Img = await fileToBase64(f); const aiResult = await callGeminiAPI(aiPrompt, base64Img); description = aiResult; if(isTrash) alert(`🤖 AI: ${aiResult}`); } catch(err) {} 
            } 
            await addDoc(collection(db, currentCollection), { url: j.secure_url, desc: description || "", uid: currentUser.uid, authorName: currentUser.displayName, authorID: currentUser.customID, authorAvatar: currentUser.photoURL, className: currentUser.class, type: window.uploadMode, createdAt: serverTimestamp(), likes: [], comments: [], archived: false }); 
            if(!isTrash) alert("Đăng thành công!"); 
        } 
    } catch(e) { alert("Lỗi!"); } 
    Utils.loader(false); i.value=""; 
}
function renderGrid(col, elId, uR, cR) {
    if(State.unsubscribes[col]) State.unsubscribes[col]();
    const unsub = onSnapshot(query(collection(db, col), where("archived", "!=", true)), (snap) => {
        const g = document.getElementById(elId); if(!g) return; g.innerHTML = ""; let uS={}, cS={}, docs=[];
        snap.forEach(d=>docs.push({id:d.id,...d.data()})); docs.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
        if(col === 'gallery' && docs.length > 0) {
            const topPost = [...docs].sort((a,b) => (b.likes?b.likes.length:0) - (a.likes?a.likes.length:0))[0];
            if(topPost) {
                document.getElementById('featured-post').style.display = 'flex';
                document.getElementById('feat-img').src = optimizeUrl(topPost.url); 
                document.getElementById('feat-desc').innerText = topPost.desc; document.getElementById('feat-author').innerText = "— " + topPost.authorName;
            }
        }
        docs.forEach(d => {
            const l = d.likes?d.likes.length:0; if(!uS[d.authorName])uS[d.authorName]=0; uS[d.authorName]+=l; const cl=d.className||"Khác"; if(!cS[cl])cS[cl]=0; cS[cl]+=l;
            let ctrls=""; if(currentUser && (currentUser.uid===d.uid || isAdmin(currentUser.email))){ ctrls=`<div class="owner-controls"><button class="ctrl-btn" onclick="event.stopPropagation();editPost('${col}','${d.id}','${d.desc}')"><i class="fas fa-pen"></i></button><button class="ctrl-btn" onclick="event.stopPropagation();deletePost('${col}','${d.id}')" style="color:red;margin-left:5px"><i class="fas fa-trash"></i></button></div>`; }
            let badge = d.type === 'trash' ? `<span style="position:absolute;top:10px;left:10px;background:#ff9800;color:white;padding:4px;font-size:0.7rem;">AI Soi Rác</span>` : '';
            g.innerHTML += `<div class="gallery-item" onclick="openLightbox('${col}','${d.id}')">${badge}${ctrls}<div class="gallery-img-container"><img src="${optimizeUrl(d.url)}" class="gallery-img" loading="lazy"></div><div class="gallery-info"><div class="gallery-title">${d.desc}</div><div class="gallery-meta"><span>${d.authorName}</span><span><i class="fas fa-heart"></i> ${l}</span></div></div></div>`;
        });
        renderRank(uR.id, uS); renderRank(cR.id, cS);
    });
    State.unsubscribes[col] = unsub;
}
function renderRank(eid, obj) { const s=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,5); const b=document.getElementById(eid); if(!b) return; b.innerHTML=""; s.forEach((i,x)=>{ b.innerHTML+=`<tr class="${x===0?'rank-top-1':''}"><td><span class="rank-num">${x+1}</span> ${i[0]}</td><td style="text-align:right;font-weight:bold;color:var(--primary)">${i[1]} <i class="fas fa-heart"></i></td></tr>`; }); }
window.openLightbox = async (c, i) => { currentImgId=i; currentImgCollection=c; document.getElementById('lightbox').style.display='flex'; const s=await getDoc(doc(db,c,i)); const d=s.data(); document.getElementById('lb-img').src=optimizeUrl(d.url); document.getElementById('lb-author-avatar').src=d.authorAvatar; document.getElementById('lb-author-name').innerHTML=d.authorName; document.getElementById('lb-custom-id').innerText=d.authorID||""; document.getElementById('lb-desc').innerText=d.desc; document.getElementById('lb-like-count').innerText=d.likes?d.likes.length:0; const controls = document.getElementById('lb-owner-controls'); if(currentUser && (currentUser.uid === d.uid || isAdmin(currentUser.email))) controls.style.display = 'flex'; else controls.style.display = 'none'; document.getElementById('lb-details-sheet').classList.remove('open'); renderComments(d.comments||[]); }
window.closeLightbox = () => { document.getElementById('lightbox').style.display='none'; document.getElementById('lb-details-sheet').classList.remove('open'); }
window.toggleDetails = () => { document.getElementById('lb-details-sheet').classList.toggle('open'); }
window.handleLike = async () => { if(!currentUser) return alert("Vui lòng đăng nhập!"); const btn = document.getElementById('lb-like-btn'); const countSpan = document.getElementById('lb-like-count'); let currentCount = parseInt(countSpan.innerText); const isLiked = btn.classList.contains('liked'); if (isLiked) { btn.classList.remove('liked'); btn.style.color='var(--text-sec)'; countSpan.innerText = Math.max(0, currentCount - 1); await updateDoc(doc(db, currentCollection, currentImgId), { likes: arrayRemove(currentUser.uid) }); } else { btn.classList.add('liked'); btn.style.color='#e53935'; countSpan.innerText = currentCount + 1; await updateDoc(doc(db, currentCollection, currentImgId), { likes: arrayUnion(currentUser.uid) }); const postSnap = await getDoc(doc(db, currentCollection, currentImgId)); if(postSnap.exists()){ pushNotification(postSnap.data().uid, 'like', `<b>${currentUser.displayName}</b> đã thả tim ảnh của bạn ❤️`, currentImgId, currentCollection); } } }
window.quickReply = async (text) => { if (!currentUser) return alert("Vui lòng đăng nhập!"); const c = { uid: currentUser.uid, name: currentUser.displayName, avatar: currentUser.photoURL, text: text, time: Date.now() }; await updateDoc(doc(db, currentCollection, currentImgId), { comments: arrayUnion(c) }); renderComments([...document.querySelectorAll('.lb-comment-item')].map(e=>({})).concat([c])); const postSnap = await getDoc(doc(db, currentCollection, currentImgId)); if(postSnap.exists()){ pushNotification(postSnap.data().uid, 'comment', `<b>${currentUser.displayName}</b> đã bình luận: "${text}"`, currentImgId, currentCollection); } }
function renderComments(arr) { const l=document.getElementById('lb-comments-list'); l.innerHTML=""; arr.forEach(c=>{ l.innerHTML+=`<div class="lb-comment-item"><img src="${c.avatar}" class="lb-comment-avatar"><div class="lb-comment-content"><div class="lb-comment-bubble"><span class="lb-comment-user">${c.name}</span><span class="lb-comment-text">${c.text}</span></div></div></div>`; }); l.scrollTop = l.scrollHeight; }
window.pinPost = async () => { await setDoc(doc(db, "settings", "featured"), { col: currentCollection, id: currentImgId }); alert("Đã ghim!"); }
window.deletePostFromLB = async () => { if(confirm("Xóa bài?")) { await deleteDoc(doc(db, currentCollection, currentImgId)); closeLightbox(); alert("Đã xóa!"); } }
window.editPostFromLB = async () => { const n = prompt("Sửa mô tả:"); if(n) { await updateDoc(doc(db, currentCollection, currentImgId), { desc: n }); document.getElementById('lb-desc').innerText = n; } }
window.deletePost = async (c, i) => { if(confirm("Xóa bài?")) await deleteDoc(doc(db, c, i)); }
window.editPost = async (c, i, o) => { const n = prompt("Sửa:", o); if(n) await updateDoc(doc(db, c, i), { desc: n }); }
window.requestDeleteAccount = async () => { if(confirm("Xóa tk?")) { await updateDoc(doc(db, "users", currentUser.uid), { status: 'deleted' }); location.reload(); } }
window.restoreAccount = async () => { await updateDoc(doc(db, "users", currentUser.uid), { status: 'active' }); location.reload(); }
async function checkUniqueID(id) { const q = query(collection(db, "users"), where("customID", "==", id)); const snap = await getDocs(q); return snap.empty; }

// --- 10. NHẠC & GEMINI & PWA ---
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
            if(!imageBase64) chatHistory.push({ role: "model", parts: [{ text: txt }] }); return txt;
        } catch (e) { if(i===aiKeys.length-1) return "Hết quota AI!"; }
    }
}
window.sendMessageToAI = async (e) => { e.preventDefault(); const inp = document.getElementById('ai-input'); const msg = inp.value; if(!msg) return; const box = document.getElementById('ai-messages'); box.innerHTML += `<div class="ai-msg user">${msg}</div>`; inp.value=""; box.scrollTop=box.scrollHeight; const id = Date.now(); box.innerHTML += `<div class="ai-msg bot" id="${id}">...</div>`; const res = await callGeminiAPI(msg); document.getElementById(id).innerText = res; box.scrollTop=box.scrollHeight; }
window.fillChat = (t) => { document.getElementById('ai-input').value = t; window.sendMessageToAI(new Event('submit')); }
window.toggleAIChat = () => { const w = document.getElementById('ai-window'); w.style.display = w.style.display === 'flex' ? 'none' : 'flex'; }
function fileToBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = error => reject(error); }); }
function handleRoute() { const hash = window.location.hash.slice(1) || 'home'; showPage(hash); }
window.addEventListener('hashchange', handleRoute);
window.showPage = (id) => {
    const valid = ['home','greenclass','contest','archive','activities','guide','profile','admin','settings']; let tid = valid.includes(id)?id:'home';
    if(tid==='admin' && (!currentUser || !isAdmin(currentUser.email))) { alert("Khu vực cấm!"); tid='home'; window.location.hash='home'; }
    document.querySelectorAll('.page-section').forEach(p=>p.classList.remove('active')); document.getElementById(tid).classList.add('active');
    document.querySelectorAll('nav.pc-nav a, nav.mobile-nav a').forEach(a => a.classList.remove('active-menu'));
    if(document.getElementById('menu-pc-'+tid)) document.getElementById('menu-pc-'+tid).classList.add('active-menu'); if(document.getElementById('mob-'+tid)) document.getElementById('mob-'+tid).classList.add('active-menu');
    if(tid==='archive') { loadArchiveSeasons(); window.switchArchiveTab = (t) => { activeArchiveTab=t; loadArchiveGrid(); }; window.loadArchiveGrid(); }
    if(tid==='settings') { if(document.getElementById('set-darkmode')) document.getElementById('set-darkmode').checked = document.body.classList.contains('dark-mode'); }
    document.title = `Green School - ${tid.toUpperCase()}`;
}
const trashDB = [ {n:"Vỏ sữa",t:"Tái chế",c:"bin-recycle"}, {n:"Chai nhựa",t:"Tái chế",c:"bin-recycle"}, {n:"Giấy vụn",t:"Tái chế",c:"bin-recycle"}, {n:"Vỏ trái cây",t:"Hữu cơ",c:"bin-organic"}, {n:"Lá cây",t:"Hữu cơ",c:"bin-organic"}, {n:"Túi nilon",t:"Rác khác",c:"bin-other"} ];
window.filterTrash = () => { const k = document.getElementById('trashSearchInput').value.toLowerCase(); const r = document.getElementById('trashContainer'); r.innerHTML=""; trashDB.filter(i=>i.n.toLowerCase().includes(k)).forEach(i=>{ r.innerHTML+=`<div class="gallery-item" style="padding:10px;text-align:center"><div class="${i.c}" style="font-weight:bold">${i.t}</div><strong>${i.n}</strong></div>`; }); }; window.filterTrash();
document.getElementById('daily-tip').innerText = ["Tắt đèn khi ra khỏi lớp.", "Trồng thêm cây xanh.", "Phân loại rác."][Math.floor(Math.random()*3)];
const mainLoginBtn = document.getElementById('main-login-btn'); if(mainLoginBtn) { mainLoginBtn.addEventListener('click', () => { signInWithPopup(auth, provider); }); }
let deferredPrompt; const pcMenu = document.querySelector('nav.pc-nav ul'); const installLi = document.createElement('li'); installLi.innerHTML = '<a id="btn-install-pc" style="display:none; color:yellow; cursor:pointer"><i class="fas fa-download"></i> Tải App</a>'; pcMenu.appendChild(installLi); const mobNav = document.querySelector('.mobile-nav-inner'); const installMob = document.createElement('a'); installMob.className = 'nav-item'; installMob.id = 'btn-install-mob'; installMob.style.display = 'none'; installMob.innerHTML = '<i class="fas fa-download"></i><span>TảiApp</span>'; mobNav.insertBefore(installMob, mobNav.firstChild);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; document.getElementById('btn-install-pc').style.display = 'inline-block'; document.getElementById('btn-install-mob').style.display = 'flex'; });
async function installPWA() { if (!deferredPrompt) return; deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; deferredPrompt = null; document.getElementById('btn-install-pc').style.display = 'none'; document.getElementById('btn-install-mob').style.display = 'none'; }
document.getElementById('btn-install-pc').addEventListener('click', installPWA); document.getElementById('btn-install-mob').addEventListener('click', installPWA);
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js'); }); }
