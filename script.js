// ============================================================
// script.js — Portal Unificado v2 (versão estável com correção de autenticação)
// ============================================================

import { auth, db } from "./firebaseConfig.js";
import {
  onAuthStateChanged,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ============================================================
// ELEMENTOS DOM
// ============================================================
const sidebar = document.getElementById('sidebar');
const logoutBtn = document.getElementById('logoutBtn');
const changePassBtn = document.getElementById('changePassBtn');
const sidebarBadge = document.getElementById('sidebarBadge');
const frame = document.getElementById('mainFrame');
const iframeContainer = document.getElementById('iframeContainer');
const avisosSection = document.getElementById('avisosSection');
const dataVigenteSpan = document.getElementById('dataVigente');

// ============================================================
// ROTAS DO SISTEMA
// ============================================================
const ROUTES = {
  home: null,
  abastecimento: "sistemas/abastecimento/index.html",
  emprestimo: "sistemas/emprestimo/index.html",
  relatorios: "sistemas/emprestimo/emprestimocartao-main/relatorio.html",
  diferencas: "sistemas/diferencas/index.html"
};

// ============================================================
// TELA DE CARREGAMENTO
// ============================================================
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingOverlay';
loadingOverlay.innerHTML = `
  <div class="spinner"></div>
  <div>Carregando...</div>
`;
document.body.appendChild(loadingOverlay);

function showLoading() {
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
}

// ============================================================
// FUNÇÕES DE NAVEGAÇÃO
// ============================================================
function goHome() {
  iframeContainer.classList.remove('full');
  iframeContainer.style.display = 'none';
  avisosSection.style.display = 'block';
  sidebar.style.display = 'flex';
}

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

  // Remove listeners antigos
  frame.onload = null;
  frame.onload = async () => {
    await sendAuthToIframe();
    hideLoading();
  };

  frame.src = src;
}

// ============================================================
// EVENTOS DA SIDEBAR
// ============================================================
document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    const t = li.dataset.target;
    if (t === 'home') goHome();
    else openRoute(t);
  });
});

// ============================================================
// DATA VIGENTE
// ============================================================
if (dataVigenteSpan) {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  dataVigenteSpan.textContent = `${dia}/${mes}/${ano}`;
}

// ============================================================
// GARANTE QUE O USUÁRIO EXISTE NO FIRESTORE
// ============================================================
async function ensureUserInFirestore(user) {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const parts = (user.email || '').split('@');
    const matricula = parts[0] || '';
    const domain = parts[1] || '';
    const isAdmin = domain.toLowerCase() === 'movebuss.local';

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
  } catch (e) {
    console.error("Erro ao salvar usuário em 'users':", e);
  }
}

// ============================================================
// CONTROLE DE LOGIN — COM VERIFICAÇÃO E TOLERÂNCIA DE TOKEN
// ============================================================
let authChecked = false;

onAuthStateChanged(auth, async (user) => {
  showLoading();

  if (!user) {
    // Aguarda até 2 segundos antes de decidir redirecionar
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
    await ensureUserInFirestore(user);

    sidebar.classList.remove('hidden');
    const [matricula] = (user.email || '').split('@');
    sidebarBadge.textContent = matricula;

    sidebar.addEventListener('mouseenter', () => {
      sidebarBadge.textContent = (user.displayName || 'Usuário') + ' • ' + matricula;
    });
    sidebar.addEventListener('mouseleave', () => {
      sidebarBadge.textContent = matricula;
    });

    // Envia token inicial antes de liberar interface
    await sendAuthToIframe();

    goHome();
  } catch (err) {
    console.error("Erro ao inicializar usuário:", err);
  } finally {
    hideLoading();
  }
});

// ============================================================
// ENVIO SEGURO DE TOKEN PARA IFRAME
// ============================================================
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
      idToken
    };
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage(payload, '*');
    }
  } catch (e) {
    console.warn('sendAuthToIframe error', e);
  }
}

// ============================================================
// BOTÕES DE SAIR E ALTERAR SENHA
// ============================================================
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

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
