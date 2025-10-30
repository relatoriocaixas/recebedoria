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

const ROUTES = {
  home: null,
  abastecimento: "sistemas/abastecimento/index.html",
  emprestimo: "sistemas/emprestimo/index.html",
  relatorios: "sistemas/emprestimo/emprestimocartao-main/relatorio.html",
  diferencas: "sistemas/diferencas/index.html"
};

// 🔹 Função para ir à tela inicial
function goHome() {
  iframeContainer.classList.remove('full');
  iframeContainer.style.display = 'none';
  avisosSection.style.display = 'block';
  sidebar.style.display = 'flex';
}

// 🔹 Função para abrir uma rota no iframe com tela de carregamento
function openRoute(route) {
  const src = ROUTES[route];
  if (!src) { goHome(); return; }

  avisosSection.style.display = 'none';
  iframeContainer.style.display = 'block';
  iframeContainer.classList.add('full');

  // 🔹 Tela de carregamento
  const loading = document.createElement('div');
  loading.id = 'iframeLoading';
  loading.style.position = 'absolute';
  loading.style.top = '0';
  loading.style.left = '0';
  loading.style.width = '100%';
  loading.style.height = '100%';
  loading.style.background = 'rgba(0,0,0,0.5)';
  loading.style.display = 'flex';
  loading.style.alignItems = 'center';
  loading.style.justifyContent = 'center';
  loading.style.zIndex = '9999';
  loading.style.color = '#fff';
  loading.style.fontSize = '1.5rem';
  loading.textContent = 'Carregando...';
  iframeContainer.appendChild(loading);

  // 🔹 Substitui src
  frame.src = src;

  // 🔹 Reenvia auth quando o iframe terminar de carregar
  frame.onload = () => sendAuthToIframe();
}

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

// 🔹 Autenticação principal
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    sidebar.classList.remove('hidden');

    const parts = (user.email || '').split('@');
    sidebarBadge.textContent = parts[0];

    sidebar.addEventListener('mouseenter', () => {
      sidebarBadge.textContent = (user.displayName || 'Usuário') + ' • ' + parts[0];
    });
    sidebar.addEventListener('mouseleave', () => {
      sidebarBadge.textContent = parts[0];
    });

    goHome();
    await ensureUserInFirestore(user);

    // 🔹 Envia token inicial
    sendAuthToIframe();
  }
});

// 🔹 Envio seguro do auth
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

// 🔹 Escuta confirmação de autenticação do iframe
window.addEventListener('message', (event) => {
  if (event.data?.type === 'authVerified') {
    const loading = document.getElementById('iframeLoading');
    if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
  }
});

// 🔹 Botão sair
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

// 🔹 Botão alterar senha (mantém a lógica original)
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
