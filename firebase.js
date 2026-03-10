import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// तपाईँको Firebase को वास्तविक विवरण
const firebaseConfig = {
  apiKey: "AIzaSyBb7tX8B9RqAgnJjdzerSL50kz0PGpQJZU",
  authDomain: "accountaid-5db3b.firebaseapp.com",
  projectId: "accountaid-5db3b",
  storageBucket: "accountaid-5db3b.firebasestorage.app",
  messagingSenderId: "12040794846",
  appId: "1:12040794846:web:7e43e4688337604be8c84f"
};

// Firebase इनिसियलाइज गर्ने
const app = initializeApp(firebaseConfig);

// Database (Firestore) लाई निर्यात गर्ने
export const db = getFirestore(app);
