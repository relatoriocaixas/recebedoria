// Função para gerar PDF A4 (termo completo)
async function gerarPDF_A4(dados) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
        alert("Erro: jsPDF não foi carregado corretamente!");
        return;
    }

    const doc = new jsPDF();
    const margem = 15;
    let y = 20;

    // === LOGO E CABEÇALHO ===
    const logo = new Image();
    logo.src = 'logo.png';
    doc.addImage(logo, 'PNG', 80, 5, 50, 20);

    doc.setFont("calibri", "bold");
    doc.setFontSize(18);
    y += 25;
    doc.text("SETOR RECEBEDORIA", 105, y, { align: "center" });

    y += 10;
    doc.setFont("calibri", "bold");
    doc.setFontSize(14);
    doc.text("TERMO DE EMPRÉSTIMO DE CARTÃO (USO DIÁRIO)", 105, y, { align: "center" });
    y += 15;

    // Corpo do texto
    doc.setFont("arial", "normal");
    doc.setFontSize(12);
    doc.text(`Nome: ${dados.nomeMotorista || ""}            Matrícula: ${dados.matriculaMotorista || ""}`, margem, y);
    y += 10;

    const largura = 180;
    const corpo = [
        "O cartão é emprestado exclusivamente para uso diário, podendo ser retirado no início ou durante a jornada e devolvido após o expediente, no local designado (Recebedoria).",
        "O colaborador que retirar o cartão assume total responsabilidade pela guarda e integridade do mesmo. Caso um terceiro (Operacional ou Gestor Operacional) retire o cartão para outro colaborador (motorista), quem realizou a retirada será o responsável direto por sua integridade.",
        "Em caso de perda, dano ou extravio, o colaborador responsável deverá arcar com o custo de reposição, conforme valores praticados pela empresa. O valor correspondente será descontado nas verbas salariais, se houver desligamento e o cartão não for devolvido, o valor será descontado nas verbas rescisórias.",
        "Declaro estar ciente e de acordo com os termos estabelecidos pela empresa."
    ];
    corpo.forEach(paragrafo => {
        const linhas = doc.splitTextToSize(paragrafo, largura);
        doc.text(linhas, margem, y);
        y += linhas.length * 6 + 5;
    });

    // Valor a ser descontado
    doc.setFont("arial", "bold");
    doc.text("Valor a ser descontado:", margem, y);
    y += 10;

    doc.setFont("arial", "normal");
    doc.text("Digicon: ( ) R$400,00   ½ Viagem: ( ) R$200,00   Prodata: ( ) R$400,00", margem, y);
    y += 10;

    doc.text(`Bordo Digicon: ${dados.numBordoDigicon || "-"}   ½ Viagem: ${dados.numMeiaViagem || "-"}   Bordo Prodata: ${dados.numBordoProdata || "-"}`, margem, y);
    y += 10;
    doc.text(`Motivo: ${dados.motivo || "-"}`, margem, y);
    y += 10;

    let dias = 1;
    if (["Perda", "Roubo/Furto"].includes(dados.motivo)) dias = 3;
    else if (dados.motivo === "Danificado") dias = 2;

    const dataRetirada = new Date(dados.dataRetirada.split("/").reverse().join("-"));
    const dataDevolucao = new Date(dataRetirada);
    dataDevolucao.setDate(dataDevolucao.getDate() + dias);

    doc.text(`Data Retirada: ${dados.dataRetirada}    Prazo Devolução: ${dataDevolucao.toLocaleDateString("pt-BR")}`, margem, y);
    y += 20;

    doc.text("Assinatura Motorista: ____________________", margem, y);
    y += 25;
    doc.text("Assinatura Recebedoria: ____________________", margem, y);
    y += 15;

    doc.setTextColor(255, 0, 0);
    doc.text("A não devolução no prazo acarretará em medidas disciplinares.", margem, y);

    // Rodapé
    y = 280;
    doc.setTextColor(100, 100, 100);
    doc.setFont("calibri", "normal");
    doc.setFontSize(10);
    doc.text("Rua Murta do Campo, 405 – Vila Alpina – São Paulo – CEP: 03210-010", 105, y, { align: "center" });
    y += 5;
    doc.text("www.movebuss.com.br – sac@movebuss.com.br – Fone/Fax: 011-2911-0675", 105, y, { align: "center" });

    doc.save(`Termo_${dados.nomeMotorista}_${dados.matriculaMotorista}.pdf`);
}


