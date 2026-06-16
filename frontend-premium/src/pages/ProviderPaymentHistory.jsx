import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Target, TrendingUp, AlertCircle, Users, Briefcase } from 'lucide-react';
import api from '../services/api';
import '../styles/ProviderPaymentHistory.css';

// Sistema tem histórico desde 2021 — gerar dinamicamente até o ano atual + 1
const anoAtualPPH = new Date().getFullYear();
const ANOS_DISPONIVEIS = Array.from({ length: anoAtualPPH - 2021 + 2 }, (_, i) => 2021 + i);

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

    // Usar lista completa de vínculos PJ quando disponível (array retornado pelo backend)
    const prestadoresList = dados?.prestadores?.length > 0
        ? dados.prestadores
        : (dados?.prestador ? [dados.prestador] : []);
    const hasPrestador = prestadoresList.length > 0;
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
                        {ANOS_DISPONIVEIS.map(y => (
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
                    {/* Card Consolidado — mostra quando há CLT + PJ ou múltiplos vínculos */}
                    {(hasMultiple || prestadoresList.length > 1) && (
                        <div className="value-card glass-card consolidado-card">
                            <div className="value-header">
                                <TrendingUp size={24} />
                                <span>Total Consolidado - {mesesNomes[mes]} / {ano}</span>
                            </div>
                            <div className="value-main">
                                <span className="value-label">
                                    {hasMultiple ? 'Valor Total (Prestador + CLT)' : 'Valor Total (todos os vínculos)'}
                                </span>
                                <h1 className="value-amount">{formatCurrency(dados.consolidado.valor_total)}</h1>
                                <span className="consolidado-detail">
                                    {dados.consolidado.registros} contrato(s)
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Cards Prestador de Serviço — um por vínculo PJ */}
                    {hasPrestador && prestadoresList.map((pj, idx) => (
                        <div key={pj.id || idx} className="payment-contract-section">
                            <div className="section-title prestador-title">
                                <Users size={20} />
                                <h3>
                                    Contrato de Prestador de Serviço
                                    {prestadoresList.length > 1 && (
                                        <span style={{ marginLeft: 8, fontSize: '0.85rem', opacity: 0.7 }}>
                                            ({idx + 1}/{prestadoresList.length})
                                        </span>
                                    )}
                                </h3>
                            </div>
                            <div className="value-card glass-card prestador-card">
                                <div className="value-header">
                                    <Calendar size={24} />
                                    <span>Período: {pj.dia_inicio || 1} a {pj.dia_fim || 30} de {mesesNomes[mes]}</span>
                                </div>
                                <div className="value-main">
                                    <span className="value-label">Valor Líquido</span>
                                    <h1 className="value-amount">{formatCurrency(pj.valor_liquido)}</h1>
                                    {pj.turno && (
                                        <span className="detail-badge">{pj.turno} - {pj.especialidade}</span>
                                    )}
                                </div>

                                <div className="stats-grid">
                                    <div className="stat-card glass-card">
                                        <div className="stat-icon faltas">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div className="stat-content">
                                            <span className="stat-label">Faltas</span>
                                            <span className={`stat-value ${pj.faltas > 0 ? 'danger' : 'success'}`}>
                                                {pj.faltas || 0}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="stat-card glass-card">
                                        <div className="stat-icon">
                                            <DollarSign size={20} />
                                        </div>
                                        <div className="stat-content">
                                            <span className="stat-label">Unidade</span>
                                            <span className="stat-value-small">{pj.unidade || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

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
