// app.js
import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  doc,
  getDoc,
  deleteDoc
} from "./firebaseConfig_v2.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[app] Iniciando app.js");

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      console.warn("[app] Nenhum usuário logado. Redirecionando...");
      window.location.href = "/login.html";
      return;
    }

    console.log("[app] onAuthStateChanged fired — user:", user.uid);

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
    await popularSelects(); // popula selects com matriculas da coleção users
    inicializarEventos(IS_ADMIN, MATRICULA);
    carregarRelatorios(MATRICULA, IS_ADMIN);
  });
});

// =======================================================
// Interface
// =======================================================
function configurarInterface(admin) {
  document.querySelectorAll(".admin-only").forEach((el) => (el.hidden = !admin));
  document.querySelectorAll(".user-only").forEach((el) => (el.hidden = admin));
}

// =======================================================
// Popular selects de matrículas
// =======================================================
async function popularSelects() {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    const matriculas = snapshot.docs.map((d) => d.data().matricula).filter(Boolean);

    const selects = [
      document.getElementById("matriculaForm"),
      document.getElementById("selectMatriculas"),
      document.getElementById("filtroMatricula")
    ];

    selects.forEach((sel) => {
      if (!sel) return;
      sel.innerHTML = `<option value="">Selecione...</option>`;
      matriculas.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        sel.appendChild(opt);
      });
    });

    console.log("[app] Selects populados:", matriculas);
  } catch (e) {
    console.error("Erro ao carregar usuários:", e);
  }
}

// =======================================================
// Inicialização de eventos
// =======================================================
function inicializarEventos(admin, matricula) {
  const btnSalvarRelatorio = document.getElementById("btnSalvarRelatorio");
  const btnResumoRecebedor = document.getElementById("btnResumoRecebedor");
  const btnToggleResumo = document.getElementById("btnToggleResumo");
  const btnLogout = document.getElementById("btnLogout");
  const btnCarregarResumo = document.getElementById("btnCarregarResumo");
  const btnAplicarFiltroMatricula = document.getElementById("btnAplicarFiltroMatricula");
  const btnFiltrarPorData = document.getElementById("btnFiltrarPorData");

  if (btnSalvarRelatorio)
    btnSalvarRelatorio.addEventListener("click", () => salvarRelatorio(admin, matricula));

  if (btnResumoRecebedor)
    btnResumoRecebedor.addEventListener("click", () => {
      document.getElementById("resumoWrap").classList.toggle("collapsed");
    });

  if (btnToggleResumo)
    btnToggleResumo.addEventListener("click", () => {
      document.getElementById("resumoWrap").classList.toggle("collapsed");
    });

  if (btnLogout)
    btnLogout.addEventListener("click", () =>
      auth.signOut().then(() => (window.location.href = "/login.html"))
    );

  if (btnCarregarResumo)
    btnCarregarResumo.addEventListener("click", carregarResumoMensal);

  if (btnAplicarFiltroMatricula)
    btnAplicarFiltroMatricula.addEventListener("click", () => {
      const m = document.getElementById("filtroMatricula").value;
      if (m) carregarRelatorios(m, true);
    });

  if (btnFiltrarPorData)
    btnFiltrarPorData.addEventListener("click", async () => {
      const data = document.getElementById("filtroDataGlobal").value;
      if (!data) return alert("Selecione uma data!");
      await carregarRelatoriosPorData(data);
    });
}

// =======================================================
// Salvar relatório
// =======================================================
async function salvarRelatorio(admin) {
  if (!admin) {
    alert("Apenas administradores podem criar relatórios.");
    return;
  }

  const matricula = document.getElementById("matriculaForm").value;
  const dataCaixa = document.getElementById("dataCaixa").value;
  const valorFolha = parseFloat(document.getElementById("valorFolha").value) || 0;
  const valorDinheiro = parseFloat(document.getElementById("valorDinheiro").value) || 0;
  const sobraFalta = valorDinheiro - valorFolha;
  const observacao = document.getElementById("observacao").value;

  if (!matricula || !dataCaixa) {
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
    carregarRelatorios(matricula, admin);
  } catch (e) {
    console.error("Erro ao salvar relatório:", e);
    alert("Erro ao salvar relatório. Tente novamente.");
  }
}

