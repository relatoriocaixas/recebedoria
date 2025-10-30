// portal-frame-loader.js
import { auth, db } from "./firebaseConfig.js";
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/*
  Principais diferenças:
  - Pré-carrega iframes (hidden) para todas as rotas em ROUTES_PRELOAD.
  - Envia token para cada iframe assim que o iframe dispara "load".
  - Ao clicar em atalho trocamos o iframe visível por um já carregado (sem setar src na hora).
  - Mantém loadingOverlay e reenvio de token em onIdTokenChanged.
*/

const sidebar = document.getElementById('sidebar');
const logoutBtn = document.getElementById('logoutBtn');
const changePassBtn = document.getElementById('changePassBtn');
const sidebarBadge = document.getElementById('sidebarBadge');
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

// Lista de rotas a pré-carregar (todas as não-nulas)
const ROUTES_PRELOAD = Object.entries(ROUTES).filter(([k,v]) => v).map(([k,v]) => ({key:k, src:v}));

// ---- Loading overlay (mantido) ----
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingOverlay';
loadingOverlay.style.cssText = `
  position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
  gap:12px; background:rgba(0,0,0,0.45); z-index:9999; font-family:Inter,system-ui;
  color:#fff; font-size:16px; flex-direction:column;
`;
loadingOverlay.innerHTML = `<div class="spinner" style="width:48px;height:48px;border:5px solid rgba(255,255,255,0.12);border-top-color:#00c853;border-radius:50%;animation:spin 1s linear infinite"></div><div>Carregando...</div>`;
document.head.insertAdjacentHTML('beforeend', `<style>@keyframes spin{to{transform:rotate(360deg)}}</style>`);
document.body.appendChild(loadingOverlay);
function showLoading(){ loadingOverlay.style.display='flex'; }
function hideLoading(){ loadingOverlay.style.display='none'; }
hideLoading();

// ---- iframe preloading map ----
const iframeMap = new Map(); // key => {iframe, loaded:boolean}
let preloadsFinished = false;

// Create a placeholder "visible" iframe element that's used when showing route.
// We'll swap it for preloaded iframe elements when needed.
let visibleIframe = null;

// ---- Utility to post auth token to an iframe element ----
async function postAuthToIframeElement(iframeEl){
  try{
    const user = auth.currentUser;
    if(!user) return;
    const idToken = await user.getIdToken();
    const parts = (user.email||'').split('@');
    const payload = {
      type:'syncAuth',
      usuario:{ matricula: parts[0]||'', email: user.email||'', nome: user.displayName||'' },
      idToken
    };
    // if iframe not yet reachable, try a bit later
    if(!iframeEl.contentWindow){
      // nothing to do
      return;
    }
    iframeEl.contentWindow.postMessage(payload, '*');
  }catch(e){
    console.warn('postAuthToIframeElement error', e);
  }
}

// ---- Preload all iframes (create hidden iframes, set src, wait load, send token) ----
async function preloadAllIframes(){
  // If already preloaded, skip
  if(preloadsFinished) return;
  showLoading();

  const promises = ROUTES_PRELOAD.map(({key, src}) => new Promise((resolve) => {
    // create iframe
    const iframeEl = document.createElement('iframe');
    iframeEl.dataset.routeKey = key;
    iframeEl.src = src;
    iframeEl.style.display = 'none';
    iframeEl.style.width = '100%';
    iframeEl.style.height = '100%';
    iframeEl.style.border = '0';
    iframeEl.setAttribute('loading','lazy');

    // on load, send token and mark loaded
    const onLoad = async () => {
      iframeEl.removeEventListener('load', onLoad);
      await postAuthToIframeElement(iframeEl);
      iframeMap.set(key, { iframe: iframeEl, loaded:true });
      resolve();
    };
    iframeEl.addEventListener('load', onLoad);

    // add to container but keep hidden
    iframeContainer.appendChild(iframeEl);
    // store initial entry
    iframeMap.set(key, { iframe: iframeEl, loaded:false });
  }));

  // wait all to finish but with a timeout: if some slow iframe not loaded within X ms, continue
  const timeoutMs = 8000; // you can increase if needed, but don't make it huge
  await Promise.race([
    Promise.all(promises),
    new Promise((res) => setTimeout(res, timeoutMs))
  ]);

  preloadsFinished = true;
  hideLoading();
}

// ---- Show a preloaded iframe (or fallback to creating one) ----
async function showRouteIframe(key){
  // remove currently visible iframe if any
  if(visibleIframe && visibleIframe.parentElement === iframeContainer){
    iframeContainer.removeChild(visibleIframe);
    visibleIframe = null;
  }

  const entry = iframeMap.get(key);
  if(entry && entry.iframe){
    // ensure iframe is visible
    entry.iframe.style.display = 'block';
    iframeContainer.appendChild(entry.iframe);
    visibleIframe = entry.iframe;
    // ensure we sent latest token
    await postAuthToIframeElement(entry.iframe);
    return;
  }

  // fallback: create iframe now
  const src = ROUTES[key];
  const iframeEl = document.createElement('iframe');
  iframeEl.src = src;
  iframeEl.style.width = '100%';
  iframeEl.style.height = '100%';
  iframeEl.style.border = '0';
  iframeContainer.appendChild(iframeEl);
  visibleIframe = iframeEl;
  iframeMap.set(key, { iframe: iframeEl, loaded:false });
  iframeEl.addEventListener('load', () => postAuthToIframeElement(iframeEl));
}

