// escala.js — versão compatível com o portal
import { 
  db, auth,
  collection, getDocs, setDoc, deleteDoc, doc 
} from "../../firebaseConfig.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[escala] Iniciado");

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
  });

  // === 🔹 Carregar usuários (matrículas)
  async function carregarUsuarios() {
    const snap = await getDocs(collection(db, "users"));
    selectMatricula.innerHTML = "";
    let usuarioDoc = null;

    snap.forEach((docSnap) => {
      const u = docSnap.data();
      const opt = document.createElement("option");
      opt.value = u.matricula;
      opt.textContent = `${u.matricula} - ${u.nome || u.matricula}`;
      selectMatricula.appendChild(opt);

      if (u.uid === userAtual.uid) usuarioDoc = u;
    });

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

  // === 🔹 Calendário
  async function carregarCalendario() {
    const ano = mesAtual.getFullYear();
    const mes = mesAtual.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);

    monthLabel.textContent = primeiroDia.toLocaleString("pt-BR", { month: "long", year: "numeric" });
    const matricula = selectMatricula.value;
    if (!matricula) return;

    escalaSelecionada = {};
    const snap = await getDocs(collection(db, "escalas"));
    snap.forEach((docSnap) => {
      const e = docSnap.data();
      if (e.matricula === matricula && e.periodo === selectPeriodo.value) {
        escalaSelecionada[e.data] = e;
      }
    });

    renderizarCalendario(primeiroDia, ultimoDia);
  }

  function renderizarCalendario(primeiroDia, ultimoDia) {
    calGrid.innerHTML = "";
    const primeiroDiaSemana = primeiroDia.getDay();

    // Preenche espaços em branco antes do primeiro dia
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

      const escala = escalaSelecionada[dataKey];
      if (escala) {
        diaDiv.classList.add(escala.tipo === "folga" ? "folga" : "troca");
        const desc = document.createElement("div");
        desc.classList.add("desc");
        desc.textContent = escala.descricao || escala.tipo;
        diaDiv.appendChild(desc);
      }

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

    const escala = escalaSelecionada[data];
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

  // === 🔹 Navegação de meses
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