// =======================================================
// Carregar relatórios
// =======================================================
async function carregarRelatorios(matricula, admin) {
  try {
    const ref = collection(db, "relatorios");
    let q;
    if (admin && matricula) {
      q = query(ref, where("matricula", "==", matricula), orderBy("criadoEm", "desc"));
    } else if (admin) {
      q = query(ref, orderBy("criadoEm", "desc"));
    } else {
      q = query(ref, where("matricula", "==", matricula), orderBy("criadoEm", "desc"));
    }

    const snapshot = await getDocs(q);
    const lista = document.getElementById("listaRelatorios");
    lista.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const r = docSnap.data();
      const item = document.createElement("div");
      item.className = "relatorio-item";
      item.innerHTML = `
        <strong>${
          r.dataCaixa instanceof Object && r.dataCaixa.toDate
            ? r.dataCaixa.toDate().toLocaleDateString()
            : r.dataCaixa
        }</strong> — 
        Folha: R$ ${r.valorFolha.toFixed(2)} | Dinheiro: R$ ${r.valorDinheiro.toFixed(2)}  
        <span class="${r.sobraFalta >= 0 ? "positivo" : "negativo"}">
          (${r.sobraFalta.toFixed(2)})
        </span>
        ${admin ? `<button class="btn danger" onclick="excluirRelatorio('${docSnap.id}')">Excluir</button>` : ""}
      `;
      lista.appendChild(item);
    });
  } catch (e) {
    console.error("Erro ao carregar relatórios:", e);
  }
}

// =======================================================
// Resumo mensal por matrícula
// =======================================================
async function carregarResumoMensal() {
  const matricula = document.getElementById("selectMatriculas").value;
  const mesSelecionado = document.getElementById("mesResumo").value;
  if (!matricula || !mesSelecionado) {
    alert("Selecione matrícula e mês!");
    return;
  }

  const [ano, mes] = mesSelecionado.split("-");
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59);

  try {
    const ref = collection(db, "relatorios");
    const q = query(
      ref,
      where("matricula", "==", matricula),
      orderBy("dataCaixa", "desc")
    );
    const snapshot = await getDocs(q);
    const relatorios = snapshot.docs
      .map((d) => d.data())
      .filter((r) => r.dataCaixa.toDate() >= inicio && r.dataCaixa.toDate() <= fim);

    const totalFolha = relatorios.reduce((s, r) => s + (r.valorFolha || 0), 0);
    const saldo = relatorios.reduce((s, r) => s + (r.sobraFalta || 0), 0);

    document.getElementById("resumoTotalFolha").textContent = `R$ ${totalFolha.toFixed(2)}`;
    document.getElementById("resumoSaldo").textContent = `R$ ${saldo.toFixed(2)}`;
    document.getElementById("resumoSituacao").textContent =
      saldo > 0 ? "Sobra" : saldo < 0 ? "Falta" : "Zerado";

    const lista = document.getElementById("resumoLista");
    lista.innerHTML = "";
    relatorios.forEach((r) => {
      const div = document.createElement("div");
      div.innerHTML = `
        <span>${r.dataCaixa.toDate().toLocaleDateString()}</span> - 
        Folha: R$ ${r.valorFolha.toFixed(2)} | 
        Dif: <strong class="${r.sobraFalta >= 0 ? "positivo" : "negativo"}">
        ${r.sobraFalta.toFixed(2)}</strong>`;
      lista.appendChild(div);
    });
  } catch (e) {
    console.error("Erro ao carregar resumo:", e);
  }
}

// =======================================================
// Filtro por data global
// =======================================================
async function carregarRelatoriosPorData(dataStr) {
  const ref = collection(db, "relatorios");
  const snapshot = await getDocs(query(ref, orderBy("dataCaixa", "desc")));
  const lista = document.getElementById("listaRelatorios");
  lista.innerHTML = "";

  snapshot.forEach((docSnap) => {
    const r = docSnap.data();
    const dataCaixa = r.dataCaixa.toDate().toISOString().split("T")[0];
    if (dataCaixa === dataStr) {
      const item = document.createElement("div");
      item.className = "relatorio-item";
      item.innerHTML = `
        <strong>${dataCaixa}</strong> — Folha: R$ ${r.valorFolha.toFixed(2)} | 
        Dinheiro: R$ ${r.valorDinheiro.toFixed(2)} 
        <span class="${r.sobraFalta >= 0 ? "positivo" : "negativo"}">
          (${r.sobraFalta.toFixed(2)})
        </span>`;
      lista.appendChild(item);
    }
  });
}

// =======================================================
// Excluir relatório
// =======================================================
window.excluirRelatorio = async function (id) {
  if (!confirm("Deseja realmente excluir este relatório?")) return;
  try {
    await deleteDoc(doc(db, "relatorios", id));
    alert("Relatório excluído com sucesso!");
    carregarRelatorios("", true);
  } catch (e) {
    console.error("Erro ao excluir relatório:", e);
    alert("Erro ao excluir relatório.");
  }
};