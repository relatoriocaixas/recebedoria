// escala.js
import { auth, db } from "../../firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
  collection, getDocs, doc, getDoc, setDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ==========================
// INICIALIZAÇÃO
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  console.log("[escala] Iniciando...");

  const wrap = document.querySelector(".escala-wrap");
  const selectMatricula = document.getElementById("selectMatricula");
  const selectPeriodo = document.getElementById("selectPeriodo");
  const selectTipo = document.getElementById("selectTipo");
  const inputDia = document.getElementById("inputDia");
  const btnSalvar = document.getElementById("btnSalvar");
  const monthLabel = document.getElementById("monthLabel");
  const calGrid = document.getElementById("calGrid");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");

  let currentDate = new Date();
  let currentUser = null;
  let IS_ADMIN = false;
  let MATRICULA = "";

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    currentUser = user;
    console.log("[escala] Usuário logado:", user.email);

    // Busca dados do usuário logado
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      alert("Usuário não encontrado.");
      return;
    }

    const userData = userSnap.data();
    IS_ADMIN = userData.admin === true;
    MATRICULA = userData.matricula;

    console.log("[escala] IS_ADMIN:", IS_ADMIN, "MATRICULA:", MATRICULA);

    await popularSelectMatriculas(IS_ADMIN, MATRICULA);
    renderCalendar(currentDate);
    wrap.style.visibility = "visible";
  });

  // ==========================
  // POPULAR MATRÍCULAS
  // ==========================
  async function popularSelectMatriculas(admin, matriculaAtual) {
    console.log("[escala] Populando matrículas...");

    selectMatricula.innerHTML = '<option value="">Carregando...</option>';

    try {
      const snapshot = await getDocs(collection(db, "users"));
      const matriculas = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.matricula) {
          matriculas.push({
            matricula: data.matricula,
            nome: data.nome || "Sem nome"
          });
        }
      });

      matriculas.sort((a, b) =>
        a.matricula.localeCompare(b.matricula, "pt-BR", { numeric: true })
      );

      selectMatricula.innerHTML = "";

      if (admin) {
        const optDefault = document.createElement("option");
        optDefault.value = "";
        optDefault.textContent = "Selecione uma matrícula";
        selectMatricula.appendChild(optDefault);
      }

      matriculas.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.matricula;
        opt.textContent = `${m.matricula} - ${m.nome}`;
        selectMatricula.appendChild(opt);
      });

      if (!admin) {
        selectMatricula.value = matriculaAtual;
        selectMatricula.disabled = true;
      } else {
        selectMatricula.disabled = false;
      }

      console.log("[escala] Matrículas carregadas:", matriculas.length);
    } catch (err) {
      console.error("[escala] Erro ao carregar matrículas:", err);
      selectMatricula.innerHTML = '<option value="">Erro ao carregar</option>';
    }
  }

  // ==========================
  // CALENDÁRIO
  // ==========================
  function renderCalendar(date) {
    calGrid.innerHTML = "";
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthName = date.toLocaleString("pt-BR", { month: "long" });
    monthLabel.textContent = `${monthName.toUpperCase()} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement("div");
      calGrid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDiv = document.createElement("div");
      dayDiv.className = "day";
      dayDiv.innerHTML = `<div class="num">${day}</div>`;
      dayDiv.addEventListener("click", () => {
        const d = `${year}-${String(month + 1).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        inputDia.value = d;
      });
      calGrid.appendChild(dayDiv);
    }
  }

  prevMonthBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate);
  });

  nextMonthBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate);
  });

  // ==========================
  // SALVAR FOLGA
  // ==========================
  btnSalvar.addEventListener("click", async () => {
    const matriculaSel = selectMatricula.value;
    const periodo = selectPeriodo.value;
    const tipo = selectTipo.value;
    const dia = inputDia.value;

    if (!matriculaSel || !dia) {
      alert("Selecione a matrícula e o dia.");
      return;
    }

    try {
      const ref = doc(db, "escala", `${matriculaSel}_${dia}`);
      await setDoc(ref, {
        matricula: matriculaSel,
        periodo,
        tipo,
        dia,
        criadoPor: MATRICULA,
        criadoEm: new Date().toISOString(),
      });
      alert("Folga salva com sucesso!");
    } catch (e) {
      console.error("Erro ao salvar folga:", e);
      alert("Erro ao salvar.");
    }
  });
});
