// e:\A2K41_WEB\web sịn hahahhhahahaha\bvmt\modules\firebase.js

// Import các hàm cần thiết từ Firebase SDK (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, where, increment, limit, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

// Cấu hình Firebase Project (API Key, ID, ...)
const firebaseConfig = { apiKey: "AIzaSyCJ_XI_fq-yJC909jb9KLIKg3AfGdm6hNs", authDomain: "a2k41nvc-36b0b.firebaseapp.com", projectId: "a2k41nvc-36b0b", storageBucket: "a2k41nvc-36b0b.firebasestorage.app", messagingSenderId: "279516631226", appId: "1:279516631226:web:99012883ed7923ab5c3283" };

// Khởi tạo Firebase App
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);
const provider = new GoogleAuthProvider();

// Export các biến và hàm để các file khác (script.js, ai.js...) có thể sử dụng
export { 
    app, auth, db, provider, messaging,
    getMessaging, getToken, onMessage,
    signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged,
    collection, addDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, where, increment, limit, writeBatch
};
