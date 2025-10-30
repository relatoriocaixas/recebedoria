// app.js
import { 
  auth, db, onAuthStateChanged, collection, getDocs, query, where, orderBy, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp
} from "./firebaseConfig.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[app] Iniciando app.js");

  // Atualiza automaticamente o sobra/falta no formulário
  const valorFolhaInput = document.getElementById("valorFolha");
  const valorDinheiroInput = document.getElementById("valorDinheiro");
  const sobraFaltaInput = document.getElementById("sobraFalta");

  if (valorFolhaInput && valorDinheiroInput && sobraFaltaInput) {
    const atualizarSobra = () => {
      const folha = parseFloat(valorFolhaInput.value) || 0;
      const dinheiro = parseFloat(valorDinheiroInput.value) || 0;
      sobraFaltaInput.value = (dinheiro - folha).toFixed(2);
    };
    valorFolhaInput.addEventListener("input", atualizarSobra);
    valorDinheiroInput.addEventListener("input", atualizarSobra);
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
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
    const IS_ADMIN = userData.admin === true;
    const MATRICULA = userData.matricula;

    configurarInterface(IS_ADMIN);
    await popularSelects(IS_ADMIN);
    inicializarEventos(IS_ADMIN, MATRICULA);
    carregarRelatorios(IS_ADMIN, MATRICULA);
    carregarResumoMensal(IS_ADMIN);
  });
});

// ===========================
// Interface
// ===========================
function configurarInterface(admin) {
  document.querySelectorAll(".admin-only").forEach(el => el.hidden = !admin);
  document.querySelectorAll(".user-only").forEach(el => el.hidden = admin);
}

// ===========================
// Popula selects de matrícula (corrigido)
// ===========================
async function popularSelects(admin) {
  const selectForm = document.getElementById("matriculaForm");
  const selectResumo = document.getElementById("selectMatriculas");
  const filtroMatricula = document.getElementById("filtroMatricula"); // correção

  const snapshot = await getDocs(collection(db, "users"));
  const matriculas = [];

  snapshot.forEach(docSnap => {
    const u = docSnap.data();
    if (u.matricula) matriculas.push(u);
  });

  matriculas.sort((a, b) => a.matricula.localeCompare(b.matricula, 'pt-BR', { numeric: true }));

  [selectForm, selectResumo, filtroMatricula].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione uma matrícula</option>';
    matriculas.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.matricula;
      opt.textContent = `${u.matricula} - ${u.nome}`;
      sel.appendChild(opt);
    });
  });

  console.log("[app] Selects populados:", matriculas.map(m => m.matricula));
}

// ===========================
// Eventos
// ===========================
function inicializarEventos(admin, matricula) {
  const btnSalvarRelatorio = document.getElementById("btnSalvarRelatorio");
  const btnCarregarResumo = document.getElementById("btnCarregarResumo");
  const btnToggleResumo = document.getElementById("btnToggleResumo");
  const btnLogout = document.getElementById("btnLogout");
  const filtroResumo = document.getElementById("verApenas");

  if (btnSalvarRelatorio) btnSalvarRelatorio.addEventListener("click", () => salvarRelatorio(admin));
  if (btnCarregarResumo) btnCarregarResumo.addEventListener("click", () => carregarResumoMensal(admin));
  if (btnToggleResumo) btnToggleResumo.addEventListener("click", () => document.getElementById("resumoWrap").classList.toggle("collapsed"));
  if (btnLogout) btnLogout.addEventListener("click", () => auth.signOut().then(() => window.location.href = "/login.html"));

  // Filtro "Ver apenas" restaurado
  if (filtroResumo) {
    filtroResumo.addEventListener("change", () => carregarResumoMensal(admin));
  }
}

// ===========================
// Salvar relatório
// ===========================
async function salvarRelatorio(admin) {
  if (!admin) { alert("Apenas administradores podem criar relatórios."); return; }

  const matricula = document.getElementById("matriculaForm").value;
  const dataCaixa = document.getElementById("dataCaixa").value;
  const valorFolha = parseFloat(document.getElementById("valorFolha").value) || 0;
  const valorDinheiro = parseFloat(document.getElementById("valorDinheiro").value) || 0;
  const sobraFalta = valorDinheiro - valorFolha;
  const observacao = document.getElementById("observacao").value || "";
  const createdBy = auth.currentUser.uid;

  if (!matricula || !dataCaixa) { alert("Preencha todos os campos."); return; }

  try {
    await addDoc(collection(db, "relatorios"), {
      createdBy,
      criadoEm: serverTimestamp(),
      dataCaixa: new Date(dataCaixa),
      imagemPath: "",
      matricula,
      observacao,
      posEditado: false,
      posTexto: "",
      sobraFalta,
      valorDinheiro,
      valorFolha
    });
    alert("Relatório salvo!");
    carregarRelatorios(true, matricula);
  } catch (e) {
    console.error("Erro ao salvar relatório:", e);
    alert("Erro ao salvar relatório.");
  }
}

