import React, { useState } from 'react';
import { Upload, X, Eye, Download, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';
import '../styles/ComprovantesModal.css';

const ComprovantesModal = ({ colaborador, mes, ano, onClose, onUploadSuccess }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [comprovante, setComprovante] = useState(null);
    const [viewerOpen, setViewerOpen] = useState(false);

    React.useEffect(() => {
        fetchComprovante();
    }, []);

    const fetchComprovante = async () => {
        try {
            const response = await api.get(`/comprovantes/${colaborador.id}/${mes}/${ano}`);
            if (response.data.comprovante) {
                setComprovante(response.data.comprovante);
            }
        } catch (error) {
            console.error('Erro ao buscar comprovante:', error);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            // Validar tipo
            const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
            if (!validTypes.includes(selectedFile.type)) {
                alert('Apenas arquivos PDF e imagens são permitidos');
                return;
            }
            // Validar tamanho (5MB)
            if (selectedFile.size > 5 * 1024 * 1024) {
                alert('Arquivo muito grande. Máximo: 5MB');
                return;
            }
            setFile(selectedFile);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            alert('Selecione um arquivo');
            return;
        }

        setLoading(true);
        const formData = new FormData();
        formData.append('comprovante', file);
        formData.append('colaborador_id', colaborador.id);
        formData.append('mes', mes);
        formData.append('ano', ano);

        try {
            await api.post('/comprovantes/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('Comprovante enviado com sucesso!');
            setFile(null);
            await fetchComprovante();
            if (onUploadSuccess) onUploadSuccess();
        } catch (error) {
            alert('Erro ao enviar comprovante: ' + (error.response?.data?.error || 'Erro desconhecido'));
        } finally {
            setLoading(false);
        }
    };

    const handleView = () => {
        setViewerOpen(true);
    };

    const handleDownload = async () => {
        try {
            const response = await api.get(`/comprovantes/${colaborador.id}/${mes}/${ano}/download`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `comprovante-${mes}-${ano}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert('Erro ao baixar comprovante');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Tem certeza que deseja excluir este comprovante?')) return;

        try {
            await api.delete(`/comprovantes/${comprovante.id}`);
            alert('Comprovante excluído com sucesso');
            setComprovante(null);
            if (onUploadSuccess) onUploadSuccess();
        } catch (error) {
            alert('Erro ao excluir comprovante');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Comprovante de Pagamento</h2>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="comprovante-info">
                        <p><strong>Colaborador:</strong> {colaborador.nome}</p>
                        <p><strong>Período:</strong> {mes}/{ano}</p>
                    </div>

                    {comprovante ? (
                        <div className="comprovante-exists">
                            <div className="success-badge">
                                <CheckCircle size={48} color="#4CAF50" />
                                <p>Comprovante enviado</p>
                                <small>Enviado em: {new Date(comprovante.data_envio).toLocaleDateString('pt-BR')}</small>
                            </div>

                            <div className="comprovante-actions">
                                <button className="btn-secondary" onClick={handleView}>
                                    <Eye size={18} />
                                    <span>Visualizar</span>
                                </button>
                                <button className="btn-secondary" onClick={handleDownload}>
                                    <Download size={18} />
                                    <span>Download</span>
                                </button>
                                <button className="btn-danger" onClick={handleDelete}>
                                    <X size={18} />
                                    <span>Excluir</span>
                                </button>
                            </div>

                            <hr style={{ margin: '20px 0' }} />
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                Para substituir o comprovante, faça upload de um novo arquivo abaixo:
                            </p>
                        </div>
                    ) : (
                        <div className="no-comprovante">
                            <AlertCircle size={48} color="#ff9800" />
                            <p>Nenhum comprovante enviado ainda</p>
                        </div>
                    )}

                    <div className="upload-section">
                        <div className="dropzone">
                            <Upload size={32} />
                            <p>Arraste ou clique para selecionar o arquivo</p>
                            <small>PDF, PNG, JPG (máx 5MB)</small>
                            <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                                id="file-input"
                            />
                            <label htmlFor="file-input" className="btn-secondary" style={{ marginTop: '10px' }}>
                                Selecionar Arquivo
                            </label>
                        </div>

                        {file && (
                            <div className="selected-file">
                                <p>📄 {file.name}</p>
                                <small>{(file.size / 1024).toFixed(2)} KB</small>
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>
                        Fechar
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleUpload}
                        disabled={!file || loading}
                    >
                        {loading ? 'Enviando...' : 'Enviar Comprovante'}
                    </button>
                </div>
            </div>

            {/* Viewer Modal */}
            {viewerOpen && comprovante && (
                <div className="modal-overlay" onClick={() => setViewerOpen(false)}>
                    <div className="viewer-modal glass-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Visualizar Comprovante</h3>
                            <button className="btn-icon" onClick={() => setViewerOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="viewer-content">
                            <iframe
                                src={`${api.defaults.baseURL}/comprovantes/${colaborador.id}/${mes}/${ano}/view`}
                                title="Comprovante"
                                style={{ width: '100%', height: '600px', border: 'none' }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComprovantesModal;