// Função para gerar comprovante térmico resumido
async function gerarPDF_Termica(dados) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
        alert("Erro: jsPDF não foi carregado corretamente!");
        return;
    }

    const doc = new jsPDF({
        unit: 'mm',
        format: [80, 170] // altura aumentada para evitar cortes
    });

    let y = 10;

    // === LOGO ===
    const logo = new Image();
    logo.src = 'logo.png';
    doc.addImage(logo, 'PNG', 18, 2, 44, 12);
    y += 12;

    // === CAIXA PONTILHADA COM BORDA ARREDONDADA ===
    const boxX = 4;
    const boxY = y - 3;
    const boxWidth = 62;
    const boxHeight = 10;
    const borderRadius = 1;

    // Desenha caixa arredondada com borda pontilhada
    doc.setLineDash([1.5, 1.5], 0);
    doc.setDrawColor(60);
    doc.setLineWidth(0.4);

    // Desenhar retângulo arredondado manualmente
    doc.roundedRect(boxX, boxY, boxWidth, boxHeight, borderRadius, borderRadius);

    // === TÍTULO ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10,5);
    doc.text("RESUMO EMPRÉSTIMO CARTÃO", boxX + boxWidth/2, y + 3, { align: "center" });

    // Restaura linha sólida para o restante do documento
    doc.setLineDash([]);
    y += 12;

    // === DADOS PRINCIPAIS ===
    doc.setFontSize(10);

    const campos = [
        ["Motorista:", dados.nomeMotorista],
        ["Matrícula:", dados.matriculaMotorista],
        ["Tipo Cartão:", dados.tipoCartao],
        ["N° Bordo Digicon:", dados.numBordoDigicon || "-"],
        ["N° Bordo Prodata:", dados.numBordoProdata || "-"],
        ["N° Meia Viagem:", dados.numMeiaViagem || "-"],
        ["Motivo:", dados.motivo],
    ];

    campos.forEach(([rotulo, valor]) => {
        doc.setFont("helvetica", "bold");
        doc.text(rotulo, 2, y);
        doc.setFont("helvetica", "normal");

        // alinhamento dinâmico do valor
        const xValor = rotulo.includes("Motorista") ? 19
                     : rotulo.includes("Matrícula") ? 26
                     : rotulo.includes("Tipo Cartão") ? 31
                     : rotulo.includes("Motivo") ? 23
                     : 38;

        doc.text(String(valor || ""), xValor, y);
        y += 6;
    });

    // === PRAZOS ===
    let dias = 1;
    if (["Perda", "Roubo/Furto"].includes(dados.motivo)) dias = 3;
    else if (dados.motivo === "Danificado") dias = 2;

    const dataRetirada = new Date(dados.dataRetirada.split("/").reverse().join("-"));
    const dataDevolucao = new Date(dataRetirada);
    dataDevolucao.setDate(dataDevolucao.getDate() + dias);

    y += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Data Retirada:", 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(dados.dataRetirada, 27, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.text("Devolução Até:", 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(dataDevolucao.toLocaleDateString("pt-BR"), 30, y);
    y += 22;

    // === LINHA DE ASSINATURA RECEBEDORIA ===
    doc.setDrawColor(0);
    doc.line(5, y, 75, y);
    y += 4;
    doc.setFontSize(9);
    doc.text("Assinatura Recebedoria", 35, y, { align: "center" });
    y += 11;

    // === AVISO FINAL ===
    doc.setTextColor(255, 0, 0);
    doc.setFontSize(8);
    doc.text("Guarde esse comprovante por 10 dias.", 33, y, { align: "center" });
    y += 8;

    // === RODAPÉ ===
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text("Move Buss - Mobilidade Urbana", 33, y, { align: "center" });

    // === IMPRESSÃO ===
    doc.autoPrint({ variant: 'non-conform' });
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
}