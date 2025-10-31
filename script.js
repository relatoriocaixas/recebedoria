// script.js
import { auth, db } from "./firebaseConfig.js";
import {
  onAuthStateChanged,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const sidebar = document.getElementById('sidebar');
const logoutBtn = document.getElementById('logoutBtn');
const changePassBtn = document.getElementById('changePassBtn');
const sidebarBadge = document.getElementById('sidebarBadge');
const frame = document.getElementById('mainFrame');
const iframeContainer = document.getElementById('iframeContainer');
const avisosSection = document.getElementById('avisosSection');
const dataVigenteSpan = document.getElementById('dataVigente');

// 🔹 ROTAS
const ROUTES = {
  home: null,
  abastecimento: "sistemas/abastecimento/index.html",
  emprestimo: "sistemas/emprestimo/index.html",
  relatorios: "sistemas/emprestimo/emprestimocartao-main/relatorio.html",
  diferencas: "sistemas/diferencas/index.html",
  escala: "sistemas/escala/escala.html" // 🔹 Nova rota Escala
};

// 🔹 Tela de carregamento
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingOverlay';
loadingOverlay.innerHTML = `
  <div class="spinner"></div>
  <div>Carregando...</div>
`;
document.body.appendChild(loadingOverlay);

function showLoading() { loadingOverlay.style.display = 'flex'; }
function hideLoading() { loadingOverlay.style.display = 'none'; }

// 🔹 Função para ir à tela inicial
function goHome() {
  iframeContainer.classList.remove('full');
  iframeContainer.style.display = 'none';
  avisosSection.style.display = 'block';
  sidebar.style.display = 'flex';
}

// 🔹 Função para abrir uma rota no iframe
function openRoute(route) {
  const src = ROUTES[route];
  if (!src) {
    goHome();
    return;
  }

  showLoading();
  avisosSection.style.display = 'none';
  iframeContainer.style.display = 'block';
  iframeContainer.classList.add('full');

  frame.onload = null;
  frame.onload = async () => {
    await sendAuthToIframe();
    hideLoading();
  };

  frame.src = src;
}

// 🔹 Adiciona Escala na barra lateral dinamicamente
const escalaLi = document.createElement('li');
escalaLi.dataset.target = 'escala';
escalaLi.innerHTML = "📅 <span class='label'>Escala</span>";
sidebar.querySelector('ul').appendChild(escalaLi);

escalaLi.addEventListener('click', () => openRoute('escala'));

// 🔹 Atalhos da barra lateral
document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    const t = li.dataset.target;
    if (t === 'home') goHome();
    else openRoute(t);
  });
});

// 🔹 Atualiza o #dataVigente com a data atual
if (dataVigenteSpan) {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  dataVigenteSpan.textContent = `${dia}/${mes}/${ano}`;
}

// 🔹 Garante que o usuário exista em "users"
async function ensureUserInFirestore(user) {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const parts = (user.email || '').split('@');
    const matricula = parts[0] || '';
    const domain = parts[1] || '';
    const isAdmin = domain.toLowerCase() === 'movebuss.local'; // admin automático

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        matricula,
        nome: user.displayName || matricula,
        admin: isAdmin,
        createdAt: new Date()
      });
      console.log("Usuário adicionado à coleção 'users'.");
    } else {
      const existing = userSnap.data();
      if (existing.admin !== isAdmin) {
        await setDoc(userRef, { ...existing, admin: isAdmin }, { merge: true });
        console.log("Campo 'admin' atualizado conforme domínio.");
      }
    }

    return { matricula, isAdmin }; // retorna info do usuário
  } catch (e) {
    console.error("Erro ao salvar usuário em 'users':", e);
    throw e;
  }
}

// ============================================================
// 🔹 AUTENTICAÇÃO COM TELA DE CARREGAMENTO INTELIGENTE
// ============================================================
let authChecked = false;
let retryCount = 0;
const MAX_RETRIES = 3;

onAuthStateChanged(auth, async (user) => {
  showLoading();

  if (!user) {
    setTimeout(async () => {
      const currentUser = auth.currentUser;
      if (!currentUser && !authChecked) {
        authChecked = true;
        hideLoading();
        window.location.href = 'login.html';
      }
    }, 2000);
    return;
  }

  try {
    authChecked = true;
    const { matricula, isAdmin } = await ensureUserInFirestore(user);

    sidebar.classList.remove('hidden');
    sidebarBadge.textContent = matricula;

    sidebar.addEventListener('mouseenter', () => {
      sidebarBadge.textContent = (user.displayName || 'Usuário') + ' • ' + matricula;
    });
    sidebar.addEventListener('mouseleave', () => {
      sidebarBadge.textContent = matricula;
    });

    await sendAuthToIframe();
    goHome();
    hideLoading();

  } catch (err) {
    console.warn("⚠️ Falha temporária ao inicializar usuário:", err);

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`Tentando novamente (${retryCount}/${MAX_RETRIES})...`);
      setTimeout(() => {
        onAuthStateChanged(auth, () => {});
      }, 1500);
      return;
    }

    console.error("Erro persistente — mantendo tela de carregamento.");
    showLoading();
  }
});

// 🔹 Envio seguro do auth para iframes (Escala, etc)
async function sendAuthToIframe() {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const parts = (user.email || '').split('@');
    const idToken = await user.getIdToken();

    const payload = {
      type: 'syncAuth',
      usuario: {
        matricula: parts[0] || '',
        email: user.email || '',
        nome: user.displayName || ''
      },
      admin: (parts[1].toLowerCase() === 'movebuss.local'),
      idToken
    };

    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage(payload, '*');
    }
  } catch (e) {
    console.warn('sendAuthToIframe error', e);
  }
}

// 🔹 Botão sair
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

// 🔹 Botão alterar senha
changePassBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return alert('Usuário não autenticado.');

  const nova = prompt('Digite a nova senha:');
  if (!nova) return;

  try {
    await updatePassword(user, nova);
    alert('Senha alterada com sucesso.');
  } catch (e) {
    console.error('Erro ao alterar senha:', e);
    if (e.code === 'auth/requires-recent-login') {
      alert('Por segurança, faça login novamente antes de alterar a senha.');
      await signOut(auth);
      window.location.href = 'login.html';
    } else {
      alert('Erro ao alterar senha: ' + (e?.message || e));
    }
  }
});
