// app.js
import {
  auth, db
} from "./firebaseConfig.js";
import {
  onAuthStateChanged,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ===========================
// Elementos do DOM
// ===========================
const sidebar = document.getElementById('sidebar');
const logoutBtn = document.getElementById('logoutBtn');
const changePassBtn = document.getElementById('changePassBtn');
const sidebarBadge = document.getElementById('sidebarBadge');
const frame = document.getElementById('mainFrame');
const iframeContainer = document.getElementById('iframeContainer');
const avisosSection = document.getElementById('avisosSection');
const dataVigenteSpan = document.getElementById('dataVigente');

// ===========================
// Rotas do portal
// ===========================
const ROUTES = {
  home: null,
  abastecimento: "sistemas/abastecimento/index.html",
  emprestimo: "sistemas/emprestimo/index.html",
  relatorios: "sistemas/emprestimo/emprestimocartao-main/relatorio.html",
  diferencas: "sistemas/diferencas/index.html"
};

// ===========================
// Tela de carregamento
// ===========================
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingOverlay';
loadingOverlay.innerHTML = `
  <div class="spinner"></div>
  <div>Carregando...</div>
`;
document.body.appendChild(loadingOverlay);

function showLoading() { loadingOverlay.style.display = 'flex'; }
function hideLoading() { loadingOverlay.style.display = 'none'; }

// ===========================
// Funções de interface
// ===========================
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
    // Envia auth assim que o iframe carrega
    await broadcastAuthToIframe(frame);
    hideLoading();
  };

  frame.src = src;
}

// ===========================
// Atualiza data atual
// ===========================
if (dataVigenteSpan) {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  dataVigenteSpan.textContent = `${dia}/${mes}/${ano}`;
}

// ===========================
// Garante que o usuário exista no Firestore
// ===========================
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

// ===========================
// Envia auth para todos os iframes
// ===========================
async function broadcastAuthToIframe(targetFrame = null) {
  const user = auth.currentUser;
  if (!user) return;

  const idToken = await user.getIdToken(true);
  const payload = {
    type: 'syncAuth',
    usuario: {
      email: user.email || '',
      nome: user.displayName || '',
      matricula: (user.email || '').split('@')[0]
    },
    idToken
  };

  // Se targetFrame fornecido, envia apenas para ele
  if (targetFrame && targetFrame.contentWindow) {
    targetFrame.contentWindow.postMessage(payload, '*');
    return;
  }

  // Senão, envia para todos os iframes existentes
  document.querySelectorAll('iframe').forEach(f => {
    if (f.contentWindow) f.contentWindow.postMessage(payload, '*');
  });
}

// ===========================
// Autenticação principal
// ===========================
onAuthStateChanged(auth, async (user) => {
  showLoading();
  if (!user) {
    // NÃO redirecionar. apenas colocar a UI em modo "aguardando"
    sidebar.classList.add('hidden');
    // mantenha página ativa (o portal controla a experiência)
    hideLoading();
    return;
  }

  try {
    sidebar.classList.remove('hidden');

    const parts = (user.email || '').split('@');
    sidebarBadge.textContent = parts[0];

    sidebar.addEventListener('mouseenter', () => {
      sidebarBadge.textContent = (user.displayName || 'Usuário') + ' • ' + parts[0];
    });
    sidebar.addEventListener('mouseleave', () => {
      sidebarBadge.textContent = parts[0];
    });

    await ensureUserInFirestore(user);

    // envia auth para todos os iframes existentes
    await broadcastAuthToIframe();

    goHome();
  } catch (err) {
    console.error("Erro no carregamento inicial:", err);
  } finally {
    hideLoading();
  }
});

// ===========================
// Atalhos da barra lateral
// ===========================
document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    const t = li.dataset.target;
    if (t === 'home') goHome();
    else openRoute(t);
  });
});

// ===========================
// Botão sair
// ===========================
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  // não redirecionar aqui; deixar o portal controlar navegação.
  // manter comportamento antigo: enviar para login.html se desejar, mas como o portal gerencia login, apenas esconder UI.
  sidebar.classList.add('hidden');
  iframeContainer.style.display = 'none';
  avisosSection.style.display = 'none';
  window.location.href = 'login.html'; // opcional: manter para casos isolados
});

// ===========================
// Botão alterar senha
// ===========================
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

// ===========================
// Listener global para iframes
// ===========================
window.addEventListener('message', (e) => {
  // aqui você pode tratar mensagens de retorno dos iframes se necessário
  // Ex.: respostas de impressão, pedidos de reload, etc.
});
