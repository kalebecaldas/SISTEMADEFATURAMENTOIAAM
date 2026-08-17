import React, { useState, useEffect } from 'react';
import { Upload, CheckSquare, DollarSign, FileText, Wallet, CalendarRange, Users } from 'lucide-react';
import UploadPage from './Upload';
import InvoiceDashboard from './InvoiceDashboard';
import PaymentNotifications from './PaymentNotifications';
import Invoices from './Invoices';
import api from '../services/api';
import '../styles/TabbedPage.css';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const ABAS = [
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'control', label: 'Controle de Envios', icon: CheckSquare },
    { id: 'payments', label: 'Pagamentos', icon: DollarSign },
    { id: 'invoices', label: 'Notas Fiscais', icon: FileText },
];

const formatCurrency = (v) =>
    (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FinanceHub = () => {
    const [activeTab, setActiveTab] = useState('upload');
    const [resumo, setResumo] = useState(null);
    const [carregando, setCarregando] = useState(true);

    // Contexto do topo: qual competência está aberta e quanto ela soma. Sem isso o
    // usuário troca de aba sem saber de que mês está falando.
    useEffect(() => {
        let ativo = true;
        api.get('/admin/dashboard')
            .then(({ data }) => {
                if (ativo) setResumo(data);
            })
            .catch(() => {
                if (ativo) setResumo(null);
            })
            .finally(() => {
                if (ativo) setCarregando(false);
            });
        return () => { ativo = false; };
    }, []);

    const competencia = resumo?.mes
        ? `${MESES[Number(resumo.mes)]} / ${resumo.ano}`
        : '—';
    const stats = resumo?.estatisticas;

    return (
        <div className="tabbed-page">
            <header className="hub-header">
                <div>
                    <h1>Financeiro</h1>
                    <p>Envio de planilhas, conferência de notas e liberação de pagamentos.</p>
                </div>
            </header>

            <div className="ui-kpi-strip">
                <div className="ui-kpi" style={{ '--kpi-accent': 'var(--regime-pj-fg)', '--kpi-accent-bg': 'var(--regime-pj-bg)' }}>
                    <div className="ui-kpi-icon"><CalendarRange size={19} /></div>
                    <div className="ui-kpi-body">
                        <div className="ui-kpi-label">Competência</div>
                        <div className="ui-kpi-value">{carregando ? '···' : competencia}</div>
                    </div>
                </div>
                <div className="ui-kpi" style={{ '--kpi-accent': 'var(--badge-success-fg)', '--kpi-accent-bg': 'var(--badge-success-bg)' }}>
                    <div className="ui-kpi-icon"><Wallet size={19} /></div>
                    <div className="ui-kpi-body">
                        <div className="ui-kpi-label">Total do período</div>
                        <div className="ui-kpi-value">
                            {carregando ? '···' : formatCurrency(stats?.valor_total)}
                        </div>
                    </div>
                </div>
                <div className="ui-kpi" style={{ '--kpi-accent': 'var(--badge-info-fg)', '--kpi-accent-bg': 'var(--badge-info-bg)' }}>
                    <div className="ui-kpi-icon"><Users size={19} /></div>
                    <div className="ui-kpi-body">
                        <div className="ui-kpi-label">Profissionais</div>
                        <div className="ui-kpi-value">{carregando ? '···' : (stats?.total_prestadores ?? 0)}</div>
                    </div>
                </div>
                <div className="ui-kpi" style={{ '--kpi-accent': 'var(--badge-warn-fg)', '--kpi-accent-bg': 'var(--badge-warn-bg)' }}>
                    <div className="ui-kpi-icon"><FileText size={19} /></div>
                    <div className="ui-kpi-body">
                        <div className="ui-kpi-label">Notas pendentes</div>
                        <div className="ui-kpi-value">{carregando ? '···' : (stats?.notas_pendentes ?? 0)}</div>
                        {!carregando && stats?.total_notas > 0 && (
                            <div className="ui-kpi-hint">de {stats.total_notas} enviadas</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="tabs-container glass-card">
                <div className="tabs" role="tablist" aria-label="Seções do financeiro">
                    {ABAS.map(({ id, label, icon: Icone }) => (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={activeTab === id}
                            className={`tab ${activeTab === id ? 'active' : ''}`}
                            onClick={() => setActiveTab(id)}
                        >
                            <Icone size={18} />
                            <span>{label}</span>
                            {id === 'invoices' && !carregando && stats?.notas_pendentes > 0 && (
                                <span className="tab-count">{stats.notas_pendentes}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="tab-content" role="tabpanel">
                {activeTab === 'upload' && <UploadPage />}
                {activeTab === 'control' && <InvoiceDashboard />}
                {activeTab === 'payments' && <PaymentNotifications />}
                {activeTab === 'invoices' && <Invoices />}
            </div>
        </div>
    );
};

export default FinanceHub;
