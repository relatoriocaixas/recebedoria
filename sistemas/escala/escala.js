// escala.js
import { auth, db } from "./firebaseConfig.js";
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const storage = getStorage();

// Elementos do DOM
const matriculaSelect = document.getElementById('matriculaSelect');
const periodoSelect = document.getElementById('periodoSelect');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const escalaTableBody = document.getElementById('escalaTableBody');

let currentUser = null;
let isAdmin = false;

// 🔹 Inicialização
auth.onAuthStateChanged(async (user) => {
  if (!user) return window.location.href = '../login.html';
  currentUser = user;

  const userSnap = await getDoc(doc(db, 'users', user.uid));
  isAdmin = userSnap.exists() && userSnap.data().admin === true;

  await populateMatriculas();
  await loadEscalas();
});

// 🔹 Carrega matrículas para seleção
async function populateMatriculas() {
  const usersSnap = await getDocs(collection(db, 'users'));
  matriculaSelect.innerHTML = '';

  usersSnap.forEach(u => {
    const data = u.data();
    const option = document.createElement('option');
    option.value = data.matricula;
    option.textContent = `${data.matricula} - ${data.nome}`;
    matriculaSelect.appendChild(option);
  });
}

// 🔹 Upload de arquivo
uploadBtn.addEventListener('click', async () => {
  const matricula = matriculaSelect.value;
  const periodo = periodoSelect.value;
  const file = fileInput.files[0];

  if (!matricula || !periodo || !file) return alert('Selecione matrícula, período e arquivo');

  const storageRef = ref(storage, `escalas/${matricula}_${periodo}_${file.name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  // Salva referência no Firestore
  const escalaRef = doc(db, 'escalas', `${matricula}_${periodo}_${file.name}`);
  await setDoc(escalaRef, {
    matricula,
    periodo,
    nomeArquivo: file.name,
    url,
    uploadedBy: currentUser.uid,
    timestamp: new Date()
  });

  alert('Escala enviada com sucesso!');
  fileInput.value = '';
  await loadEscalas();
});

// 🔹 Carrega escalas
async function loadEscalas() {
  escalaTableBody.innerHTML = '';
  const escalasSnap = await getDocs(collection(db, 'escalas'));

  escalasSnap.forEach(docSnap => {
    const data = docSnap.data();

    // Filtra visibilidade para usuários comuns
    if (!isAdmin && (data.matricula !== currentUser.email.split('@')[0])) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.matricula}</td>
      <td>${data.periodo}</td>
      <td><a href="${data.url}" target="_blank">${data.nomeArquivo}</a></td>
      <td>${isAdmin ? `<button data-id="${docSnap.id}" class="deleteBtn">Excluir</button>` : ''}</td>
    `;
    escalaTableBody.appendChild(tr);
  });

  // Bind delete buttons
  document.querySelectorAll('.deleteBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const docId = btn.dataset.id;
      const docRef = doc(db, 'escalas', docId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;

      const data = docSnap.data();
      const storageRef = ref(storage, `escalas/${data.matricula}_${data.periodo}_${data.nomeArquivo}`);

      if (confirm(`Excluir escala ${data.nomeArquivo} do período ${data.periodo} da matrícula ${data.matricula}?`)) {
        await deleteDoc(docRef);
        await deleteObject(storageRef);
        alert('Escala excluída!');
        await loadEscalas();
      }
    });
  });
}
