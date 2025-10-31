// portal/script.js
import { auth, db } from "./firebaseConfig.js";
import {
  onAuthStateChanged,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// 🔹 Elementos principais
const sidebar = document.getElementById('sidebar');
const logoutBtn = document.getElementById('logoutBtn');
const changePassBtn = document.getElementById('changePassBtn');
const sidebarBadge = document.getElementById('sidebarBadge');
const frame = document.getElementById('mainFrame');
const iframeContainer = document.getElementById('iframeContainer');
const avisosSection = document.getElementById('avisosSection');
const dataVigenteSpan = document.getElementById('dataVigente');

// 🔹 Rotas do portal
const ROUTES = {
  home: null,
  abastecimento: "sistemas/abastecimento/index.html",
  emprestimo: "sistemas/emprestimo/index.html",
  relatorios: "sistemas/emprestimo/emprestimocartao-main/relatorio.html",
  diferencas: "sistemas/diferencas/index.html"
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

// 🔹 Ir à tela inicial
function goHome() {
  iframeContainer.classList.remove('full');
  iframeContainer.style.display = 'none';
  avisosSection.style.display = 'block';
  sidebar.style.display = 'flex';
}

// 🔹 Abre módulo com controle de token
async function openRoute(route) {
  const src = ROUTES[route];
  if (!src) return goHome();

  showLoading();

  try {
    const user = auth.currentUser;
    if (!user) {
      alert("Sessão expirada. Faça login novamente.");
      return window.location.href = "login.html";
    }

    // 🔸 Força o Firebase a renovar token antes do iframe
    const idToken = await new Promise((resolve, reject) => {
      const start = Date.now();
      const check = async () => {
        try {
          const t = await user.getIdToken(true);
          if (t) return resolve(t);
        } catch {}
        if (Date.now() - start > 5000) reject("Timeout token");
        else setTimeout(check, 250);
      };
      check();
    });

    // 🔸 Esconde avisos e prepara container
    avisosSection.style.display = 'none';
    iframeContainer.style.display = 'block';
    iframeContainer.classList.add('full');

    // 🔸 Recria iframe limpo
    const newFrame = document.createElement('iframe');
    newFrame.id = 'mainFrame';
    newFrame.style.display = 'none';
    iframeContainer.innerHTML = "";
    iframeContainer.appendChild(newFrame);

    // 🔸 Espera iframe carregar
    await new Promise((resolve, reject) => {
      newFrame.onload = () => resolve();
      newFrame.onerror = () => reject("Falha ao carregar");
      newFrame.src = src;
    });

    // 🔸 Envia token e dados
    const parts = (user.email || '').split('@');
    const payload = {
      type: 'syncAuth',
      usuario: {
        matricula: parts[0] || '',
        email: user.email || '',
        nome: user.displayName || ''
      },
      idToken
    };
    newFrame.contentWindow.postMessage(payload, '*');

    // 🔸 Exibe somente após sincronizar
    setTimeout(() => {
      newFrame.style.display = 'block';
      hideLoading();
    }, 500);
  } catch (err) {
    console.error("Erro ao abrir módulo:", err);
    alert("Erro ao carregar o sistema. Tente novamente.");
    hideLoading();
  }
}

// 🔹 Atalhos da barra lateral
document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    const t = li.dataset.target;
    if (t === 'home') goHome();
    else openRoute(t);
  });
});

// 🔹 Atualiza a data
if (dataVigenteSpan) {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  dataVigenteSpan.textContent = `${dia}/${mes}/${ano}`;
}

// 🔹 Garante que o usuário existe no Firestore
async function ensureUserInFirestore(user) {
  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const [matricula, domain] = (user.email || '').split('@');
    const isAdmin = (domain || '').toLowerCase() === 'movebuss.local';

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        matricula: matricula || '',
        nome: user.displayName || matricula || '',
        admin: isAdmin,
        createdAt: new Date()
      });
    } else {
      const existing = snap.data();
      if (existing.admin !== isAdmin) {
        await setDoc(userRef, { ...existing, admin: isAdmin }, { merge: true });
      }
    }
  } catch (e) {
    console.error("Erro Firestore:", e);
  }
}

// 🔹 Controle de login com sincronização e proteção
onAuthStateChanged(auth, async (user) => {
  showLoading();

  if (!user) {
    hideLoading();
    return window.location.href = 'login.html';
  }

  try {
    await ensureUserInFirestore(user);

    // Mostra interface
    sidebar.classList.remove('hidden');
    const [matricula] = (user.email || '').split('@');
    sidebarBadge.textContent = matricula;

    sidebar.addEventListener('mouseenter', () => {
      sidebarBadge.textContent = (user.displayName || 'Usuário') + ' • ' + matricula;
    });
    sidebar.addEventListener('mouseleave', () => {
      sidebarBadge.textContent = matricula;
    });

    // Espera token e envia ao iframe inicial (se houver)
    await sendAuthToIframe();

    goHome();
    hideLoading();
  } catch (err) {
    console.error("Erro ao inicializar usuário:", err);
    hideLoading();
  }
});

// 🔹 Envio seguro de autenticação
async function sendAuthToIframe() {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const [matricula] = (user.email || '').split('@');
    const idToken = await user.getIdToken();
    const payload = {
      type: 'syncAuth',
      usuario: {
        matricula: matricula || '',
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

// 🔹 Botão sair
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

// 🔹 Alterar senha
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
      alert('Por segurança, faça login novamente.');
      await signOut(auth);
      window.location.href = 'login.html';
    } else {
      alert('Erro: ' + (e?.message || e));
    }
  }
});
