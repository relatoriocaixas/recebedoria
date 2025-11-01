// escala.js — para sistemas/escala/escala.html
import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "../../firebaseConfig.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[escala] Iniciando...");

  // DOM
  const wrap = document.querySelector(".escala-wrap");
  const selectMatricula = document.getElementById("selectMatricula");
  const selectPeriodo = document.getElementById("selectPeriodo");
  const selectTipo = document.getElementById("selectTipo");
  const inputDia = document.getElementById("inputDia");
  const btnSalvar = document.getElementById("btnSalvar");
  const prevMonth = document.getElementById("prevMonth");
  const nextMonth = document.getElementById("nextMonth");
  const monthLabel = document.getElementById("monthLabel");
  const calGrid = document.getElementById("calGrid");

  // estado
  let userAtual = null;
  let isAdmin = false;
  let mesAtual = new Date(); // aponta para mês/ano sendo exibido

  // Esconde a tela enquanto carrega
  if (wrap) wrap.style.visibility = "hidden";

  // --- autenticação ---
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }
    userAtual = user;

    // obter doc do usuário para saber se admin e matricula
    try {
      const uref = doc(db, "users", user.uid);
      const usnap = await getDoc(uref);
      if (!usnap.exists()) {
        alert("Cadastro de usuário não encontrado.");
        await auth.signOut();
        return;
      }
      const udata = usnap.data();
      isAdmin = !!udata.admin;

      // popula selects, monta calendário e mostra a tela
      await popularMatriculas(isAdmin, udata.matricula);
      await renderCalendarioMes(mesAtual);
      bindEventos();

      // finalmente, mostrar UI
      if (wrap) wrap.style.visibility = "visible";
    } catch (err) {
      console.error("[escala] erro inicial:", err);
      alert("Erro ao inicializar escala. Veja console.");
    }
  });

  // --- popula select de matriculas (mesma lógica do iframe diferenças) ---
  async function popularMatriculas(admin, matriculaAtual) {
    if (!selectMatricula) return;
    selectMatricula.innerHTML = '<option value="">Carregando...</option>';
    try {
      const snap = await getDocs(collection(db, "users"));
      const arr = [];
      snap.forEach(s => {
        const d = s.data();
        if (d?.matricula) arr.push({ matricula: d.matricula, nome: d.nome || d.matricula, uid: d.uid });
      });
      // ordenar numericamente quando possível
      arr.sort((a,b) => a.matricula.localeCompare(b.matricula, 'pt-BR', { numeric: true }));
      selectMatricula.innerHTML = '<option value="">Todas</option>';
      arr.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.matricula;
        opt.textContent = `${u.matricula} - ${u.nome}`;
        selectMatricula.appendChild(opt);
      });
      if (!admin) {
        selectMatricula.value = matriculaAtual || "";
        selectMatricula.disabled = true;
      } else {
        selectMatricula.disabled = false;
      }
    } catch (err) {
      console.error("[escala] erro carregar matriculas:", err);
      selectMatricula.innerHTML = '<option value="">Erro</option>';
    }
  }

  // --- eventos básicos da UI ---
  function bindEventos() {
    if (btnSalvar) btnSalvar.addEventListener("click", handleSalvar);
    if (prevMonth) prevMonth.addEventListener("click", () => { mesAtual.setMonth(mesAtual.getMonth()-1); renderCalendarioMes(mesAtual); });
    if (nextMonth) nextMonth.addEventListener("click", () => { mesAtual.setMonth(mesAtual.getMonth()+1); renderCalendarioMes(mesAtual); });
    if (selectMatricula) selectMatricula.addEventListener("change", () => renderCalendarioMes(mesAtual));
    if (selectPeriodo) selectPeriodo.addEventListener("change", () => renderCalendarioMes(mesAtual));
  }

  // --- salvar folga/troca ---
  async function handleSalvar() {
    const matricula = selectMatricula?.value;
    const periodo = selectPeriodo?.value;
    const tipo = selectTipo?.value;
    const dia = inputDia?.value; // formato YYYY-MM-DD

    if (!matricula) return alert("Selecione uma matrícula.");
    if (!periodo) return alert("Selecione o período.");
    if (!dia) return alert("Escolha a data.");

    const docId = `${matricula}_${periodo}_${dia}`;
    try {
      await setDoc(doc(db, "escalas", docId), {
        matricula,
        periodo,
        tipo,
        data: dia,
        descricao: `${tipo === 'folga' ? 'Folga' : 'Troca'} (${periodo})`,
        createdAt: serverTimestamp()
      });
      await renderCalendarioMes(mesAtual);
      alert("Registro salvo.");
    } catch (err) {
      console.error("[escala] erro salvar:", err);
      alert("Erro ao salvar.");
    }
  }

  // --- excluir (usa confirmação simples) ---
  async function handleExcluirRegistro(reg) {
    const ok = confirm(`Excluir registro de ${reg.matricula} em ${reg.data} (${reg.periodo})?`);
    if (!ok) return;
    try {
      const id = `${reg.matricula}_${reg.periodo}_${reg.data}`;
      await deleteDoc(doc(db, "escalas", id));
      await renderCalendarioMes(mesAtual);
    } catch (err) {
      console.error("[escala] erro excluir:", err);
      alert("Erro ao excluir.");
    }
  }

  // --- util: cor por matrícula (determinística pastel) ---
  function colorForMatricula(matr) {
    // hash simples
    let h = 0;
    for (let i=0;i<matr.length;i++) h = (h<<5) - h + matr.charCodeAt(i);
    h = Math.abs(h);
    const hue = h % 360;
    const sat = 60 + (h % 20); // 60-79
    const light = 55; // pastel
    return `hsl(${hue} ${sat}% ${light}%)`;
  }

  // --- render do calendário (grid mensal) ---
  async function renderCalendarioMes(dateObj) {
    if (!calGrid || !monthLabel) return;

    // set label
    const ano = dateObj.getFullYear();
    const mes = dateObj.getMonth();
    const primeiro = new Date(ano, mes, 1);
    const ultimo = new Date(ano, mes+1, 0);
    monthLabel.textContent = primeiro.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    // limpa grid e monta cabeçalho dos dias da semana (já no HTML)
    calGrid.innerHTML = '';

    // Number of leading blank cells (weekday of 1st)
    const lead = primeiro.getDay(); // 0 (dom) .. 6
    for (let i=0;i<lead;i++) {
      const blank = document.createElement('div');
      blank.className = 'day';
      blank.style.opacity = '0.2';
      calGrid.appendChild(blank);
    }

    // carregar todas as escalas do mês (para desempenho, pegamos todas e filtramos localmente)
    let allEscalas = [];
    try {
      const snap = await getDocs(collection(db, "escalas"));
      snap.forEach(s => {
        const d = s.data();
        if (d?.data) allEscalas.push(d);
      });
    } catch (err) {
      console.error("[escala] erro carregar escalas:", err);
    }

    // cria dias
    for (let d=1; d<=ultimo.getDate(); d++) {
      const dataObj = new Date(ano, mes, d);
      const dataKey = dataObj.toISOString().slice(0,10); // YYYY-MM-DD
      const dayEl = document.createElement('div');
      dayEl.className = 'day';
      dayEl.dataset.date = dataKey;

      const num = document.createElement('div');
      num.className = 'num';
      num.textContent = d;
      dayEl.appendChild(num);

      // filtrar escalas para esse dia
      const escalasDoDia = allEscalas.filter(e => e.data === dataKey);

      // se selectMatricula estiver definida (não vazia) e usuário não admin, já filtramos na query UI,
      // mas aqui aplicamos regra de visibilidade: admin vê todos; usuário vê apenas os que tiverem sua matricula.
      let visibleEscalas = escalasDoDia;
      if (!isAdmin) {
        // determinar matricula logada
        try {
          const uref = doc(db, "users", userAtual.uid);
          const usnap = await getDoc(uref);
          const udata = usnap.data();
          const myMat = udata?.matricula;
          visibleEscalas = escalasDoDia.filter(e => e.matricula === myMat);
        } catch(e) {
          console.warn("[escala] não foi possível ler matrícula do usuário, usando seleção.", e);
          const sel = selectMatricula?.value;
          if (sel) visibleEscalas = escalasDoDia.filter(e => e.matricula === sel);
        }
      } else {
        // se admin selecionou uma matrícula específica na UI, mostramos só dela (útil para foco)
        const sel = selectMatricula?.value;
        if (sel) visibleEscalas = escalasDoDia.filter(e => e.matricula === sel);
      }

      // montar badges por escala
      visibleEscalas.forEach(e => {
        const badge = document.createElement('div');
        badge.className = 'desc';
        badge.style.background = colorForMatricula(e.matricula);
        badge.style.color = '#0b0c0e';
        badge.title = `${e.matricula} • ${e.periodo} • ${e.tipo}`;
        badge.textContent = `${e.matricula} ${e.periodo.slice(0,1).toUpperCase()}`; // ex: 6414 M
        dayEl.appendChild(badge);

        // se admin, clique no badge para excluir
        if (isAdmin) {
          badge.style.cursor = 'pointer';
          badge.onclick = (ev) => {
            ev.stopPropagation();
            handleExcluirRegistro(e);
          };
        }
      });

      // clique no dia abre pré-seleção para lançar folga (preenche inputDia)
      dayEl.addEventListener('click', () => {
        // preencho o campo date e foca select matricula para lançamento rápido
        if (inputDia) inputDia.value = dataKey;
        // se admin deixar a seleção de matrícula disponível; caso não, nada
        // rolar foco para o select matricula (facilitar lançamento)
        if (selectMatricula) selectMatricula.focus();
      });

      calGrid.appendChild(dayEl);
    }
  }
});
