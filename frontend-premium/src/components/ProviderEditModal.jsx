import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import api from '../services/api';
import '../styles/ProviderEditModal.css';

const ProviderEditModal = ({ provider, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        nome: provider?.nome || '',
        email: provider?.email || '',
        telefone: provider?.telefone || '',
        especialidade: provider?.especialidade || '',
        unidades: provider?.unidades || [],
        valor_fixo: provider?.valor_fixo || false,
        meta_mensal: provider?.meta_mensal || '',
        status: provider?.status || 'ativo',
        tipo_colaborador: provider?.tipo_colaborador || 'prestador_servico'
    });
    const [loading, setLoading] = useState(false);

    const especialidades = [
        'Acupuntura',
        'Fisioterapia Pélvica',
        'Fisioterapia Neurológica',
        'Acupuntura São José',
        'Fisioterapia São José',
        'Outra'
    ];

    const unidadesDisponiveis = ['Matriz', 'Anexo', 'São José'];
    const statusOptions = ['ativo', 'inativo', 'demitido', 'incompleto'];

    const handleUnidadeToggle = (unidade) => {
        setFormData(prev => ({
            ...prev,
            unidades: prev.unidades.includes(unidade)
                ? prev.unidades.filter(u => u !== unidade)
                : [...prev.unidades, unidade]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await api.put(`/colaboradores/${provider.id}`, formData);
            onSave();
            onClose();
        } catch (error) {
            alert('Erro ao atualizar colaborador: ' + (error.response?.data?.error || 'Erro desconhecido'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Editar Colaborador</h2>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label>Nome Completo *</label>
                            <input
                                type="text"
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Email *</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Telefone</label>
                            <input
                                type="tel"
                                value={formData.telefone}
                                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                        <div className="form-group">
                            <label>Especialidade *</label>
                            <select
                                value={formData.especialidade}
                                onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                                required
                            >
                                <option value="">Selecione...</option>
                                {especialidades.map(esp => (
                                    <option key={esp} value={esp}>{esp}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Unidades de Atendimento *</label>
                        <div className="checkbox-group">
                            {unidadesDisponiveis.map(unidade => (
                                <label key={unidade} className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.unidades.includes(unidade)}
                                        onChange={() => handleUnidadeToggle(unidade)}
                                    />
                                    <span>{unidade}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Meta Mensal (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.meta_mensal}
                                onChange={(e) => setFormData({ ...formData, meta_mensal: e.target.value })}
                                placeholder="5000.00"
                            />
                            <small>Deixe vazio para usar meta do contrato</small>
                        </div>
                        <div className="form-group">
                            <label>Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                {statusOptions.map(status => (
                                    <option key={status} value={status}>
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Tipo de Colaborador</label>
                            <select
                                value={formData.tipo_colaborador}
                                onChange={(e) => setFormData({ ...formData, tipo_colaborador: e.target.value })}
                            >
                                <option value="prestador_servico">Prestador de Serviço</option>
                                <option value="clt">CLT</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.valor_fixo}
                                onChange={(e) => setFormData({ ...formData, valor_fixo: e.target.checked })}
                            />
                            <span>Valor Fixo (não varia por produção)</span>
                        </label>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            <Save size={18} />
                            <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProviderEditModal;