// ===========================
// Carregar relatórios
// ===========================
async function carregarRelatorios(admin, userMatricula) {
  const lista = document.getElementById("listaRelatorios");
  lista.innerHTML = "";

  try {
    let q;
    if (admin) {
      q = query(collection(db, "relatorios"), orderBy("criadoEm", "desc"));
    } else {
      q = query(collection(db, "relatorios"), where("matricula", "==", userMatricula), orderBy("criadoEm", "desc"));
    }

    const snapshot = await getDocs(q);

    snapshot.forEach(docSnap => {
      const r = docSnap.data();
      const tr = document.createElement("div");
      tr.className = "relatorio-item";

      const diferencaClass = r.sobraFalta >= 0 ? "positivo" : "negativo";

      tr.innerHTML = `
        <div class="item-header">
          <strong>${r.dataCaixa instanceof Object && r.dataCaixa.toDate ? r.dataCaixa.toDate().toLocaleDateString() : new Date(r.dataCaixa).toLocaleDateString()}</strong> — Matrícula: ${r.matricula}
          <button class="btn outline btnToggle" data-id="${docSnap.id}">Ocultar/Exibir</button>
        </div>
        <div class="item-body hidden">
          <table class="relatorio-table">
            <tr><td>Folha:</td><td>R$ ${r.valorFolha.toFixed(2)}</td></tr>
            <tr><td>Dinheiro:</td><td>R$ ${r.valorDinheiro.toFixed(2)}</td></tr>
            <tr><td>Diferença:</td><td class="${diferencaClass}">R$ ${r.sobraFalta.toFixed(2)}</td></tr>
            <tr><td>Observação:</td><td>${r.observacao || "-"}</td></tr>
          </table>
          <div class="actions">
            <button class="btn outline btnPos" data-id="${docSnap.id}">Pós Conferência</button>
            ${admin ? `<button class="btn primary btnEdit" data-id="${docSnap.id}">Editar</button>` : ""}
          </div>
        </div>
      `;

      lista.appendChild(tr);
    });

    document.querySelectorAll(".btnToggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const body = btn.closest(".relatorio-item").querySelector(".item-body");
        body.classList.toggle("hidden");
      });
    });

    document.querySelectorAll(".btnPos").forEach(btn => {
      btn.addEventListener("click", () => abrirPosConferencia(btn.dataset.id, admin));
    });

    document.querySelectorAll(".btnEdit").forEach(btn => {
      btn.addEventListener("click", () => editarRelatorio(btn.dataset.id));
    });

  } catch (e) {
    console.error("Erro ao carregar relatórios:", e);
  }
}

// ===========================
// Pós-Conferência
// ===========================
async function abrirPosConferencia(id, admin) {
  const modal = document.getElementById("posModal");
  const textarea = document.getElementById("posTexto");
  modal.showModal();

  const docRef = doc(db, "relatorios", id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    textarea.value = docSnap.data().posTexto || "";
    textarea.disabled = !admin;
  }

  document.getElementById("btnSalvarPos").onclick = async () => {
    if (!admin) return;
    await updateDoc(docRef, {
      posTexto: textarea.value,
      posEditado: true
    });
    alert("Pós Conferência salva!");
    modal.close();
    carregarRelatorios(true, "");
  };
}

// ===========================
// Editar relatório (Admin)
// ===========================
async function editarRelatorio(id) {
  const docRef = doc(db, "relatorios", id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;

  const r = docSnap.data();
  const novoFolha = parseFloat(prompt("Valor Folha:", r.valorFolha)) || r.valorFolha;
  const novoDin = parseFloat(prompt("Valor Dinheiro:", r.valorDinheiro)) || r.valorDinheiro;
  const novaObs = prompt("Observação:", r.observacao || "") || r.observacao;
  const novaDif = novoDin - novoFolha;

  await updateDoc(docRef, {
    valorFolha: novoFolha,
    valorDinheiro: novoDin,
    sobraFalta: novaDif,
    observacao: novaObs
  });

  alert("Relatório atualizado!");
  carregarRelatorios(true, "");
}

// ===========================
// Resumo mensal
// ===========================
async function carregarResumoMensal(admin) {
  if (!admin) return;

  const select = document.getElementById("selectMatriculas");
  const matricula = select.value;
  if (!matricula) return;

  const mesInput = document.getElementById("mesResumo");
  if (!mesInput.value) {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    mesInput.value = `${now.getFullYear()}-${month}`;
  }

  const [year, month] = mesInput.value.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  try {
    const q = query(collection(db, "relatorios"), where("matricula", "==", matricula), orderBy("criadoEm", "desc"));
    const snapshot = await getDocs(q);

    let totalFolha = 0;
    let saldo = 0;
    const detalhesPos = [];
    const detalhesNeg = [];

    snapshot.forEach(docSnap => {
      const r = docSnap.data();
      const dt = r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa);
      if (dt >= start && dt <= end) {
        const vf = Number(r.valorFolha || 0);
        const vd = Number(r.valorDinheiro || 0);
        const diff = vd - vf;
        totalFolha += vf;
        saldo += diff;
        (diff >= 0 ? detalhesPos : detalhesNeg).push(`${dt.toLocaleDateString()}: R$ ${diff.toFixed(2)}`);
      }
    });

    document.getElementById("resumoTotalFolha").textContent = `R$ ${totalFolha.toFixed(2)}`;
    document.getElementById("resumoSaldo").textContent = `R$ ${saldo.toFixed(2)}`;
    document.getElementById("resumoSituacao").textContent = saldo >= 0 ? "Positivo" : "Negativo";

    const lista = document.getElementById("resumoLista");
    lista.innerHTML = `
      <details><summary>Dias com sobra</summary>${detalhesPos.join("<br>") || "-"}</details>
      <details><summary>Dias com falta</summary>${detalhesNeg.join("<br>") || "-"}</details>
    `;

  } catch (e) {
    console.error("Erro ao carregar resumo:", e);
  }
}
