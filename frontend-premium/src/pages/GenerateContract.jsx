import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Save } from 'lucide-react';
import api from '../services/api';
import '../styles/Invoices.css';

const GenerateContract = () => {
    const [prestadores, setPrestadores] = useState([]);
    const [modelos, setModelos] = useState([]);
    const [selectedPrestador, setSelectedPrestador] = useState('');
    const [selectedModelo, setSelectedModelo] = useState('');
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nome: '',
        endereco: '',
        cpf: '',
        data_assinatura: '',
        dia_pagamento: '',
        campo_custom: '',
        // Campos de estágio
        periodo_curso: '',
        universidade: '',
        curso: '',
        data_inicio: '',
        data_fim: '',
        valor_bolsa: '',
        horarios: ''
    });

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        try {
            // Carregar prestadores
            // A API retorna diretamente um array
            const resPrest = await api.get('/prestadores');
            setPrestadores(Array.isArray(resPrest.data) ? resPrest.data : []);

            // Carregar modelos
            // A API retorna um objeto com propriedade 'modelos'
            const resMod = await api.get('/contratos/modelos?ativo=true');
            setModelos(resMod.data?.modelos || []);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            // Se houver erro de autenticação ou outro problema, os arrays ficam vazios
            setPrestadores([]);
            setModelos([]);
            
            // Mostrar mensagem de erro se for problema de autenticação
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error('Erro de autenticação ao carregar prestadores');
            }
        }
    };

    const handlePrestadorChange = (e) => {
        const prestadorId = e.target.value;
        setSelectedPrestador(prestadorId);

        const prestador = prestadores.find(p => p.id === parseInt(prestadorId));
        if (prestador) {
            setFormData(prev => ({
                ...prev,
                nome: prestador.nome || '',
                email: prestador.email || '',
            }));
        }
    };

    const handleModeloChange = (e) => {
        setSelectedModelo(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await api.post('/contratos/gerar', {
                prestador_id: parseInt(selectedPrestador),
                modelo_id: parseInt(selectedModelo),
                dados: formData
            });

            alert('Contrato gerado com sucesso!');
            window.location.href = '/contratos';
        } catch (error) {
            console.error('Erro:', error);
            const errorMessage = error.response?.data?.error || 'Erro ao gerar contrato';
            alert(`Erro: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const modeloSelecionado = modelos.find(m => m.id === parseInt(selectedModelo));
    const isEstagio = modeloSelecionado?.tipo === 'estagio';

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <button
                    className="btn-icon"
                    onClick={() => window.history.back()}
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1>Gerar Novo Contrato</h1>
                    <p>Preencha os dados para gerar o contrato</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem' }}>
                <div className="form-grid">
                    <div className="form-group">
                        <label>Prestador *</label>
                        {prestadores.length === 0 ? (
                            <div style={{
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-muted)',
                                fontSize: '0.9rem'
                            }}>
                                Nenhum prestador cadastrado. Cadastre prestadores na página de Prestadores.
                            </div>
                        ) : (
                            <select
                                required
                                value={selectedPrestador}
                                onChange={handlePrestadorChange}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    width: '100%'
                                }}
                            >
                                <option value="">Selecione um prestador</option>
                                {prestadores.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.nome} - {p.email}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Tipo de Contrato *</label>
                        <select
                            required
                            value={selectedModelo}
                            onChange={handleModeloChange}
                            style={{
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-primary)',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                outline: 'none',
                                width: '100%'
                            }}
                        >
                            <option value="">Selecione um modelo</option>
                            {modelos.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.nome}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedModelo && (
                    <>
                        <hr style={{ margin: '2rem 0', opacity: 0.2 }} />

                        <h3 style={{ marginBottom: '1rem' }}>Dados do Contrato</h3>

                        <div className="form-grid">
                            <div className="form-group">
                                <label>Nome Completo *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Endereço *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.endereco}
                                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>CPF *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.cpf}
                                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                                    placeholder="000.000.000-00"
                                />
                            </div>

                            <div className="form-group">
                                <label>Data de Assinatura *</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.data_assinatura}
                                    onChange={(e) => setFormData({ ...formData, data_assinatura: e.target.value })}
                                />
                            </div>

                            {!isEstagio && (
                                <>
                                    <div className="form-group">
                                        <label>Dia do Pagamento (1-31)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="31"
                                            value={formData.dia_pagamento}
                                            onChange={(e) => setFormData({ ...formData, dia_pagamento: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Campo Adicional</label>
                                        <input
                                            type="text"
                                            value={formData.campo_custom}
                                            onChange={(e) => setFormData({ ...formData, campo_custom: e.target.value })}
                                        />
                                    </div>
                                </>
                            )}

                            {isEstagio && (
                                <>
                                    <div className="form-group">
                                        <label>Período do Curso</label>
                                        <input
                                            type="text"
                                            value={formData.periodo_curso}
                                            onChange={(e) => setFormData({ ...formData, periodo_curso: e.target.value })}
                                            placeholder="Ex: 9º período"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Universidade/Faculdade</label>
                                        <input
                                            type="text"
                                            value={formData.universidade}
                                            onChange={(e) => setFormData({ ...formData, universidade: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Curso</label>
                                        <input
                                            type="text"
                                            value={formData.curso}
                                            onChange={(e) => setFormData({ ...formData, curso: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Data de Início</label>
                                        <input
                                            type="date"
                                            value={formData.data_inicio}
                                            onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Data de Término</label>
                                        <input
                                            type="date"
                                            value={formData.data_fim}
                                            onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Valor da Bolsa</label>
                                        <input
                                            type="text"
                                            value={formData.valor_bolsa}
                                            onChange={(e) => setFormData({ ...formData, valor_bolsa: e.target.value })}
                                            placeholder="R$ 0,00"
                                        />
                                    </div>

                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>Horários</label>
                                        <textarea
                                            value={formData.horarios}
                                            onChange={(e) => setFormData({ ...formData, horarios: e.target.value })}
                                            rows="3"
                                            placeholder="Ex: Segunda a Sexta, 13:30 às 19:00"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => window.history.back()}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={loading}
                            >
                                {loading ? (
                                    'Gerando...'
                                ) : (
                                    <>
                                        <Save size={20} />
                                        <span>Gerar Contrato</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </form>
        </div>
    );
};

export default GenerateContract;
