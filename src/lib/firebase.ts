import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDIoeJsBLUP9R8VhVqvXpR_AtPB7kYndKo",
  authDomain: "farmaciaapp-930c4.firebaseapp.com",
  databaseURL: "https://farmaciaapp-930c4-default-rtdb.firebaseio.com",
  projectId: "farmaciaapp-930c4",
  storageBucket: "farmaciaapp-930c4.firebasestorage.app",
  messagingSenderId: "644322152587",
  appId: "1:644322152587:web:cc6a0b5e2c0358d925048e",
  measurementId: "G-8QDRB5BXPJ"
};

// Inicializar Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };
