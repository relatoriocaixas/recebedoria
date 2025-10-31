import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  doc,
  getDoc
} from "./firebaseConfig.js";

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

    // Popula o seletor de matrículas
    await popularSelectMatriculas(IS_ADMIN, MATRICULA);
  });
});

async function popularSelectMatriculas(admin, matriculaAtual) {
  console.log("[escala] Populando seletor de matrículas...");

  const selectMatricula = document.getElementById("selectMatricula");
  if (!selectMatricula) {
    console.error("[escala] Elemento #selectMatricula não encontrado no DOM");
    return;
  }

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

    // Se não for admin, deixa apenas sua própria matrícula
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
