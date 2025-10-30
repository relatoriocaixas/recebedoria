import { auth, db } from "./firebaseConfig.js";
import {
  onAuthStateChanged,
  onIdTokenChanged,
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

// 🔹 Loading overlay
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingOverlay';
loadingOverlay.innerHTML = `
  <div class="spinner"></div>
  <div>Carregando...</div>
`;
document.body.appendChild(loadingOverlay);
function showLoading() { loadingOverlay.style.display = 'flex'; }
function hideLoading() { loadingOverlay.style.display = 'none'; }
hideLoading();

// 🔹 Map para armazenar iframe pré-carregado
const iframeMap = new Map();
let visibleIframe = null;

// 🔹 Função para ir à tela inicial
function goHome() {
  iframeContainer.classList.remove('full');
  iframeContainer.style.display = 'none';
  avisosSection.style.display = 'block';
  sidebar.style.display = 'flex';
  if (visibleIframe) visibleIframe.style.display = 'none';
}

// 🔹 Função para enviar token ao iframe
async function sendAuthToIframeElement(iframeEl) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken(true);
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
    if (iframeEl.contentWindow) iframeEl.contentWindow.postMessage(payload, '*');
  } catch (e) {
    console.warn('sendAuthToIframeElement error', e);
  }
}

// 🔹 Função para pré-carregar iframes
async function preloadIframe(routeKey) {
  const src = ROUTES[routeKey];
  if (!src) return;
  return new Promise(resolve => {
    const iframeEl = document.createElement('iframe');
    iframeEl.src = src;
    iframeEl.style.display = 'none';
    iframeEl.style.width = '100%';
    iframeEl.style.height = '100%';
    iframeEl.style.border = '0';
    iframeEl.onload = async () => {
      await sendAuthToIframeElement(iframeEl);
      iframeMap.set(routeKey, iframeEl);
      resolve();
    };
    iframeContainer.appendChild(iframeEl);
  });
}

// 🔹 Abrir rota (mostra iframe pré-carregado)
async function openRoute(routeKey) {
  if (!ROUTES[routeKey]) return goHome();
  showLoading();
  avisosSection.style.display = 'none';
  iframeContainer.style.display = 'block';
  iframeContainer.classList.add('full');

  let iframeEl = iframeMap.get(routeKey);
  if (!iframeEl) iframeEl = await preloadIframe(routeKey);

  if (visibleIframe) visibleIframe.style.display = 'none';
  iframeEl.style.display = 'block';
  visibleIframe = iframeEl;

  // pequeno delay para garantir que o iframe processou o token
  setTimeout(() => hideLoading(), 300);
}

// 🔹 Sidebar
document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    const t = li.dataset.target;
    if (t === 'home') goHome();
    else openRoute(t);
  });
});

// 🔹 Data atual
if (dataVigenteSpan) {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  dataVigenteSpan.textContent = `${dia}/${mes}/${ano}`;
}

// 🔹 Garante usuário no Firestore
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
    } else {
      const existing = userSnap.data();
      if (existing.admin !== isAdmin) {
        await setDoc(userRef, { ...existing, admin: isAdmin }, { merge: true });
      }
    }
  } catch (e) {
    console.error("Erro ao salvar usuário em 'users':", e);
  }
}

// 🔹 Envia token para todos os iframes
async function sendAuthToIframe() {
  for (let iframeEl of iframeMap.values()) {
    await sendAuthToIframeElement(iframeEl);
  }
  if (visibleIframe) await sendAuthToIframeElement(visibleIframe);
}

// 🔹 AuthStateChanged
onAuthStateChanged(auth, async (user) => {
  showLoading();
  if (!user) return window.location.href = 'login.html';
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

    // pré-carrega todos os iframes (background)
    Object.keys(ROUTES).forEach(routeKey => {
      if (ROUTES[routeKey]) preloadIframe(routeKey);
    });

    await sendAuthToIframe();

    goHome();
  } catch (err) {
    console.error("Erro no carregamento inicial:", err);
  } finally {
    hideLoading();
  }
});

// 🔹 Reenvio de token ao mudar
onIdTokenChanged(auth, async (user) => {
  if (!user) return;
  try { await sendAuthToIframe(); } catch(e){ console.warn(e); }
});

// 🔹 Botões
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

changePassBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return alert('Usuário não autenticado.');
  const nova = prompt('Digite a nova senha:');
  if (!nova) return;
  try { await updatePassword(user, nova); alert('Senha alterada com sucesso.'); }
  catch (e) {
    console.error(e);
    if (e.code === 'auth/requires-recent-login') {
      alert('Faça login novamente antes de alterar a senha.');
      await signOut(auth);
      window.location.href = 'login.html';
    } else alert('Erro ao alterar senha: ' + (e?.message || e));
  }
});
