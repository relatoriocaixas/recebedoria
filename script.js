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

// 🔹 Tela de carregamento
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

// 🔹 Volta para tela inicial (avisos)
function goHome() {
  showLoading();
  iframeContainer.style.display = 'none';
  avisosSection.style.display = 'block';
  sidebar.style.display = 'flex';
  setTimeout(() => hideLoading(), 800); // transição rápida e suave
}

// 🔹 Função robusta para abrir um módulo
async function openRoute(route) {
  const src = ROUTES[route];
  if (!src) return goHome();

  showLoading();

  try {
    const user = auth.currentUser;
    if (!user) {
      alert("Sessão expirada. Faça login novamente.");
      return (window.location.href = "login.html");
    }

    // 🔸 Aguarda token válido ANTES de carregar o iframe
    const idToken = await user.getIdToken(true);

    // 🔸 Esconde os avisos e mostra área do iframe
    avisosSection.style.display = 'none';
    iframeContainer.style.display = 'block';
    iframeContainer.classList.add('full');
    frame.style.display = 'none'; // oculta até terminar tudo

    // 🔸 Carrega o iframe somente agora
    frame.src = src;

    await new Promise((resolve) => {
      frame.onload = () => resolve();
    });

    // 🔸 Envia o token e dados de usuário ao iframe
    const parts = (user.email || '').split('@');
    const payload = {
      type: "syncAuth",
      usuario: {
        matricula: parts[0] || '',
        email: user.email || '',
        nome: user.displayName || ''
      },
      idToken
    };
    frame.contentWindow.postMessage(payload, "*");

    // 🔸 Após envio bem-sucedido, mostra o conteúdo
    frame.style.display = 'block';
    hideLoading();

  } catch (error) {
    console.error("Erro ao abrir módulo:", error);
    alert("Erro ao carregar o sistema. Tente novamente.");
    hideLoading();
  }
}

// 🔹 Itens da barra lateral
document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    const t = li.dataset.target;
    if (t === 'home') goHome();
    else openRoute(t);
  });
});

// 🔹 Atualiza a data vigente
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

// 🔹 Estado de autenticação principal
onAuthStateChanged(auth, async (user) => {
  showLoading();
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

    await ensureUserInFirestore(user);

    // 🔸 Após login, abre Home com transição leve
    setTimeout(() => {
      goHome();
      hideLoading();
    }, 800);
  }
});

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
