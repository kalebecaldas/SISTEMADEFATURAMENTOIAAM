import React, { useState, useEffect } from 'react';
import { Send, Edit2, Check, X, Mail, Users, DollarSign, AlertCircle, FileText, Upload as UploadIcon } from 'lucide-react';
import api from '../services/api';
import ComprovantesModal from '../components/ComprovantesModal';
import '../styles/PaymentNotifications.css';

const PaymentNotifications = () => {
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [ano, setAno] = useState(new Date().getFullYear());
    const [dados, setDados] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editando, setEditando] = useState(null);
    const [valorEdit, setValorEdit] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [sending, setSending] = useState(false);
    const [comprovanteModal, setComprovanteModal] = useState(null);
    const [comprovantes, setComprovantes] = useState({});

    useEffect(() => {
        fetchDados();
    }, [mes, ano]);

    const fetchDados = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/pagamentos/${mes}/${ano}`);
            setDados(response.data.dados || []);
            // Fetch comprovantes for all colaboradores
            await fetchAllComprovantes(response.data.dados || []);
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            if (error.response?.status === 404) {
                setDados([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchAllComprovantes = async (dadosList) => {
        const comprovantesMap = {};
        for (const dado of dadosList) {
            try {
                const response = await api.get(`/comprovantes/${dado.prestador_id}/${mes}/${ano}`);
                if (response.data.comprovante) {
                    comprovantesMap[dado.prestador_id] = response.data.comprovante;
                }
            } catch (error) {
                // Comprovante não existe
            }
        }
        setComprovantes(comprovantesMap);
    };

    const handleEdit = (dado) => {
        setEditando(dado.id);
        setValorEdit(dado.valor_liquido);
        setObservacoes(dado.observacoes_edicao || '');
    };

    const handleSaveEdit = async (id) => {
        try {
            await api.put(`/pagamentos/editar/${id}`, {
                valor_liquido: parseFloat(valorEdit),
                observacoes
            });
            setEditando(null);
            setValorEdit('');
            setObservacoes('');
            fetchDados();
            alert('Valor atualizado com sucesso!');
        } catch (error) {
            alert('Erro ao atualizar valor: ' + (error.response?.data?.error || 'Erro desconhecido'));
        }
    };

    const handleCancelEdit = () => {
        setEditando(null);
        setValorEdit('');
        setObservacoes('');
    };

    const handleSendIndividual = async (prestadorId) => {
        // Verificar se tem comprovante
        if (!comprovantes[prestadorId]) {
            alert('É necessário enviar o comprovante antes de enviar o email!');
            return;
        }

        if (!window.confirm('Enviar email com comprovante de pagamento para este colaborador?')) return;

        setSending(true);
        try {
            // Rota de comprovantes (envia apenas o PDF anexado)
            await api.post('/comprovantes/enviar-email', {
                colaborador_id: prestadorId,
                mes,
                ano
            });
            alert('Email com comprovante enviado com sucesso!');
        } catch (error) {
            alert('Erro ao enviar email: ' + (error.response?.data?.error || 'Erro desconhecido'));
        } finally {
            setSending(false);
        }
    };

    const handleSendMass = async () => {
        // Filtrar apenas colaboradores com comprovante
        const comComprovante = dados.filter(d => comprovantes[d.prestador_id]);

        if (comComprovante.length === 0) {
            alert('Nenhum colaborador possui comprovante enviado!');
            return;
        }

        if (!window.confirm(`Enviar comprovantes para ${comComprovante.length} colaborador(es)?`)) return;

        setSending(true);
        let sucessos = 0;
        let erros = 0;

        try {
            for (const dado of comComprovante) {
                try {
                    await api.post('/comprovantes/enviar-email', {
                        colaborador_id: dado.prestador_id,
                        mes,
                        ano
                    });
                    sucessos++;
                } catch (error) {
                    console.error(`Erro ao enviar para ${dado.prestador_nome}:`, error);
                    erros++;
                }
                // Pequeno delay entre envios
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            alert(`Envios concluídos!\nSucessos: ${sucessos}\nErros: ${erros}`);
        } catch (error) {
            alert('Erro ao enviar emails: ' + (error.response?.data?.error || 'Erro desconhecido'));
        } finally {
            setSending(false);
        }
    };

    const handleComprovanteClick = (dado) => {
        setComprovanteModal({
            colaborador: {
                id: dado.prestador_id,
                nome: dado.prestador_nome
            },
            mes,
            ano
        });
    };

    const handleComprovanteUploadSuccess = () => {
        fetchDados(); // Refresh to update comprovante status
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const totalValores = dados.reduce((sum, d) => sum + parseFloat(d.valor_liquido || 0), 0);
    const metasBatidas = dados.filter(d => d.meta_batida).length;
    const comComprovante = dados.filter(d => comprovantes[d.prestador_id]).length;

    return (
        <div className="payment-notifications-page">
            <div className="page-header">
                <h1>💰 Enviar Comprovantes de Pagamento</h1>
                <button
                    className="btn-primary"
                    onClick={handleSendMass}
                    disabled={sending || comComprovante === 0}
                >
                    <Mail size={20} />
                    <span>Enviar Comprovantes ({comComprovante}/{dados.length})</span>
                </button>
            </div>

            {/* Filtros */}
            <div className="glass-card filters">
                <div className="filter-group">
                    <label>Mês:</label>
                    <select value={mes} onChange={(e) => setMes(parseInt(e.target.value))}>
                        <option value={1}>Janeiro</option>
                        <option value={2}>Fevereiro</option>
                        <option value={3}>Março</option>
                        <option value={4}>Abril</option>
                        <option value={5}>Maio</option>
                        <option value={6}>Junho</option>
                        <option value={7}>Julho</option>
                        <option value={8}>Agosto</option>
                        <option value={9}>Setembro</option>
                        <option value={10}>Outubro</option>
                        <option value={11}>Novembro</option>
                        <option value={12}>Dezembro</option>
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

            {/* Estatísticas */}
            {dados.length > 0 && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <Users size={24} />
                        <div>
                            <span className="stat-value">{dados.length}</span>
                            <span className="stat-label">Prestadores</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <DollarSign size={24} />
                        <div>
                            <span className="stat-value">{formatCurrency(totalValores)}</span>
                            <span className="stat-label">Total a Pagar</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <Check size={24} />
                        <div>
                            <span className="stat-value">{metasBatidas}</span>
                            <span className="stat-label">Metas Batidas</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabela */}
            <div className="glass-card table-container">
                {loading ? (
                    <div className="loading">Carregando...</div>
                ) : dados.length === 0 ? (
                    <div className="empty-state">
                        <AlertCircle size={48} />
                        <p>Nenhum dado encontrado para este período</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Colaborador</th>
                                <th>Especialidade</th>
                                <th>Valor Líquido</th>
                                <th>Meta</th>
                                <th>Faltas</th>
                                <th>Status</th>
                                <th>Comprovante</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dados.map((dado) => (
                                <tr key={dado.id}>
                                    <td>
                                        <div className="provider-info">
                                            <div className="avatar">
                                                {dado.prestador_nome.charAt(0)}
                                            </div>
                                            <div>
                                                <span className="name">{dado.prestador_nome}</span>
                                                <span className="email">{dado.prestador_email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{dado.especialidade || '-'}</td>
                                    <td>
                                        {editando === dado.id ? (
                                            <div className="edit-value">
                                                <input
                                                    type="number"
                                                    value={valorEdit}
                                                    onChange={(e) => setValorEdit(e.target.value)}
                                                    step="0.01"
                                                    className="value-input"
                                                />
                                                <input
                                                    type="text"
                                                    value={observacoes}
                                                    onChange={(e) => setObservacoes(e.target.value)}
                                                    placeholder="Observações (opcional)"
                                                    className="obs-input"
                                                />
                                                <div className="edit-actions">
                                                    <button
                                                        className="btn-icon success"
                                                        onClick={() => handleSaveEdit(dado.id)}
                                                        title="Salvar"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={handleCancelEdit}
                                                        title="Cancelar"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="value-display">
                                                <span className={dado.valor_editado ? 'edited' : ''}>
                                                    {formatCurrency(dado.valor_liquido)}
                                                </span>
                                                {dado.valor_editado && (
                                                    <span className="edited-badge" title={`Editado por ${dado.editor_nome || 'Admin'}`}>
                                                        ✏️ Editado
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`meta-badge ${dado.meta_batida ? 'success' : 'warning'}`}>
                                            {dado.meta_batida ? '✓ Batida' : '○ Não Batida'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={dado.faltas > 0 ? 'text-danger' : 'text-success'}>
                                            {dado.faltas || 0}
                                        </span>
                                    </td>
                                    <td>
                                        {formatCurrency(dado.meta_mensal || 5000)}
                                    </td>
                                    <td>
                                        <button
                                            className={`comprovante-btn ${comprovantes[dado.prestador_id] ? 'success' : 'pending'}`}
                                            onClick={() => handleComprovanteClick(dado)}
                                            title={comprovantes[dado.prestador_id] ? 'Comprovante enviado - Clique para visualizar' : 'Comprovante pendente - Clique para enviar'}
                                        >
                                            {comprovantes[dado.prestador_id] ? (
                                                <>
                                                    <FileText size={18} />
                                                    <span>Enviado</span>
                                                </>
                                            ) : (
                                                <>
                                                    <UploadIcon size={18} />
                                                    <span>Pendente</span>
                                                </>
                                            )}
                                        </button>
                                    </td>
                                    <td>
                                        <div className="actions">
                                            {editando !== dado.id && (
                                                <>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => handleEdit(dado)}
                                                        title="Editar Valor"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        className="btn-icon primary"
                                                        onClick={() => handleSendIndividual(dado.prestador_id)}
                                                        disabled={sending || !comprovantes[dado.prestador_id]}
                                                        title={comprovantes[dado.prestador_id] ? "Enviar Email com Comprovante" : "Envie o comprovante primeiro"}
                                                        style={{
                                                            opacity: comprovantes[dado.prestador_id] ? 1 : 0.4,
                                                            cursor: comprovantes[dado.prestador_id] ? 'pointer' : 'not-allowed'
                                                        }}
                                                    >
                                                        <Send size={18} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal de Comprovantes */}
            {comprovanteModal && (
                <ComprovantesModal
                    colaborador={comprovanteModal.colaborador}
                    mes={comprovanteModal.mes}
                    ano={comprovanteModal.ano}
                    onClose={() => setComprovanteModal(null)}
                    onUploadSuccess={handleComprovanteUploadSuccess}
                />
            )}
        </div>
    );
};

export default PaymentNotifications;
