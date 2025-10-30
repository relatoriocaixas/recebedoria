// app.js (adaptado para usar apenas o Firebase do portal)
// importa do firebase.js (já configurado para o projeto unificado)
import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updatePassword,
  doc, setDoc, getDoc, updateDoc, addDoc, getDocs, collection, query, where, serverTimestamp, orderBy
} from './firebaseConfig.js';

// Helpers e utilitários
const $ = (sel) => document.querySelector(sel);
const fmtMoney = (v) => (Number(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const todayISO = () => {
  const d = new Date();
  return d.toLocaleDateString('pt-BR').split('/').reverse().join('-');
};

function formatISOtoBR(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

const adminsMat = new Set(['4144','70029','6266']);
const emailFromMat = (mat) => `${mat}@movebuss.com`; // mantido conforme código anterior

// State
let currentUserDoc = null;
let currentCaixaRef = null;

// Elements (alguns podem ser nulos se o HTML não tiver a área de auth)
const authArea = $('#authArea'); // provavelmente null agora — usamos checks antes de acessar
const appArea = $('#appArea');
const userBadge = $('#userBadge');
const btnLogout = $('#btnLogout');
const btnChangePass = $('#btnChangePass');
const btnAbrir = $('#btnAbrir');
const btnFechar = $('#btnFechar');
const caixaStatusEl = $('#caixaStatus');

const lancBox = $('#lancamentoBox');
const sangriaBox = $('#sangriaBox');
const relatorioLista = $('#relatorioLista');
const matRecebedor = $('#matRecebedor');

const qtdBordos = $('#qtdBordos');
const valor = $('#valor');
const tipoVal = $('#tipoVal');
const prefixo = $('#prefixo');
const dataCaixa = $('#dataCaixa');
const matMotorista = $('#matMotorista');

// segurança: se algum elemento não existir, cria placeholders para não quebrar o código
if (!qtdBordos) {
  console.warn('Elemento #qtdBordos não encontrado no DOM — verificando HTML.');
}
if (!dataCaixa) {
  console.warn('Elemento #dataCaixa não encontrado no DOM — verificando HTML.');
}

// Atualiza valor automaticamente
const updateValor = () => {
  if (!qtdBordos || !valor) return;
  const q = Number(qtdBordos.value || 0);
  valor.value = (q * 5).toFixed(2);
};
if (qtdBordos) qtdBordos.addEventListener('input', updateValor);

// Prefixo: apenas dígitos e máximo 3
if (prefixo) {
  prefixo.addEventListener('input', () => {
    prefixo.value = prefixo.value.replace(/\D/g, '').slice(0,3);
  });
}

// Data default
if (dataCaixa) dataCaixa.value = todayISO();

// ---- Removed login/register listeners (we use portal auth) ----
// NOTE: login/register code removed to avoid conflicts with portal auth

// Keep logout and change password handlers (they operate on portal auth)
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    try {
      await signOut(auth);
      // UI: hide app area — onAuthStateChanged will handle rest
      if (appArea) appArea.classList.add('hidden');
      if (userBadge) userBadge.classList.add('hidden');
    } catch (e) {
      console.error('Erro no logout:', e);
      alert('Erro ao deslogar: ' + (e?.message || e));
    }
  });
}

if (btnChangePass) {
  btnChangePass.addEventListener('click', async () => {
    const nova = prompt('Digite a nova senha:');
    if (!nova) return;
    try {
      await updatePassword(auth.currentUser, nova);
      alert('Senha alterada com sucesso.');
    } catch (e) {
      alert('Erro ao alterar senha: ' + (e?.message || e));
    }
  });
}

