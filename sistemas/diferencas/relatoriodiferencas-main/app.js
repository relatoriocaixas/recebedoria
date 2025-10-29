// app.js
import { auth, db, onAuthStateChanged, collection, getDocs, query, where, orderBy, addDoc, doc, getDoc } from "./firebaseConfig.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[app] Iniciando app.js");
  
  // Observa alterações no estado do usuário
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      console.warn("[app] Nenhum usuário logado. Redirecionando...");
      window.location.href = "/login.html"; // ajuste conforme seu caminho
      return;
    }
    
    console.log("[app] onAuthStateChanged fired — user:", user.uid);

    // Busca dados completos do usuário na coleção 'users'
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      alert("Seu cadastro não está completo. Faça login novamente.");
      await auth.signOut();
      return;
    }

    const userData = userSnap.data();
    console.log("[app] CURRENT_USER_DATA:", userData);

    const IS_ADMIN = userData.admin === true;
    const MATRICULA = userData.matricula;

    configurarInterface(IS_ADMIN);
    inicializarEventos(IS_ADMIN, MATRICULA);
    carregarRelatorios(MATRICULA, IS_ADMIN);
  });
});

// =======================================================
// Funções de Interface
// =======================================================
function configurarInterface(admin) {
  document.querySelectorAll(".admin-only").forEach(el => el.hidden = !admin);
  document.querySelectorAll(".user-only").forEach(el => el.hidden = admin);
}

// =======================================================
// Inicialização de Eventos
// =======================================================
function inicializarEventos(admin, matricula) {
  const btnSalvarRelatorio = document.getElementById("btnSalvarRelatorio");
  const btnResumoRecebedor = document.getElementById("btnResumoRecebedor");
  const btnToggleResumo = document.getElementById("btnToggleResumo");
  const btnLogout = document.getElementById("btnLogout");

  if (btnSalvarRelatorio) {
    btnSalvarRelatorio.addEventListener("click", () => salvarRelatorio(admin, matricula));
  }

  if (btnResumoRecebedor) {
    btnResumoRecebedor.addEventListener("click", () => {
      document.getElementById("resumoWrap").classList.toggle("collapsed");
    });
  }

  if (btnToggleResumo) {
    btnToggleResumo.addEventListener("click", () => {
      document.getElementById("resumoWrap").classList.toggle("collapsed");
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => auth.signOut().then(() => window.location.href = "/login.html"));
  }
}

// =======================================================
// Funções principais
// =======================================================
async function salvarRelatorio(admin, matricula) {
  if (!admin) {
    alert("Apenas administradores podem criar relatórios.");
    return;
  }

  const dataCaixa = document.getElementById("dataCaixa").value;
  const valorFolha = parseFloat(document.getElementById("valorFolha").value) || 0;
  const valorDinheiro = parseFloat(document.getElementById("valorDinheiro").value) || 0;
  const sobraFalta = valorDinheiro - valorFolha;
  const observacao = document.getElementById("observacao").value;

  if (!dataCaixa || isNaN(valorFolha) || isNaN(valorDinheiro)) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  try {
    await addDoc(collection(db, "relatorios"), {
      matricula,
      dataCaixa: new Date(dataCaixa),
      valorFolha,
      valorDinheiro,
      sobraFalta,
      observacao,
      criadoEm: new Date(),
      createdBy: auth.currentUser.uid
    });
    alert("Relatório salvo com sucesso!");
    carregarRelatorios(matricula, admin); // atualiza a lista
  } catch (e) {
    console.error("Erro ao salvar relatório:", e);
    alert("Erro ao salvar relatório. Tente novamente.");
  }
}

async function carregarRelatorios(matricula, admin) {
  try {
    const ref = collection(db, "relatorios");
    let q;
    if (admin) {
      q = query(ref, orderBy("criadoEm", "desc"));
    } else {
      q = query(ref, where("matricula", "==", matricula), orderBy("criadoEm", "desc"));
    }

    const snapshot = await getDocs(q);
    const lista = document.getElementById("listaRelatorios");
    lista.innerHTML = "";

    snapshot.forEach(docSnap => {
      const r = docSnap.data();
      const item = document.createElement("div");
      item.className = "relatorio-item";
      item.innerHTML = `
        <strong>${r.dataCaixa instanceof Object && r.dataCaixa.toDate ? r.dataCaixa.toDate().toLocaleDateString() : r.dataCaixa}</strong> — 
        Folha: R$ ${r.valorFolha.toFixed(2)} | Dinheiro: R$ ${r.valorDinheiro.toFixed(2)}  
        <span class="${r.sobraFalta >= 0 ? "positivo" : "negativo"}">
          (${r.sobraFalta.toFixed(2)})
        </span>
        ${admin ? `<button class="btn danger" data-id="${docSnap.id}" onclick="excluirRelatorio('${docSnap.id}')">Excluir</button>` : ""}
      `;
      lista.appendChild(item);
    });
  } catch (e) {
    console.error("Erro ao carregar relatórios:", e);
  }
}

// Função global para excluir relatório (admin)
window.excluirRelatorio = async function(id) {
  if (!confirm("Deseja realmente excluir este relatório?")) return;
  try {
    await deleteDoc(doc(db, "relatorios", id));
    alert("Relatório excluído com sucesso!");
    document.getElementById("listaRelatorios").innerHTML = "";
    // recarrega a lista
    carregarRelatorios("", true);
  } catch (e) {
    console.error("Erro ao excluir relatório:", e);
    alert("Erro ao excluir relatório.");
  }
};
