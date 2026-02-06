import { db, collection, query, where, orderBy, limit, onSnapshot, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, getDocs } from './firebase.js';
import { optimizeUrl } from './utils.js';
import { isAdmin } from './auth.js';

let currentUser = null;
let pinnedSettings = null;
let latestGalleryDocs = [];
let lastTopPostId = null;
const PAGE_SIZE = 12;
const gridLimits = { gallery: PAGE_SIZE, contest: PAGE_SIZE };
const gridParams = {};
const State = { unsubscribes: {} };

// Cập nhật user hiện tại cho module này
export function setGalleryUser(user) {
    currentUser = user;
}

export function setPinnedSettings(settings) {
    pinnedSettings = settings;
    updateFeaturedUI();
}

// --- NOTIFICATION HELPER (Internal) ---
async function pushNotification(recipientId, type, message, linkId, colRef) {
    if (!currentUser || recipientId === currentUser.uid) return; 
    try {
        await addDoc(collection(db, "notifications"), { recipientUid: recipientId, senderName: currentUser.displayName, senderAvatar: currentUser.photoURL, type: type, message: message, link: linkId, collectionRef: colRef, isRead: false, createdAt: serverTimestamp() });
    } catch (e) { console.error("Lỗi gửi thông báo:", e); }
}

// --- GRID LOGIC ---
export function renderGrid(col, elId, uR, cR) {
    gridParams[col] = { elId, uR, cR };
    if(State.unsubscribes[col]) State.unsubscribes[col]();
    
    const g = document.getElementById(elId);
    if(g) {
        let skel = "";
        for(let i=0; i<6; i++) {
            skel += `<div class="skeleton-card"><div class="skeleton skeleton-img"></div><div class="skeleton-info"><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div></div></div>`;
        }
        g.innerHTML = skel;
    }

    const q = query(collection(db, col), where("archived", "!=", true), orderBy("archived"), orderBy("createdAt", "desc"), limit(gridLimits[col]));

    const unsub = onSnapshot(q, (snap) => {
        const g = document.getElementById(elId); if(!g) return;
        let htmlBuffer = ""; let uS={}, cS={}, docs=[];
        snap.forEach(d=>docs.push({id:d.id,...d.data()})); 
        
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
            else if(d.type === 'bio') badge = `<span style="position:absolute; top:10px; left:10px; background:#8bc34a; color:white; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; z-index:5;">Sinh Học</span>`;
            
            const tinyUrl = optimizeUrl(d.url, 50);
            const realUrl = optimizeUrl(d.url, 400);
            const isAdm = d.className === 'Admin' || d.authorName === 'Admin_xinhxinh';
            const admBadge = isAdm ? ' <i class="fas fa-check-circle" style="color:#2e7d32; font-size:0.8em;" title="Admin"></i>' : '';
            const nameStyle = isAdm ? 'color:#d32f2f;font-weight:bold' : '';
            htmlBuffer += `<div class="gallery-item" onclick="openLightbox('${col}','${d.id}')">${badge}${ctrls}<div class="gallery-img-container"><img src="${tinyUrl}" data-src="${realUrl}" class="gallery-img lazy-blur"></div><div class="gallery-info"><div class="gallery-title">${d.desc}</div><div class="gallery-meta"><div style="display:flex;align-items:center; cursor:pointer; z-index:10;" onclick="event.stopPropagation(); showUserPosts('${d.uid}', '${d.authorName}')"><img src="${d.authorAvatar||'https://lh3.googleusercontent.com/a/default-user=s96-c'}" class="post-avatar" onerror="this.src='https://lh3.googleusercontent.com/a/default-user=s96-c'"> <span style="${nameStyle}">${d.authorID||d.authorName}${admBadge}</span></div><span><i class="fas fa-heart" style="color:${d.likes?.includes(currentUser?.uid)?'red':'#ccc'}"></i> ${l}</span></div><div class="grid-actions"><button class="grid-act-btn" onclick="event.stopPropagation(); alert('Link ảnh: ${d.url}')"><i class="fas fa-share"></i> Share</button></div></div></div>`;
        });
        
        if(snap.docs.length >= gridLimits[col]) {
            htmlBuffer += `<div style="grid-column:1/-1;text-align:center;margin-top:10px"><button class="btn btn-outline" onclick="loadMore('${col}')">Xem thêm</button></div>`;
        }

        g.innerHTML = htmlBuffer;
        lazyLoadImages();
        renderRank(uR.id, uS); renderRank(cR.id, cS);
    }, (error) => {
        console.error("RenderGrid Error:", error);
    });
    State.unsubscribes[col] = unsub;
}

