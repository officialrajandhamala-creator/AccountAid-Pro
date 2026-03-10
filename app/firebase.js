// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBb7tX8B9RqAgnJjdzerSL50kz0PGpQJZU",
  authDomain: "accountaid-5db3b.firebaseapp.com",
  projectId: "accountaid-5db3b",
  storageBucket: "accountaid-5db3b.firebasestorage.app",
  messagingSenderId: "12040794846",
  appId: "1:12040794846:web:7e43e4688337604be8c84f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
import { getFirestore } from "firebase/firestore";
export const db = getFirestore(app);
