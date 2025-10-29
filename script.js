import { auth } from "./firebaseConfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

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

function goHome(){
  iframeContainer.classList.remove('full');
  iframeContainer.style.display = 'none';
  avisosSection.style.display = 'block';
  sidebar.style.display = 'flex';
}

function openRoute(route){
  const src = ROUTES[route];
  if(!src){ goHome(); return; }
  avisosSection.style.display = 'none';
  iframeContainer.style.display = 'block';
  iframeContainer.classList.add('full');
  frame.src = src;
  setTimeout(sendAuthToIframe, 500);
}

// Atalhos da barra lateral
document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    const t = li.dataset.target;
    if(t === 'home') goHome();
    else openRoute(t);
  });
});

// Atualiza o #dataVigente com a data atual
if(dataVigenteSpan){
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2,'0');
  const mes = String(hoje.getMonth()+1).padStart(2,'0');
  const ano = hoje.getFullYear();
  dataVigenteSpan.textContent = `${dia}/${mes}/${ano}`;
}

// Auth e badge
onAuthStateChanged(auth, (user) => {
  if(!user){
    window.location.href = 'login.html';
  } else {
    sidebar.classList.remove('hidden');

    const parts = (user.email||'').split('@');

    // Badge na sidebar
    sidebarBadge.textContent = parts[0];
    sidebar.addEventListener('mouseenter', () => {
      sidebarBadge.textContent = (user.displayName || 'Usuário') + ' • ' + parts[0];
    });
    sidebar.addEventListener('mouseleave', () => {
      sidebarBadge.textContent = parts[0];
    });

    goHome();

    // Envia auth para iframe
    try {
      user.getIdToken().then(idToken => {
        const payload = {
          type: 'syncAuth',
          usuario: {
            matricula: parts[0] || '',
            email: user.email || '',
            nome: user.displayName || ''
          },
          idToken
        };
        if(frame && frame.contentWindow){
          frame.contentWindow.postMessage(payload, '*');
        }
      });
    } catch(e){
      console.warn('erro ao enviar token ao iframe', e);
    }
  }
});

// Botão sair
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

// Botão alterar senha
changePassBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if(!user) return alert('Usuário não autenticado');
  const nova = prompt('Digite a nova senha:');
  if(!nova) return;
  try {
    await user.updatePassword(nova);
    alert('Senha alterada com sucesso.');
  } catch(e){
    alert('Erro ao alterar senha: ' + (e?.message || e));
  }
});

// Função original de enviar auth para iframe
async function sendAuthToIframe(){
  try {
    const user = auth.currentUser;
    if(!user) return;
    const parts = (user.email||'').split('@');
    const idToken = await user.getIdToken();
    const payload = {
      type:'syncAuth',
      usuario:{
        matricula: parts[0]||'',
        email: user.email||'',
        nome: user.displayName||''
      },
      idToken
    };
    if(frame && frame.contentWindow){
      frame.contentWindow.postMessage(payload, '*');
    }
  } catch(e){
    console.warn('sendAuthToIframe error', e);
  }
}
