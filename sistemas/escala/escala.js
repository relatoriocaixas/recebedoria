// escala.js
import { auth, db } from '../../firebaseConfig.js';
import {
  onAuthStateChanged
} from '../../firebaseConfig.js'; // onAuthStateChanged exported by your firebaseConfig

// Firestore helpers (estas funções foram exportadas no firebaseConfig que você mostrou)
import {
  doc, getDoc, setDoc, getDocs, collection, query, where, orderBy, updateDoc
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

// ----------------- Load users (populate select) -----------------
async function carregarUsuarios() {
  selectMatricula.innerHTML = '<option value="">Carregando...</option>';
  usersList = [];
  try {
    const snaps = await getDocs(query(collection(db, 'users'), orderBy('matricula')));
    snaps.forEach(s => {
      const d = s.data();
      if (d && d.matricula) usersList.push({ matricula: d.matricula, nome: d.nome || d.matricula });
    });
    // popular select (admins veem tudo, usuarios só veem a propria matricula que definiremos depois)
    selectMatricula.innerHTML = '';
    usersList.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.matricula;
      opt.textContent = `${u.matricula} - ${u.nome}`;
      selectMatricula.appendChild(opt);
    });
  } catch (e) {
    console.error('Erro ao carregar usuários:', e);
    selectMatricula.innerHTML = '<option value="">Erro</option>';
  }
}

// ----------------- Calendar rendering -----------------
function setView(year, month) {
  viewYear = year; viewMonth = month;
  monthLabel.textContent = `${viewYear}-${pad(viewMonth + 1)}`;
  renderCalendar();
}

function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay(); // 0..6 (Sun..Sat)
}
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

async function renderCalendar() {
  calGrid.innerHTML = '';
  // determine document (matricula & periodo)
  const matricula = selectMatricula.value || currentUserDoc?.matricula;
  const periodo = selectPeriodo.value;
  if (!matricula) {
    calGrid.innerHTML = '<div class="small-muted">Selecione uma matrícula.</div>';
    return;
  }

  statusInfo.textContent = `Mostrando: ${matricula} — ${periodo}`;

  // load the doc for this month
  const id = docIdFor(matricula, periodo, viewYear, viewMonth + 1);
  editingDocId = id;
  let diasObj = {};
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

  // build grid: include leading blanks for first weekday
  const firstWeekday = firstDayOfMonth(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);

  // add blanks
  for (let i = 0; i < firstWeekday; i++) {
    const blank = document.createElement('div'); blank.className = 'day';
    blank.innerHTML = '';
    calGrid.appendChild(blank);
  }

  // add days
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

    // click handler: open modal if allowed
    dayEl.addEventListener('click', () => {
      // only admins can edit other matriculas; non-admins only their own matricula
      const selectedMat = selectMatricula.value || currentUserDoc?.matricula;
      if (!isAdmin && selectedMat !== currentUserDoc?.matricula) {
        alert('Você só pode ver a sua própria escala.');
        return;
      }
      openModal(dateIso, selectedMat, periodo, info);
    });

    calGrid.appendChild(dayEl);
  }
}

// simple sanitize (keeps newlines)
function sanitize(text) {
  if (!text) return '';
  return text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
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
  // enable/disable delete depending if exists
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
    if (!snap.exists()) {
      alert('Nada a remover.');
      modalBack.style.display = 'none';
      return;
    }
    const data = snap.data() || {};
    const dias = data.dias || {};
    delete dias[editingDate];
    // if no dias left, remove doc content (set empty dias)
    await setDoc(dref, { dias }, { merge: true });
    modalBack.style.display = 'none';
    renderCalendar();
  } catch (e) {
    console.error('Erro ao excluir dia:', e);
    alert('Erro ao excluir. Veja console.');
  }
};

btnSave.onclick = async () => {
  if (!editingDate || !editingDocId || !editingMatricula) return;
  const tipo = modalTipo.value;
  const descricao = modalDesc.value.trim();

  try {
    const dref = doc(db, 'escalas', editingDocId);
    const snap = await getDoc(dref);
    const data = snap.exists() ? snap.data() : { matricula: editingMatricula, periodo: editingPeriodo, anoMes: `${viewYear}-${pad(viewMonth+1)}`, dias: {} };
    data.dias = data.dias || {};
    data.dias[editingDate] = { tipo, descricao, updatedAt: new Date(), updatedBy: currentUser.uid };
    // save (merge)
    await setDoc(dref, data, { merge: true });
    modalBack.style.display = 'none';
    renderCalendar();
  } catch (e) {
    console.error('Erro ao salvar dia:', e);
    alert('Erro ao salvar. Veja console.');
  }
};

// ----------------- Auth & boot -----------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert('Usuário não autenticado. Faça login no portal.');
    return;
  }
  currentUser = user;

  // load user doc to check admin and matricula
  try {
    const uref = doc(db, 'users', user.uid);
    const usnap = await getDoc(uref);
    if (!usnap.exists()) {
      // create baseline if missing
      const matDefault = (user.email || '').split('@')[0] || 'unknown';
      await setDoc(uref, { uid: user.uid, email: user.email || '', matricula: matDefault, nome: user.displayName || matDefault, admin: false, createdAt: new Date() });
    }
    const userdata = (await getDoc(uref)).data();
    currentUserDoc = userdata;
    isAdmin = userdata?.admin === true;
  } catch (e) {
    console.error('Erro ao carregar perfil:', e);
    alert('Erro ao carregar perfil. Veja console.');
    return;
  }

  // carregar usuarios para select
  await carregarUsuarios();

  // se não for admin, pre-seleciona a matricula do usuário e desabilita o select
  if (!isAdmin) {
    selectMatricula.value = currentUserDoc.matricula;
    selectMatricula.disabled = true;
  } else {
    // admin: se houver ao menos uma matricula, pre-seleciona a primeira
    if (selectMatricula.options.length) selectMatricula.selectedIndex = 0;
    selectMatricula.disabled = false;
  }

  // iniciar view com mês atual
  const hoje = new Date();
  setView(hoje.getFullYear(), hoje.getMonth());

  // add listeners
  prevMonth.onclick = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setView(d.getFullYear(), d.getMonth());
  };
  nextMonth.onclick = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setView(d.getFullYear(), d.getMonth());
  };

  // when select changes, re-render
  selectMatricula.addEventListener('change', renderCalendar);
  selectPeriodo.addEventListener('change', renderCalendar);

  // New quick-add: choose a date from prompt? We'll open modal for today
  btnNovo.addEventListener('click', () => {
    const matricula = selectMatricula.value || currentUserDoc.matricula;
    const periodo = selectPeriodo.value;
    const hojeIso = isoDate(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate());
    openModal(hojeIso, matricula, periodo, null);
  });

  // close modal on backdrop click
  modalBack.addEventListener('click', (e) => {
    if (e.target === modalBack) modalBack.style.display = 'none';
  });
});

// utility setDoc wrapper (we import setDoc directly from firebaseConfig export)
async function setDoc(ref, data, opts = {}) {
  // The firebaseConfig's setDoc is the firestore one; call it directly
  return await (await import('../../firebaseConfig.js')).setDoc(ref, data, opts);
}
