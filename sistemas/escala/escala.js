import { db, auth } from "../../firebaseConfig.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[escala] Iniciando módulo...");

  const wrap = document.querySelector(".escala-wrap");
  const calGrid = document.getElementById("calGrid");
  const monthLabel = document.getElementById("monthLabel");
  const selectMatricula = document.getElementById("selectMatricula");
  const selectPeriodo = document.getElementById("selectPeriodo");
  const selectTipo = document.getElementById("selectTipo");
  const inputDia = document.getElementById("inputDia");
  const btnSalvar = document.getElementById("btnSalvar");

  let currentMonth = new Date();
  let folgas = [];
  let matriculas = [];
  let userMatricula = "";
  let isAdmin = false;

  // === Espera autenticação ===
  auth.onAuthStateChanged(async (user) => {
    if (!user) return console.warn("[escala] Usuário não autenticado.");

    console.log("[escala] Usuário autenticado:", user.uid);

    await obterDadosUsuario(user.uid);
    await carregarMatriculas();
    await carregarFolgas();

    renderCalendar();
    wrap.style.visibility = "visible";
  });

  // === Pega dados do usuário logado (matrícula e admin) ===
  async function obterDadosUsuario(uid) {
    try {
      const ref = doc(db, "usuarios", uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        userMatricula = data.matricula;
        isAdmin = !!data.admin;
        console.log("[escala] Usuário:", { userMatricula, isAdmin });
      } else {
        console.warn("[escala] Usuário não encontrado na coleção 'usuarios'.");
      }
    } catch (err) {
      console.error("[escala] Erro ao buscar dados do usuário:", err);
    }
  }

  // === Carregar matrículas ===
  async function carregarMatriculas() {
    try {
      const q = query(collection(db, "usuarios"), orderBy("matricula"));
      const snap = await getDocs(q);
      selectMatricula.innerHTML = `<option value="">Selecione...</option>`;
      matriculas = [];

      snap.forEach((doc) => {
        const data = doc.data();
        if (data.matricula) {
          matriculas.push(data.matricula);
          // Se for admin, mostra todos; senão, apenas a sua matrícula
          if (isAdmin || data.matricula === userMatricula) {
            const opt = document.createElement("option");
            opt.value = data.matricula;
            opt.textContent = data.matricula;
            selectMatricula.appendChild(opt);
          }
        }
      });

      console.log("[escala] Matrículas carregadas:", matriculas);
    } catch (err) {
      console.error("[escala] Erro ao carregar matrículas:", err);
    }
  }

  // === Carregar folgas ===
  async function carregarFolgas() {
    try {
      const snap = await getDocs(collection(db, "folgas"));
      folgas = [];
      snap.forEach((doc) => folgas.push({ id: doc.id, ...doc.data() }));

      // Filtra se não for admin
      if (!isAdmin) {
        folgas = folgas.filter((f) => f.matricula === userMatricula);
      }

      console.log("[escala] Folgas visíveis:", folgas);
    } catch (err) {
      console.error("[escala] Erro ao carregar folgas:", err);
    }
  }

  // === Renderizar calendário ===
  function renderCalendar() {
    calGrid.innerHTML = "";
    const ano = currentMonth.getFullYear();
    const mes = currentMonth.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const offset = primeiroDia.getDay();
    const diasMes = ultimoDia.getDate();

    monthLabel.textContent = currentMonth.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });

    for (let i = 0; i < offset; i++) {
      const empty = document.createElement("div");
      calGrid.appendChild(empty);
    }

    for (let dia = 1; dia <= diasMes; dia++) {
      const cell = document.createElement("div");
      cell.className = "day";
      cell.innerHTML = `<div class="num">${dia}</div>`;
      const dataISO = new Date(ano, mes, dia).toISOString().split("T")[0];

      const folgasDoDia = folgas.filter((f) => f.data === dataISO);
      folgasDoDia.forEach((f) => {
        const tag = document.createElement("div");
        tag.className = "desc";
        tag.textContent = `${f.matricula} (${f.tipo})`;
        tag.style.background = gerarCorPorMatricula(f.matricula);
        cell.appendChild(tag);
      });

      calGrid.appendChild(cell);
    }
  }

  // === Salvar folga ===
  btnSalvar.addEventListener("click", async () => {
    const matricula = selectMatricula.value;
    const periodo = selectPeriodo.value;
    const tipo = selectTipo.value;
    const data = inputDia.value;

    if (!matricula || !data) {
      alert("Selecione matrícula e dia antes de salvar!");
      return;
    }

    try {
      await addDoc(collection(db, "folgas"), {
        matricula,
        periodo,
        tipo,
        data,
        criadoEm: new Date().toISOString(),
      });

      alert("Folga registrada!");
      await carregarFolgas();
      renderCalendar();
    } catch (err) {
      console.error("Erro ao salvar folga:", err);
      alert("Erro ao salvar folga!");
    }
  });

  // === Navegar meses ===
  document.getElementById("prevMonth").addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });

  // === Cor única por matrícula ===
  function gerarCorPorMatricula(mat) {
    const hash = Array.from(mat)
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      .toString(16);
    return `#${hash.slice(0, 6)}`;
  }
});
