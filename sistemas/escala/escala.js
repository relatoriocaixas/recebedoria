// sistema/escala/escala.js
import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  doc,
  getDoc
} from "../../firebaseConfig.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[escala] Iniciando escala.js...");

  // Garante que a tela comece visível, mesmo se algo falhar
  const escalaWrap = document.querySelector(".escala-wrap");
  if (escalaWrap) escalaWrap.style.visibility = "visible";

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        console.warn("[escala] Nenhum usuário logado, redirecionando...");
        window.location.href = "/login.html";
        return;
      }

      console.log("[escala] Usuário logado:", user.uid);

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        alert("Seu cadastro não foi encontrado.");
        await auth.signOut();
        window.location.href = "/login.html";
        return;
      }

      const userData = userSnap.data();
      const IS_ADMIN = userData.admin === true;
      const MATRICULA = userData.matricula;

      console.log("[escala] Dados do usuário:", userData);
      console.log("[escala] IS_ADMIN:", IS_ADMIN, "MATRICULA:", MATRICULA);

      await popularSelectMatriculas(IS_ADMIN, MATRICULA);
    } catch (err) {
      console.error("[escala] Erro durante carregamento:", err);
    } finally {
      if (escalaWrap) escalaWrap.style.visibility = "visible";
    }
  });
});

async function popularSelectMatriculas(admin, matriculaAtual) {
  console.log("[escala] Iniciando carregamento de matrículas...");
  const selectMatricula = document.getElementById("selectMatricula");

  if (!selectMatricula) {
    console.error("[escala] Elemento #selectMatricula não encontrado no DOM.");
    return;
  }

  selectMatricula.innerHTML = '<option value="">Carregando...</option>';

  try {
    const usersCol = collection(db, "users");
    const snapshot = await getDocs(usersCol);

    console.log("[escala] Total de documentos encontrados:", snapshot.size);

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

    console.log("[escala] Matrículas obtidas:", matriculas);

    // Ordena numericamente
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
      console.log(`[escala] Usuário comum — campo bloqueado (${matriculaAtual})`);
    } else {
      selectMatricula.disabled = false;
      console.log("[escala] Usuário admin — campo liberado.");
    }

    console.log("[escala] Seletor populado com sucesso!");
  } catch (err) {
    console.error("[escala] Erro ao carregar matrículas:", err);
    selectMatricula.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}
