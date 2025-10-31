import { auth, db } from "../../firebaseConfig.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc, getDocs, collection
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const storage = getStorage();
const matriculaSel = document.getElementById("matriculaSel");
const periodoSel = document.getElementById("periodoSel");
const escalaTexto = document.getElementById("escalaTexto");
const fileInput = document.getElementById("fileInput");
const salvarBtn = document.getElementById("salvarBtn");
const excluirBtn = document.getElementById("excluirBtn");
const listaEscalas = document.getElementById("listaEscalas");
const statusDiv = document.getElementById("status");

let currentUser = null;
let isAdmin = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.top.location.href = "../../login.html");
  currentUser = user;

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const data = userDoc.data();
  isAdmin = data?.admin || false;

  if (isAdmin) {
    carregarUsuarios();
  } else {
    matriculaSel.innerHTML = `<option value="${user.uid}">${data.matricula}</option>`;
    matriculaSel.disabled = true; // funcionário não pode trocar matrícula
    salvarBtn.style.display = "none"; // não pode salvar
    excluirBtn.style.display = "none"; // não pode excluir
    fileInput.disabled = true; // não pode enviar arquivo
    escalaTexto.disabled = true; // não pode editar
  }

  carregarEscalas();
});

// 🔹 Carrega todos os usuários para admins
async function carregarUsuarios() {
  const snap = await getDocs(collection(db, "users"));
  matriculaSel.innerHTML = "";
  snap.forEach((u) => {
    const d = u.data();
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = `${d.matricula || u.id}`;
    matriculaSel.appendChild(opt);
  });
}

// 🔹 Carrega escalas
async function carregarEscalas() {
  listaEscalas.innerHTML = "";
  const usersSnap = await getDocs(collection(db, "users"));
  usersSnap.forEach((u) => {
    const d = u.data();

    // 🔹 Se não for admin, só mostra escalas do próprio usuário
    if (!isAdmin && u.id !== currentUser.uid) return;

    if (d.escala) {
      Object.entries(d.escala).forEach(([periodo, esc]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${d.matricula}</td>
          <td>${periodo}</td>
          <td>${esc?.arquivoURL ? `<a href="${esc.arquivoURL}" target="_blank">Ver arquivo</a>` : "-"}</td>
          <td>${isAdmin ? `<button class="deleteBtn" data-uid="${u.id}" data-p="${periodo}">Excluir</button>` : ""}</td>
        `;
        listaEscalas.appendChild(tr);
      });
    }
  });

  if (isAdmin) {
    document.querySelectorAll(".deleteBtn").forEach((btn) => {
      btn.onclick = async () => {
        const uid = btn.dataset.uid;
        const periodo = btn.dataset.p;
        if (!confirm(`Excluir escala de ${periodo} para ${uid}?`)) return;
        await updateDoc(doc(db, "users", uid), {
          [`escala.${periodo}`]: null
        });
        carregarEscalas();
      };
    });
  }
}

// 🔹 Salvar escala (somente admins)
salvarBtn.onclick = async () => {
  const uid = matriculaSel.value;
  const periodo = periodoSel.value;
  const texto = escalaTexto.value.trim();
  const file = fileInput.files[0];

  if (!uid) return alert("Selecione uma matrícula.");
  if (!periodo) return alert("Selecione um período.");

  let arquivoURL = null;
  if (file) {
    const path = `escalas/${uid}/${periodo}_${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    arquivoURL = await getDownloadURL(fileRef);
  }

  await updateDoc(doc(db, "users", uid), {
    [`escala.${periodo}`]: {
      texto: texto || "",
      arquivoURL: arquivoURL || null,
      updatedAt: new Date()
    }
  });

  statusDiv.textContent = `Escala (${periodo}) salva para ${uid}.`;
  escalaTexto.value = "";
  fileInput.value = "";
  carregarEscalas();
};

// 🔹 Exclusão manual (somente admins)
excluirBtn.onclick = async () => {
  const uid = matriculaSel.value;
  const periodo = periodoSel.value;
  if (!confirm(`Excluir escala de ${periodo} para ${uid}?`)) return;
  await updateDoc(doc(db, "users", uid), {
    [`escala.${periodo}`]: null
  });
  statusDiv.textContent = `Escala (${periodo}) excluída para ${uid}.`;
  carregarEscalas();
};