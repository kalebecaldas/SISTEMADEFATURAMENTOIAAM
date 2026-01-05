import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Upload, Download, Trash2, Search, Filter, File, AlertTriangle, CheckCircle, Clock, Plus } from 'lucide-react';
import api from '../services/api';
import '../styles/Documents.css';

const Documents = () => {
    const { prestadorId } = useParams();
    const [documents, setDocuments] = useState([]);
    const [requests, setRequests] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('documents'); // 'documents', 'requests', or 'contracts'

    // Upload Modal State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadData, setUploadData] = useState({
        tipo: 'documento_geral',
        descricao: '',
        arquivo: null,
        solicitacao_id: null
    });
    const [uploadStatus, setUploadStatus] = useState(null);
    const [uploadMessage, setUploadMessage] = useState('');

    // Request Modal State (Admin only)
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestData, setRequestData] = useState({
        tipo: 'cnh',
        descricao: ''
    });

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.tipo === 'admin';
    const targetId = prestadorId || user.id;

    useEffect(() => {
        fetchData();
    }, [targetId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [docsRes, reqsRes] = await Promise.all([
                api.get(`/documentos/prestador/${targetId}`),
                api.get(`/documentos/solicitacoes/${targetId}`)
            ]);
            setDocuments(docsRes.data.documentos);
            setRequests(reqsRes.data);
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        setUploadData({ ...uploadData, arquivo: e.target.files[0] });
    };

    const openUploadModal = (solicitacao = null) => {
        if (solicitacao) {
            setUploadData({
                tipo: solicitacao.tipo,
                descricao: `Resposta à solicitação: ${solicitacao.descricao || solicitacao.tipo}`,
                arquivo: null,
                solicitacao_id: solicitacao.id
            });
        } else {
            setUploadData({
                tipo: 'documento_geral',
                descricao: '',
                arquivo: null,
                solicitacao_id: null
            });
        }
        setShowUploadModal(true);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadData.arquivo) {
            alert('Selecione um arquivo');
            return;
        }

        setUploadStatus('uploading');
        const formData = new FormData();
        formData.append('prestador_id', targetId);
        formData.append('tipo', uploadData.tipo);
        formData.append('descricao', uploadData.descricao);
        formData.append('arquivo', uploadData.arquivo);
        if (uploadData.solicitacao_id) {
            formData.append('solicitacao_id', uploadData.solicitacao_id);
        }

        try {
            await api.post('/documentos/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadStatus('success');
            setUploadMessage('Documento enviado com sucesso!');
            fetchData();
            setTimeout(() => {
                setShowUploadModal(false);
                setUploadStatus(null);
            }, 2000);
        } catch (error) {
            setUploadStatus('error');
            setUploadMessage(error.response?.data?.error || 'Erro ao enviar documento');
        }
    };

    const handleCreateRequest = async (e) => {
        e.preventDefault();
        try {
            await api.post('/documentos/solicitar', {
                prestador_id: targetId,
                ...requestData
            });
            setShowRequestModal(false);
            fetchData();
            alert('Solicitação criada com sucesso!');
        } catch (error) {
            console.error('Erro ao criar solicitação:', error);
            alert('Erro ao criar solicitação');
        }
    };

    const handleDownload = async (id, filename) => {
        try {
            const response = await api.get(`/documentos/download/${id}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Erro ao baixar arquivo:', error);
            alert('Erro ao baixar arquivo');
        }
    };

    const handleDelete = async (id) => {
        if (!isAdmin) return;
        if (!window.confirm('Tem certeza que deseja excluir este documento?')) return;

        try {
            await api.delete(`/documentos/${id}`);
            fetchData();
        } catch (error) {
            console.error('Erro ao excluir documento:', error);
            alert('Erro ao excluir documento');
        }
    };

    const handleApproveRequest = async (id) => {
        if (!window.confirm('Confirmar aprovação do documento?')) return;
        try {
            await api.put(`/documentos/solicitacoes/${id}/status`, { status: 'aprovado' });
            fetchData();
        } catch (error) {
            console.error('Erro ao aprovar:', error);
        }
    };

    const filteredDocuments = documents.filter(doc =>
        doc.nome_arquivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.descricao && doc.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getIcon = (mimeType) => {
        if (mimeType?.includes('pdf')) return <FileText size={24} color="#F44336" />;
        if (mimeType?.includes('image')) return <FileText size={24} color="#2196F3" />;
        if (mimeType?.includes('word')) return <FileText size={24} color="#2979FF" />;
        return <File size={24} color="#757575" />;
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'aprovado': return <span className="status-badge approved"><CheckCircle size={14} /> Aprovado</span>;
            case 'enviado': return <span className="status-badge warning"><Clock size={14} /> Enviado</span>;
            case 'rejeitado': return <span className="status-badge rejected"><AlertTriangle size={14} /> Rejeitado</span>;
            default: return <span className="status-badge pending"><Clock size={14} /> Pendente</span>;
        }
    };

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <h1>Documentos</h1>
                <p>Gerencie os documentos {isAdmin && prestadorId ? 'do prestador' : 'da sua conta'}</p>
            </div>

            <div className="glass-card toolbar">
                <div className="tabs">
                    <button
                        className={`tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
                        onClick={() => setActiveTab('documents')}
                    >
                        Documentos
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                        onClick={() => setActiveTab('requests')}
                    >
                        Solicitações {requests.filter(r => r.status === 'pendente').length > 0 && <span className="badge">{requests.filter(r => r.status === 'pendente').length}</span>}
                    </button>
                </div>

                {activeTab === 'documents' && (
                    <div className="search-box">
                        <Search size={20} />
                        <input
                            type="text"
                            placeholder="Buscar documentos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}

                <div className="actions">
                    {activeTab === 'documents' ? (
                        <button className="btn-primary" onClick={() => openUploadModal()}>
                            <Upload size={20} />
                            <span>Novo Documento</span>
                        </button>
                    ) : isAdmin ? (
                        <button className="btn-primary" onClick={() => setShowRequestModal(true)}>
                            <Plus size={20} />
                            <span>Solicitar Documento</span>
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="glass-card table-container">
                {loading ? (
                    <div className="loading">Carregando...</div>
                ) : activeTab === 'documents' ? (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Tipo</th>
                                <th>Nome</th>
                                <th>Descrição</th>
                                <th>Data Upload</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDocuments.map((doc) => (
                                <tr key={doc.id}>
                                    <td>
                                        <div className="doc-type">
                                            {getIcon(doc.mime_type)}
                                            <span style={{ marginLeft: '10px', textTransform: 'capitalize' }}>
                                                {doc.tipo.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </td>
                                    <td>{doc.nome_arquivo}</td>
                                    <td>{doc.descricao || '-'}</td>
                                    <td>{new Date(doc.data_upload).toLocaleDateString('pt-BR')}</td>
                                    <td>
                                        <div className="action-buttons">
                                            <button
                                                className="btn-icon-sm"
                                                title="Baixar"
                                                onClick={() => handleDownload(doc.id, doc.nome_arquivo)}
                                            >
                                                <Download size={18} />
                                            </button>
                                            {isAdmin && (
                                                <button
                                                    className="btn-icon-sm danger"
                                                    title="Excluir"
                                                    onClick={() => handleDelete(doc.id)}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredDocuments.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="empty-state">Nenhum documento encontrado</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Tipo Solicitado</th>
                                <th>Descrição</th>
                                <th>Status</th>
                                <th>Data Solicitação</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map((req) => (
                                <tr key={req.id}>
                                    <td style={{ textTransform: 'capitalize' }}>{req.tipo.replace('_', ' ')}</td>
                                    <td>{req.descricao || '-'}</td>
                                    <td>{getStatusBadge(req.status)}</td>
                                    <td>{new Date(req.created_at).toLocaleDateString('pt-BR')}</td>
                                    <td>
                                        <div className="action-buttons">
                                            {req.status === 'pendente' && !isAdmin && (
                                                <button
                                                    className="btn-primary-sm"
                                                    onClick={() => openUploadModal(req)}
                                                >
                                                    <Upload size={14} /> Enviar
                                                </button>
                                            )}
                                            {req.status === 'enviado' && isAdmin && (
                                                <button
                                                    className="btn-icon-sm success"
                                                    title="Aprovar"
                                                    onClick={() => handleApproveRequest(req.id)}
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                            )}
                                            {req.documento_id && (
                                                <button
                                                    className="btn-icon-sm"
                                                    title="Ver Documento"
                                                    onClick={() => handleDownload(req.documento_id, `doc-${req.id}`)}
                                                >
                                                    <FileText size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {requests.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="empty-state">Nenhuma solicitação encontrada</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="modal-overlay">
                    <div className="modal glass-card">
                        <h2>{uploadData.solicitacao_id ? 'Atender Solicitação' : 'Upload de Documento'}</h2>

                        {uploadStatus === 'success' ? (
                            <div className="success-message">
                                <p>{uploadMessage}</p>
                            </div>
                        ) : (
                            <form onSubmit={handleUpload}>
                                {uploadStatus === 'error' && (
                                    <div className="error-message">{uploadMessage}</div>
                                )}

                                <div className="form-group">
                                    <label>Tipo de Documento</label>
                                    <select
                                        value={uploadData.tipo}
                                        onChange={(e) => setUploadData({ ...uploadData, tipo: e.target.value })}
                                        disabled={!!uploadData.solicitacao_id}
                                    >
                                        <option value="documento_geral">Documento Geral</option>
                                        <option value="cnh">CNH</option>
                                        <option value="diploma">Diploma</option>
                                        <option value="comprovante_residencia">Comprovante de Residência</option>
                                        <option value="contrato">Contrato</option>
                                        <option value="outros">Outros</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Descrição</label>
                                    <input
                                        type="text"
                                        value={uploadData.descricao}
                                        onChange={(e) => setUploadData({ ...uploadData, descricao: e.target.value })}
                                        placeholder="Ex: CNH 2024"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Arquivo</label>
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        required
                                    />
                                </div>

                                <div className="modal-actions">
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => setShowUploadModal(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        disabled={uploadStatus === 'uploading'}
                                    >
                                        {uploadStatus === 'uploading' ? 'Enviando...' : 'Enviar'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Request Modal (Admin) */}
            {showRequestModal && (
                <div className="modal-overlay">
                    <div className="modal glass-card">
                        <h2>Solicitar Documento</h2>
                        <form onSubmit={handleCreateRequest}>
                            <div className="form-group">
                                <label>Tipo de Documento</label>
                                <select
                                    value={requestData.tipo}
                                    onChange={(e) => setRequestData({ ...requestData, tipo: e.target.value })}
                                >
                                    <option value="cnh">CNH</option>
                                    <option value="diploma">Diploma</option>
                                    <option value="comprovante_residencia">Comprovante de Residência</option>
                                    <option value="contrato_social">Contrato Social</option>
                                    <option value="outros">Outros</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Descrição / Instruções</label>
                                <textarea
                                    value={requestData.descricao}
                                    onChange={(e) => setRequestData({ ...requestData, descricao: e.target.value })}
                                    placeholder="Ex: Favor enviar cópia autenticada..."
                                    rows="3"
                                />
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowRequestModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary">
                                    Criar Solicitação
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Documents;
