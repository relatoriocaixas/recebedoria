// escala.js
import { db, auth } from "../../firebaseConfig.js";
import {
  collection,
  getDocs,
  setDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[escala] Iniciado");

  const selectMatricula = document.getElementById("selectMatricula");
  const selectPeriodo = document.getElementById("selectPeriodo");
  const selectTipo = document.getElementById("selectTipo");
  const inputDia = document.getElementById("inputDia");
  const btnSalvar = document.getElementById("btnSalvar");
  const calGrid = document.getElementById("calGrid");
  const monthLabel = document.getElementById("monthLabel");
  const prevMonth = document.getElementById("prevMonth");
  const nextMonth = document.getElementById("nextMonth");
  const escalaWrap = document.querySelector(".escala-wrap");

  let userAtual = null;
  let admin = false;
  let escalaSelecionada = {};
  let mesAtual = new Date();
  let matriculasCores = {};

  const cores = [
    "#f94144","#f3722c","#f8961e","#f9844a","#f9c74f",
    "#90be6d","#43aa8b","#4d908e","#577590","#277da1"
  ];

  // Autenticação
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "../../index.html";
      return;
    }
    userAtual = user;
    console.log("[escala] Usuário:", user.email);

    await carregarUsuarios();
    await carregarCalendario();
    escalaWrap.style.visibility = "visible";
  });

  // Carregar usuários e popular select
  async function carregarUsuarios() {
    const snap = await getDocs(collection(db, "users"));
    selectMatricula.innerHTML = "";
    let usuarioDoc = null;

    snap.forEach((docSnap, index) => {
      const u = docSnap.data();
      const opt = document.createElement("option");
      opt.value = u.matricula;
      opt.textContent = `${u.matricula} - ${u.nome || u.matricula}`;
      selectMatricula.appendChild(opt);

      // Armazena cor por matrícula
      matriculasCores[u.matricula] = cores[index % cores.length];

      if (u.uid === userAtual.uid) usuarioDoc = u;
    });

    if (usuarioDoc?.admin) {
      admin = true;
      selectMatricula.disabled = false;
    } else {
      admin = false;
      selectMatricula.value = usuarioDoc?.matricula || "";
      selectMatricula.disabled = true;
    }
  }

  // Carregar calendário
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
        desc.textContent = `${escala.matricula}: ${escala.tipo === "folga" ? "Folga" : "Troca"}`;
        desc.style.backgroundColor = matriculasCores[escala.matricula] || "#666";
        diaDiv.appendChild(desc);
      });

      calGrid.appendChild(diaDiv);
    }
  }

  // Salvar folga/troca
  btnSalvar.onclick = async () => {
    const matricula = selectMatricula.value;
    const periodo = selectPeriodo.value;
    const tipo = selectTipo.value;
    const dataSelecionada = inputDia.value;

    if (!matricula || !periodo || !dataSelecionada) {
      alert("Selecione matrícula, período e dia.");
      return;
    }

    await setDoc(doc(db, "escalas", `${matricula}_${periodo}_${dataSelecionada}`), {
      matricula,
      periodo,
      data: dataSelecionada,
      tipo,
      descricao: ""
    });

    await carregarCalendario();
    inputDia.value = "";
  };

  // Navegação de meses
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