// onAuthStateChanged: integra com o portal (sem redirecionamentos)
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Sem usuário logado: apenas mantém app escondido (não redireciona)
    if (authArea) authArea.classList.remove('hidden');
    if (appArea) appArea.classList.add('hidden');
    if (userBadge) userBadge.classList.add('hidden');
    if (btnLogout) btnLogout.classList.add('hidden');
    if (btnChangePass) btnChangePass.classList.add('hidden');
    currentUserDoc = null;
    currentCaixaRef = null;
    return;
  }

  // Usuário autenticado no portal — carregar perfil do Firestore
  try {
    const uref = doc(db, 'users', user.uid);
    const snap = await getDoc(uref);
    currentUserDoc = snap.exists() ? snap.data() : null;

    // Se o documento não existir, criar um baseline (preservando comportamento anterior)
    if (!currentUserDoc) {
      const matDefault = user.email ? user.email.split('@')[0] : 'unknown';
      const novo = { nome: matDefault, matricula: matDefault, admin: adminsMat.has(matDefault), createdAt: serverTimestamp() };
      await setDoc(uref, novo);
      currentUserDoc = novo;
    }

    // ajuste admin automático (mantido)
    if (adminsMat.has(currentUserDoc?.matricula) && !currentUserDoc.admin) {
      await updateDoc(uref, { admin: true });
      currentUserDoc.admin = true;
    }

    // Ajusta UI
    if (authArea) authArea.classList.add('hidden');
    if (appArea) appArea.classList.remove('hidden');
    if (btnLogout) btnLogout.classList.remove('hidden');
    if (btnChangePass) btnChangePass.classList.remove('hidden');

    if (matRecebedor && currentUserDoc?.matricula) matRecebedor.value = currentUserDoc.matricula;

    if (userBadge) {
      userBadge.textContent = `${currentUserDoc.nome} • ${currentUserDoc.matricula}`;
      userBadge.classList.remove('hidden');
      if (currentUserDoc.admin) userBadge.classList.add('admin'); else userBadge.classList.remove('admin');
    }

    // Continuar com o fluxo de caixa existente
    await detectOrUpdateCaixaStatus();
  } catch (e) {
    console.error('Erro ao ler dados do usuário:', e);
    alert('Erro ao carregar perfil do usuário: ' + (e?.message || e));
  }
});

// ---- Caixa ----
async function detectOrUpdateCaixaStatus() {
  if (!auth.currentUser) {
    currentCaixaRef = null;
    setStatusUI('fechado');
    enableWorkflows(false);
    if (relatorioLista) relatorioLista.textContent = 'Sem lançamentos. Abra um caixa para iniciar.';
    return;
  }
  const uid = auth.currentUser.uid;
  const q1 = query(collection(db, 'users', uid, 'caixas'), where('status', '==', 'aberto'));
  const abertos = await getDocs(q1);
  if (!abertos.empty) {
    const docRef = abertos.docs[0].ref;
    currentCaixaRef = { userId: uid, caixaId: docRef.id };
    setStatusUI('aberto'); enableWorkflows(true);
    await renderParcial();
  } else {
    currentCaixaRef = null; setStatusUI('fechado'); enableWorkflows(false);
    if (relatorioLista) relatorioLista.textContent = 'Sem lançamentos. Abra um caixa para iniciar.';
  }
}

function setStatusUI(status) { if (caixaStatusEl) caixaStatusEl.textContent = status === 'aberto' ? 'Caixa Aberto' : 'Caixa Fechado'; }
function enableWorkflows(aberto) {
  if (btnAbrir) btnAbrir.disabled = !!aberto;
  if (btnFechar) btnFechar.disabled = !aberto;
  if (lancBox) lancBox.classList.toggle('hidden', !aberto);
  if (sangriaBox) sangriaBox.classList.toggle('hidden', !aberto);
}

if (btnAbrir) {
  btnAbrir.addEventListener('click', async () => {
    if (!auth.currentUser) return alert('Usuário não autenticado. Faça login no portal.');
    const uid = auth.currentUser.uid;
    const q1 = query(collection(db, 'users', uid, 'caixas'), where('status', '==', 'aberto'));
    const openDocs = await getDocs(q1);
    if (!openDocs.empty) return alert('Você já possui um caixa aberto.');

    const caixa = {
      status: 'aberto', createdAt: serverTimestamp(),
      data: dataCaixa ? dataCaixa.value : todayISO(),
      matricula: currentUserDoc.matricula, nome: currentUserDoc.nome
    };
    const ref = await addDoc(collection(db, 'users', uid, 'caixas'), caixa);
    currentCaixaRef = { userId: uid, caixaId: ref.id }; setStatusUI('aberto'); enableWorkflows(true);
    await renderParcial(); alert('Caixa aberto com sucesso.');
  });
}

