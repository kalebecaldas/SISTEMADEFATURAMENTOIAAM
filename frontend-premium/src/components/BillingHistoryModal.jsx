import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, TrendingUp, Calendar } from 'lucide-react';
import api from '../services/api';
import '../styles/BillingHistoryModal.css';

const BillingHistoryModal = ({ provider, onClose }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, [provider.id]);

    const fetchHistory = async () => {
        try {
            const response = await api.get(`/dados-mensais/${provider.id}/historico`);
            // A API retorna {historico: [], total: number}
            const data = response.data;
            const historyData = data.historico || data || [];
            setHistory(Array.isArray(historyData) ? historyData : []);
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
            setHistory([]);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const getMonthName = (month) => {
        const months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return months[month - 1] || month;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content billing-history-modal glass-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2>Histórico de Faturamento</h2>
                        <p className="provider-name">{provider.nome}</p>
                    </div>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div className="loading-state">
                            <TrendingUp size={48} className="spin" />
                            <p>Carregando histórico...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="empty-state">
                            <Calendar size={48} />
                            <p>Nenhum registro de faturamento encontrado</p>
                        </div>
                    ) : (
                        <div className="history-list">
                            {history.map((record) => (
                                <div key={record.id || `${record.mes}-${record.ano}-${record.prestador_id || ''}`} className="history-item">
                                    <div className="history-date">
                                        <Calendar size={20} />
                                        <div>
                                            <span className="month">{getMonthName(record.mes)}</span>
                                            <span className="year">{record.ano}</span>
                                        </div>
                                    </div>

                                    <div className="history-values">
                                        <div className="value-item">
                                            <span className="label">Valor Líquido</span>
                                            <span className="value">{formatCurrency(record.valor_liquido)}</span>
                                        </div>
                                        <div className="value-item">
                                            <span className="label">Meta</span>
                                            <span className="value meta">{formatCurrency(record.meta_mensal || provider.meta_mensal)}</span>
                                        </div>
                                        <div className="value-item">
                                            <span className="label">Faltas</span>
                                            <span className="value">{record.faltas || 0}</span>
                                        </div>
                                    </div>

                                    <div className="meta-status">
                                        {record.meta_batida ? (
                                            <div className="status-badge success">
                                                <CheckCircle size={18} />
                                                <span>Meta Batida</span>
                                            </div>
                                        ) : (
                                            <div className="status-badge failed">
                                                <XCircle size={18} />
                                                <span>Meta Não Batida</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BillingHistoryModal;
