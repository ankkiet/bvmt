/* FILE: js/main.js
   CHỨC NĂNG: Khởi chạy ứng dụng, lắng nghe sự kiện trang.
*/

import { CONFIG } from "./config.js";
import { auth, db, isAdmin, handleTimer, applyLock, renderGrid, listenForNotifications, listenToMyNotifications, syncToGoogleSheet, player, musicId } from "./core.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, onSnapshot, arrayRemove, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- EVENT LISTENERS ---
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

// --- YOUTUBE API LOADER ---
const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api"; 
var firstScriptTag = document.getElementsByTagName('script')[0]; 
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// --- GLOBAL CONFIG LISTENER ---
onSnapshot(doc(db, "settings", "config"), (docSnap) => {
    if(docSnap.exists()) {
        const cfg = docSnap.data();
        if(cfg.aiKeys && cfg.aiKeys.length > 0) { 
            // Update AI Keys in core logic handled internally via window access or re-import if needed. 
            // In this specific refactor, we rely on the internal state of core.js
             const list = document.getElementById('ai-key-list'); 
             if(list) { list.innerHTML = ""; cfg.aiKeys.forEach(k => { list.innerHTML += `<div class="key-item"><span class="key-name">${k.name}</span><span class="key-val">******</span><button class="btn btn-sm btn-danger" onclick="removeAIKey('${k.name}', '${k.val}')">X</button></div>`; }); } 
        }
        if(cfg.musicId && cfg.musicId !== musicId) { try{if(player) player.loadVideoById(cfg.musicId);}catch(e){} }
        const plDiv = document.getElementById('music-playlist-container'); 
        if(plDiv && cfg.playlist) { plDiv.innerHTML = ""; cfg.playlist.forEach(s => { const style = s.id === cfg.musicId ? 'background:rgba(46, 125, 50, 0.1); border-left:4px solid green;' : ''; plDiv.innerHTML += `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border); ${style}"><span>${s.name}</span> <div><button class="btn btn-sm" onclick="playSong('${s.id}')">▶</button> <button class="btn btn-sm btn-danger" onclick="deleteSong('${s.name}','${s.id}')">🗑</button></div></div>`; }); }
        
        const mDiv = document.getElementById('maintenance-overlay'); 
        // Note: currentUser is imported from Core, but it's a value copy. We use auth.currentUser for live check.
        const u = auth.currentUser;
        if(cfg.maintenance && (!u || !isAdmin(u.email))) mDiv.style.display='flex'; else mDiv.style.display='none';
        
        applyLock('home',cfg.locks?.home); applyLock('greenclass',cfg.locks?.greenclass); applyLock('contest',cfg.locks?.contest); applyLock('activities',cfg.locks?.activities); applyLock('guide',cfg.locks?.guide); applyLock('archive',cfg.locks?.archive);
        handleTimer('timer-gallery','cd-gallery',cfg.deadlines?.gallery); handleTimer('timer-contest','cd-contest',cfg.deadlines?.contest);
        
        if(u && isAdmin(u.email)) {
            document.getElementById('cfg-maintenance').checked=cfg.maintenance; document.getElementById('lock-home').checked=cfg.locks?.home; document.getElementById('lock-greenclass').checked=cfg.locks?.greenclass; document.getElementById('lock-contest').checked=cfg.locks?.contest; document.getElementById('lock-activities').checked=cfg.locks?.activities; document.getElementById('lock-guide').checked=cfg.locks?.guide; document.getElementById('lock-archive').checked=cfg.locks?.archive;
            document.getElementById('time-gallery').value=cfg.deadlines?.gallery||""; document.getElementById('time-contest').value=cfg.deadlines?.contest||"";
            if(cfg.googleSheetUrl) { document.getElementById('cfg-sheet-url').value = cfg.googleSheetUrl; }
        }
    }
});

// --- AUTH STATE & ROUTING ---
onAuthStateChanged(auth, async(u)=>{
    renderGrid('gallery', 'gallery-grid', {id:'rank-gallery-user'}, {id:'rank-gallery-class'}); 
    renderGrid('contest', 'contest-grid', {id:'rank-contest-user'}, {id:'rank-contest-class'});
    
    listenForNotifications();

    if(u){
        const r=doc(db,"users",u.uid), s=await getDoc(r); let userData;
        if(s.exists()){ const d=s.data(); if(d.banned){alert("Bạn đã bị khóa!"); auth.signOut(); return;} userData = { ...d, loginCount: (d.loginCount || 0) + 1 }; await updateDoc(r, { lastActive: serverTimestamp(), loginCount: increment(1) }); } 
        else { userData = { uid:u.uid, email:u.email, displayName:isAdmin(u.email)?"Admin_xinhxinh":u.displayName, photoURL:u.photoURL, role:isAdmin(u.email)?'admin':'member', status:'active', class:"", customID:"@"+u.uid.slice(0,5), createdAt: serverTimestamp(), lastActive: serverTimestamp(), loginCount: 1 }; await setDoc(r,userData); }
        
        syncToGoogleSheet(userData);
        listenToMyNotifications(u.uid);
        handleRoute(); // Redirect to Admin if needed

        document.getElementById('profile-in').style.display='block'; document.getElementById('profile-out').style.display='none'; document.getElementById('home-login-area').style.display='none';
        document.getElementById('p-avatar').src=userData.photoURL; document.getElementById('p-name').innerHTML=(userData.role==='admin'||isAdmin(userData.email))?`<span style="color:red;font-weight:bold">Admin_xinhxinh ✅</span>`:userData.displayName;
        document.getElementById('p-custom-id').innerText = userData.customID || "@chua_co_id"; document.getElementById('p-email').innerText=userData.email; document.getElementById('edit-name').value=userData.displayName; document.getElementById('edit-custom-id').value=userData.customID || ""; document.getElementById('edit-class').value=userData.class||""; document.getElementById('edit-bio').value=userData.bio||"";
        if(isAdmin(userData.email)){ document.getElementById('menu-pc-admin').style.display='block'; document.getElementById('mob-admin').style.display='flex'; document.getElementById('maintenance-overlay').style.display='none'; }
    }else{ 
        // currentUser = null handled in Core
        document.getElementById('profile-in').style.display='none'; document.getElementById('profile-out').style.display='block'; document.getElementById('home-login-area').style.display='block'; document.getElementById('menu-pc-admin').style.display='none'; document.getElementById('mob-admin').style.display='none'; 
    }
});

