import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWmq02P8pGbl2NmppEAIKtF9KtQ7AzTFQ",
  authDomain: "unificado-441cd.firebaseapp.com",
  projectId: "unificado-441cd",
  storageBucket: "unificado-441cd.firebasestorage.app",
  messagingSenderId: "671392063569",
  appId: "1:671392063569:web:57e3f6b54fcdc45862d870",
  measurementId: "G-6GQX395J9C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.getElementById("loginBtn").addEventListener("click", async () => {
  // Here the input 'email' actually holds the matrícula (numbers only)
  const matriculaInput = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if(!matriculaInput){
    alert("Digite sua matrícula.");
    return;
  }

  // build institutional email
  const email = matriculaInput.includes('@') ? matriculaInput : (matriculaInput + "@movebuss.local");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // notify parent will happen in index via onAuthStateChanged
    window.location.href = "index.html";
  } catch (error) {
    alert("Erro ao fazer login: " + error.message);
  }
});

document.getElementById("showCreateAccountBtn").addEventListener("click", () => {
  document.getElementById("createAccountModal").classList.remove("hidden");
});

document.getElementById("closeModalBtn").addEventListener("click", () => {
  document.getElementById("createAccountModal").classList.add("hidden");
});

document.getElementById("createAccountBtn").addEventListener("click", async () => {
  const matriculaInput = document.getElementById("newEmail").value.trim();
  const newPassword = document.getElementById("newPassword").value;

  if (!matriculaInput) {
    alert("Digite a matrícula para criar a conta.");
    return;
  }

  const email = matriculaInput.includes('@') ? matriculaInput : (matriculaInput + "@movebuss.local");

  try {
    await createUserWithEmailAndPassword(auth, email, newPassword);
    alert("Conta criada com sucesso!");
    document.getElementById("createAccountModal").classList.add("hidden");
  } catch (error) {
    alert("Erro ao criar conta: " + error.message);
  }
});
