import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, XCircle, Mail, AlertCircle, Send, Clock } from 'lucide-react';
import api from '../services/api';
import '../styles/InvoiceDashboard.css';

const InvoiceDashboard = () => {
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [ano, setAno] = useState(new Date().getFullYear());
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sending, setSending] = useState(false);
    const [selectedProviders, setSelectedProviders] = useState([]);
    const [selectAll, setSelectAll] = useState(false);

    useEffect(() => {
        fetchDados();
    }, [mes, ano]);

    const fetchDados = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/pagamentos/${mes}/${ano}`);
            // Transformar dados para o formato esperado
            const dados = response.data.dados || [];

            // Calcular estatísticas
            const estatisticas = {
                total: dados.length,
                enviadas: dados.filter(d => d.comprovante_enviado).length,
                pendentes: dados.filter(d => !d.comprovante_enviado).length,
                aprovadas: 0 // TODO: implementar quando tiver aprovação de notas
            };

            // Transformar para formato de prestadores
            const prestadores = dados.map(d => ({
                id: d.id, // Preservar o ID único do registro
                prestador_id: d.prestador_id,
                nome: d.prestador_nome,
                email: d.prestador_email,
                especialidade: d.especialidade,
                valor_liquido: d.valor_liquido,
                nota_enviada: false, // TODO: buscar de notas_fiscais
                nota_status: 'pendente',
                data_envio: null
            }));

            setDados({ estatisticas, prestadores });
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            setDados(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSendReminder = async (prestadorId, prestadorEmail) => {
        if (!window.confirm(`Enviar email com valores para ${prestadorEmail}?`)) return;

        setSending(true);
        try {
            // Enviar email completo com valores (Controle de Envios)
            await api.post(`/pagamentos/enviar-email/${prestadorId}/${mes}/${ano}`);
            alert('Email enviado com sucesso!');
        } catch (error) {
            alert('Erro ao enviar email: ' + (error.response?.data?.error || 'Erro desconhecido'));
        } finally {
            setSending(false);
        }
    };

    const handleSendMassReminder = async () => {
        const pendentes = dados?.prestadores.filter(p => !p.nota_enviada) || [];
        if (pendentes.length === 0) {
            alert('Não há prestadores pendentes');
            return;
        }

        if (!window.confirm(`Enviar lembrete para ${pendentes.length} prestadores?`)) return;

        setSending(true);
        try {
            // TODO: Implementar rota de lembrete em massa
            await api.post(`/invoices/reminder-mass/${mes}/${ano}`);
            alert(`Lembretes enviados para ${pendentes.length} prestadores!`);
        } catch (error) {
            alert('Erro ao enviar lembretes: ' + (error.response?.data?.error || 'Erro desconhecido'));
        } finally {
            setSending(false);
        }
    };

    const handleSendPayments = async () => {
        const total = dados?.estatisticas.total || 0;
        const isAllSelected = selectAll || selectedProviders.length === total;
        const count = isAllSelected ? total : selectedProviders.length;

        if (count === 0) {
            alert('Não há prestadores para enviar');
            return;
        }

        const message = isAllSelected
            ? `Enviar comprovantes de pagamento para todos os ${total} prestadores?`
            : `Enviar comprovantes para ${count} prestador(es) selecionado(s)?`;

        if (!window.confirm(message)) return;

        setSending(true);

        try {
            if (isAllSelected) {
                // Enviar para todos
                const response = await api.post(`/pagamentos/enviar-email-massa/${mes}/${ano}`);
                alert(response.data.message || 'Emails enviados com sucesso!');
            } else {
                // Enviar para selecionados
                let sucessos = 0;
                let erros = 0;

                for (const prestadorId of selectedProviders) {
                    try {
                        await api.post(`/pagamentos/enviar-email/${prestadorId}/${mes}/${ano}`);
                        sucessos++;
                    } catch (error) {
                        console.error(`Erro ao enviar para prestador ${prestadorId}:`, error);
                        erros++;
                    }
                }

                alert(`Envios concluídos!\nSucessos: ${sucessos}\nErros: ${erros}`);
            }

            setSelectedProviders([]);
            setSelectAll(false);
            fetchDados();
        } catch (error) {
            alert('Erro ao enviar emails: ' + (error.response?.data?.error || 'Erro desconhecido'));
        } finally {
            setSending(false);
        }
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedProviders([]);
        } else {
            const allIds = filteredPrestadores.map(p => p.prestador_id);
            setSelectedProviders(allIds);
        }
        setSelectAll(!selectAll);
    };

    const handleSelectProvider = (prestadorId) => {
        if (selectedProviders.includes(prestadorId)) {
            setSelectedProviders(selectedProviders.filter(id => id !== prestadorId));
            setSelectAll(false);
        } else {
            const newSelected = [...selectedProviders, prestadorId];
            setSelectedProviders(newSelected);

            // Atualizar selectAll se todos foram selecionados manualmente
            if (newSelected.length === filteredPrestadores.length) {
                setSelectAll(true);
            }
        }
    };

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

    const filteredPrestadores = dados?.prestadores.filter(p =>
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    return (
        <div className="invoice-dashboard">
            {/* Filtros */}
            <div className="glass-card filters" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: '1.5rem', flex: 1, flexWrap: 'wrap' }}>
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
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-group search">
                        <label>Buscar:</label>
                        <input
                            type="text"
                            placeholder="Nome ou email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="action-buttons-group">
                    <button
                        className="btn-primary btn-send-dynamic"
                        onClick={handleSendPayments}
                        disabled={sending || !dados || selectedProviders.length === 0}
                    >
                        <Mail size={20} />
                        <span>
                            {selectAll || selectedProviders.length === (dados?.estatisticas?.total || 0)
                                ? `Enviar para Todos (${dados?.estatisticas?.total || 0})`
                                : `Enviar para Selecionados (${selectedProviders.length})`
                            }
                        </span>
                    </button>
                </div>
            </div>

            {/* Estatísticas */}
            {dados && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <Calendar size={24} />
                        <div>
                            <span className="stat-value">{dados.estatisticas.total}</span>
                            <span className="stat-label">Total de Prestadores</span>
                        </div>
                    </div>
                    <div className="stat-card success">
                        <CheckCircle size={24} />
                        <div>
                            <span className="stat-value">{dados.estatisticas.enviadas}</span>
                            <span className="stat-label">Notas Enviadas</span>
                        </div>
                    </div>
                    <div className="stat-card warning">
                        <XCircle size={24} />
                        <div>
                            <span className="stat-value">{dados.estatisticas.pendentes}</span>
                            <span className="stat-label">Pendentes</span>
                        </div>
                    </div>
                    <div className="stat-card approved">
                        <CheckCircle size={24} />
                        <div>
                            <span className="stat-value">{dados.estatisticas.aprovadas}</span>
                            <span className="stat-label">Aprovadas</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabela */}
            <div className="glass-card table-container">
                {loading ? (
                    <div className="loading">Carregando...</div>
                ) : !dados || filteredPrestadores.length === 0 ? (
                    <div className="empty-state">
                        <AlertCircle size={48} />
                        <p>Nenhum prestador encontrado para este período</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectAll}
                                        onChange={handleSelectAll}
                                        title="Selecionar todos"
                                    />
                                </th>
                                <th>Prestador</th>
                                <th>Especialidade</th>
                                <th>Valor</th>
                                <th>Status Nota</th>
                                <th>Data Envio</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPrestadores.map((prestador) => (
                                <tr key={prestador.id} className={prestador.nota_enviada ? 'sent' : 'pending'}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedProviders.includes(prestador.prestador_id)}
                                            onChange={() => handleSelectProvider(prestador.prestador_id)}
                                        />
                                    </td>
                                    <td>
                                        <div className="provider-info">
                                            <div className="avatar">
                                                {prestador.nome.charAt(0)}
                                            </div>
                                            <div>
                                                <span className="name">{prestador.nome}</span>
                                                <span className="email">{prestador.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{prestador.especialidade || '-'}</td>
                                    <td>
                                        <span className="value">{formatCurrency(prestador.valor_liquido)}</span>
                                    </td>
                                    <td>
                                        {prestador.nota_enviada ? (
                                            <span className={`status-badge ${prestador.nota_status || 'enviada'}`}>
                                                {prestador.nota_status === 'aprovado' ? (
                                                    <><CheckCircle size={14} /> Aprovada</>
                                                ) : prestador.nota_status === 'rejeitado' ? (
                                                    <><XCircle size={14} /> Rejeitada</>
                                                ) : (
                                                    <><Clock size={14} /> Enviada</>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="status-badge pendente">
                                                <AlertCircle size={14} />
                                                Pendente
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {prestador.data_envio ?
                                            new Date(prestador.data_envio).toLocaleDateString('pt-BR') :
                                            '-'
                                        }
                                    </td>
                                    <td>
                                        <div className="actions">
                                            {!prestador.nota_enviada && (
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handleSendReminder(prestador.prestador_id, prestador.email)}
                                                    disabled={sending}
                                                    title="Enviar Email com Valores"
                                                >
                                                    <Mail size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div >
    );
};

export default InvoiceDashboard;