// --- ROUTER ---
window.showPage = (id) => {
    const validPages = ['home', 'greenclass', 'contest', 'archive', 'activities', 'guide', 'profile', 'admin'];
    let targetId = validPages.includes(id) ? id : 'home';
    const user = auth.currentUser;
    if (targetId === 'admin') {
        if (!user) { alert("Vui lòng đăng nhập quyền Admin trước!"); targetId = 'profile'; window.location.hash = 'profile'; } 
        else if (!isAdmin(user.email)) { alert("⛔ Bạn không có quyền truy cập khu vực này!"); targetId = 'home'; window.location.hash = 'home'; }
    }
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    const section = document.getElementById(targetId); if(section) section.classList.add('active');
    document.querySelectorAll('nav.pc-nav a, nav.mobile-nav a').forEach(a => a.classList.remove('active-menu'));
    if(document.getElementById('menu-pc-'+targetId)) document.getElementById('menu-pc-'+targetId).classList.add('active-menu');
    if(document.getElementById('mob-'+targetId)) document.getElementById('mob-'+targetId).classList.add('active-menu');
    if(targetId === 'archive') { window.loadArchiveSeasons(); window.switchArchiveTab('gallery'); }
    const titles = { 'home': 'Trang Chủ', 'greenclass': 'Góc Xanh', 'contest': 'Thi Đua', 'archive': 'Lưu Trữ', 'activities': 'Hoạt Động', 'guide': 'Tra Cứu', 'profile': 'Hồ Sơ', 'admin': '🛠 Quản Trị Hệ Thống' };
    document.title = `Green School - ${titles[targetId] || 'A2K41'}`;
}

function handleRoute() {
    const hash = window.location.hash.slice(1) || 'home';
    window.showPage(hash);
}
window.addEventListener('hashchange', handleRoute);

// --- INIT TRASH DB ---
window.filterTrash = () => { const k = document.getElementById('trashSearchInput').value.toLowerCase(); const r = document.getElementById('trashContainer'); r.innerHTML=""; CONFIG.trashDB.filter(i=>i.n.toLowerCase().includes(k)).forEach(i=>{ r.innerHTML+=`<div class="gallery-item" style="padding:10px;text-align:center"><div class="${i.c}" style="font-weight:bold">${i.t}</div><strong>${i.n}</strong></div>`; }); }; 
window.filterTrash();

// --- DAILY TIP ---
document.getElementById('daily-tip').innerText = ["Tắt đèn khi ra khỏi lớp.", "Trồng thêm cây xanh.", "Phân loại rác."][Math.floor(Math.random()*3)];
const mainLoginBtn = document.getElementById('main-login-btn'); if(mainLoginBtn) { mainLoginBtn.addEventListener('click', () => { window.checkAdminLogin(); }); }

// --- PWA INSTALL ---
let deferredPrompt; const pcMenu = document.querySelector('nav.pc-nav ul'); const installLi = document.createElement('li'); installLi.innerHTML = '<a id="btn-install-pc" style="display:none; color:yellow; cursor:pointer"><i class="fas fa-download"></i> Tải App</a>'; pcMenu.appendChild(installLi); const mobNav = document.querySelector('.mobile-nav-inner'); const installMob = document.createElement('a'); installMob.className = 'nav-item'; installMob.id = 'btn-install-mob'; installMob.style.display = 'none'; installMob.innerHTML = '<i class="fas fa-download"></i><span>TảiApp</span>'; mobNav.insertBefore(installMob, mobNav.firstChild);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; document.getElementById('btn-install-pc').style.display = 'inline-block'; document.getElementById('btn-install-mob').style.display = 'flex'; });
async function installPWA() { if (!deferredPrompt) return; deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; deferredPrompt = null; document.getElementById('btn-install-pc').style.display = 'none'; document.getElementById('btn-install-mob').style.display = 'none'; }
document.getElementById('btn-install-pc').addEventListener('click', installPWA); document.getElementById('btn-install-mob').addEventListener('click', installPWA);
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').then(reg => console.log('SW Registered!', reg)).catch(err => console.log('SW Error:', err)); }); }
