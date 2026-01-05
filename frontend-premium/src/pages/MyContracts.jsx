import React, { useState, useEffect } from 'react';
import { Briefcase, Users, TrendingUp, Calendar, MapPin, Award } from 'lucide-react';
import api from '../services/api';
import '../styles/Contracts.css';

const MyContracts = () => {
    const [contratos, setContratos] = useState({
        vinculos_prestador: [],
        vinculos_clt: [],
        total: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        carregarContratos();
    }, []);

    const carregarContratos = async () => {
        try {
            setLoading(true);
            const response = await api.get('/prestadores/contratos');
            setContratos(response.data);
        } catch (error) {
            console.error('Erro ao carregar contratos:', error);
            setError('Erro ao carregar contratos. Tente novamente mais tarde.');
        } finally {
            setLoading(false);
        }
    };

    const formatPeriodo = (tipo) => {
        if (tipo === 'clt') {
            return 'Dia 1 ao 25';
        }
        return 'Dia 1 ao 30/31';
    };

    const ContractCard = ({ vinculo, tipo }) => {
        const isCLT = tipo === 'clt';

        return (
            <div className={`contract-card glass-card ${isCLT ? 'clt' : 'prestador'}`}>
                <div className="contract-header">
                    <div className="contract-type-badge">
                        {isCLT ? (
                            <>
                                <Briefcase size={16} />
                                <span>CLT</span>
                            </>
                        ) : (
                            <>
                                <Users size={16} />
                                <span>Prestador de Serviço</span>
                            </>
                        )}
                    </div>
                    <div className={`status-indicator ${vinculo.ativo ? 'active' : 'inactive'}`}>
                        {vinculo.ativo ? 'Ativo' : 'Inativo'}
                    </div>
                </div>

                <div className="contract-body">
                    <div className="contract-info-row">
                        <div className="info-item">
                            <Calendar size={18} className="icon" />
                            <div>
                                <span className="label">Turno</span>
                                <span className="value">{vinculo.turno || 'Não especificado'}</span>
                            </div>
                        </div>

                        <div className="info-item">
                            <Award size={18} className="icon" />
                            <div>
                                <span className="label">Especialidade</span>
                                <span className="value">{vinculo.especialidade || 'Não especificado'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="contract-info-row">
                        <div className="info-item">
                            <MapPin size={18} className="icon" />
                            <div>
                                <span className="label">Unidade</span>
                                <span className="value">{vinculo.unidade || 'Não especificado'}</span>
                            </div>
                        </div>

                        <div className="info-item">
                            <TrendingUp size={18} className="icon" />
                            <div>
                                <span className="label">Meta Mensal</span>
                                <span className="value">
                                    {vinculo.meta_mensal
                                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vinculo.meta_mensal)
                                        : 'Não definida'
                                    }
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="contract-periodo">
                        <Calendar size={16} />
                        <span>Período de pagamento: <strong>{formatPeriodo(tipo)}</strong></span>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Carregando seus contratos...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-container">
                <div className="error-state glass-card">
                    <p>{error}</p>
                    <button className="btn-primary" onClick={carregarContratos}>
                        Tentar Novamente
                    </button>
                </div>
            </div>
        );
    }

    const temContratos = contratos.total > 0;

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <h1>Meus Contratos</h1>
                <p>Visualize todos os seus vínculos contratuais</p>
            </div>

            {!temContratos ? (
                <div className="empty-state glass-card">
                    <Briefcase size={48} className="empty-icon" />
                    <h3>Nenhum contrato encontrado</h3>
                    <p>Você ainda não possui vínculos contratuais cadastrados no sistema.</p>
                </div>
            ) : (
                <div className="contracts-grid">
                    {/* Contratos de Prestador de Serviço */}
                    {contratos.vinculos_prestador.length > 0 && (
                        <div className="contract-section">
                            <div className="section-header">
                                <Users size={24} />
                                <h2>Contratos de Prestador de Serviço</h2>
                                <span className="count-badge">{contratos.vinculos_prestador.length}</span>
                            </div>
                            <div className="contracts-list">
                                {contratos.vinculos_prestador.map((vinculo) => (
                                    <ContractCard
                                        key={vinculo.id}
                                        vinculo={vinculo}
                                        tipo="prestador"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Contratos CLT */}
                    {contratos.vinculos_clt.length > 0 && (
                        <div className="contract-section">
                            <div className="section-header">
                                <Briefcase size={24} />
                                <h2>Contratos CLT</h2>
                                <span className="count-badge">{contratos.vinculos_clt.length}</span>
                            </div>
                            <div className="contracts-list">
                                {contratos.vinculos_clt.map((vinculo) => (
                                    <ContractCard
                                        key={vinculo.id}
                                        vinculo={vinculo}
                                        tipo="clt"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Resumo */}
                    <div className="summary-card glass-card">
                        <h3>Resumo</h3>
                        <div className="summary-stats">
                            <div className="summary-stat">
                                <span className="stat-label">Total de Vínculos</span>
                                <span className="stat-value">{contratos.total}</span>
                            </div>
                            <div className="summary-stat">
                                <span className="stat-label">Prestador de Serviço</span>
                                <span className="stat-value">{contratos.vinculos_prestador.length}</span>
                            </div>
                            <div className="summary-stat">
                                <span className="stat-label">CLT</span>
                                <span className="stat-value">{contratos.vinculos_clt.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyContracts;
