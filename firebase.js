import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBb7tX8B9RqAgnJjdzerSL50kz0PGpQJZU",
  authDomain: "accountaid-5db3b.firebaseapp.com",
  projectId: "accountaid-5db3b",
  storageBucket: "accountaid-5db3b.firebasestorage.app",
  messagingSenderId: "12040794846",
  appId: "1:12040794846:web:7e43e4688337604be8c84f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
