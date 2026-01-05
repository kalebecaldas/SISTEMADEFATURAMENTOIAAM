import React, { useState, useEffect } from 'react';
import { Users, FileText, TrendingUp, AlertCircle, DollarSign, Calendar } from 'lucide-react';
import api from '../services/api';
import '../styles/Dashboard.css';

const ProviderDashboard = () => {
    const [dadosAtual, setDadosAtual] = useState(null);
    const [contratos, setContratos] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDadosPrestador();
    }, []);

    const fetchDadosPrestador = async () => {
        try {
            const mesAtual = new Date().getMonth() + 1;
            const anoAtual = new Date().getFullYear();

            const [dadosRes, contratosRes] = await Promise.all([
                api.get(`/prestadores/historico/${mesAtual}/${anoAtual}`),
                api.get('/prestadores/contratos')
            ]);

            setDadosAtual(dadosRes.data);
            setContratos(contratosRes.data);
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    const StatCard = ({ icon: Icon, title, value, color, delay, subtitle }) => (
        <div className="stat-card glass-card animate-slide-up" style={{ animationDelay: delay }}>
            <div className="stat-icon" style={{ background: `${color}20`, color: color }}>
                <Icon size={24} />
            </div>
            <div className="stat-info">
                <h3>{value}</h3>
                <p>{title}</p>
                {subtitle && <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</small>}
            </div>
        </div>
    );

    if (loading) return <div className="loading">Carregando seus dados...</div>;

    const valorTotal = dadosAtual?.consolidado?.valor_total || 0;
    const totalContratos = contratos?.total || 0;
    const hasPrestador = contratos?.vinculos_prestador?.length > 0;
    const hasCLT = contratos?.vinculos_clt?.length > 0;

    return (
        <div className="stats-grid">
            <StatCard
                icon={DollarSign}
                title="Faturamento Total (Mês Atual)"
                value={formatCurrency(valorTotal)}
                color="#00D4FF"
                delay="0.1s"
                subtitle={dadosAtual?.dados?.length > 0 ? `${dadosAtual.consolidado.registros} contrato(s)` : 'Sem dados'}
            />
            <StatCard
                icon={FileText}
                title="Meus Contratos"
                value={totalContratos}
                color="#0066FF"
                delay="0.2s"
                subtitle={`${hasPrestador ? 'Prestador' : ''}${hasPrestador && hasCLT ? ' + ' : ''}${hasCLT ? 'CLT' : ''}`}
            />
            <StatCard
                icon={Calendar}
                title="Status"
                value={dadosAtual?.dados?.length > 0 ? "Ativo" : "Pendente"}
                color="#4CAF50"
                delay="0.3s"
                subtitle="Visualizar detalhes"
            />
        </div>
    );
};

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalPrestadores: 0,
        notasPendentes: 0,
        faturamentoMes: 0,
        contratosGerados: 0
    });
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.tipo === 'admin' || user.tipo === 'master';

    useEffect(() => {
        if (isAdmin) {
            fetchStats();
        } else {
            setLoading(false);
        }
    }, [isAdmin]);

    const fetchStats = async () => {
        try {
            setTimeout(() => {
                setStats({
                    totalPrestadores: 12,
                    notasPendentes: 5,
                    faturamentoMes: 45000,
                    contratosGerados: 8
                });
                setLoading(false);
            }, 1000);
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            setLoading(false);
        }
    };

    const StatCard = ({ icon: Icon, title, value, color, delay }) => (
        <div className="stat-card glass-card animate-slide-up" style={{ animationDelay: delay }}>
            <div className="stat-icon" style={{ background: `${color}20`, color: color }}>
                <Icon size={24} />
            </div>
            <div className="stat-info">
                <h3>{value}</h3>
                <p>{title}</p>
            </div>
        </div>
    );

    if (loading) return <div className="loading">Carregando dashboard...</div>;

    return (
        <div className="dashboard-page">
            <div className="page-header">
                <h1>Olá, {user.nome}</h1>
                <p>{isAdmin ? 'Visão geral do sistema ZoraH' : 'Bem-vindo ao seu painel do ZoraH'}</p>
            </div>

            {isAdmin ? (
                // ADMIN DASHBOARD
                <div className="stats-grid">
                    <StatCard
                        icon={Users}
                        title="Prestadores Ativos"
                        value={stats.totalPrestadores}
                        color="#0066FF"
                        delay="0.1s"
                    />
                    <StatCard
                        icon={AlertCircle}
                        title="Notas Pendentes"
                        value={stats.notasPendentes}
                        color="#FF6B00"
                        delay="0.2s"
                    />
                    <StatCard
                        icon={DollarSign}
                        title="Faturamento (Mês)"
                        value={`R$ ${stats.faturamentoMes.toLocaleString()}`}
                        color="#00D4FF"
                        delay="0.3s"
                    />
                    <StatCard
                        icon={FileText}
                        title="Contratos Gerados"
                        value={stats.contratosGerados}
                        color="#4CAF50"
                        delay="0.4s"
                    />
                </div>
            ) : (
                // PROVIDER DASHBOARD
                <ProviderDashboard />
            )}

            <div className="dashboard-content">
                <div className="glass-card recent-activity animate-slide-up" style={{ animationDelay: '0.5s' }}>
                    <h2>{isAdmin ? 'Atividades Recentes' : 'Meus Avisos'}</h2>
                    <div className="activity-list">
                        {isAdmin ? (
                            <>
                                <div className="activity-item">
                                    <div className="dot" style={{ background: '#4CAF50' }}></div>
                                    <div>
                                        <strong>João Silva</strong> enviou uma nota fiscal
                                        <span className="time">Há 10 min</span>
                                    </div>
                                </div>
                                <div className="activity-item">
                                    <div className="dot" style={{ background: '#0066FF' }}></div>
                                    <div>
                                        Novo prestador <strong>Maria Santos</strong> cadastrado
                                        <span className="time">Há 1 hora</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="activity-item">
                                    <div className="dot" style={{ background: '#FF6B00' }}></div>
                                    <div>
                                        Lembrete: Enviar nota fiscal até dia 15
                                        <span className="time">Hoje</span>
                                    </div>
                                </div>
                                <div className="activity-item">
                                    <div className="dot" style={{ background: '#4CAF50' }}></div>
                                    <div>
                                        Pagamento de Novembro confirmado
                                        <span className="time">Ontem</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
