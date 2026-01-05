import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, FileText, Mail, CheckCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ProviderEditModal from '../components/ProviderEditModal';
import BillingHistoryModal from '../components/BillingHistoryModal';
import '../styles/Providers.css';

const Providers = () => {
    const navigate = useNavigate();
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProvider, setEditingProvider] = useState(null);
    const [historyProvider, setHistoryProvider] = useState(null);
    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        cpf: '',
        telefone: '',
        funcao: 'Prestador'
    });
    const [submitStatus, setSubmitStatus] = useState(null);
    const [submitMessage, setSubmitMessage] = useState('');

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            const response = await api.get('/prestadores');
            setProviders(response.data);
        } catch (error) {
            console.error('Erro ao buscar prestadores:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitStatus('loading');

        try {
            await api.post('/auth/register-provider', formData);
            setSubmitStatus('success');
            setSubmitMessage('Prestador criado! Um email de confirmação foi enviado.');
            fetchProviders();
            setTimeout(() => {
                setShowModal(false);
                setSubmitStatus(null);
                setFormData({ nome: '', email: '', cpf: '', telefone: '', funcao: 'Prestador' });
            }, 2000);
        } catch (error) {
            setSubmitStatus('error');
            setSubmitMessage(error.response?.data?.error || 'Erro ao criar prestador');
        }
    };

    const handleResendEmail = async (providerId) => {
        try {
            await api.post(`/confirmacao/enviar/${providerId}`);
            alert('Email de confirmação enviado com sucesso!');
        } catch (error) {
            alert('Erro ao enviar email: ' + (error.response?.data?.error || 'Erro desconhecido'));
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este prestador?')) {
            try {
                await api.delete(`/prestadores/${id}`);
                fetchProviders();
            } catch (error) {
                console.error('Erro ao excluir:', error);
            }
        }
    };

    const handleEdit = (provider) => {
        setEditingProvider(provider);
    };

    const filteredProviders = providers.filter(provider =>
        provider.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (provider.especialidade && provider.especialidade.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getStatusBadge = (status) => {
        const statusMap = {
            'ativo': { icon: CheckCircle, class: 'active', label: 'Ativo' },
            'pendente': { icon: Clock, class: 'pending', label: 'Pendente' },
            'incompleto': { icon: Clock, class: 'pending', label: 'Incompleto' },
            'inativo': { icon: AlertCircle, class: 'inactive', label: 'Inativo' },
            'demitido': { icon: AlertCircle, class: 'rejected', label: 'Demitido' }
        };

        const statusInfo = statusMap[status] || statusMap['ativo'];
        const Icon = statusInfo.icon;

        return (
            <span className={`status-badge ${statusInfo.class}`}>
                <Icon size={14} />
                {statusInfo.label}
            </span>
        );
    };

    return (
        <div className="providers-page">
            <div className="page-header">
                <h1>Prestadores</h1>
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={20} />
                    <span>Novo Prestador</span>
                </button>
            </div>

            <div className="glass-card toolbar">
                <div className="search-box">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nome, email ou especialidade..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="glass-card table-container">
                {loading ? (
                    <div className="loading">Carregando...</div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Prestador</th>
                                <th>Especialidade</th>
                                <th>Unidades</th>
                                <th>Meta</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProviders.map((provider) => (
                                <tr key={provider.id}>
                                    <td>
                                        <div className="provider-info">
                                            <div className="avatar">
                                                {provider.nome.charAt(0)}
                                            </div>
                                            <div>
                                                <span className="name">{provider.nome}</span>
                                                <span className="email">{provider.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="specialty-badge">
                                            {provider.especialidade || '-'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="units-list">
                                            {provider.unidades && provider.unidades.length > 0 ? (
                                                provider.unidades.map((unidade, idx) => (
                                                    <span key={`${provider.id}-unidade-${unidade}-${idx}`} className="unit-tag">{unidade}</span>
                                                ))
                                            ) : '-'}
                                        </div>
                                    </td>
                                    <td>
                                        {provider.meta_mensal ? (
                                            <span className="meta-value">
                                                R$ {parseFloat(provider.meta_mensal).toLocaleString('pt-BR')}
                                            </span>
                                        ) : (
                                            <span className="text-muted">Contrato</span>
                                        )}
                                    </td>
                                    <td>{getStatusBadge(provider.status || 'ativo')}</td>
                                    <td>
                                        <div className="actions">
                                            <button
                                                className="btn-icon"
                                                title="Histórico de Faturamento"
                                                onClick={() => setHistoryProvider(provider)}
                                            >
                                                <TrendingUp size={18} />
                                            </button>
                                            <button
                                                className="btn-icon"
                                                title="Documentos"
                                                onClick={() => navigate(`/documentos/${provider.id}`)}
                                            >
                                                <FileText size={18} />
                                            </button>

                                            {(provider.status === 'incompleto' || !provider.cadastro_confirmado) && (
                                                <button
                                                    className="btn-icon"
                                                    title="Enviar Email de Confirmação"
                                                    onClick={() => handleResendEmail(provider.id)}
                                                >
                                                    <Mail size={18} />
                                                </button>
                                            )}

                                            <button
                                                className="btn-icon"
                                                title="Editar"
                                                onClick={() => handleEdit(provider)}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                className="btn-icon delete"
                                                title="Excluir"
                                                onClick={() => handleDelete(provider.id)}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal de Novo Prestador */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal glass-card">
                        <h2>Novo Prestador</h2>

                        {submitStatus === 'success' ? (
                            <div className="success-message">
                                <CheckCircle size={48} color="#4CAF50" />
                                <p>{submitMessage}</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                {submitStatus === 'error' && (
                                    <div className="error-message">{submitMessage}</div>
                                )}

                                <div className="form-group">
                                    <label>Nome Completo</label>
                                    <input
                                        type="text"
                                        value={formData.nome}
                                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>CPF</label>
                                    <input
                                        type="text"
                                        value={formData.cpf}
                                        onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                                        placeholder="000.000.000-00"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Telefone</label>
                                    <input
                                        type="tel"
                                        value={formData.telefone}
                                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>

                                <div className="modal-actions">
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => setShowModal(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        disabled={submitStatus === 'loading'}
                                    >
                                        {submitStatus === 'loading' ? 'Criando...' : 'Criar Prestador'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Edição */}
            {editingProvider && (
                <ProviderEditModal
                    provider={editingProvider}
                    onClose={() => setEditingProvider(null)}
                    onSave={() => {
                        fetchProviders();
                        setEditingProvider(null);
                    }}
                />
            )}

            {/* Modal de Histórico de Faturamento */}
            {historyProvider && (
                <BillingHistoryModal
                    provider={historyProvider}
                    onClose={() => setHistoryProvider(null)}
                />
            )}
        </div>
    );
};

export default Providers;
