import React, { useState, useEffect } from 'react';
import { FileText, Eye, Search, CheckCircle, XCircle, AlertCircle, Calendar, X, Send, ThumbsUp, ThumbsDown, TrendingUp, Users, Clock, RefreshCw } from 'lucide-react';
import api from '../services/api';
import '../styles/Invoices.css';

const Invoices = () => {
    const [prestadores, setPrestadores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1);
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
    const [showViewModal, setShowViewModal] = useState(null);
    const [documentUrl, setDocumentUrl] = useState(null);
    const [approving, setApproving] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectMotivo, setRejectMotivo] = useState('');
    const [stats, setStats] = useState(null);
    const [recentActivities, setRecentActivities] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchPrestadores();
        fetchRecentActivities();

        // Auto-refresh a cada 30 segundos
        const interval = setInterval(() => {
            fetchPrestadores(true);
            fetchRecentActivities();
        }, 30000);

        return () => clearInterval(interval);
    }, [statusFilter, monthFilter, yearFilter]);

    const fetchPrestadores = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            const response = await api.get(`/invoices/dashboard/${monthFilter}/${yearFilter}`);
            const prestadoresData = response.data.prestadores || [];

            // Buscar o ID da nota para cada prestador que enviou
            const prestadoresComNota = await Promise.all(
                prestadoresData.map(async (p) => {
                    if (p.nota_enviada) {
                        // Buscar a nota do prestador para este mês/ano
                        const notasResponse = await api.get('/invoices', {
                            params: {
                                prestador_id: p.prestador_id,
                                mes: monthFilter,
                                ano: yearFilter
                            }
                        });
                        const nota = notasResponse.data[0]; // Primeira nota do período
                        return {
                            ...p,
                            nota_id: nota?.id,
                            observacoes: nota?.observacoes
                        };
                    }
                    return { ...p, nota_id: null };
                })
            );

            setPrestadores(prestadoresComNota);
            setStats(response.data.estatisticas);
        } catch (error) {
            console.error('Erro ao buscar prestadores:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchRecentActivities = async () => {
        try {
            const response = await api.get(`/invoices?mes=${monthFilter}&ano=${yearFilter}`);
            const notas = response.data || [];

            // Pegar as 5 mais recentes
            const recent = notas
                .sort((a, b) => new Date(b.data_envio) - new Date(a.data_envio))
                .slice(0, 5);

            setRecentActivities(recent);
        } catch (error) {
            console.error('Erro ao buscar atividades:', error);
        }
    };

    const handleViewInvoice = async (prestador) => {
        if (!prestador.nota_id) {
            alert('Nota fiscal não encontrada');
            return;
        }

        try {
            const response = await api.get(`/invoices/${prestador.nota_id}/download`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            setDocumentUrl(url);
            setShowViewModal(prestador);
        } catch (error) {
            console.error('Erro ao carregar nota:', error);
            alert('Erro ao carregar nota fiscal');
        }
    };

    const closeViewModal = () => {
        if (documentUrl) {
            window.URL.revokeObjectURL(documentUrl);
        }
        setDocumentUrl(null);
        setShowViewModal(null);
        setShowRejectModal(false);
        setRejectMotivo('');
    };

    const handleApprove = async () => {
        if (!showViewModal?.nota_id) return;

        if (!window.confirm('Tem certeza que deseja aprovar esta nota fiscal?')) return;

        setApproving(true);
        try {
            await api.post(`/invoices/${showViewModal.nota_id}/approve`);
            alert('Nota fiscal aprovada com sucesso!');
            closeViewModal();
            fetchPrestadores();
            fetchRecentActivities();
        } catch (error) {
            console.error('Erro ao aprovar nota:', error);
            alert('Erro ao aprovar nota fiscal');
        } finally {
            setApproving(false);
        }
    };

    const handleReject = async () => {
        if (!showViewModal?.nota_id) return;

        if (!rejectMotivo.trim()) {
            alert('Por favor, informe o motivo da reprovação');
            return;
        }

        setApproving(true);
        try {
            await api.post(`/invoices/${showViewModal.nota_id}/reject`, {
                motivo: rejectMotivo
            });
            alert('Nota fiscal reprovada');
            closeViewModal();
            fetchPrestadores();
            fetchRecentActivities();
        } catch (error) {
            console.error('Erro ao reprovar nota:', error);
            alert('Erro ao reprovar nota fiscal');
        } finally {
            setApproving(false);
        }
    };

    const handleSendReminder = async (prestadorId) => {
        if (!window.confirm('Enviar lembrete de nota fiscal para este prestador?')) return;

        try {
            await api.post(`/invoices/reminder/${prestadorId}/${monthFilter}/${yearFilter}`);
            alert('Lembrete enviado com sucesso!');
        } catch (error) {
            alert('Erro ao enviar lembrete: ' + (error.response?.data?.error || 'Erro desconhecido'));
        }
    };

    const filteredPrestadores = prestadores.filter(p => {
        const matchSearch = p.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchStatus = !statusFilter ||
            (statusFilter === 'pendente' && !p.nota_enviada) ||
            (p.nota_status === statusFilter);

        return matchSearch && matchStatus;
    });

    const getStatusBadge = (status, enviada) => {
        if (!enviada) {
            return <span className="status-badge warning"><AlertCircle size={14} /> Não Enviado</span>;
        }
        switch (status) {
            case 'aprovado':
                return <span className="status-badge approved"><CheckCircle size={14} /> Aprovado</span>;
            case 'rejeitado':
                return <span className="status-badge rejected"><XCircle size={14} /> Rejeitado</span>;
            default:
                return <span className="status-badge pending"><AlertCircle size={14} /> Pendente</span>;
        }
    };

    // Função para calcular tempo relativo
    const getRelativeTime = (date) => {
        const now = new Date();
        const past = new Date(date);
        const diffInSeconds = Math.floor((now - past) / 1000);

        if (diffInSeconds < 60) return `há ${diffInSeconds} segundos`;
        if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)} minutos`;
        if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)} horas`;
        return `há ${Math.floor(diffInSeconds / 86400)} dias`;
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
                <div>
                    <h1>Notas Fiscais - Controle Admin</h1>
                    <p className="page-subtitle">
                        Visualize e aprove as notas fiscais dos prestadores de serviço
                    </p>
                </div>
                <button
                    className={`btn-icon refresh-btn ${refreshing ? 'refreshing' : ''}`}
                    onClick={() => {
                        fetchPrestadores(true);
                        fetchRecentActivities();
                    }}
                    title="Atualizar"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Dashboard de Estatísticas */}
            {stats && (
                <div className="stats-grid">
                    <div className="stat-card glass-card">
                        <div className="stat-icon total">
                            <Users size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Total de Prestadores</span>
                            <span className="stat-value">{stats.total}</span>
                        </div>
                    </div>

                    <div className="stat-card glass-card">
                        <div className="stat-icon pending">
                            <AlertCircle size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Aguardando Envio</span>
                            <span className="stat-value">{stats.pendentes}</span>
                        </div>
                    </div>

                    <div className="stat-card glass-card">
                        <div className="stat-icon sent">
                            <FileText size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Notas Enviadas</span>
                            <span className="stat-value">{stats.enviadas}</span>
                        </div>
                    </div>

                    <div className="stat-card glass-card">
                        <div className="stat-icon approved">
                            <CheckCircle size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Aprovadas</span>
                            <span className="stat-value">{stats.aprovadas}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Feed de Atividades Recentes */}
            {recentActivities.length > 0 && (
                <div className="glass-card activities-feed">
                    <div className="activities-header">
                        <h3><Clock size={18} /> Atividades Recentes</h3>
                    </div>
                    <div className="activities-list">
                        {recentActivities.map((activity, index) => (
                            <div key={activity.id || index} className="activity-item">
                                <div className="activity-icon">
                                    <FileText size={16} />
                                </div>
                                <div className="activity-content">
                                    <p>
                                        <strong>{activity.prestador_nome}</strong> enviou nota fiscal
                                    </p>
                                    <span className="activity-time">{getRelativeTime(activity.data_envio)}</span>
                                </div>
                                <div className="activity-status">
                                    {getStatusBadge(activity.status, true)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="glass-card toolbar">
                <div className="search-box">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por prestador..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filters">
                    <select value={monthFilter} onChange={(e) => setMonthFilter(Number(e.target.value))}>
                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select value={yearFilter} onChange={(e) => setYearFilter(Number(e.target.value))}>
                        <option value={2024}>2024</option>
                        <option value={2025}>2025</option>
                    </select>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">Todos os Status</option>
                        <option value="pendente">Não Enviado</option>
                        <option value="aprovado">Aprovado</option>
                        <option value="rejeitado">Rejeitado</option>
                    </select>
                </div>
            </div>

            <div className="glass-card table-container">
                {loading ? (
                    <div className="loading">Carregando prestadores...</div>
                ) : filteredPrestadores.length === 0 ? (
                    <div className="empty-state">
                        <FileText size={48} />
                        <p>Nenhum prestador com valor registrado neste período</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Prestador</th>
                                <th>Referência</th>
                                <th>Valor</th>
                                <th>Status</th>
                                <th>Data Envio</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPrestadores.map((prestador) => (
                                <tr key={prestador.prestador_id}>
                                    <td>
                                        <div className="provider-info">
                                            <div className="avatar">{prestador.nome?.charAt(0)}</div>
                                            <div>
                                                <span className="name">{prestador.nome}</span>
                                                <span className="email">{prestador.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="reference-info">
                                            <Calendar size={16} />
                                            <span>{months.find(m => m.value === monthFilter)?.label}/{yearFilter}</span>
                                        </div>
                                    </td>
                                    <td className="valor-cell">
                                        R$ {parseFloat(prestador.valor_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td>
                                        {getStatusBadge(prestador.nota_status, prestador.nota_enviada)}
                                    </td>
                                    <td>
                                        {prestador.data_envio
                                            ? new Date(prestador.data_envio).toLocaleDateString('pt-BR')
                                            : '-'
                                        }
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            {prestador.nota_enviada ? (
                                                <button
                                                    className="btn-icon-sm btn-view"
                                                    title="Visualizar e Aprovar Nota"
                                                    onClick={() => handleViewInvoice(prestador)}
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn-icon-sm btn-send"
                                                    title="Enviar Lembrete"
                                                    onClick={() => handleSendReminder(prestador.prestador_id)}
                                                >
                                                    <Send size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal de Visualização da Nota */}
            {showViewModal && (
                <div className="modal-overlay">
                    <div className="modal glass-card invoice-view-modal">
                        <div className="modal-header">
                            <div>
                                <h2>Nota Fiscal - {showViewModal.nome}</h2>
                                <p className="modal-subtitle">
                                    {months.find(m => m.value === monthFilter)?.label}/{yearFilter} •
                                    R$ {parseFloat(showViewModal.valor_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <button className="btn-close" onClick={closeViewModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Preview do Documento */}
                            <div className="document-preview">
                                {documentUrl ? (
                                    <iframe
                                        src={documentUrl}
                                        title="Visualização da Nota Fiscal"
                                        className="document-iframe"
                                    />
                                ) : (
                                    <div className="loading">Carregando documento...</div>
                                )}
                            </div>

                            {/* Observações (se houver) */}
                            {showViewModal.observacoes && (
                                <div className="info-box">
                                    <strong>Observações do Prestador:</strong>
                                    <p>{showViewModal.observacoes}</p>
                                </div>
                            )}

                            {/* Campo de Reprovação */}
                            {showRejectModal && (
                                <div className="reject-section">
                                    <label>Motivo da Reprovação:</label>
                                    <textarea
                                        value={rejectMotivo}
                                        onChange={(e) => setRejectMotivo(e.target.value)}
                                        placeholder="Descreva o motivo da reprovação..."
                                        rows="3"
                                        className="reject-textarea"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            {!showRejectModal ? (
                                <>
                                    <button
                                        className="btn-secondary btn-reject"
                                        onClick={() => setShowRejectModal(true)}
                                        disabled={approving || showViewModal.nota_status === 'rejeitado'}
                                    >
                                        <ThumbsDown size={18} />
                                        Reprovar
                                    </button>
                                    <button
                                        className="btn-primary btn-approve"
                                        onClick={handleApprove}
                                        disabled={approving || showViewModal.nota_status === 'aprovado'}
                                    >
                                        <ThumbsUp size={18} />
                                        {approving ? 'Aprovando...' : 'Aprovar'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => {
                                            setShowRejectModal(false);
                                            setRejectMotivo('');
                                        }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        className="btn-primary btn-reject"
                                        onClick={handleReject}
                                        disabled={approving || !rejectMotivo.trim()}
                                    >
                                        {approving ? 'Reprovando...' : 'Confirmar Reprovação'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Invoices;
