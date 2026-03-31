import React, { useState, useEffect } from 'react';
import { Upload as UploadIcon, CheckCircle, AlertTriangle, X, Trash2, Edit, Calendar, Users, Briefcase, TrendingUp, BarChart2 } from 'lucide-react';
import api from '../services/api';
import UploadConfirmationModal from '../components/UploadConfirmationModal';
import ResumoMensalModal from '../components/ResumoMensalModal';
import '../styles/Upload.css';

const UploadPage = () => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [monthsData, setMonthsData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [selectedType, setSelectedType] = useState('prestador'); // 'prestador' ou 'clt'
    const [activeTabs, setActiveTabs] = useState({}); // { mes: 'prestador' | 'clt' | 'consolidado' }
    const [file, setFile] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [confirmationData, setConfirmationData] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [overwriteMode, setOverwriteMode] = useState(false);
    const [resumoModal, setResumoModal] = useState(null); // { mes, ano }

    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    useEffect(() => {
        loadMonthsData();
    }, [year]);

    const loadMonthsData = async () => {
        setLoading(true);
        try {
            const promises = Array.from({ length: 12 }, (_, i) =>
                api.get(`/upload/verificar/${i + 1}/${year}`)
                    .then(res => ({ mes: i + 1, ...res.data }))
                    .catch(() => ({
                        mes: i + 1,
                        prestadores: { existe: false, total: 0, colaboradores: 0, valor_total: 0 },
                        clt: { existe: false, total: 0, colaboradores: 0, valor_total: 0 },
                        consolidado: { total_registros: 0, total_colaboradores: 0, valor_total: 0 }
                    }))
            );

            const results = await Promise.all(promises);
            setMonthsData(results);
        } catch (error) {
            console.error('Error loading months data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleUploadClick = (mes, tipo) => {
        setSelectedMonth(mes);
        setSelectedType(tipo);
        setFile(null);
        setOverwriteMode(false);
        setShowUploadModal(true);
    };

    const handleEditClick = (mes, tipo) => {
        setSelectedMonth(mes);
        setSelectedType(tipo);
        setFile(null);
        setOverwriteMode(true);
        setShowUploadModal(true);
    };

    const processSpreadsheet = async () => {
        if (!file || !selectedMonth) return;

        setProcessing(true);
        const formData = new FormData();
        formData.append('planilha', file);
        formData.append('mes', selectedMonth);
        formData.append('ano', year);
        formData.append('tipo_colaborador', selectedType);

        try {
            const response = await api.post('/upload/processar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setConfirmationData(response.data);
            setShowConfirmation(true);
            setShowUploadModal(false);
        } catch (error) {
            console.error('Error processing spreadsheet:', error);
            alert('Erro ao processar planilha: ' + (error.response?.data?.error || error.message));
        } finally {
            setProcessing(false);
        }
    };

    const handleConfirm = async () => {
        if (!confirmationData) return;

        setUploading(true);
        setShowConfirmation(false);

        try {
            const response = await api.post('/upload/confirmar', {
                tempFile: confirmationData.tempFile,
                sobreescrever: overwriteMode
            });

            alert(`✅ ${response.data.message || 'Upload concluído com sucesso!'}`);
            setConfirmationData(null);
            setFile(null);
            setSelectedMonth(null);
            setOverwriteMode(false);

            // Recarregar dados
            await loadMonthsData();
        } catch (error) {
            console.error('Error confirming upload:', error);
            alert('Erro ao salvar dados: ' + (error.response?.data?.error || error.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (mes, tipo) => {
        const tipoTexto = tipo === 'clt' ? 'CLT' : 'Prestadores de Serviço';

        if (!window.confirm(`⚠️ Tem certeza que deseja DELETAR todos os dados de ${tipoTexto} em ${meses[mes - 1]}/${year}?\n\nISSO IRÁ REMOVER:\n✗ Todos os registros de pagamento deste tipo\n✗ Vínculos de prestadores órfãos\n✗ Prestadores não confirmados\n\nEsta ação NÃO PODE SER DESFEITA!`)) {
            return;
        }

        setLoading(true);
        try {
            const response = await api.delete(`/upload/deletar/${mes}/${year}/${tipo}`);
            alert(`✅ ${response.data.message}\n\n📊 ${response.data.deletados} registros removidos\n👤 ${response.data.prestadores_removidos || 0} prestadores removidos`);

            // Recarregar dados
            await loadMonthsData();
        } catch (error) {
            console.error('Error deleting data:', error);
            alert('Erro ao deletar dados: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    const formatPeriodo = (periodo) => {
        if (!periodo) return '';
        return `${periodo.inicio}/${String(selectedMonth).padStart(2, '0')} - ${periodo.fim}/${String(selectedMonth).padStart(2, '0')}`;
    };

    // Função para obter tab ativa de um mês específico
    const getActiveTab = (mes) => {
        return activeTabs[mes] || 'prestador';
    };

    // Função para alterar tab de um mês específico
    const setActiveTab = (mes, tab) => {
        setActiveTabs(prev => ({ ...prev, [mes]: tab }));
    };

    return (
        <>
            {/* Enhanced Header */}
            <div className="upload-header glass-card">
                <div className="header-top-compact">
                    <div className="year-selector">
                        <label>Ano</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                        >
                            {Array.from({ length: 11 }, (_, i) => {
                                const y = new Date().getFullYear() - 5 + i;
                                return <option key={y} value={y}>{y}</option>;
                            })}
                        </select>
                    </div>
                </div>

                <div className="header-stats">
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                            <CheckCircle size={18} style={{ color: '#10b981' }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Meses Enviados</span>
                            <span className="stat-value">
                                {monthsData.filter(m => m.prestadores?.existe || m.clt?.existe).length}/12
                            </span>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                            <UploadIcon size={18} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Total de Registros</span>
                            <span className="stat-value">
                                {monthsData.reduce((sum, m) => sum + (m.consolidado?.total_registros || 0), 0)}
                            </span>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                            <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Meses Pendentes</span>
                            <span className="stat-value">
                                {12 - monthsData.filter(m => m.prestadores?.existe || m.clt?.existe).length}
                            </span>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
                            <Calendar size={18} style={{ color: '#8b5cf6' }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-label">Valor Total Ano</span>
                            <span className="stat-value">
                                {formatCurrency(monthsData.reduce((sum, m) => sum + (m.consolidado?.valor_total || 0), 0))}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de Meses */}
            <div className="months-grid">
                {loading ? (
                    <div className="loading">Carregando...</div>
                ) : (
                    monthsData.map((monthData) => {
                        const hasPrestadores = monthData.prestadores?.existe;
                        const hasCLT = monthData.clt?.existe;
                        const hasAny = hasPrestadores || hasCLT;

                        return (
                            <div
                                key={monthData.mes}
                                className={`month-card glass-card ${hasAny ? 'uploaded' : 'pending'}`}
                            >
                                <div className="month-header">
                                    <div>
                                        <h3>{meses[monthData.mes - 1]}</h3>
                                        {!hasAny ? (
                                            <span className="status-badge pending">
                                                <AlertTriangle size={14} /> Pendente
                                            </span>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                                                {hasPrestadores && (
                                                    <span className="status-badge success" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                                                        <CheckCircle size={11} /> PJ
                                                    </span>
                                                )}
                                                {hasCLT && (
                                                    <span className="status-badge success" style={{ fontSize: '0.68rem', padding: '2px 8px', background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)' }}>
                                                        <CheckCircle size={11} /> CLT
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Tabs - SEMPRE MOSTRAR */}
                                <div className="month-tabs">
                                    <button
                                        className={`tab-btn ${getActiveTab(monthData.mes) === 'prestador' ? 'active' : ''}`}
                                        onClick={() => setActiveTab(monthData.mes, 'prestador')}
                                        style={hasPrestadores && getActiveTab(monthData.mes) !== 'prestador' ? { borderColor: 'rgba(34,197,94,0.4)' } : {}}
                                    >
                                        <Users size={14} />
                                        PJ{hasPrestadores ? ' ✓' : ''}
                                    </button>
                                    <button
                                        className={`tab-btn ${getActiveTab(monthData.mes) === 'clt' ? 'active' : ''}`}
                                        onClick={() => setActiveTab(monthData.mes, 'clt')}
                                        style={hasCLT && getActiveTab(monthData.mes) !== 'clt' ? { borderColor: 'rgba(34,197,94,0.4)' } : {}}
                                    >
                                        <Briefcase size={14} />
                                        CLT{hasCLT ? ' ✓' : ''}
                                    </button>
                                    <button
                                        className={`tab-btn ${getActiveTab(monthData.mes) === 'consolidado' ? 'active' : ''}`}
                                        onClick={() => setActiveTab(monthData.mes, 'consolidado')}
                                        disabled={!hasAny}
                                    >
                                        <TrendingUp size={14} />
                                        Total
                                    </button>
                                </div>

                                {/* Conteúdo baseado na tab ativa */}
                                {getActiveTab(monthData.mes) === 'prestador' && (
                                    <>
                                        {hasPrestadores ? (
                                            <>
                                                <div className="month-stats">
                                                    <div className="stat">
                                                        <span className="stat-label">Período</span>
                                                        <span className="stat-value-small">
                                                            {monthData.prestadores.periodo?.inicio} - {monthData.prestadores.periodo?.fim}
                                                        </span>
                                                    </div>
                                                    <div className="stat">
                                                        <span className="stat-label">Registros</span>
                                                        <span className="stat-value">{monthData.prestadores.total}</span>
                                                    </div>
                                                    <div className="stat">
                                                        <span className="stat-label">Colaboradores</span>
                                                        <span className="stat-value">{monthData.prestadores.colaboradores}</span>
                                                    </div>
                                                    <div className="stat">
                                                        <span className="stat-label">Valor Total</span>
                                                        <span className="stat-value">{formatCurrency(monthData.prestadores.valor_total)}</span>
                                                    </div>
                                                </div>

                                                <div className="month-actions">
                                                    <button
                                                        className="btn-icon btn-primary"
                                                        onClick={() => setResumoModal({ mes: monthData.mes, ano: year })}
                                                        title="Ver resumo detalhado"
                                                    >
                                                        <BarChart2 size={18} />
                                                        Resumo
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-warning"
                                                        onClick={() => handleEditClick(monthData.mes, 'prestador')}
                                                        title="Substituir planilha inteira"
                                                    >
                                                        <Edit size={18} />
                                                        Substituir
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-danger"
                                                        onClick={() => handleDelete(monthData.mes, 'prestador')}
                                                        title="Deletar dados"
                                                    >
                                                        <Trash2 size={18} />
                                                        Deletar
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="month-actions">
                                                <button
                                                    className="btn-primary full-width"
                                                    onClick={() => handleUploadClick(monthData.mes, 'prestador')}
                                                >
                                                    <UploadIcon size={18} />
                                                    Enviar Planilha
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {getActiveTab(monthData.mes) === 'clt' && (
                                    <>
                                        {hasCLT ? (
                                            <>
                                                <div className="month-stats">
                                                    <div className="stat">
                                                        <span className="stat-label">Período</span>
                                                        <span className="stat-value-small">
                                                            {monthData.clt.periodo?.inicio} - {monthData.clt.periodo?.fim}
                                                        </span>
                                                    </div>
                                                    <div className="stat">
                                                        <span className="stat-label">Registros</span>
                                                        <span className="stat-value">{monthData.clt.total}</span>
                                                    </div>
                                                    <div className="stat">
                                                        <span className="stat-label">Colaboradores</span>
                                                        <span className="stat-value">{monthData.clt.colaboradores}</span>
                                                    </div>
                                                    <div className="stat">
                                                        <span className="stat-label">Valor Total</span>
                                                        <span className="stat-value">{formatCurrency(monthData.clt.valor_total)}</span>
                                                    </div>
                                                </div>

                                                <div className="month-actions">
                                                    <button
                                                        className="btn-icon btn-primary"
                                                        onClick={() => setResumoModal({ mes: monthData.mes, ano: year })}
                                                        title="Ver resumo detalhado"
                                                    >
                                                        <BarChart2 size={18} />
                                                        Resumo
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-warning"
                                                        onClick={() => handleEditClick(monthData.mes, 'clt')}
                                                        title="Substituir planilha inteira"
                                                    >
                                                        <Edit size={18} />
                                                        Substituir
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-danger"
                                                        onClick={() => handleDelete(monthData.mes, 'clt')}
                                                        title="Deletar dados"
                                                    >
                                                        <Trash2 size={18} />
                                                        Deletar
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="month-actions">
                                                <button
                                                    className="btn-primary full-width"
                                                    onClick={() => handleUploadClick(monthData.mes, 'clt')}
                                                >
                                                    <UploadIcon size={18} />
                                                    Enviar Planilha
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {getActiveTab(monthData.mes) === 'consolidado' && hasAny && (
                                    <>
                                        <div className="month-stats">
                                            <div className="stat">
                                                <span className="stat-label">Total Registros</span>
                                                <span className="stat-value">{monthData.consolidado.total_registros}</span>
                                            </div>
                                            <div className="stat">
                                                <span className="stat-label">Total Colaboradores</span>
                                                <span className="stat-value">{monthData.consolidado.total_colaboradores}</span>
                                            </div>
                                            <div className="stat">
                                                <span className="stat-label">Valor Total</span>
                                                <span className="stat-value">{formatCurrency(monthData.consolidado.valor_total)}</span>
                                            </div>
                                            <div className="stat">
                                                <span className="stat-label">Detalhamento</span>
                                                <span className="stat-value-small">
                                                    {hasPrestadores && `${monthData.prestadores.colaboradores} Prestadores`}
                                                    {hasPrestadores && hasCLT && ' + '}
                                                    {hasCLT && `${monthData.clt.colaboradores} CLT`}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="month-actions" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                                            <button
                                                className="btn-icon btn-primary full-width"
                                                onClick={() => setResumoModal({ mes: monthData.mes, ano: year })}
                                            >
                                                <BarChart2 size={18} />
                                                Ver Resumo Detalhado
                                            </button>
                                            <button
                                                className="btn-icon btn-danger full-width"
                                                onClick={async () => {
                                                    if (!window.confirm(`Apagar TODOS os dados de ${meses[monthData.mes - 1]}/${year} (CLT + PJ)?`)) return;
                                                    setLoading(true);
                                                    try {
                                                        await api.delete(`/upload/deletar/${monthData.mes}/${year}`);
                                                        await loadMonthsData();
                                                    } catch (e) {
                                                        alert('Erro ao apagar: ' + (e.response?.data?.error || e.message));
                                                    } finally {
                                                        setLoading(false);
                                                    }
                                                }}
                                            >
                                                <Trash2 size={18} />
                                                Apagar Tudo (CLT + PJ)
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal de Upload */}
            {showUploadModal && selectedMonth && (
                <div className="modal-overlay animate-fade-in" onClick={() => setShowUploadModal(false)}>
                    <div className="modal glass-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                {overwriteMode ? '🔄 Reenviar' : '📤 Enviar'} Planilha - {meses[selectedMonth - 1]}/{year}
                                <span className="type-badge">{selectedType === 'clt' ? 'CLT (01-25)' : 'Prestadores (01-31/30)'}</span>
                            </h2>
                            <button className="close-btn" onClick={() => setShowUploadModal(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="modal-content">
                            {overwriteMode && (
                                <div className="warning-box" style={{ marginBottom: '1rem' }}>
                                    <AlertTriangle size={20} />
                                    <p>Os dados existentes de <strong>{selectedType === 'clt' ? 'CLT' : 'Prestadores'}</strong> serão <strong>sobrescritos</strong> pela nova planilha.</p>
                                </div>
                            )}

                            <div className="file-drop-area">
                                <input
                                    type="file"
                                    id="file-upload-modal"
                                    accept=".xlsx, .xls, .xlsm"
                                    onChange={handleFileChange}
                                    hidden
                                />
                                <label htmlFor="file-upload-modal" className="drop-zone">
                                    <UploadIcon size={48} className="upload-icon" />
                                    <h3>{file ? file.name : 'Clique ou arraste o arquivo aqui'}</h3>
                                    <p>Suporta .xlsx, .xls, .xlsm</p>
                                </label>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowUploadModal(false)}>
                                Cancelar
                            </button>
                            <button
                                className="btn-primary"
                                onClick={processSpreadsheet}
                                disabled={!file || processing}
                            >
                                {processing ? 'Processando...' : 'Processar Arquivo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Upload */}
            <UploadConfirmationModal
                isOpen={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={handleConfirm}
                data={confirmationData}
            />

            {/* Modal de Resumo Mensal — estilo planilha CLT + PJ */}
            {resumoModal && (
                <ResumoMensalModal
                    mes={resumoModal.mes}
                    ano={resumoModal.ano}
                    onClose={() => setResumoModal(null)}
                />
            )}
        </>
    );
};

export default UploadPage;