export function loadMore(col) {
    gridLimits[col] += PAGE_SIZE;
    const p = gridParams[col];
    if(p) renderGrid(col, p.elId, p.uR, p.cR);
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

// --- FEATURED UI ---
export async function updateFeaturedUI() {
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
                if (topPost.id !== lastTopPostId && window.triggerFireworks) window.triggerFireworks();
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

// --- LIGHTBOX ---
export let currentImgId = null;
export let currentImgCollection = null;

export async function openLightbox(c, i) { 
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
            pinBtn.onclick = isPinned ? unpinPost : pinPost;
            pinBtn.title = isPinned ? "Bỏ ghim" : "Ghim";
            pinBtn.style.color = isPinned ? '#d32f2f' : '#ffa000';
        } else { pinBtn.style.display = 'none'; }
    } else { controls.style.display = 'none'; }
    document.getElementById('lb-details-sheet').classList.remove('open'); renderComments(d.comments||[]); 
}

export function closeLightbox() { document.getElementById('lightbox').style.display='none'; document.getElementById('lb-details-sheet').classList.remove('open'); }
export function toggleDetails() { document.getElementById('lb-details-sheet').classList.toggle('open'); }

export async function handleLike() { 
    if(!currentUser) return alert("Vui lòng đăng nhập để thả tim!"); 
    const btn = document.getElementById('lb-like-btn'); const countSpan = document.getElementById('lb-like-count');
    let currentCount = parseInt(countSpan.innerText); const isLiked = btn.classList.contains('liked');
    if (isLiked) { btn.classList.remove('liked'); btn.style.color = 'var(--text-sec)'; countSpan.innerText = Math.max(0, currentCount - 1); await updateDoc(doc(db, currentImgCollection, currentImgId), { likes: arrayRemove(currentUser.uid) }); } 
    else { btn.classList.add('liked'); btn.style.color = '#e53935'; countSpan.innerText = currentCount + 1; await updateDoc(doc(db, currentImgCollection, currentImgId), { likes: arrayUnion(currentUser.uid) });
    const postSnap = await getDoc(doc(db, currentImgCollection, currentImgId)); if(postSnap.exists()){ const ownerId = postSnap.data().uid; pushNotification(ownerId, 'like', `<b>${currentUser.displayName}</b> đã thả tim ảnh của bạn ❤️`, currentImgId, currentImgCollection); } }
}

