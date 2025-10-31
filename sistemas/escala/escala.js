import { db, auth } from "../../firebaseConfig.js";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[escala] Iniciado");

  const appContainer = document.querySelector(".escala-wrap");
  appContainer.style.display = "none";

  const selectMatricula = document.getElementById("selectMatricula");
  const selectPeriodo = document.getElementById("selectPeriodo");
  const selectTipo = document.getElementById("selectTipo");
  const calGrid = document.getElementById("calGrid");
  const monthLabel = document.getElementById("monthLabel");
  const btnNovo = document.getElementById("btnNovo");
  const modalBack = document.getElementById("modalBack");
  const modalTipo = document.getElementById("modalTipo");
  const modalDesc = document.getElementById("modalDesc");
  const btnSave = document.getElementById("btnSave");
  const btnDelete = document.getElementById("btnDelete");
  const btnCancel = document.getElementById("btnCancel");
  const prevMonth = document.getElementById("prevMonth");
  const nextMonth = document.getElementById("nextMonth");

  let userAtual = null;
  let admin = false;
  let escalaSelecionada = {};
  let dataSelecionada = null;
  let mesAtual = new Date();
  const coresMatriculas = {};

  // === 🔹 Autenticação
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "../../index.html";
      return;
    }
    userAtual = user;
    console.log("[escala] Usuário:", user.email);

    await carregarUsuarios();
    await carregarCalendario();

    // Exibe a tela após tudo carregar
    appContainer.style.display = "flex";
  });

  // === 🔹 Carregar usuários (matrículas)
  async function carregarUsuarios() {
    console.log("[escala] Carregando usuários...");
    const snap = await getDocs(collection(db, "users"));
    selectMatricula.innerHTML = "";

    let usuarioDoc = null;
    let count = 0;

    snap.forEach(docSnap => {
      const u = docSnap.data();
      const matricula = u.matricula || u.id || u.uid || `user${count++}`;
      const nome = u.nome || "(Sem nome)";

      const opt = document.createElement("option");
      opt.value = matricula;
      opt.textContent = `${matricula} - ${nome}`;
      selectMatricula.appendChild(opt);

      // 🔹 Gera cor única por matrícula
      if (!coresMatriculas[matricula]) {
        const hue = Math.floor(Math.random() * 360);
        coresMatriculas[matricula] = `hsl(${hue}, 65%, 55%)`;
      }

      if (u.uid === userAtual.uid) usuarioDoc = u;
    });

    console.log("[escala] Matrículas carregadas:", selectMatricula.options.length);

    if (usuarioDoc?.admin) {
      admin = true;
      selectMatricula.disabled = false;
    } else {
      admin = false;
      selectMatricula.value = usuarioDoc?.matricula || "";
      selectMatricula.disabled = true;
      btnNovo.style.display = "none";
    }
  }

  // === 🔹 Carregar calendário
  async function carregarCalendario() {
    const ano = mesAtual.getFullYear();
    const mes = mesAtual.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);

    monthLabel.textContent = primeiroDia.toLocaleString("pt-BR", {
      month: "long",
      year: "numeric"
    });

    escalaSelecionada = {};

    const snap = await getDocs(collection(db, "escalas"));
    snap.forEach((docSnap) => {
      const e = docSnap.data();
      if (admin || e.matricula === selectMatricula.value) {
        if (!escalaSelecionada[e.data]) escalaSelecionada[e.data] = [];
        escalaSelecionada[e.data].push(e);
      }
    });

    renderizarCalendario(primeiroDia, ultimoDia);
  }

  function renderizarCalendario(primeiroDia, ultimoDia) {
    calGrid.innerHTML = "";
    const primeiroDiaSemana = primeiroDia.getDay();

    // espaços vazios antes do 1º dia
    for (let i = 0; i < primeiroDiaSemana; i++) {
      const div = document.createElement("div");
      div.classList.add("day");
      calGrid.appendChild(div);
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const dataAtual = new Date(primeiroDia.getFullYear(), primeiroDia.getMonth(), dia);
      const dataKey = dataAtual.toISOString().split("T")[0];
      const diaDiv = document.createElement("div");
      diaDiv.classList.add("day");

      const num = document.createElement("div");
      num.classList.add("num");
      num.textContent = dia;
      diaDiv.appendChild(num);

      const escalasDoDia = escalaSelecionada[dataKey] || [];
      escalasDoDia.forEach((escala) => {
        const desc = document.createElement("div");
        desc.classList.add("desc");
        desc.textContent = `${escala.matricula} - ${escala.tipo === "folga" ? "Folga" : "Troca"}`;
        const cor = coresMatriculas[escala.matricula] || "rgba(80,80,80,0.5)";
        desc.style.background = cor;
        desc.style.padding = "2px 4px";
        desc.style.borderRadius = "4px";
        diaDiv.appendChild(desc);
      });

      if (admin) {
        diaDiv.onclick = () => abrirModal(dataKey);
      }

      calGrid.appendChild(diaDiv);
    }
  }

  // === 🔹 Modal
  function abrirModal(data) {
    dataSelecionada = data;
    modalBack.style.display = "flex";

    const escalasDoDia = escalaSelecionada[data] || [];
    const escala = escalasDoDia.find(e => e.matricula === selectMatricula.value && e.periodo === selectPeriodo.value);
    modalTipo.value = escala?.tipo || "folga";
    modalDesc.value = escala?.descricao || "";
  }

  btnCancel.onclick = () => {
    modalBack.style.display = "none";
  };

  btnSave.onclick = async () => {
    const tipo = modalTipo.value;
    const descricao = modalDesc.value;
    const matricula = selectMatricula.value;
    const periodo = selectPeriodo.value;

    if (!matricula || !periodo) {
      alert("Selecione a matrícula e o período.");
      return;
    }

    await setDoc(doc(db, "escalas", `${matricula}_${periodo}_${dataSelecionada}`), {
      matricula,
      periodo,
      data: dataSelecionada,
      tipo,
      descricao
    });

    modalBack.style.display = "none";
    await carregarCalendario();
  };

  btnDelete.onclick = async () => {
    const matricula = selectMatricula.value;
    const periodo = selectPeriodo.value;
    await deleteDoc(doc(db, "escalas", `${matricula}_${periodo}_${dataSelecionada}`));
    modalBack.style.display = "none";
    await carregarCalendario();
  };

  // === 🔹 Navegação entre meses
  prevMonth.onclick = () => {
    mesAtual.setMonth(mesAtual.getMonth() - 1);
    carregarCalendario();
  };

  nextMonth.onclick = () => {
    mesAtual.setMonth(mesAtual.getMonth() + 1);
    carregarCalendario();
  };

  selectMatricula.addEventListener("change", carregarCalendario);
  selectPeriodo.addEventListener("change", carregarCalendario);
});

   