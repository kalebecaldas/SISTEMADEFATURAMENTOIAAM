import React, { useState, useEffect } from 'react';
import { FileText, Edit2, Save, X, Plus } from 'lucide-react';
import api from '../services/api';
import '../styles/ContractManagement.css';

const ContractManagement = () => {
    const [contratos, setContratos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editando, setEditando] = useState(null);
    const [metaEdit, setMetaEdit] = useState('');

    useEffect(() => {
        fetchContratos();
    }, []);

    const fetchContratos = async () => {
        setLoading(true);
        try {
            const response = await api.get('/contratos/modelos');
            setContratos(response.data);
        } catch (error) {
            console.error('Erro ao buscar contratos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (contrato) => {
        setEditando(contrato.id);
        setMetaEdit(contrato.meta_mensal || '');
    };

    const handleSave = async (id) => {
        try {
            await api.put(`/contratos/modelos/${id}`, {
                meta_mensal: parseFloat(metaEdit)
            });
            setEditando(null);
            setMetaEdit('');
            fetchContratos();
            alert('Meta atualizada com sucesso!');
        } catch (error) {
            alert('Erro ao atualizar meta: ' + (error.response?.data?.error || 'Erro desconhecido'));
        }
    };

    const handleCancel = () => {
        setEditando(null);
        setMetaEdit('');
    };

    const formatCurrency = (value) => {
        if (!value) return 'Não definida';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    return (
        <div className="contract-management">
            <div className="page-header">
                <h1>📄 Gestão de Contratos</h1>
            </div>

            <div className="glass-card">
                {loading ? (
                    <div className="loading">Carregando...</div>
                ) : (
                    <div className="contracts-grid">
                        {contratos.map((contrato) => (
                            <div key={contrato.id} className="contract-card">
                                <div className="contract-header">
                                    <FileText size={24} />
                                    <h3>{contrato.nome}</h3>
                                </div>
                                <div className="contract-body">
                                    <div className="contract-info">
                                        <span className="label">Tipo:</span>
                                        <span className="value">{contrato.tipo}</span>
                                    </div>
                                    {contrato.especialidade && (
                                        <div className="contract-info">
                                            <span className="label">Especialidade:</span>
                                            <span className="value">{contrato.especialidade}</span>
                                        </div>
                                    )}
                                    {contrato.unidade && (
                                        <div className="contract-info">
                                            <span className="label">Unidade:</span>
                                            <span className="value">{contrato.unidade}</span>
                                        </div>
                                    )}
                                    <div className="contract-info meta">
                                        <span className="label">Meta Mensal:</span>
                                        {editando === contrato.id ? (
                                            <div className="edit-meta">
                                                <input
                                                    type="number"
                                                    value={metaEdit}
                                                    onChange={(e) => setMetaEdit(e.target.value)}
                                                    placeholder="5000.00"
                                                    step="0.01"
                                                />
                                                <div className="edit-actions">
                                                    <button
                                                        className="btn-icon success"
                                                        onClick={() => handleSave(contrato.id)}
                                                        title="Salvar"
                                                    >
                                                        <Save size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={handleCancel}
                                                        title="Cancelar"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="meta-display">
                                                <span className="value">{formatCurrency(contrato.meta_mensal)}</span>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handleEdit(contrato)}
                                                    title="Editar Meta"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="contract-footer">
                                    <span className={`status-badge ${contrato.ativo ? 'ativo' : 'inativo'}`}>
                                        {contrato.ativo ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="info-card glass-card">
                <h4>ℹ️ Informações</h4>
                <p>
                    As metas mensais definidas aqui serão aplicadas automaticamente aos prestadores
                    associados a cada contrato. Valores não definidos usarão a meta padrão de R$ 5.000,00.
                </p>
                <p>
                    <strong>Dica:</strong> Extraia os valores de meta diretamente dos arquivos de contrato
                    localizados na pasta <code>/CONTRATOS</code>.
                </p>
            </div>
        </div>
    );
};

export default ContractManagement;