// ---- Route open logic (shows preloaded iframe) ----
function goHome(){
  // hide iframe area and show notices
  iframeContainer.classList.remove('full');
  iframeContainer.style.display = 'none';
  avisosSection.style.display = 'block';
  sidebar.style.display = 'flex';
  // if there is a visible iframe keep it but hidden
  if(visibleIframe){ visibleIframe.style.display = 'none'; }
}

async function openRoute(route){
  const src = ROUTES[route];
  if(!src){ goHome(); return; }

  showLoading();
  avisosSection.style.display = 'none';
  iframeContainer.style.display = 'block';
  iframeContainer.classList.add('full');

  // ensure preloads finished (wait a bit more if necessary)
  if(!preloadsFinished){
    // attempt to preload now if not yet started
    await preloadAllIframes();
  }

  // Small deliberate wait to ensure token sync
  await new Promise(r => setTimeout(r, 300));

  // show the preloaded iframe (or fallback)
  await showRouteIframe(route);

  // hide loading once iframe is visible and token posted
  // give iframe a small time to process auth
  setTimeout(() => { hideLoading(); }, 350);
}

// ---- Sidebar link wiring (same behavior) ----
document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    const t = li.dataset.target;
    if(t === 'home') goHome();
    else openRoute(t);
  });
});

// ---- date in header (unchanged) ----
if (dataVigenteSpan) {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2,'0');
  const mes = String(hoje.getMonth()+1).padStart(2,'0');
  const ano = hoje.getFullYear();
  dataVigenteSpan.textContent = `${dia}/${mes}/${ano}`;
}

// ---- ensure user doc (unchanged) ----
async function ensureUserInFirestore(user){
  try{
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const parts = (user.email || '').split('@');
    const matricula = parts[0] || '';
    const domain = parts[1] || '';
    const isAdmin = domain.toLowerCase() === 'movebuss.local';

    if(!userSnap.exists()){
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        matricula,
        nome: user.displayName || matricula,
        admin: isAdmin,
        createdAt: new Date()
      });
      console.log("Usuário adicionado à coleção 'users'.");
    }else{
      const existing = userSnap.data();
      if(existing.admin !== isAdmin){
        await setDoc(userRef, {...existing, admin: isAdmin}, { merge: true });
        console.log("Campo 'admin' atualizado conforme domínio.");
      }
    }
  }catch(e){
    console.error("Erro ao salvar usuário em 'users':", e);
  }
}

// ---- sendAuthToIframe now posts to ALL preloaded iframes as well ----
async function sendAuthToIframe(){
  try{
    const user = auth.currentUser;
    if(!user) return;
    const idToken = await user.getIdToken();
    const parts = (user.email||'').split('@');
    const payload = {
      type:'syncAuth',
      usuario:{ matricula: parts[0]||'', email: user.email||'', nome: user.displayName||'' },
      idToken
    };

    // send to currently visible iframe first (if any)
    if(visibleIframe && visibleIframe.contentWindow){
      visibleIframe.contentWindow.postMessage(payload, '*');
    }

    // also send to all preloaded iframes
    iframeMap.forEach(({iframe}) => {
      try{
        if(iframe && iframe.contentWindow){
          iframe.contentWindow.postMessage(payload, '*');
        }
      }catch(e){/* ignore */ }
    });
  }catch(e){
    console.warn('sendAuthToIframe error', e);
  }
}

// ---- onAuthStateChanged: ensure preloads happen after auth and user doc exists ----
onAuthStateChanged(auth, async (user) => {
  showLoading();

  if(!user){
    // not authenticated: go to login page
    window.location.href = 'login.html';
    return;
  }

  try{
    const parts = (user.email||'').split('@');
    sidebarBadge.textContent = parts[0] || '';
    sidebar.classList.remove('hidden');

    sidebar.addEventListener('mouseenter', () => {
      sidebarBadge.textContent = (user.displayName || 'Usuário') + ' • ' + (parts[0] || '');
    });
    sidebar.addEventListener('mouseleave', () => {
      sidebarBadge.textContent = parts[0] || '';
    });

    // ensure user doc exists
    await ensureUserInFirestore(user);

    // Start preloading iframes in background (do not block UI long)
    // but await a short time so we're sure at least some are ready before user clicks.
    preloadAllIframes().catch(e => console.warn('preloadAllIframes failed', e));

    // send immediate token to any current visible iframe (none yet) and to preloaded once loaded
    await sendAuthToIframe();

    // Give short breathing time before hiding loading (ensures token round-trip)
    await new Promise(r => setTimeout(r, 400));
    hideLoading();
    goHome();

  }catch(e){
    console.error('Erro no onAuthStateChanged:', e);
    hideLoading();
  }
});

// ---- re-send token on token changes to all iframes (helps avoid expiry logout) ----
onIdTokenChanged(auth, async (user) => {
  if(!user) return;
  try{
    // force refresh token and send to iframes
    await user.getIdToken(true);
    await sendAuthToIframe();
  }catch(e){
    console.warn('onIdTokenChanged handler error', e);
  }
});

// ---- logout and change password unchanged ----
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
