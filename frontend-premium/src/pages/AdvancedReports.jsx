import React, { useState, useEffect } from 'react';
import { TrendingUp, Award, BarChart3, Download, FileText, Sun, Moon, Shuffle } from 'lucide-react';
import api from '../services/api';
import CustomReportModal from '../components/CustomReportModal';
import '../styles/AdvancedReports.css';

const MESES_NOMES = {
    1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr',
    5: 'Mai', 6: 'Jun', 7: 'Jul', 8: 'Ago',
    9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez'
};

// Sistema tem histórico desde 2021 — gerar dinamicamente até o ano atual + 1
const anoAtualAR = new Date().getFullYear();
const ANOS_DISPONIVEIS = Array.from({ length: anoAtualAR - 2021 + 2 }, (_, i) => 2021 + i);

const AdvancedReports = () => {
    const [stats, setStats] = useState(null);
    const [ranking, setRanking] = useState([]);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [ano, setAno] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [showCustomReport, setShowCustomReport] = useState(false);

    const [turnosAno, setTurnosAno] = useState(new Date().getFullYear());
    const [turnosData, setTurnosData] = useState(null);
    const [turnosLoading, setTurnosLoading] = useState(false);
    const [turnosFiltro, setTurnosFiltro] = useState('todos'); // todos | variados | manha | tarde

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

    const fetchTurnos = async (anoParam) => {
        setTurnosLoading(true);
        try {
            const response = await api.get(`/dados-mensais/relatorio-turnos/${anoParam}`);
            setTurnosData(response.data);
        } catch (error) {
            console.error('Erro ao buscar relatório de turnos:', error);
        } finally {
            setTurnosLoading(false);
        }
    };

    useEffect(() => {
        fetchTurnos(turnosAno);
    }, [turnosAno]);

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
                                    {ANOS_DISPONIVEIS.map(y => (
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

                    {/* Relatório de Turnos Anual */}
                    <div className="section">
                        <h2>🕐 Relatório de Turnos por Profissional</h2>
                        <div className="filters glass-card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div className="filter-group">
                                <label>Ano:</label>
                                <select value={turnosAno} onChange={(e) => setTurnosAno(parseInt(e.target.value))}>
                                    {ANOS_DISPONIVEIS.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-group">
                                <label>Filtrar:</label>
                                <select value={turnosFiltro} onChange={(e) => setTurnosFiltro(e.target.value)}>
                                    <option value="todos">Todos</option>
                                    <option value="variados">Com variação de turno</option>
                                    <option value="manha">Predominantemente Manhã</option>
                                    <option value="tarde">Predominantemente Tarde</option>
                                    <option value="ambos">Trabalhou em ambos</option>
                                </select>
                            </div>
                            {turnosData && (
                                <span style={{ fontSize: '0.85rem', color: '#888', marginLeft: 'auto' }}>
                                    {turnosData.total} profissional(ais) em {turnosAno}
                                </span>
                            )}
                        </div>

                        {turnosLoading ? (
                            <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>Carregando turnos...</div>
                        ) : turnosData && (() => {
                            const profissionais = turnosData.profissionais.filter(p => {
                                const mesesAtivos = Object.values(p.meses);
                                if (turnosFiltro === 'todos') return true;
                                const turnos = new Set(mesesAtivos.map(m => m.turno));
                                if (turnosFiltro === 'variados') return turnos.size > 1 || turnos.has('AMBOS');
                                if (turnosFiltro === 'ambos') return [...turnos].some(t => t === 'AMBOS');
                                if (turnosFiltro === 'manha') {
                                    const all = mesesAtivos.map(m => m.turno);
                                    return all.some(t => t === 'MANHÃ') && !all.some(t => t === 'TARDE');
                                }
                                if (turnosFiltro === 'tarde') {
                                    const all = mesesAtivos.map(m => m.turno);
                                    return all.some(t => t === 'TARDE') && !all.some(t => t === 'MANHÃ');
                                }
                                return true;
                            });

                            const mesesDisponiveis = [...new Set(
                                profissionais.flatMap(p => Object.keys(p.meses).map(Number))
                            )].sort((a, b) => a - b);

                            const celulaTurno = (info) => {
                                if (!info) return <td key="vazio" style={{ background: '#1a1a2e', color: '#444', textAlign: 'center', fontSize: '0.75rem' }}>—</td>;
                                const turno = info.turno || 'integral';
                                let bg, icon, label;
                                if (turno === 'MANHÃ') { bg = 'rgba(255,196,0,0.15)'; icon = '🌅'; label = 'M'; }
                                else if (turno === 'TARDE') { bg = 'rgba(100,149,237,0.15)'; icon = '🌇'; label = 'T'; }
                                else if (turno === 'AMBOS') { bg = 'rgba(150,100,220,0.15)'; icon = '↕️'; label = 'A'; }
                                else { bg = 'transparent'; icon = ''; label = '?'; }
                                return (
                                    <td key={turno} style={{ background: bg, textAlign: 'center', fontSize: '0.85rem', fontWeight: 600 }}
                                        title={`${turno}\nManhã: ${info.turno_manha ? 'Sim' : 'Não'} | Tarde: ${info.turno_tarde ? 'Sim' : 'Não'}`}>
                                        {icon} {label}
                                    </td>
                                );
                            };

                            return (
                                <div className="glass-card" style={{ overflowX: 'auto' }}>
                                    {profissionais.length === 0 ? (
                                        <p style={{ padding: '1.5rem', color: '#888', textAlign: 'center' }}>Nenhum profissional encontrado com esse filtro.</p>
                                    ) : (
                                        <table className="data-table" style={{ minWidth: '700px' }}>
                                            <thead>
                                                <tr>
                                                    <th>Profissional</th>
                                                    <th>Especialidade</th>
                                                    <th>Unidade</th>
                                                    {mesesDisponiveis.map(m => (
                                                        <th key={m} style={{ textAlign: 'center', minWidth: '52px' }}>{MESES_NOMES[m]}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {profissionais.map((p, i) => (
                                                    <tr key={`${p.prestador_id}-${p.especialidade}-${p.unidade}-${i}`}>
                                                        <td style={{ fontWeight: 500 }}>{p.nome}</td>
                                                        <td>{p.especialidade}</td>
                                                        <td>{p.unidade}</td>
                                                        {mesesDisponiveis.map(m => celulaTurno(p.meses[m]))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                    <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #2a2a3a', fontSize: '0.78rem', color: '#888', display: 'flex', gap: '1.5rem' }}>
                                        <span>🌅 M = Manhã</span>
                                        <span>🌇 T = Tarde</span>
                                        <span>↕️ A = Ambos os turnos</span>
                                    </div>
                                </div>
                            );
                        })()}
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