if (btnFechar) {
  btnFechar.addEventListener('click', async () => {
    if (!currentCaixaRef) return;
    await gerarRelatorioPDF();
    const ref = doc(db, 'users', currentCaixaRef.userId, 'caixas', currentCaixaRef.caixaId);
    await updateDoc(ref, { status: 'fechado', closedAt: serverTimestamp() });
    currentCaixaRef = null; setStatusUI('fechado'); enableWorkflows(false);
    if (relatorioLista) relatorioLista.textContent = 'Caixa encerrado. Abra um novo quando necessário.';
  });
}

// ---- Lançamentos ----
const btnSalvarLanc = $('#btnSalvarLanc');
if (btnSalvarLanc) {
  btnSalvarLanc.addEventListener('click', async () => {
    if (!currentCaixaRef) return alert('Abra um caixa primeiro.');
    const dados = {
      tipoValidador: tipoVal ? tipoVal.value : '',
      qtdBordos: Number(qtdBordos ? qtdBordos.value || 0 : 0),
      valor: Number(valor ? valor.value || 0 : 0),
      prefixo: '55' + (prefixo ? prefixo.value || '000' : '000'),
      dataCaixa: dataCaixa ? dataCaixa.value : todayISO(),
      matriculaMotorista: (matMotorista ? matMotorista.value : '').trim(),
      matriculaRecebedor: currentUserDoc.matricula,
      createdAt: serverTimestamp()
    };
    if (!dados.qtdBordos || !dados.matriculaMotorista) return alert('Informe a quantidade e a matrícula do motorista.');
    const ref = collection(db, 'users', currentCaixaRef.userId, 'caixas', currentCaixaRef.caixaId, 'lancamentos');
    await addDoc(ref, dados);
    await renderParcial();
    printThermalReceipt(dados);

    // Limpa os campos no site após gerar recibo
    if (qtdBordos) qtdBordos.value = '';
    if (valor) valor.value = '';
    if (tipoVal) tipoVal.value = '';
    if (prefixo) prefixo.value = '';
    if (matMotorista) matMotorista.value = '';
  });
}

const btnRegistrarSangria = $('#btnRegistrarSangria');
if (btnRegistrarSangria) {
  btnRegistrarSangria.addEventListener('click', async () => {
    if (!currentCaixaRef) return alert('Abra um caixa primeiro.');
    const valorS = Number($('#sangriaValor') ? $('#sangriaValor').value || 0 : 0);
    const motivo = ($('#sangriaMotivo') ? $('#sangriaMotivo').value : '').trim();
    if (valorS <= 0 || !motivo) return alert('Informe valor e motivo da sangria.');
    const ref = collection(db, 'users', currentCaixaRef.userId, 'caixas', currentCaixaRef.caixaId, 'sangrias');
    await addDoc(ref, { valor: valorS, motivo, createdAt: serverTimestamp() });
    if ($('#sangriaValor')) $('#sangriaValor').value = '';
    if ($('#sangriaMotivo')) $('#sangriaMotivo').value = '';
    await renderParcial();
    alert('Sangria registrada.');
  });
}

