// firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getAuth, setPersistence, browserLocalPersistence, 
  onAuthStateChanged, createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, signOut, updatePassword 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
  getFirestore, doc, setDoc, getDoc, updateDoc, addDoc, 
  getDocs, collection, query, where, serverTimestamp, orderBy 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Configuração do Firebase
export const firebaseConfig = { 
  apiKey: "AIzaSyBWmq02P8pGbl2NmppEAIKtF9KtQ7AzTFQ",
  authDomain: "unificado-441cd.firebaseapp.com",
  projectId: "unificado-441cd",
  storageBucket: "unificado-441cd.firebasestorage.app",
  messagingSenderId: "671392063569",
  appId: "1:671392063569:web:57e3f6b54fcdc45862d870",
  measurementId: "G-6GQX395J9C"
};

// Inicializa Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Persistência do login
setPersistence(auth, browserLocalPersistence);

// Exportar funções que o app.js usa
export { 
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, updatePassword, doc, setDoc, getDoc, updateDoc, addDoc, 
  getDocs, collection, query, where, serverTimestamp, orderBy 
};
