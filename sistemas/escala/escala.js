// sistema/escala/escala.js
import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "../../firebaseConfig.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[escala] Iniciando escala.js...");

  const escalaWrap = document.querySelector(".escala-wrap");
  if (escalaWrap) escalaWrap.style.visibility = "hidden";

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    console.log("[escala] Usuário logado:", user.uid);

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      alert("Usuário não encontrado no banco.");
      await auth.signOut();
      window.location.href = "/login.html";
      return;
    }

    const userData = userSnap.data();
    const IS_ADMIN = userData.admin === true;
    const MATRICULA = userData.matricula;

    console.log("[escala] IS_ADMIN:", IS_ADMIN, "MATRICULA:", MATRICULA);

    await popularSelectMatriculas(IS_ADMIN, MATRICULA);
    montarCalendario();

    const btnSalvar = document.getElementById("btnSalvar");
    const selectMatricula = document.getElementById("selectMatricula");
    const inputData = document.getElementById("inputData");

    btnSalvar.addEventListener("click", async () => {
      const matricula = selectMatricula.value;
      const data = inputData.value;

      if (!matricula || !data) {
        alert("Selecione uma matrícula e uma data.");
        return;
      }

      try {
        await setDoc(doc(db, "folgas", `${matricula}_${data}`), {
          matricula,
          data,
          criadoEm: new Date(),
        });
        alert("Folga salva com sucesso!");
        montarCalendario();
      } catch (err) {
        console.error("[escala] Erro ao salvar folga:", err);
        alert("Erro ao salvar folga.");
      }
    });

    if (escalaWrap) escalaWrap.style.visibility = "visible";
  });
});

async function popularSelectMatriculas(admin, matriculaAtual) {
  const selectMatricula = document.getElementById("selectMatricula");
  if (!selectMatricula) return;

  selectMatricula.innerHTML = '<option>Carregando...</option>';

  try {
    const snapshot = await getDocs(collection(db, "users"));
    const matriculas = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.matricula) {
        matriculas.push({
          matricula: data.matricula,
          nome: data.nome || data.matricula,
        });
      }
    });

    matriculas.sort((a, b) =>
      a.matricula.localeCompare(b.matricula, "pt-BR", { numeric: true })
    );

    selectMatricula.innerHTML = '<option value="">Selecione uma matrícula</option>';
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
  } catch (err) {
    console.error("[escala] Erro ao carregar matrículas:", err);
    selectMatricula.innerHTML = '<option>Erro ao carregar</option>';
  }
}

async function montarCalendario() {
  const calendario = document.getElementById("calendario");
  if (!calendario) return;

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const dataInicial = new Date(ano, mes, 1);
  const dataFinal = new Date(ano, mes + 1, 0);
  const diasNoMes = dataFinal.getDate();

  calendario.innerHTML = `<h3>${hoje.toLocaleString("pt-BR", { month: "long" })} ${ano}</h3>`;

  const tabela = document.createElement("table");
  tabela.classList.add("tabela-calendario");

  let linha = document.createElement("tr");
  for (let d = 1; d <= diasNoMes; d++) {
    const celula = document.createElement("td");
    celula.textContent = d;
    celula.dataset.data = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    linha.appendChild(celula);
    if (d % 7 === 0) {
      tabela.appendChild(linha);
      linha = document.createElement("tr");
    }
  }
  tabela.appendChild(linha);
  calendario.appendChild(tabela);

  // Destacar folgas já registradas
  const snapshot = await getDocs(collection(db, "folgas"));
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const celula = calendario.querySelector(`[data-data="${data.data}"]`);
    if (celula) celula.style.backgroundColor = "#ffd966"; // destaque amarelo
  });
}
