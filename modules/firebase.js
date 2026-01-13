// e:\A2K41_WEB\web sịn hahahhhahahaha\bvmt\modules\firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, where, increment, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCJ_XI_fq-yJC909jb9KLIKg3AfGdm6hNs", authDomain: "a2k41nvc-36b0b.firebaseapp.com", projectId: "a2k41nvc-36b0b", storageBucket: "a2k41nvc-36b0b.firebasestorage.app", messagingSenderId: "279516631226", appId: "1:279516631226:web:99012883ed7923ab5c3283" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Export các biến và hàm để file khác dùng
export { 
    app, auth, db, provider, 
    signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged,
    collection, addDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, where, increment, limit
};
