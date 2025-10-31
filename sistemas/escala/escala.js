// escala.js
import { auth, db } from '../../firebaseConfig.js';
import {
  onAuthStateChanged, doc, getDoc, setDoc, getDocs, collection, query, where, updateDoc
} from '../../firebaseConfig.js';

// ----------------- UI refs -----------------
const selectMatricula = document.getElementById('selectMatricula');
const selectPeriodo = document.getElementById('selectPeriodo');
const selectTipo = document.getElementById('selectTipo');
const btnNovo = document.getElementById('btnNovo');
const calGrid = document.getElementById('calGrid');
const monthLabel = document.getElementById('monthLabel');
const prevMonth = document.getElementById('prevMonth');
const nextMonth = document.getElementById('nextMonth');
const modalBack = document.getElementById('modalBack');
const modalTipo = document.getElementById('modalTipo');
const modalDesc = document.getElementById('modalDesc');
const btnSave = document.getElementById('btnSave');
const btnDelete = document.getElementById('btnDelete');
const btnCancel = document.getElementById('btnCancel');
const statusInfo = document.getElementById('statusInfo');

// ----------------- State -----------------
let currentUser = null;
let currentUserDoc = null;
let isAdmin = false;
let usersList = [];
let viewYear, viewMonth; // month: 0..11
let editingDate = null; // ISO date string 'YYYY-MM-DD'
let editingDocId = null; // doc id string
let editingMatricula = null;
let editingPeriodo = null;

// ----------------- Helpers -----------------
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const docIdFor = (mat, periodo, y, m) => `${mat}_${periodo}_${y}-${pad(m)}`;

// ----------------- Load users -----------------
async function carregarUsuarios() {
  selectMatricula.innerHTML = '<option value="">Carregando...</option>';
  usersList = [];
  try {
    const snaps = await getDocs(collection(db, 'users'));
    snaps.forEach(s => {
      const d = s.data();
      if (d && d.matricula) usersList.push({ matricula: d.matricula, nome: d.nome || d.matricula });
    });
    selectMatricula.innerHTML = '';
    if (usersList.length === 0) {
      const fallbackMat = currentUserDoc?.matricula || (currentUser?.email?.split('@')[0]) || '0000';
      usersList.push({ matricula: fallbackMat, nome: fallbackMat });
    }
    usersList.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.matricula;
      opt.textContent = `${u.matricula} - ${u.nome}`;
      selectMatricula.appendChild(opt);
    });
  } catch (e) {
    console.error('Erro ao carregar usuários:', e);
    selectMatricula.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

// ----------------- Calendar -----------------
function setView(year, month) {
  viewYear = year; viewMonth = month;
  monthLabel.textContent = `${viewYear}-${pad(viewMonth + 1)}`;
  renderCalendar();
}

function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay(); // 0..6 (Dom..Sáb)
}
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

async function renderCalendar() {
  calGrid.innerHTML = '';

  const matricula = selectMatricula.value || currentUserDoc?.matricula;
  const periodo = selectPeriodo.value || 'manha';

  statusInfo.textContent = matricula
    ? `Mostrando: ${matricula} — ${periodo}`
    : 'Nenhuma matrícula selecionada';

  // sempre mostra calendário
  const firstWeekday = firstDayOfMonth(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);

  // adiciona espaços iniciais
  for (let i = 0; i < firstWeekday; i++) {
    const blank = document.createElement('div');
    blank.className = 'day';
    calGrid.appendChild(blank);
  }

  // tenta carregar dias se tiver matrícula
  let diasObj = {};
  if (matricula) {
    const id = docIdFor(matricula, periodo, viewYear, viewMonth + 1);
    editingDocId = id;
    try {
      const dref = doc(db, 'escalas', id);
      const snap = await getDoc(dref);
      if (snap.exists()) {
        const data = snap.data();
        diasObj = data.dias || {};
      }
    } catch (e) {
      console.error('Erro ao carregar escalas:', e);
    }
  }

  // monta dias
  for (let d = 1; d <= totalDays; d++) {
    const dateIso = isoDate(viewYear, viewMonth + 1, d);
    const dayEl = document.createElement('div');
    dayEl.className = 'day';
    const info = diasObj[dateIso];

    if (info) {
      dayEl.classList.add(info.tipo === 'folga' ? 'folga' : 'troca');
      dayEl.innerHTML = `<div class="num">${d}</div><div class="desc">${sanitize(info.descricao || info.tipo || '')}</div>`;
    } else {
      dayEl.innerHTML = `<div class="num">${d}</div>`;
    }

    // clique no dia
    dayEl.addEventListener('click', () => {
      if (!matricula) {
        alert('Selecione uma matrícula primeiro.');
        return;
      }
      if (!isAdmin && matricula !== currentUserDoc?.matricula) {
        alert('Você só pode visualizar sua própria escala.');
        return;
      }
      openModal(dateIso, matricula, periodo, info);
    });

    calGrid.appendChild(dayEl);
  }
}

