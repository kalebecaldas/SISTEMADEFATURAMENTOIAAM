import React, { useState, useEffect } from 'react';
import { TrendingUp, Award, BarChart3, Download, FileText } from 'lucide-react';
import api from '../services/api';
import CustomReportModal from '../components/CustomReportModal';
import '../styles/AdvancedReports.css';

const AdvancedReports = () => {
    const [stats, setStats] = useState(null);
    const [ranking, setRanking] = useState([]);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [ano, setAno] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [showCustomReport, setShowCustomReport] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        fetchRanking();
    }, [mes, ano]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const response = await api.get('/relatorios/stats');
            setStats(response.data);
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRanking = async () => {
        try {
            const response = await api.get(`/relatorios/ranking/${mes}/${ano}`);
            setRanking(response.data);
        } catch (error) {
            console.error('Erro ao buscar ranking:', error);
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

    return (
        <div className="advanced-reports">
            <div className="page-header">
                <h1>📊 Relatórios Avançados</h1>
                <div className="header-actions">
                    <button className="btn-secondary" onClick={() => setShowCustomReport(true)}>
                        <FileText size={20} />
                        <span>Relatório Customizado</span>
                    </button>
                    <button className="btn-primary">
                        <Download size={20} />
                        <span>Exportar Relatório</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading">Carregando...</div>
            ) : (
                <>
                    {/* Médias de Faturamento */}
                    <div className="section">
                        <h2>💰 Médias de Faturamento</h2>
                        <div className="stats-grid">
                            <div className="stat-card glass-card">
                                <TrendingUp size={32} />
                                <div>
                                    <span className="stat-label">Média 3 Meses</span>
                                    <span className="stat-value">{formatCurrency(stats?.medias.tres_meses)}</span>
                                </div>
                            </div>
                            <div className="stat-card glass-card">
                                <TrendingUp size={32} />
                                <div>
                                    <span className="stat-label">Média 6 Meses</span>
                                    <span className="stat-value">{formatCurrency(stats?.medias.seis_meses)}</span>
                                </div>
                            </div>
                            <div className="stat-card glass-card">
                                <TrendingUp size={32} />
                                <div>
                                    <span className="stat-label">Média 12 Meses</span>
                                    <span className="stat-value">{formatCurrency(stats?.medias.doze_meses)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Meses com Mais Metas Batidas */}
                    <div className="section">
                        <h2>🎯 Meses com Mais Metas Batidas</h2>
                        <div className="glass-card">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Período</th>
                                        <th>Total de Prestadores</th>
                                        <th>Metas Batidas</th>
                                        <th>Taxa de Sucesso</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats?.mesesComMetas.map((item, index) => (
                                        <tr key={`${item.mes}-${item.ano}`}>
                                            <td>{mesesNomes[item.mes]}/{item.ano}</td>
                                            <td>{item.total}</td>
                                            <td>{item.metas_batidas}</td>
                                            <td>
                                                <span className="success-rate">
                                                    {((item.metas_batidas / item.total) * 100).toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Ranking de Prestadores */}
                    <div className="section">
                        <h2>🏆 Ranking de Prestadores</h2>
                        <div className="filters glass-card">
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

                        <div className="glass-card">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Posição</th>
                                        <th>Prestador</th>
                                        <th>Especialidade</th>
                                        <th>Valor Líquido</th>
                                        <th>Meta</th>
                                        <th>Faltas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ranking.map((item, index) => (
                                        <tr key={item.email || `ranking-${index}-${item.nome}`}>
                                            <td>
                                                <div className="rank">
                                                    {index === 0 && <Award size={20} color="#FFD700" />}
                                                    {index === 1 && <Award size={20} color="#C0C0C0" />}
                                                    {index === 2 && <Award size={20} color="#CD7F32" />}
                                                    <span>{index + 1}º</span>
                                                </div>
                                            </td>
                                            <td>{item.nome}</td>
                                            <td>{item.especialidade || '-'}</td>
                                            <td className="value">{formatCurrency(item.valor_liquido)}</td>
                                            <td>
                                                {item.meta_batida ? (
                                                    <span className="badge success">✓ Batida</span>
                                                ) : (
                                                    <span className="badge warning">○ Não Batida</span>
                                                )}
                                            </td>
                                            <td>{item.faltas || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="info-card glass-card">
                        <BarChart3 size={24} />
                        <div>
                            <h4>📈 Análise de Dados</h4>
                            <p>
                                Os relatórios são atualizados automaticamente com base nos dados mensais.
                                Use os filtros para visualizar períodos específicos.
                            </p>
                        </div>
                    </div>
                </>
            )}

            <CustomReportModal
                isOpen={showCustomReport}
                onClose={() => setShowCustomReport(false)}
            />
        </div>
    );
};

export default AdvancedReports;