// ---- Relatório parcial com hora ----
async function renderParcial() {
  if (!currentCaixaRef || !currentUserDoc) {
    if (relatorioLista) relatorioLista.textContent = 'Sem lançamentos. Abra um caixa para iniciar.';
    return;
  }
  const base = `Usuário: ${currentUserDoc.nome} • Matrícula: ${currentUserDoc.matricula}\n`;
  const lref = collection(db, 'users', currentCaixaRef.userId, 'caixas', currentCaixaRef.caixaId, 'lancamentos');
  const sref = collection(db, 'users', currentCaixaRef.userId, 'caixas', currentCaixaRef.caixaId, 'sangrias');
  const lqs = await getDocs(query(lref, orderBy('createdAt','asc')));
  const sqs = await getDocs(query(sref, orderBy('createdAt','asc')));
  let total = 0; let out = base + '\nLANÇAMENTOS:\n';
  lqs.forEach(d => {
    const x = d.data();
    total += Number(x.valor||0);
    const horaLancamento = x.createdAt?.toDate ? x.createdAt.toDate().toLocaleTimeString('pt-BR') : '';
    out += `• ${horaLancamento} ${formatISOtoBR(x.dataCaixa)} ${x.prefixo} ${x.tipoValidador} Qtd:${x.qtdBordos} Valor:${fmtMoney(x.valor)} Mot:${x.matriculaMotorista}\n`;
  });
  let totalS = 0;
  if (!sqs.empty) {
    out += '\nSANGRIAS:\n';
    sqs.forEach(d => { const x = d.data(); totalS += Number(x.valor||0); out += `• ${fmtMoney(x.valor)} — ${x.motivo}\n`; });
  }
  out += `\nTOTAL LANÇAMENTOS: ${fmtMoney(total)}\n`;
  out += `TOTAL SANGRIAS: ${fmtMoney(totalS)}\n`;
  out += `TOTAL CORRIGIDO: ${fmtMoney(total - totalS)}\n`;
  if (relatorioLista) relatorioLista.textContent = out;
}

