import React, { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Eye, CheckCircle, XCircle, AlertCircle, Calendar, X } from 'lucide-react';
import api from '../services/api';
import '../styles/Invoices.css';

const MyInvoices = () => {
    const [monthsData, setMonthsData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadingMonth, setUploadingMonth] = useState(null);
    const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(null);
    const fileInputRefs = useRef({});

    useEffect(() => {
        fetchMonthsData();
    }, []);

    const fetchMonthsData = async () => {
        try {
            // Buscar dados mensais para ver quais meses o prestador tem valores
            const dadosResponse = await api.get('/invoices/pending');
            const pendencias = dadosResponse.data.pendencias || [];

            // Buscar notas já enviadas
            const notasResponse = await api.get('/invoices');
            const notas = notasResponse.data || [];

            // Combinar dados: meses com valores + notas enviadas
            const mesesSet = new Set();
            const mesesMap = new Map();

            // Adicionar meses com pendências (valores mas sem nota)
            pendencias.forEach(p => {
                const key = `${p.mes}-${p.ano}`;
                mesesSet.add(key);
                mesesMap.set(key, {
                    mes: p.mes,
                    ano: p.ano,
                    valor: p.valor,
                    nota: null
                });
            });

            // Adicionar/atualizar com notas já enviadas
            notas.forEach(n => {
                const key = `${n.mes}-${n.ano}`;
                mesesSet.add(key);
                const existing = mesesMap.get(key);
                mesesMap.set(key, {
                    mes: n.mes,
                    ano: n.ano,
                    valor: n.valor || (existing?.valor) || 0,
                    nota: n
                });
            });

            // Converter para array e ordenar por ano/mês (mais recente primeiro)
            const mesesArray = Array.from(mesesMap.values()).sort((a, b) => {
                if (b.ano !== a.ano) return b.ano - a.ano;
                return b.mes - a.mes;
            });

            setMonthsData(mesesArray);
        } catch (error) {
            console.error('Erro ao buscar dados dos meses:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (mes, ano, hasExistingNote) => {
        if (hasExistingNote) {
            // Se já tem nota, mostrar confirmação de sobrescrita
            setShowOverwriteConfirm({ mes, ano });
        } else {
            // Se não tem nota, selecionar arquivo diretamente
            const key = `${mes}-${ano}`;
            fileInputRefs.current[key]?.click();
        }
    };

    const handleFileChange = async (e, mes, ano) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingMonth(`${mes}-${ano}`);

        const formData = new FormData();
        formData.append('mes', mes);
        formData.append('ano', ano);
        formData.append('nota_fiscal', file);

        try {
            await api.post('/invoices/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Resetar input file
            e.target.value = null;

            // Recarregar dados
            await fetchMonthsData();

            alert('Nota fiscal enviada com sucesso!');
        } catch (error) {
            console.error('Erro ao enviar nota:', error);
            alert(error.response?.data?.error || 'Erro ao enviar nota fiscal');
        } finally {
            setUploadingMonth(null);
        }
    };

    const handleOverwriteConfirm = () => {
        if (!showOverwriteConfirm) return;

        const { mes, ano } = showOverwriteConfirm;
        const key = `${mes}-${ano}`;

        // Fechar modal de confirmação
        setShowOverwriteConfirm(null);

        // Abrir seletor de arquivo
        fileInputRefs.current[key]?.click();
    };

    const handleVisualize = async (notaId, mes, ano) => {
        try {
            const response = await api.get(`/invoices/${notaId}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `nota-fiscal-${mes}-${ano}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Erro ao visualizar nota:', error);
            alert('Erro ao visualizar nota fiscal');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'aprovado':
                return <span className="status-badge approved"><CheckCircle size={14} /> Aprovado</span>;
            case 'rejeitado':
                return <span className="status-badge rejected"><XCircle size={14} /> Rejeitado</span>;
            case 'pendente':
                return <span className="status-badge pending"><AlertCircle size={14} /> Pendente</span>;
            default:
                return <span className="status-badge warning"><AlertCircle size={14} /> Não Enviado</span>;
        }
    };

    const months = [
        { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
        { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
        { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
        { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
    ];

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <h1>Minhas Notas Fiscais</h1>
                <p className="page-subtitle">Envie suas notas fiscais referentes aos valores recebidos</p>
            </div>

            <div className="glass-card table-container">
                {loading ? (
                    <div className="loading">Carregando dados...</div>
                ) : monthsData.length === 0 ? (
                    <div className="empty-state">
                        <FileText size={48} />
                        <p>Você ainda não possui valores registrados.</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Referência</th>
                                <th>Valor</th>
                                <th>Status</th>
                                <th>Data Envio</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthsData.map((monthData) => {
                                const key = `${monthData.mes}-${monthData.ano}`;
                                const isUploading = uploadingMonth === key;
                                const hasNota = !!monthData.nota;

                                return (
                                    <tr key={key}>
                                        <td>
                                            <div className="reference-info">
                                                <Calendar size={16} />
                                                <span>
                                                    {months.find(m => m.value === monthData.mes)?.label}/{monthData.ano}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="valor-cell">
                                            R$ {parseFloat(monthData.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td>
                                            {getStatusBadge(monthData.nota?.status)}
                                        </td>
                                        <td>
                                            {monthData.nota?.data_envio
                                                ? new Date(monthData.nota.data_envio).toLocaleDateString('pt-BR')
                                                : '-'
                                            }
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                {/* Input file oculto */}
                                                <input
                                                    ref={el => fileInputRefs.current[key] = el}
                                                    type="file"
                                                    accept=".pdf,.xml,.jpg,.jpeg,.png"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => handleFileChange(e, monthData.mes, monthData.ano)}
                                                />

                                                {/* Botão Visualizar (apenas se já enviou) */}
                                                {hasNota && (
                                                    <button
                                                        className="btn-icon-sm btn-view"
                                                        title="Visualizar Nota"
                                                        onClick={() => handleVisualize(monthData.nota.id, monthData.mes, monthData.ano)}
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                )}

                                                {/* Botão Enviar */}
                                                <button
                                                    className={`btn-icon-sm ${hasNota ? 'btn-resend' : 'btn-upload'}`}
                                                    title={hasNota ? 'Reenviar Nota' : 'Enviar Nota'}
                                                    onClick={() => handleFileSelect(monthData.mes, monthData.ano, hasNota)}
                                                    disabled={isUploading}
                                                >
                                                    {isUploading ? (
                                                        <span className="spinner-small"></span>
                                                    ) : (
                                                        <Upload size={18} />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal de confirmação de sobrescrita */}
            {showOverwriteConfirm && (
                <div className="modal-overlay">
                    <div className="modal glass-card confirm-modal">
                        <div className="modal-header">
                            <h2>Sobrescrever Nota Fiscal?</h2>
                            <button
                                className="btn-close"
                                onClick={() => setShowOverwriteConfirm(null)}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="warning-box">
                                <AlertCircle size={24} />
                                <div>
                                    <p>Você já enviou uma nota fiscal para <strong>{months.find(m => m.value === showOverwriteConfirm.mes)?.label}/{showOverwriteConfirm.ano}</strong>.</p>
                                    <p>Deseja substituir o arquivo enviado anteriormente?</p>
                                </div>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowOverwriteConfirm(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleOverwriteConfirm}
                            >
                                Sim, Sobrescrever
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyInvoices;
