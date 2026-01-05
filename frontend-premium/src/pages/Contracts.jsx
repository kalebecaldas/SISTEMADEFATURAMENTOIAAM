import React, { useState, useEffect } from 'react';
import { FileText, Plus, Download, Filter } from 'lucide-react';
import '../styles/Invoices.css';

const Contracts = () => {
    const [contratos, setContratos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroStatus, setFiltroStatus] = useState('todos');

    useEffect(() => {
        carregarContratos();
    }, [filtroStatus]);

    const carregarContratos = async () => {
        try {
            const token = localStorage.getItem('token');
            const url = filtroStatus === 'todos'
                ? '/api/contratos'
                : `/api/contratos?status=${filtroStatus}`;

            const response = await fetch(`http://localhost:5001${url}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setContratos(data.contratos || []);
        } catch (error) {
            console.error('Erro ao carregar contratos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (contratoId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5001/api/contratos/download/${contratoId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `contrato_${contratoId}.docx`;
            a.click();
        } catch (error) {
            console.error('Erro ao baixar contrato:', error);
        }
    };

    const formatarData = (data) => {
        if (!data) return '-';
        return new Date(data).toLocaleDateString('pt-BR');
    };

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <h1>Contratos</h1>
                <p>Gerencie contratos de prestadores</p>
            </div>

            <div className="glass-card toolbar">
                <div className="filters" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <Filter size={20} />
                    <select
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value)}
                        style={{
                            padding: '0.6rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-primary)',
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            outline: 'none',
                            minWidth: '150px'
                        }}
                    >
                        <option value="todos">Todos</option>
                        <option value="gerado">Gerados</option>
                        <option value="assinado">Assinados</option>
                        <option value="cancelado">Cancelados</option>
                    </select>
                </div>
                <div className="actions">
                    <button
                        className="btn-primary"
                        onClick={() => window.location.href = '/contratos/gerar'}
                    >
                        <Plus size={20} />
                        <span>Gerar Contrato</span>
                    </button>
                </div>
            </div>

            <div className="glass-card table-container">
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div>
                ) : contratos.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Nenhum contrato encontrado
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Prestador</th>
                                <th>Tipo</th>
                                <th>Data Geração</th>
                                <th>Data Assinatura</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contratos.map((contrato) => (
                                <tr key={contrato.id}>
                                    <td>
                                        <div>
                                            <strong>{contrato.prestador_nome}</strong>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {contrato.prestador_email}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div>
                                            {contrato.modelo_nome}
                                            {contrato.especialidade && (
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {contrato.especialidade}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td>{formatarData(contrato.data_geracao)}</td>
                                    <td>{formatarData(contrato.data_assinatura)}</td>
                                    <td>
                                        <span className={`status-badge ${contrato.status === 'assinado' ? 'aprovado' :
                                            contrato.status === 'gerado' ? 'pendente' : 'rejeitado'
                                            }`}>
                                            {contrato.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="btn-icon-sm"
                                            onClick={() => handleDownload(contrato.id)}
                                            title="Baixar contrato"
                                        >
                                            <Download size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Contracts;
