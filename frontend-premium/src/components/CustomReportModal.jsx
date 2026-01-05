import { useState } from 'react';
import { X, Download, Calendar, TrendingUp, DollarSign, Users, Clock } from 'lucide-react';
import api from '../services/api';
import '../styles/CustomReportModal.css';
// Import estático do jsPDF e autoTable para garantir que o plugin seja carregado
import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';

// Aplicar o plugin ao jsPDF para poder usar doc.autoTable()
applyPlugin(jsPDF);

const MESES = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
];

function CustomReportModal({ isOpen, onClose }) {
    const [mesInicio, setMesInicio] = useState(new Date().getMonth() + 1);
    const [anoInicio, setAnoInicio] = useState(new Date().getFullYear());
    const [mesesPeriodo, setMesesPeriodo] = useState(3);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [selectedProviders, setSelectedProviders] = useState(new Set());
    const [selectAll, setSelectAll] = useState(true);
    const [groupDuplicates, setGroupDuplicates] = useState(false); // Não agrupar por padrão

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const response = await api.get('/relatorios/customizado', {
                params: { mesInicio, anoInicio, mesesPeriodo }
            });
            setData(response.data);
            // Selecionar todos por padrão
            const allIds = new Set(response.data.prestadores.map(p => p.id));
            setSelectedProviders(allIds);
            setSelectAll(true);
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            alert('Erro ao gerar relatório: ' + (error.response?.data?.error || 'Erro desconhecido'));
        } finally {
            setLoading(false);
        }
    };

    // Agrupar prestadores por email (mesmo prestador, turnos diferentes)
    const groupProvidersByEmail = (providers) => {
        if (!groupDuplicates) return providers;

        const grouped = {};

        providers.forEach(p => {
            const email = p.email || p.nome;

            if (!grouped[email]) {
                // Primeiro registro deste email - inicializar
                let nomeLimpo = p.nome
                    .replace(/\s*\(tarde\)/i, '')
                    .replace(/\s*\(manhã\)/i, '')
                    .replace(/\s*\(manha\)/i, '')
                    .replace(/\s*\(indefinido\)/i, '')
                    .trim();

                grouped[email] = {
                    id: p.id,
                    nome: nomeLimpo,
                    email: p.email,
                    especialidade: p.especialidade,
                    turnos: [p.nome],
                    ids: [p.id],
                    meses_trabalhados: JSON.parse(JSON.stringify(p.meses_trabalhados)) // Deep copy
                };
            } else {
                // Já existe - mesclar dados
                grouped[email].turnos.push(p.nome);
                grouped[email].ids.push(p.id);

                // Mesclar meses trabalhados (sem duplicar meses)
                p.meses_trabalhados.forEach(mes => {
                    const mesExistente = grouped[email].meses_trabalhados.find(
                        m => m.mes === mes.mes && m.ano === mes.ano
                    );

                    if (mesExistente) {
                        // Mesmo mês/ano - somar valores
                        mesExistente.valor_liquido = (mesExistente.valor_liquido || 0) + (mes.valor_liquido || 0);
                        mesExistente.valor_clinica = (mesExistente.valor_clinica || 0) + (mes.valor_clinica || 0);
                        mesExistente.valor_profissional = (mesExistente.valor_profissional || 0) + (mes.valor_profissional || 0);
                        mesExistente.valor_fixo = (mesExistente.valor_fixo || 0) + (mes.valor_fixo || 0);

                        // Concatenar turnos
                        if (mes.turno && (!mesExistente.turno || !mesExistente.turno.includes(mes.turno))) {
                            mesExistente.turno = mesExistente.turno ? `${mesExistente.turno}, ${mes.turno}` : mes.turno;
                        }
                    } else {
                        // Novo mês - adicionar cópia
                        grouped[email].meses_trabalhados.push(JSON.parse(JSON.stringify(mes)));
                    }
                });
            }
        });

        // Recalcular totais e médias para TODOS os grupos
        const result = Object.values(grouped).map(g => {
            const total_meses = g.meses_trabalhados.length;
            const total_recebido = g.meses_trabalhados.reduce((sum, m) => sum + (m.valor_liquido || 0), 0);
            const total_faturado = g.meses_trabalhados.reduce((sum, m) => sum + (m.valor_clinica || 0), 0);

            return {
                ...g,
                total_meses,
                total_recebido,
                total_faturado,
                media_salarial: total_meses > 0 ? total_recebido / total_meses : 0,
                media_faturamento: total_meses > 0 ? total_faturado / total_meses : 0
            };
        });

        return result;
    };
    const toggleProvider = (id) => {
        const newSelected = new Set(selectedProviders);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedProviders(newSelected);
        setSelectAll(newSelected.size === data.prestadores.length);
    };

    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedProviders(new Set());
        } else {
            const allIds = new Set(data.prestadores.map(p => p.id));
            setSelectedProviders(allIds);
        }
        setSelectAll(!selectAll);
    };

    const getFilteredProviders = () => {
        if (!data) return [];

        // Primeiro filtrar por seleção
        let filtered = data.prestadores.filter(p => selectedProviders.has(p.id));

        // Depois agrupar se necessário
        return groupProvidersByEmail(filtered);
    };

    const getFilteredTotals = () => {
        const filtered = getFilteredProviders();

        // #region agent log
        try {
            fetch('http://127.0.0.1:7245/ingest/c587a5fd-0753-44cb-be2b-c15533efa8d7', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'debug-session',
                    runId: 'initial',
                    hypothesisId: 'H1',
                    location: 'frontend-premium/src/components/CustomReportModal.jsx:152',
                    message: 'Calculating filtered totals',
                    data: {
                        filteredCount: filtered.length,
                        firstProvider: filtered[0] ? {
                            nome: filtered[0].nome,
                            total_meses: filtered[0].total_meses,
                            total_recebido: filtered[0].total_recebido,
                            total_faturado: filtered[0].total_faturado,
                            meses_trabalhados_count: filtered[0].meses_trabalhados?.length
                        } : null
                    },
                    timestamp: Date.now()
                })
            }).catch(() => { });
        } catch (_) { }
        // #endregion

        // Calcular totais
        const total_pago = filtered.reduce((sum, p) => sum + (p.total_recebido || 0), 0);
        const total_faturado = filtered.reduce((sum, p) => sum + (p.total_faturado || 0), 0);
        const total_valor_fixo = filtered.reduce((sum, p) => {
            // Soma de todos os valores fixos de todos os meses trabalhados
            const valorFixoTotal = p.meses_trabalhados?.reduce((s, m) => s + (m.valor_fixo || 0), 0) || 0;
            return sum + valorFixoTotal;
        }, 0);
        const total_valor_profissional = filtered.reduce((sum, p) => {
            // Soma de todos os valores profissionais de todos os meses trabalhados
            const valorProfissionalTotal = p.meses_trabalhados?.reduce((s, m) => s + (m.valor_profissional || 0), 0) || 0;
            return sum + valorProfissionalTotal;
        }, 0);

        // Total de meses trabalhados (soma de todos os meses de todos os prestadores)
        const total_meses_trabalhados = filtered.reduce((sum, p) => sum + (p.total_meses || 0), 0);

        // Calcular médias corretamente: total / total de meses trabalhados
        const media_salarial_geral = total_meses_trabalhados > 0 ? total_pago / total_meses_trabalhados : 0;
        const media_faturamento_geral = total_meses_trabalhados > 0 ? total_faturado / total_meses_trabalhados : 0;
        const media_valor_profissional_geral = total_meses_trabalhados > 0 ? total_valor_profissional / total_meses_trabalhados : 0;
        const media_valor_fixo_geral = total_meses_trabalhados > 0 ? total_valor_fixo / total_meses_trabalhados : 0;

        // #region agent log
        try {
            fetch('http://127.0.0.1:7245/ingest/c587a5fd-0753-44cb-be2b-c15533efa8d7', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'debug-session',
                    runId: 'initial',
                    hypothesisId: 'H1',
                    location: 'frontend-premium/src/components/CustomReportModal.jsx:185',
                    message: 'Calculated totals',
                    data: {
                        total_pago,
                        total_faturado,
                        total_valor_fixo,
                        total_valor_profissional,
                        total_meses_trabalhados,
                        media_salarial_geral,
                        media_faturamento_geral,
                        media_valor_profissional_geral,
                        media_valor_fixo_geral
                    },
                    timestamp: Date.now()
                })
            }).catch(() => { });
        } catch (_) { }
        // #endregion

        return {
            prestadores: filtered.length,
            media_salarial_geral,
            media_faturamento_geral,
            media_valor_profissional_geral,
            media_valor_fixo_geral,
            total_pago,
            total_faturado,
            total_valor_fixo,
            total_valor_profissional,
            total_meses_trabalhados
        };
    };

    // Função auxiliar para escapar valores CSV (envolve em aspas se contém vírgula, aspas ou quebra de linha)
    const escapeCSVValue = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // Se contém vírgula, aspas ou quebra de linha, precisa ser envolvido em aspas
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            // Escapar aspas duplicando-as e envolver em aspas
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    // Formatação numérica para CSV (sem símbolo de moeda, usando vírgula como separador decimal - padrão brasileiro)
    const formatNumberForCSV = (value) => {
        if (value === null || value === undefined || isNaN(value)) return '0,00';
        // Usar vírgula como separador decimal (padrão brasileiro)
        return parseFloat(value).toFixed(2).replace('.', ',');
    };

    const handleExport = () => {
        if (!data) return;

        const filteredProviders = getFilteredProviders();
        const totals = getFilteredTotals();

        // #region agent log
        try {
            fetch('http://127.0.0.1:7245/ingest/c587a5fd-0753-44cb-be2b-c15533efa8d7', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'debug-session',
                    runId: 'initial',
                    hypothesisId: 'H1',
                    location: 'frontend-premium/src/components/CustomReportModal.jsx:155',
                    message: 'Starting CSV export',
                    data: {
                        totalProviders: filteredProviders.length,
                        totalsKeys: Object.keys(totals)
                    },
                    timestamp: Date.now()
                })
            }).catch(() => { });
        } catch (_) { }
        // #endregion

        const headers = ['Nome', 'Especialidade', 'Turnos', 'Meses Trabalhados', 'Média Salarial', 'Média Faturamento', 'Total Recebido', 'Total Faturado'];
        const rows = filteredProviders.map((p, idx) => {
            // Extrair turnos únicos
            const turnosSet = new Set();
            p.meses_trabalhados.forEach(m => {
                if (m.turno) {
                    m.turno.split(',').forEach(t => turnosSet.add(t.trim()));
                }
            });
            const turnos = Array.from(turnosSet).filter(Boolean);

            return [
                escapeCSVValue(p.nome),
                escapeCSVValue(p.especialidade || '-'),
                escapeCSVValue(turnos.join(', ')),
                p.total_meses,
                escapeCSVValue(formatNumberForCSV(p.media_salarial)),
                escapeCSVValue(formatNumberForCSV(p.media_faturamento)),
                escapeCSVValue(formatNumberForCSV(p.total_recebido)),
                escapeCSVValue(formatNumberForCSV(p.total_faturado))
            ];
        });

        // Linha de totais
        rows.push([
            'TOTAL',
            '',
            '',
            totals.prestadores || filteredProviders.length,
            escapeCSVValue(formatNumberForCSV(totals.media_salarial_geral)),
            escapeCSVValue(formatNumberForCSV(totals.media_faturamento_geral)),
            escapeCSVValue(formatNumberForCSV(totals.total_pago)),
            escapeCSVValue(formatNumberForCSV(totals.total_faturado))
        ]);

        // Gerar CSV com escape adequado
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

        // #region agent log
        try {
            fetch('http://127.0.0.1:7245/ingest/c587a5fd-0753-44cb-be2b-c15533efa8d7', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'debug-session',
                    runId: 'initial',
                    hypothesisId: 'H1',
                    location: 'frontend-premium/src/components/CustomReportModal.jsx:220',
                    message: 'CSV generated',
                    data: {
                        csvLength: csv.length,
                        firstRow: csv.split('\n')[0],
                        secondRow: csv.split('\n')[1]?.substring(0, 100)
                    },
                    timestamp: Date.now()
                })
            }).catch(() => { });
        } catch (_) { }
        // #endregion

        // Adicionar BOM para Excel reconhecer UTF-8 corretamente
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-customizado-${data.periodo.inicio.replace('/', '-')}-${data.periodo.fim.replace('/', '-')}.csv`;
        a.click();
    };

    const handleExportPDF = async () => {
        if (!data) return;

        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const filtered = getFilteredProviders();
            const totals = getFilteredTotals();

            // Cores
            const primaryColor = [102, 126, 234];
            const darkBg = [30, 35, 50];
            const lightText = [255, 255, 255];
            const accentColor = [245, 87, 108];
            const lightGray = [240, 240, 240];

            if (typeof doc.autoTable !== 'function') {
                throw new Error('autoTable plugin não foi carregado corretamente. Por favor, recarregue a página.');
            }

            // ========== PÁGINA POR PRESTADOR ==========
            filtered.forEach((prestador, index) => {
                if (index > 0) {
                    doc.addPage();
                }

                // Cabeçalho compacto
                doc.setFillColor(...darkBg);
                doc.rect(0, 0, pageWidth, 30, 'F');

                doc.setTextColor(...lightText);
                doc.setFontSize(16);
                doc.setFont(undefined, 'bold');
                doc.text(`${index + 1}. ${prestador.nome}`, pageWidth / 2, 12, { align: 'center' });

                // Especialidade e turnos na mesma linha
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');

                const turnosSet = new Set();
                prestador.meses_trabalhados.forEach(m => {
                    if (m.turno) {
                        m.turno.split(',').forEach(t => turnosSet.add(t.trim()));
                    }
                });
                const turnos = Array.from(turnosSet).filter(Boolean);
                const infoLine = `${prestador.especialidade || 'N/A'} | Turnos: ${turnos.join(', ') || 'N/A'} | ${prestador.total_meses} meses`;
                doc.text(infoLine, pageWidth / 2, 22, { align: 'center' });

                let yPos = 38;

                // Tabela de detalhamento mensal - COMPACTA
                const monthsData = prestador.meses_trabalhados.map(m => [
                    `${getMesLabel(m.mes)}/${m.ano}`,
                    formatCurrency(m.valor_liquido || 0),
                    formatCurrency(m.valor_clinica || 0)
                ]);

                // Linha de TOTAL
                monthsData.push([
                    'TOTAL',
                    formatCurrency(prestador.total_recebido),
                    formatCurrency(prestador.total_faturado)
                ]);

                doc.autoTable({
                    startY: yPos,
                    head: [['Mês/Ano', 'Valor Recebido', 'Valor Faturado']],
                    body: monthsData,
                    theme: 'grid',
                    headStyles: {
                        fillColor: primaryColor,
                        fontSize: 9,
                        fontStyle: 'bold',
                        halign: 'center',
                        textColor: lightText,
                        cellPadding: 3
                    },
                    styles: {
                        fontSize: 8,
                        cellPadding: 3
                    },
                    columnStyles: {
                        0: { cellWidth: 40, fontStyle: 'bold' },
                        1: { halign: 'right', cellWidth: 50 },
                        2: { halign: 'right', cellWidth: 50 }
                    },
                    didParseCell: function (data) {
                        if (data.row.index === monthsData.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = lightGray;
                            data.cell.styles.fontSize = 9;
                        }
                    },
                    margin: { left: 14, right: 14 }
                });

                yPos = doc.lastAutoTable.finalY + 10;

                // Resumo do Prestador - LAYOUT EM 2 COLUNAS
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.text('Resumo do Prestador', 14, yPos);
                yPos += 6;

                // Dividir em 2 colunas
                const col1X = 14;
                const col2X = pageWidth / 2 + 7;
                const colWidth = (pageWidth - 28) / 2 - 7;

                // Coluna 1
                doc.autoTable({
                    startY: yPos,
                    body: [
                        ['Média Salarial', formatCurrency(prestador.media_salarial)],
                        ['Total Recebido', formatCurrency(prestador.total_recebido)]
                    ],
                    theme: 'grid',
                    styles: {
                        fontSize: 9,
                        cellPadding: 4
                    },
                    columnStyles: {
                        0: { fontStyle: 'bold', cellWidth: colWidth * 0.5, fillColor: lightGray },
                        1: { halign: 'right', cellWidth: colWidth * 0.5, fontStyle: 'bold' }
                    },
                    margin: { left: col1X, right: pageWidth / 2 + 7 }
                });

                const table1FinalY = doc.lastAutoTable.finalY;

                // Coluna 2
                doc.autoTable({
                    startY: yPos,
                    body: [
                        ['Média Faturamento', formatCurrency(prestador.media_faturamento)],
                        ['Total Faturado', formatCurrency(prestador.total_faturado)]
                    ],
                    theme: 'grid',
                    styles: {
                        fontSize: 9,
                        cellPadding: 4
                    },
                    columnStyles: {
                        0: { fontStyle: 'bold', cellWidth: colWidth * 0.5, fillColor: lightGray },
                        1: { halign: 'right', cellWidth: colWidth * 0.5, fontStyle: 'bold' }
                    },
                    margin: { left: col2X, right: 14 }
                });

                // Rodapé
                doc.setFontSize(7);
                doc.setTextColor(128, 128, 128);
                doc.text(
                    `Página ${index + 1} de ${filtered.length + 1} | Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
                    pageWidth / 2,
                    pageHeight - 8,
                    { align: 'center' }
                );
            });

            // ========== PÁGINA FINAL: BALANÇO GERAL ==========
            doc.addPage();

            // Cabeçalho
            doc.setFillColor(...darkBg);
            doc.rect(0, 0, pageWidth, 45, 'F');

            doc.setTextColor(...lightText);
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text('Balanço Geral do Período', pageWidth / 2, 18, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.text(`Período: ${data.periodo.inicio} a ${data.periodo.fim}`, pageWidth / 2, 28, { align: 'center' });
            doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, 36, { align: 'center' });

            let yPos = 60;

            // Resumo Geral
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('Resumo Geral', 14, yPos);
            yPos += 10;

            const summaryData = [
                ['Total de Prestadores', filtered.length.toString()],
                ['Total de Meses Trabalhados', totals.total_meses_trabalhados?.toString() || '0'],
                ['Média Salarial Geral', formatCurrency(totals.media_salarial_geral)],
                ['Média Faturamento Geral', formatCurrency(totals.media_faturamento_geral)],
                ['Total Pago aos Prestadores', formatCurrency(totals.total_pago)],
                ['Total Faturado pela Clínica', formatCurrency(totals.total_faturado)],
                ['Diferença (Faturado - Pago)', formatCurrency(totals.total_faturado - totals.total_pago)]
            ];

            doc.autoTable({
                startY: yPos,
                body: summaryData,
                theme: 'grid',
                styles: {
                    fontSize: 11,
                    cellPadding: 7
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 110, fillColor: lightGray },
                    1: { halign: 'right', cellWidth: 'auto', fontStyle: 'bold', fontSize: 12 }
                }
            });

            // Rodapé
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(
                `Página ${filtered.length + 1} de ${filtered.length + 1} | Relatório Final`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );

            // Salvar PDF
            // Salvar PDF
            doc.save(`relatorio-detalhado-${data.periodo.inicio.replace('/', '-')}-${data.periodo.fim.replace('/', '-')}.pdf`);
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            alert('Erro ao gerar PDF: ' + error.message);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const getMesLabel = (mes) => {
        return MESES.find(m => m.value === mes)?.label || mes;
    };

    if (!isOpen) return null;

    return (
        <div className="custom-report-modal-overlay" onClick={onClose}>
            <div className="custom-report-modal" onClick={(e) => e.stopPropagation()}>
                <div className="custom-report-header">
                    <div>
                        <h2>📊 Relatório Customizado</h2>
                        <p>Análise detalhada por período</p>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="custom-report-body">
                    <div className="period-selector">
                        <h3><Calendar size={20} /> Selecionar Período</h3>

                        <div className="period-inputs">
                            <div className="input-group">
                                <label>Mês Inicial</label>
                                <select value={mesInicio} onChange={(e) => setMesInicio(parseInt(e.target.value))}>
                                    {MESES.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label>Ano Inicial</label>
                                <select value={anoInicio} onChange={(e) => setAnoInicio(parseInt(e.target.value))}>
                                    {[2024, 2025, 2026].map(ano => (
                                        <option key={ano} value={ano}>{ano}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label>Quantidade de Meses: {mesesPeriodo}</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="12"
                                    value={mesesPeriodo}
                                    onChange={(e) => setMesesPeriodo(parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        <button
                            className="generate-btn"
                            onClick={handleGenerate}
                            disabled={loading}
                        >
                            {loading ? 'Gerando...' : 'Gerar Relatório'}
                        </button>
                    </div>

                    {/* Resultados */}
                    {data && (
                        <div className="custom-report-results">
                            {/* Seleção de Prestadores */}
                            <div className="provider-selection">
                                <div className="selection-header">
                                    <h3><Users size={20} /> Selecionar Prestadores</h3>
                                    <div className="selection-controls">
                                        <label className="select-all-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={selectAll}
                                                onChange={toggleSelectAll}
                                            />
                                            <span>Selecionar Todos ({data.prestadores.length})</span>
                                        </label>
                                        <label className="group-duplicates-toggle">
                                            <input
                                                type="checkbox"
                                                checked={groupDuplicates}
                                                onChange={(e) => setGroupDuplicates(e.target.checked)}
                                            />
                                            <span>Agrupar turnos (mesmo email)</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="providers-grid">
                                    {data.prestadores.map((prestador, idx) => (
                                        <label key={`provider-${prestador.id}-${prestador.email || prestador.nome}-${idx}`} className="provider-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={selectedProviders.has(prestador.id)}
                                                onChange={() => toggleProvider(prestador.id)}
                                            />
                                            <div className="provider-info">
                                                <span className="provider-name">{prestador.nome}</span>
                                                <span className="provider-specialty">{prestador.especialidade}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Resumo Geral */}
                            <div className="summary-cards">
                                <div className="summary-card">
                                    <div className="card-icon"><Users size={24} /></div>
                                    <div className="card-content">
                                        <span className="card-label">Prestadores</span>
                                        <span className="card-value">{getFilteredTotals().prestadores}</span>
                                    </div>
                                </div>
                                <div className="summary-card">
                                    <div className="card-icon"><DollarSign size={24} /></div>
                                    <div className="card-content">
                                        <span className="card-label">Média Salarial</span>
                                        <span className="card-value">{formatCurrency(getFilteredTotals().media_salarial_geral)}</span>
                                    </div>
                                </div>
                                <div className="summary-card">
                                    <div className="card-icon"><TrendingUp size={24} /></div>
                                    <div className="card-content">
                                        <span className="card-label">Média Faturamento</span>
                                        <span className="card-value">{formatCurrency(getFilteredTotals().media_faturamento_geral)}</span>
                                    </div>
                                </div>
                                <div className="summary-card">
                                    <div className="card-icon"><DollarSign size={24} /></div>
                                    <div className="card-content">
                                        <span className="card-label">Total Pago</span>
                                        <span className="card-value">{formatCurrency(getFilteredTotals().total_pago)}</span>
                                    </div>
                                </div>
                                <div className="summary-card">
                                    <div className="card-icon"><TrendingUp size={24} /></div>
                                    <div className="card-content">
                                        <span className="card-label">Total Faturado</span>
                                        <span className="card-value">{formatCurrency(getFilteredTotals().total_faturado)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Tabela de Prestadores */}
                            <div className="providers-table-section">
                                <div className="table-header">
                                    <h3>Detalhamento por Prestador</h3>
                                    <div className="export-buttons">
                                        <button className="export-btn" onClick={handleExport}>
                                            <Download size={18} />
                                            CSV
                                        </button>
                                        <button className="export-btn export-pdf" onClick={handleExportPDF}>
                                            <Download size={18} />
                                            PDF
                                        </button>
                                    </div>
                                </div>

                                <div className="table-wrapper">
                                    <table className="providers-table">
                                        <thead>
                                            <tr>
                                                <th>Nome</th>
                                                <th>Especialidade</th>
                                                <th>Turnos</th>
                                                <th>Meses</th>
                                                <th>Média Salarial</th>
                                                <th>Média Faturamento</th>
                                                <th>Total Recebido</th>
                                                <th>Total Faturado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getFilteredProviders().map((provider, index) => {
                                                // Extrair turnos únicos dos meses trabalhados
                                                const turnosSet = new Set();
                                                provider.meses_trabalhados.forEach(m => {
                                                    if (m.turno) {
                                                        // Se turno tem vírgula, é múltiplo (ex: "MANHÃ, TARDE")
                                                        m.turno.split(',').forEach(t => turnosSet.add(t.trim()));
                                                    }
                                                });
                                                const turnos = Array.from(turnosSet).filter(Boolean);

                                                // Chave única: combinar ID (ou IDs se agrupado) com índice para evitar duplicatas
                                                const uniqueKey = provider.ids && provider.ids.length > 0
                                                    ? `${provider.ids.join('-')}-${index}`
                                                    : `${provider.id || provider.email || index}-${index}`;

                                                return (
                                                    <tr key={uniqueKey}>
                                                        <td>{provider.nome}</td>
                                                        <td>{provider.especialidade || '-'}</td>
                                                        <td>
                                                            <div className="turnos-cell">
                                                                <Clock size={16} className="clock-icon" />
                                                                <span className="turnos-count">{turnos.length}</span>
                                                                <div className="turnos-tooltip">
                                                                    {turnos.map((turno, idx) => (
                                                                        <span key={`${uniqueKey}-turno-${turno}-${idx}`} className="turno-badge">
                                                                            {turno}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="months-cell">
                                                                <Calendar size={16} className="calendar-icon" />
                                                                <span className="months-count">{provider.total_meses}</span>
                                                                <div className="months-tooltip">
                                                                    {provider.meses_trabalhados.map((m, idx) => (
                                                                        <span key={`${uniqueKey}-month-${m.mes}-${m.ano}-${idx}`} className="month-badge">
                                                                            {getMesLabel(m.mes)}/{m.ano}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>R$ {provider.media_salarial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td>R$ {provider.media_faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td>R$ {provider.total_recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td>R$ {provider.total_faturado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {!data && !loading && (
                        <div className="empty-state">
                            <Calendar size={48} />
                            <p>Selecione um período e clique em "Gerar Relatório"</p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}

export default CustomReportModal;
