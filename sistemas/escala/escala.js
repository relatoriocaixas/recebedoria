import { db, auth } from "../../firebaseConfig.js";
import { collection, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  const wrap = document.querySelector(".escala-wrap");
  const selectMatricula = document.getElementById("selectMatricula");
  const selectPeriodo = document.getElementById("selectPeriodo");
  const selectTipo = document.getElementById("selectTipo");
  const inputDia = document.getElementById("inputDia");
  const btnSalvar = document.getElementById("btnSalvar");
  const calGrid = document.getElementById("calGrid");
  const monthLabel = document.getElementById("monthLabel");
  const prevMonth = document.getElementById("prevMonth");
  const nextMonth = document.getElementById("nextMonth");

  let userAtual = null, admin=false, escalaSelecionada={}, mesAtual=new Date();
  const corPorMatricula={};

  const getCor = (matricula)=>{
    if(!corPorMatricula[matricula]){
      const r=50+Math.floor(Math.random()*155);
      const g=50+Math.floor(Math.random()*155);
      const b=50+Math.floor(Math.random()*155);
      corPorMatricula[matricula]=`rgba(${r},${g},${b},0.7)`;
    }
    return corPorMatricula[matricula];
  };

  auth.onAuthStateChanged(async (user)=>{
    if(!user) return; // não sair do iframe
    userAtual = user;
    await carregarUsuarios();
    await carregarCalendario();
    wrap.style.visibility="visible";
  });

  async function carregarUsuarios(){
    const snap = await getDocs(collection(db,"users"));
    selectMatricula.innerHTML="";
    let usuarioDoc=null;
    snap.forEach(docSnap=>{
      const u=docSnap.data();
      const opt=document.createElement("option");
      opt.value=u.matricula;
      opt.textContent=`${u.matricula} - ${u.nome||u.matricula}`;
      selectMatricula.appendChild(opt);
      if(u.uid===userAtual.uid) usuarioDoc=u;
    });
    if(usuarioDoc?.admin){ admin=true; selectMatricula.disabled=false; }
    else { admin=false; selectMatricula.value=usuarioDoc?.matricula||""; selectMatricula.disabled=true; }
  }

  async function carregarCalendario(){
    const ano=mesAtual.getFullYear();
    const mes=mesAtual.getMonth();
    const primeiroDia=new Date(ano,mes,1);
    const ultimoDia=new Date(ano,mes+1,0);
    monthLabel.textContent=primeiroDia.toLocaleString("pt-BR",{month:"long", year:"numeric"});
    escalaSelecionada={};

    const snap = await getDocs(collection(db,"escalas"));
    snap.forEach(docSnap=>{
      const e=docSnap.data();
      if(admin || e.matricula===selectMatricula.value){
        if(!escalaSelecionada[e.data]) escalaSelecionada[e.data]=[];
        escalaSelecionada[e.data].push(e);
      }
    });

    renderizarCalendario(primeiroDia,ultimoDia);
  }

  function renderizarCalendario(primeiroDia,ultimoDia){
    calGrid.innerHTML="";
    const primeiroDiaSemana=primeiroDia.getDay();
    for(let i=0;i<primeiroDiaSemana;i++) calGrid.appendChild(document.createElement("div")).classList.add("day");

    for(let dia=1;dia<=ultimoDia.getDate();dia++){
      const dataAtual=new Date(primeiroDia.getFullYear(),primeiroDia.getMonth(),dia);
      const dataKey=dataAtual.toISOString().split("T")[0];
      const diaDiv=document.createElement("div"); diaDiv.classList.add("day");

      const num=document.createElement("div"); num.classList.add("num"); num.textContent=dia;
      diaDiv.appendChild(num);

      const escalasDoDia=escalaSelecionada[dataKey]||[];
      escalasDoDia.forEach(e=>{
        const desc=document.createElement("div");
        desc.classList.add("desc");
        desc.textContent=`${e.matricula} (${e.tipo})`;
        desc.style.background=getCor(e.matricula);
        diaDiv.appendChild(desc);
      });
      calGrid.appendChild(diaDiv);
    }
  }

  btnSalvar.onclick=async()=>{
    const matricula=selectMatricula.value;
    const periodo=selectPeriodo.value;
    const tipo=selectTipo.value;
    const dia=inputDia.value;
    if(!matricula || !periodo || !dia) return alert("Preencha matrícula, período e dia");

    await setDoc(doc(db,"escalas",`${matricula}_${periodo}_${dia}`),{
      matricula,
      periodo,
      data: dia,
      tipo
    });

    await carregarCalendario();
    inputDia.value="";
  };

  prevMonth.onclick=()=>{ mesAtual.setMonth(mesAtual.getMonth()-1); carregarCalendario(); };
  nextMonth.onclick=()=>{ mesAtual.setMonth(mesAtual.getMonth()+1); carregarCalendario(); };

  selectMatricula.addEventListener("change", carregarCalendario);
  selectPeriodo.addEventListener("change", carregarCalendario);
  selectTipo.addEventListener("change", carregarCalendario);
});

   