export async function quickReply(text) {
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    const list = document.getElementById('lb-comments-list');
    const fakeDiv = document.createElement('div'); fakeDiv.className = 'lb-comment-item';
    fakeDiv.innerHTML = `<img src="${currentUser.photoURL}" class="lb-comment-avatar"><div class="lb-comment-content"><div class="lb-comment-bubble"><span class="lb-comment-user">${currentUser.displayName}</span><span class="lb-comment-text">${text}</span></div></div>`;
    list.appendChild(fakeDiv); list.scrollTop = list.scrollHeight;
    const c = { uid: currentUser.uid, name: currentUser.displayName, avatar: currentUser.photoURL, text: text, time: Date.now() };
    await updateDoc(doc(db, currentImgCollection, currentImgId), { comments: arrayUnion(c) });
    const postSnap = await getDoc(doc(db, currentImgCollection, currentImgId));
    if(postSnap.exists()){ const ownerId = postSnap.data().uid; pushNotification(ownerId, 'comment', `<b>${currentUser.displayName}</b> đã bình luận: "${text}"`, currentImgId, currentImgCollection); }
    if(navigator.vibrate) navigator.vibrate(30);
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

export async function deleteComment(index) {
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

export async function pinPost() { 
    await setDoc(doc(db, "settings", "featured"), { col: currentImgCollection, id: currentImgId }); 
    await setDoc(doc(db, "settings", "notifications"), { text: "📌 Một bài viết mới vừa được ghim lên Trang Chủ! Xem ngay!", id: Date.now().toString(), createdAt: serverTimestamp() });
    alert("Đã ghim và gửi thông báo!"); 
    const pinBtn = document.querySelector('.lb-btn-pin');
    if(pinBtn) { pinBtn.innerHTML = '<i class="fas fa-times-circle"></i>'; pinBtn.onclick = unpinPost; pinBtn.title = "Bỏ ghim"; pinBtn.style.color = '#d32f2f'; }
}

export async function unpinPost() {
    if(confirm("Bỏ ghim bài viết này?")) {
        await deleteDoc(doc(db, "settings", "featured"));
        alert("Đã bỏ ghim!");
        const pinBtn = document.querySelector('.lb-btn-pin');
        if(pinBtn) { pinBtn.innerHTML = '<i class="fas fa-thumbtack"></i>'; pinBtn.onclick = pinPost; pinBtn.title = "Ghim"; pinBtn.style.color = '#ffa000'; }
    }
}

export async function deletePostFromLB() { if(confirm("Bạn chắc chắn muốn xóa bài viết này chứ?")) { await deleteDoc(doc(db, currentImgCollection, currentImgId)); closeLightbox(); alert("Đã xóa bài viết!"); } }
export async function editPostFromLB() { const newDesc = prompt("Nhập mô tả mới:"); if(newDesc) { await updateDoc(doc(db, currentImgCollection, currentImgId), { desc: newDesc }); document.getElementById('lb-desc').innerHTML = newDesc; } }

export async function showUserPosts(uid, name) {
    const modal = document.getElementById('user-posts-modal');
    const grid = document.getElementById('user-posts-grid');
    const title = document.getElementById('user-posts-title');
    
    if(modal) modal.style.display = 'flex';
    if(title) title.innerHTML = `Bài viết của <b>${name}</b>`;
    if(grid) grid.innerHTML = '<div style="width:100%; text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Đang tải dữ liệu...</div>';

    if (!uid || uid === 'undefined' || uid === 'null') {
        grid.innerHTML = '<div style="width:100%; text-align:center; color:var(--text-sec);">Không tìm thấy ID người dùng này.</div>';
        return;
    }

    try {
        const getSafeDocs = async (col) => {
            try {
                const q = query(collection(db, col), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(20));
                return await getDocs(q);
            } catch (err) {
                console.warn(`Query ${col} failed (likely missing index), falling back...`, err);
                const qSimple = query(collection(db, col), where('uid', '==', uid));
                return await getDocs(qSimple);
            }
        };
        
        const [snap1, snap2] = await Promise.all([getSafeDocs('gallery'), getSafeDocs('contest')]);
        
        let posts = [];
        snap1.forEach(d => posts.push({id: d.id, col: 'gallery', ...d.data()}));
        snap2.forEach(d => posts.push({id: d.id, col: 'contest', ...d.data()}));
        
        posts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        if (posts.length === 0) {
            grid.innerHTML = '<div style="width:100%; text-align:center; color:var(--text-sec);">Thành viên này chưa có bài đăng nào.</div>';
            return;
        }

        let html = "";
        posts.forEach(d => {
            html += `<div class="gallery-item" onclick="openLightbox('${d.col}','${d.id}')"><div class="gallery-img-container"><img src="${optimizeUrl(d.url, 200)}" class="gallery-img lazy-blur" data-src="${optimizeUrl(d.url, 400)}"></div><div class="gallery-info"><div class="gallery-title">${d.desc}</div><div class="gallery-meta"><span>${new Date(d.createdAt?.seconds*1000).toLocaleDateString('vi-VN')}</span><span><i class="fas fa-heart"></i> ${d.likes?.length||0}</span></div></div></div>`;
        });
        grid.innerHTML = html;
        lazyLoadImages();
    } catch (e) {
        console.error(e);
        grid.innerHTML = `<div style="width:100%; text-align:center; color:red;">Lỗi tải dữ liệu: ${e.message}</div>`;
    }
}

export function closeUserPosts() {
    document.getElementById('user-posts-modal').style.display = 'none';
}