import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Target, TrendingUp, AlertCircle, Users, Briefcase } from 'lucide-react';
import api from '../services/api';
import '../styles/ProviderPaymentHistory.css';

const ProviderPaymentHistory = () => {
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [ano, setAno] = useState(new Date().getFullYear());
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(false);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        fetchDados();
    }, [mes, ano]);

    const fetchDados = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/prestadores/historico/${mes}/${ano}`);
            setDados(response.data);
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            if (error.response?.status === 404) {
                setDados(null);
            }
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

    const mesesNomes = {
        1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril',
        5: 'Maio', 6: 'Junho', 7: 'Julho', 8: 'Agosto',
        9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'
    };

    const hasPrestador = dados?.prestador;
    const hasCLT = dados?.clt;
    const hasMultiple = hasPrestador && hasCLT;

    return (
        <div className="provider-payment-history">
            <div className="page-header">
                <h1>💰 Meus Pagamentos</h1>
            </div>

            {/* Filtros */}
            <div className="glass-card filters">
                <div className="filter-group">
                    <label>Mês:</label>
                    <select value={mes} onChange={(e) => setMes(parseInt(e.target.value))}>
                        {Object.entries(mesesNomes).map(([num, nome]) => (
                            <option key={num} value={num}>{nome}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <label>Ano:</label>
                    <select value={ano} onChange={(e) => setAno(parseInt(e.target.value))}>
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="loading">Carregando...</div>
            ) : !dados || dados.dados.length === 0 ? (
                <div className="glass-card empty-state">
                    <AlertCircle size={48} />
                    <h3>Sem dados para este período</h3>
                    <p>Não há informações de pagamento para {mesesNomes[mes]}/{ano}</p>
                </div>
            ) : (
                <>
                    {/* Card Consolidado */}
                    {hasMultiple && (
                        <div className="value-card glass-card consolidado-card">
                            <div className="value-header">
                                <TrendingUp size={24} />
                                <span>Total Consolidado - {mesesNomes[mes]} / {ano}</span>
                            </div>
                            <div className="value-main">
                                <span className="value-label">Valor Total (Prestador + CLT)</span>
                                <h1 className="value-amount">{formatCurrency(dados.consolidado.valor_total)}</h1>
                                <span className="consolidado-detail">
                                    {dados.consolidado.registros} contrato(s)
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Card Prestador de Serviço */}
                    {hasPrestador && (
                        <div className="payment-contract-section">
                            <div className="section-title prestador-title">
                                <Users size={20} />
                                <h3>Contrato de Prestador de Serviço</h3>
                            </div>
                            <div className="value-card glass-card prestador-card">
                                <div className="value-header">
                                    <Calendar size={24} />
                                    <span>Período: {dados.prestador.dia_inicio || 1} a {dados.prestador.dia_fim || 30} de {mesesNomes[mes]}</span>
                                </div>
                                <div className="value-main">
                                    <span className="value-label">Valor Líquido</span>
                                    <h1 className="value-amount">{formatCurrency(dados.prestador.valor_liquido)}</h1>
                                    {dados.prestador.turno && (
                                        <span className="detail-badge">{dados.prestador.turno} - {dados.prestador.especialidade}</span>
                                    )}
                                </div>

                                <div className="stats-grid">
                                    <div className="stat-card glass-card">
                                        <div className="stat-icon faltas">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div className="stat-content">
                                            <span className="stat-label">Faltas</span>
                                            <span className={`stat-value ${dados.prestador.faltas > 0 ? 'danger' : 'success'}`}>
                                                {dados.prestador.faltas || 0}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="stat-card glass-card">
                                        <div className="stat-icon">
                                            <DollarSign size={20} />
                                        </div>
                                        <div className="stat-content">
                                            <span className="stat-label">Unidade</span>
                                            <span className="stat-value-small">{dados.prestador.unidade || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Card CLT */}
                    {hasCLT && (
                        <div className="payment-contract-section">
                            <div className="section-title clt-title">
                                <Briefcase size={20} />
                                <h3>Contrato CLT</h3>
                            </div>
                            <div className="value-card glass-card clt-card">
                                <div className="value-header">
                                    <Calendar size={24} />
                                    <span>Período: {dados.clt.dia_inicio || 1} a {dados.clt.dia_fim || 25} de {mesesNomes[mes]}</span>
                                </div>
                                <div className="value-main">
                                    <span className="value-label">Valor Líquido</span>
                                    <h1 className="value-amount">{formatCurrency(dados.clt.valor_liquido)}</h1>
                                    {dados.clt.turno && (
                                        <span className="detail-badge">{dados.clt.turno} - {dados.clt.especialidade}</span>
                                    )}
                                </div>

                                <div className="stats-grid">
                                    <div className="stat-card glass-card">
                                        <div className="stat-icon faltas">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div className="stat-content">
                                            <span className="stat-label">Faltas</span>
                                            <span className={`stat-value ${dados.clt.faltas > 0 ? 'danger' : 'success'}`}>
                                                {dados.clt.faltas || 0}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="stat-card glass-card">
                                        <div className="stat-icon">
                                            <DollarSign size={20} />
                                        </div>
                                        <div className="stat-content">
                                            <span className="stat-label">Unidade</span>
                                            <span className="stat-value-small">{dados.clt.unidade || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ProviderPaymentHistory;