function sanitize(text) {
  if (!text) return '';
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// ----------------- Modal -----------------
function openModal(dateIso, matricula, periodo, info) {
  editingDate = dateIso;
  editingMatricula = matricula;
  editingPeriodo = periodo;
  modalTipo.value = info?.tipo || selectTipo.value || 'folga';
  modalDesc.value = info?.descricao || '';
  modalBack.style.display = 'flex';
  document.getElementById('modalTitle').textContent = `Editar ${dateIso} — ${matricula} (${periodo})`;
  btnDelete.style.display = info ? 'inline-block' : 'none';
}

btnCancel.onclick = () => {
  modalBack.style.display = 'none';
  editingDate = null;
};

btnDelete.onclick = async () => {
  if (!editingDate || !editingDocId) return;
  if (!confirm('Remover marcação deste dia?')) return;
  try {
    const dref = doc(db, 'escalas', editingDocId);
    const snap = await getDoc(dref);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const dias = data.dias || {};
    delete dias[editingDate];
    await setDoc(dref, { dias }, { merge: true });
    modalBack.style.display = 'none';
    renderCalendar();
  } catch (e) {
    console.error('Erro ao excluir dia:', e);
  }
};

btnSave.onclick = async () => {
  if (!editingDate || !editingMatricula) return;
  const tipo = modalTipo.value;
  const descricao = modalDesc.value.trim();

  try {
    const id = docIdFor(editingMatricula, editingPeriodo, viewYear, viewMonth + 1);
    const dref = doc(db, 'escalas', id);
    const snap = await getDoc(dref);
    const data = snap.exists()
      ? snap.data()
      : { matricula: editingMatricula, periodo: editingPeriodo, anoMes: `${viewYear}-${pad(viewMonth + 1)}`, dias: {} };
    data.dias = data.dias || {};
    data.dias[editingDate] = { tipo, descricao, updatedAt: new Date(), updatedBy: currentUser.uid };
    await setDoc(dref, data, { merge: true });
    modalBack.style.display = 'none';
    renderCalendar();
  } catch (e) {
    console.error('Erro ao salvar dia:', e);
  }
};

// ----------------- Auth -----------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert('Usuário não autenticado.');
    return;
  }
  currentUser = user;

  try {
    const uref = doc(db, 'users', user.uid);
    const usnap = await getDoc(uref);
    if (!usnap.exists()) {
      const mat = (user.email || '').split('@')[0];
      await setDoc(uref, {
        uid: user.uid, email: user.email, matricula: mat, nome: mat, admin: false, createdAt: new Date()
      });
    }
    const data = (await getDoc(uref)).data();
    currentUserDoc = data;
    isAdmin = data?.admin === true;
  } catch (e) {
    console.error('Erro ao carregar perfil:', e);
  }

  await carregarUsuarios();

  if (!isAdmin) {
    selectMatricula.value = currentUserDoc.matricula;
    selectMatricula.disabled = true;
  } else {
    if (selectMatricula.options.length) selectMatricula.selectedIndex = 0;
    selectMatricula.disabled = false;
  }

  const hoje = new Date();
  setView(hoje.getFullYear(), hoje.getMonth());

  prevMonth.onclick = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setView(d.getFullYear(), d.getMonth());
  };
  nextMonth.onclick = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setView(d.getFullYear(), d.getMonth());
  };

  selectMatricula.addEventListener('change', renderCalendar);
  selectPeriodo.addEventListener('change', renderCalendar);

  btnNovo.addEventListener('click', () => {
    const matricula = selectMatricula.value || currentUserDoc.matricula;
    const periodo = selectPeriodo.value;
    const hoje = new Date();
    const hojeIso = isoDate(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate());
    openModal(hojeIso, matricula, periodo, null);
  });

  modalBack.addEventListener('click', (e) => {
    if (e.target === modalBack) modalBack.style.display = 'none';
  });
});