// ---- Recibo térmico ----
function printThermalReceipt(data) {
  const win = window.open('', '_blank', 'width=400,height=800');
  const now = new Date();
  const dt = now.toLocaleString('pt-BR');
  const dataCaixaBR = formatISOtoBR(data.dataCaixa);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Recibo</title>
<style>@page { size: 80mm 148mm; margin: 0; } body { font-family: "Lucida Sans", monospace; font-size: 12px; margin: 0; padding: 0; } h1 { text-align: center; font-size: 15px; margin: 8px 0 12px; } .mono { font-family: "Lucida Sans", monospace; white-space: pre-wrap; }</style>
</head>
<body onload="window.print(); setTimeout(()=>window.close(), 500);">
<h1>RECIBO DE PAGAMENTO MANUAL</h1>
--------------------------------------------------------------------
<div class="mono">
<strong>Matricula Motorista:</strong> ${data.matriculaMotorista}<br>
<strong>Tipo de Validador:</strong> ${data.tipoValidador}<br>
<strong>Prefixo:</strong> ${data.prefixo}<br>
--------------------------------------------------------------------
<strong>Data do Caixa:</strong> ${dataCaixaBR}<br>
<strong>Quantidade bordos:</strong> ${data.qtdBordos}<br>
<strong>Valor:</strong> R$ ${Number(data.valor).toFixed(2)}<br>
--------------------------------------------------------------------
<strong>Matricula Recebedor:</strong> ${data.matriculaRecebedor}<br>
<strong>Data Recebimento:</strong> ${dt}<br><br>
<strong>Assinatura Recebedor:</strong><br> ________________________________
</div>
</body></html>`;

  win.document.write(html); win.document.close();
}

// ---- PDF relatório completo com hora ----
async function gerarRelatorioPDF() {
  const { jsPDF } = window.jspdf;
  const docpdf = new jsPDF({ unit: 'pt', format: 'a4' });
  if (!currentCaixaRef) return;

  const uid = currentCaixaRef.userId;
  const cid = currentCaixaRef.caixaId;

  const logo = new Image();
  logo.src = "./assets/logo.png";
  logo.onload = async () => {
    try {
      const pageWidth = docpdf.internal.pageSize.getWidth();
      const logoWidth = 120; const logoHeight = 60;
      const logoX = (pageWidth - logoWidth) / 2;
      docpdf.addImage(logo, 'PNG', logoX, 30, logoWidth, logoHeight);
      docpdf.setDrawColor(0,128,0); docpdf.setLineWidth(1.2); docpdf.line(40,100,pageWidth-40,100);
      let y = 120; docpdf.setFont('helvetica','bold'); docpdf.setFontSize(16);
      docpdf.text('Relatório de Fechamento de Caixa', pageWidth/2, y, {align:'center'});
      y += 30; docpdf.setFontSize(11); docpdf.setFont('helvetica','normal');

      const hoje = new Date();
      const dataHoraBR = hoje.toLocaleDateString('pt-BR') + " " + hoje.toLocaleTimeString('pt-BR');
      const caixaSnap = await getDoc(doc(db,'users',uid,'caixas',cid));
      const caixaData = caixaSnap.data();
      let aberturaTxt = "";
      if (caixaData?.data) {
        const aberturaHora = caixaData?.createdAt?.toDate ? caixaData.createdAt.toDate().toLocaleTimeString("pt-BR") : "";
        aberturaTxt = formatISOtoBR(caixaData.data) + (aberturaHora ? " " + aberturaHora : "");
      }

      docpdf.text(`Operador: ${currentUserDoc.nome} • Matrícula: ${currentUserDoc.matricula}`, 40, y); y+=16;
      if (aberturaTxt){ docpdf.text(`Abertura do caixa: ${aberturaTxt}`, 40, y); y+=16; }
      docpdf.text(`Data do fechamento: ${dataHoraBR}`, 40, y); y+=22;

      // --- Lançamentos ---
      const lref = collection(db,'users',uid,'caixas',cid,'lancamentos');
      const lqs = await getDocs(query(lref, orderBy('createdAt','asc')));
      const lancamentosBody = []; let total=0;
      lqs.forEach(d=>{
        const x=d.data();
        total+=Number(x.valor||0);
        const horaLancamento = x.createdAt?.toDate ? x.createdAt.toDate().toLocaleTimeString("pt-BR"):'';
        lancamentosBody.push([horaLancamento, formatISOtoBR(x.dataCaixa), x.prefixo||'', x.tipoValidador||'', x.qtdBordos||'', fmtMoney(x.valor)||'R$ 0,00', x.matriculaMotorista||'']);
      });

      docpdf.autoTable({
        startY:y,
        head:[['Horário','Data','Prefixo','Validador','Qtd Bordos','Valor','Motorista']],
        body:lancamentosBody,
        theme:'grid',
        headStyles:{fillColor:[50,50,50],textColor:255,halign:'center'},
        bodyStyles:{halign:'center'},
        columnStyles:{4:{halign:'center'},5:{halign:'right'}}
      });
      y = docpdf.lastAutoTable.finalY + 20;

      // --- Sangrias ---
      const sref = collection(db,'users',uid,'caixas',cid,'sangrias');
      const sqs = await getDocs(query(sref, orderBy('createdAt','asc')));
      const sangriasBody=[]; let totalS=0;
      if(!sqs.empty){ sqs.forEach(d=>{ const x=d.data(); totalS+=Number(x.valor||0); sangriasBody.push([fmtMoney(x.valor),x.motivo||'']); }); }
      else sangriasBody.push(['R$ 0,00','Nenhuma']);
      docpdf.autoTable({
        startY:y,
        head:[['Valor','Motivo']],
        body:sangriasBody,
        theme:'grid',
        headStyles:{fillColor:[50,50,50],textColor:255,halign:'center'},
        bodyStyles:{halign:'center'}
      });
      y = docpdf.lastAutoTable.finalY + 14;

      docpdf.text(`Total Lançamentos: ${fmtMoney(total)}`,40,y); y+=14;
      docpdf.text(`Total Sangrias: ${fmtMoney(totalS)}`,40,y); y+=14;
      docpdf.text(`Total Corrigido: ${fmtMoney(total-totalS)}`,40,y); y+=22;

      // --- Nome do PDF: matricula-data-hora.minuto ---
      const d = hoje;
      const nomeArquivo = `${currentUserDoc.matricula}-${d.toLocaleDateString('pt-BR').split('/').reverse().join('-')}-${d.getHours()}.${d.getMinutes()}.pdf`;
      docpdf.save(nomeArquivo);
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      alert('Erro ao gerar relatório: ' + (e?.message || e));
    }
  };
}