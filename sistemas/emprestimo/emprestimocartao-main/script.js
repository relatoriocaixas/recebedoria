// Espera carregar o DOM
document.addEventListener("DOMContentLoaded", () => {
    const tipoCartao = document.getElementById("tipoCartao");
    const digiconField = document.getElementById("digiconField");
    const prodataField = document.getElementById("prodataField");
    const meiaViagemField = document.getElementById("meiaViagemField");
    const dataRetirada = document.getElementById("dataRetirada");
    const form = document.getElementById("emprestimoForm");

    // Preenche a data automaticamente (pt-BR)
    const hoje = new Date();
    dataRetirada.value = hoje.toLocaleDateString('pt-BR');

    // Mostra/oculta campos dependendo do tipo de cartão
    tipoCartao.addEventListener("change", () => {
        digiconField.style.display = "none";
        prodataField.style.display = "none";
        meiaViagemField.style.display = "none";

        if(tipoCartao.value === "DIGICON") {
            digiconField.style.display = "flex";
            meiaViagemField.style.display = "flex";
        } else if(tipoCartao.value === "PRODATA") {
            prodataField.style.display = "flex";
            meiaViagemField.style.display = "flex";
        } else if(tipoCartao.value === "MEIA") {
            meiaViagemField.style.display = "flex";
        }
    });

    // Função para calcular prazo de devolução
    function calcularPrazo(motivo) {
        const prazo = new Date();
        const m = motivo.toLowerCase();
        if(m === "perda" || m === "roubo/furto") {
            prazo.setDate(prazo.getDate() + 3);
        } else if(m === "danificado") {
            prazo.setDate(prazo.getDate() + 2);
        } else {
            prazo.setDate(prazo.getDate() + 1);
        }
        return prazo.toLocaleDateString('pt-BR');
    }

    // Função de salvar registro
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const dados = {
            nomeMotorista: document.getElementById("nomeMotorista").value.trim(),
            matriculaMotorista: document.getElementById("matriculaMotorista").value.trim(),
            tipoCartao: tipoCartao.value,
            numBordoDigicon: document.getElementById("numBordoDigicon")?.value.trim() || "",
            numBordoProdata: document.getElementById("numBordoProdata")?.value.trim() || "",
            numMeiaViagem: document.getElementById("numMeiaViagem")?.value.trim() || "",
            motivo: document.getElementById("motivo").value,
            matriculaEmpresto: document.getElementById("matriculaEmpresto").value.trim(),
            dataRetirada: dataRetirada.value,
            prazoDevolucao: calcularPrazo(document.getElementById("motivo").value),
            status: "em aberto",
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            // Salvar no Firestore
            await db.collection("emprestimos").add(dados);

            // Gerar PDF A4 oficial
            gerarPDF_A4(dados);

            // Gerar PDF térmico para impressão
            gerarPDF_Termica(dados);

            alert("Registro salvo com sucesso!");
            form.reset();
            dataRetirada.value = hoje.toLocaleDateString('pt-BR');

            // Resetar campos dinâmicos
            digiconField.style.display = "none";
            prodataField.style.display = "none";
            meiaViagemField.style.display = "none";

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar registro. Veja o console.");
        }
    });
});