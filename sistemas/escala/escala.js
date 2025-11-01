import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc
} from "../../firebaseConfig_v2.js";

// Paleta de cores por matrícula
const coresMatricula = {};
const paletaCores = ["#4da6ff", "#ff7f50", "#7fff00", "#ff69b4", "#ffa500", "#00ced1"];

document.addEventListener("DOMContentLoaded", () => {
  console.log("[escala] Iniciando escala.js");

  const selectTipo = document.getElementById("selectTipo");
  const horarioWrapper = document.getElementById("horarioWrapper");
  const inputHorario = document.getElementById("inputHorario");

  // Exibe campo de horário apenas para "Troca de horário"
  if (selectTipo && horarioWrapper) {
    selectTipo.addEventListener("change", () => {
      if (selectTipo.value === "troca") {
        horarioWrapper.style.display = "block";
      } else {
        horarioWrapper.style.display = "none";
        inputHorario.value = "";
      }
    });
  }

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

    await popularSelectMatriculas(IS_ADMIN, MATRICULA);
    inicializarCalendario(IS_ADMIN, MATRICULA);

    const btnSalvar = document.getElementById("btnSalvar");
    if (btnSalvar) {
      btnSalvar.addEventListener("click", async () => {
        await salvarFolga(IS_ADMIN);
        await carregarFolgas(IS_ADMIN, MATRICULA);
      });
    }

    await carregarFolgas(IS_ADMIN, MATRICULA);
  });
});

// ===========================
// Popula seletor de matrículas
// ===========================
async function popularSelectMatriculas(admin, matriculaAtual) {
  const selectMatricula = document.getElementById("selectMatricula");
  if (!selectMatricula) return;

  selectMatricula.innerHTML = '<option value="">Carregando...</option>';

  try {
    const snapshot = await getDocs(collection(db, "users"));
    const matriculas = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.matricula) {
        matriculas.push({ matricula: data.matricula, nome: data.nome || data.matricula });
      }
    });

    matriculas.sort((a, b) =>
      a.matricula.localeCompare(b.matricula, "pt-BR", { numeric: true })
    );

    selectMatricula.innerHTML = '<option value="">Selecione uma matrícula</option>';
    matriculas.forEach((u) => {
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
  } catch (err) {
    console.error("[escala] Erro ao carregar matrículas:", err);
    selectMatricula.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

// ===========================
// Salvar folga
// ===========================
async function salvarFolga() {
  const selectMatricula = document.getElementById("selectMatricula");
  const selectTipo = document.getElementById("selectTipo");
  const selectPeriodo = document.getElementById("selectPeriodo");
  const inputDia = document.getElementById("inputDia");
  const inputHorario = document.getElementById("inputHorario");

  if (!selectMatricula.value || !inputDia.value) {
    alert("Preencha matrícula e dia.");
    return;
  }

  try {
    await addDoc(collection(db, "folgas"), {
      matricula: selectMatricula.value,
      tipo: selectTipo.value,
      periodo: selectPeriodo.value,
      dia: inputDia.value,
      horario: selectTipo.value === "troca" ? inputHorario.value : "",
      criadoPor: auth.currentUser.uid,
      criadoEm: new Date().toISOString(),
    });

    alert("Folga salva com sucesso!");
  } catch (err) {
    console.error("Erro ao salvar folga:", err);
    alert("Erro ao salvar folga.");
  }
}

// ===========================
// Inicializa calendário
// ===========================
function inicializarCalendario(admin, matricula) {
  const escalaWrap = document.querySelector(".escala-wrap");
  const calGrid = document.getElementById("calGrid");
  const monthLabel = document.getElementById("monthLabel");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");

  let today = new Date();
  let currentMonth = today.getMonth();
  let currentYear = today.getFullYear();

  async function renderCalendar() {
    calGrid.innerHTML = "";
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    monthLabel.textContent = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

    for (let i = 0; i < firstDay; i++) calGrid.appendChild(document.createElement("div"));

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDiv = document.createElement("div");
      dayDiv.className = "day";
      dayDiv.innerHTML = `<div class="num">${d}</div><div class="badges"></div>`;
      calGrid.appendChild(dayDiv);
    }

    await carregarFolgas(admin, matricula, currentMonth, currentYear);
  }

  prevMonthBtn.addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  });

  renderCalendar();
  escalaWrap.style.visibility = "visible";
}

// ===========================
// Carrega folgas e badges
// ===========================
async function carregarFolgas(admin, matriculaAtual, monthOverride, yearOverride) {
  const calGrid = document.getElementById("calGrid");
  if (!calGrid) return;

  try {
    let q;
    if (admin) {
      q = query(collection(db, "folgas"), orderBy("dia", "asc"));
    } else {
      q = query(collection(db, "folgas"), where("matricula", "==", matriculaAtual), orderBy("dia", "asc"));
    }

    const snapshot = await getDocs(q);
    const currentMonth = typeof monthOverride === "number" ? monthOverride : new Date().getMonth();
    const currentYear = typeof yearOverride === "number" ? yearOverride : new Date().getFullYear();

    // Limpa os dias antes de redesenhar badges
    Array.from(calGrid.getElementsByClassName("day")).forEach(el => {
      const badges = el.querySelectorAll(".badge");
      badges.forEach(b => b.remove());
    });

    snapshot.forEach(docSnap => {
      const f = docSnap.data();
      const folgaId = docSnap.id; // precisamos do id para deletar
      const partes = f.dia.split("-");
      const dia = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));

      if (dia.getMonth() === currentMonth && dia.getFullYear() === currentYear) {
        const dayElements = Array.from(calGrid.getElementsByClassName("day"));
        dayElements.forEach(el => {
          const dayNum = parseInt(el.querySelector(".num").textContent, 10);
          if (dia.getDate() === dayNum) {

            if (!coresMatricula[f.matricula]) {
              coresMatricula[f.matricula] =
                paletaCores[Object.keys(coresMatricula).length % paletaCores.length];
            }

            // Cria badge
            const badge = document.createElement("span");
            badge.className = "badge";
            badge.textContent = admin
              ? f.matricula
              : f.tipo === "troca"
              ? "Troca de horário"
              : "Folga";

            badge.style.backgroundColor =
              f.tipo === "troca" ? "#ffb347" : (admin ? coresMatricula[f.matricula] : "#4da6ff");

            // Tooltip
            if (f.tipo === "troca" && f.horario) {
              badge.setAttribute("data-tooltip", f.horario);
            } else {
              badge.setAttribute(
                "data-tooltip",
                f.tipo === "troca" ? "Troca de horário" : "Folga"
              );
            }

            // Se for admin → adicionar botão de exclusão
            if (admin) {
              const btnExcluir = document.createElement("button");
              btnExcluir.textContent = "✕";
              btnExcluir.className = "btn-excluir";
              btnExcluir.title = "Excluir folga";

              btnExcluir.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm("Deseja realmente excluir esta folga?")) {
                  await deleteDoc(doc(db, "folgas", folgaId));
                  alert("Folga excluída com sucesso!");
                  await carregarFolgas(admin, matriculaAtual, monthOverride, yearOverride);
                }
              });

              badge.appendChild(btnExcluir);
            }

            el.appendChild(badge);
          }
        });
      }
    });
  } catch (err) {
    console.error("[escala] Erro ao carregar folgas:", err);
  }
}