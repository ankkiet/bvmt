import { auth, db, provider, signInWithPopup, signOut, doc, updateDoc, query, collection, where, getDocs } from './firebase.js';
import { ADMIN_EMAILS } from './constants.js';

export let dynamicAdminEmails = [...ADMIN_EMAILS];

export const isAdmin = (email) => dynamicAdminEmails.includes(email);

export function setDynamicAdminEmails(emails) {
    dynamicAdminEmails = [...new Set([...ADMIN_EMAILS, ...emails])];
}

export async function handleLogout() {
    await signOut(auth);
    alert("Đã đăng xuất");
    location.reload();
}

export function checkAdminLogin() {
    return signInWithPopup(auth, provider);
}

export async function syncToGoogleSheet(user, googleSheetUrl) {
    if (!googleSheetUrl) return;
    try {
        const payload = {
            displayName: user.displayName || "Chưa đặt tên",
            email: user.email,
            customID: user.customID || "",
            createdAt: user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'),
            classInfo: user.class ? `Thành viên lớp ${user.class}` : "Chưa cập nhật lớp",
            lastActive: new Date().toLocaleString('vi-VN'),
            loginCount: user.loginCount || 1,
            uid: user.uid
        };
        await fetch(googleSheetUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
        console.log("Synced to Google Sheet");
    } catch (e) { console.error("Sync Error:", e); }
}

export async function checkUniqueID(id) {
    const q = query(collection(db, "users"), where("customID", "==", id));
    const snap = await getDocs(q);
    return snap.empty;
}

export async function requestDeleteAccount(uid) {
    if (confirm("Xóa tk?")) {
        await updateDoc(doc(db, "users", uid), { status: 'deleted' });
        location.reload();
    }
}

export async function restoreAccount(uid) {
    await updateDoc(doc(db, "users", uid), { status: 'active' });
    location.reload();
}