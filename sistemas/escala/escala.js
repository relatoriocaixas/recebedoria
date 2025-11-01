import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc
} from "../../firebaseConfig.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[escala] Iniciando escala.js");

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    console.log("[escala] Usuário logado:", user.uid);

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      alert("Seu cadastro não foi encontrado.");
      await auth.signOut();
      return;
    }

    const userData = userSnap.data();
    const IS_ADMIN = userData.admin === true;
    const MATRICULA = userData.matricula;

    console.log("[escala] IS_ADMIN:", IS_ADMIN, "MATRICULA:", MATRICULA);

    // Popula seletor de matrícula
    await popularSelectMatriculas(IS_ADMIN, MATRICULA);

    // Inicializa calendário
    initCalendar(IS_ADMIN, MATRICULA);

    // Botão Salvar Folga
    const btnSalvar = document.getElementById("btnSalvar");
    btnSalvar.addEventListener("click", async () => {
      const diaInput = document.getElementById("inputDia").value;
      const matriculaSel = document.getElementById("selectMatricula").value;

      if (!diaInput || !matriculaSel) {
        alert("Preencha matrícula e dia da folga.");
        return;
      }

      try {
        await addDoc(collection(db, "folgas"), {
          matricula: matriculaSel,
          dia: diaInput
        });
        alert("Folga salva!");
        // Atualiza calendário
        await carregarFolgas(IS_ADMIN, MATRICULA);
      } catch (err) {
        console.error("Erro ao salvar folga:", err);
        alert("Erro ao salvar folga.");
      }
    });

    // Exibe tela após tudo carregado
    document.querySelector(".escala-wrap").style.visibility = "visible";
  });
});

// ===========================
// Popula seletor de matrícula
// ===========================
async function popularSelectMatriculas(admin, matriculaAtual) {
  console.log("[escala] Populando seletor de matrículas...");
  const selectMatricula = document.getElementById("selectMatricula");
  if (!selectMatricula) return;

  selectMatricula.innerHTML = '<option value="">Carregando...</option>';

  try {
    const snapshot = await getDocs(collection(db, "users"));
    const matriculas = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.matricula) {
        matriculas.push({
          matricula: data.matricula,
          nome: data.nome || "Sem nome"
        });
      }
    });

    // Ordena numericamente
    matriculas.sort((a, b) => a.matricula.localeCompare(b.matricula, 'pt-BR', { numeric: true }));

    selectMatricula.innerHTML = '<option value="">Selecione uma matrícula</option>';

    matriculas.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.matricula;
      opt.textContent = `${u.matricula} - ${u.nome}`;
      selectMatricula.appendChild(opt);
    });

    if (!admin) {
      selectMatricula.value = matriculaAtual;
      selectMatricula.disabled = true;
    } else {
      selectMatricula.disabled = false;
    }

    console.log("[escala] Matrículas carregadas:", matriculas.map(m => m.matricula));
  } catch (err) {
    console.error("[escala] Erro ao carregar matrículas:", err);
    selectMatricula.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

// ===========================
// Calendário
// ===========================
let currentDate = new Date();

function initCalendar(admin, matricula) {
  renderCalendar();
  carregarFolgas(admin, matricula);

  document.getElementById("prevMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
    carregarFolgas(admin, matricula);
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
    carregarFolgas(admin, matricula);
  });
}

function renderCalendar() {
  const grid = document.getElementById("calGrid");
  const monthLabel = document.getElementById("monthLabel");
  grid.innerHTML = "";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  monthLabel.textContent = firstDay.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  // Dias em branco antes do mês
  for (let i = 0; i < startDay; i++) {
    const emptyCell = document.createElement("div");
    grid.appendChild(emptyCell);
  }

  // Dias do mês
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    const cell = document.createElement("div");
    cell.className = "day";
    const dateStr = `${year}-${(month + 1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
    cell.dataset.date = dateStr;

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = d;
    cell.appendChild(num);

    grid.appendChild(cell);
  }
}

// ===========================
// Carrega folgas no calendário
// ===========================
async function carregarFolgas(admin, matriculaAtual) {
  console.log("[escala] Carregando folgas do Firestore...");
  const grid = document.getElementById("calGrid");
  if (!grid) return;

  // Remove marcações antigas
  grid.querySelectorAll(".desc").forEach(el => el.remove());

  try {
    const snapshot = await getDocs(collection(db, "folgas"));
    const folgas = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.dia || !data.matricula) return;
      if (admin || data.matricula === matriculaAtual) {
        folgas.push(data);
      }
    });

    folgas.forEach(f => {
      const dia = new Date(f.dia);
      const diaStr = `${dia.getFullYear()}-${(dia.getMonth()+1).toString().padStart(2, '0')}-${dia.getDate().toString().padStart(2, '0')}`;
      const cell = grid.querySelector(`[data-date='${diaStr}']`);
      if (cell) {
        const div = document.createElement("div");
        div.className = "desc";
        div.style.background = "#4da6ff88";
        div.textContent = `Folga ${f.matricula}`;
        cell.appendChild(div);
      }
    });
  } catch (err) {
    console.error("[escala] Erro ao carregar folgas:", err);
  }
}
