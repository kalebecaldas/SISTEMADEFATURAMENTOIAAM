import { useState } from 'react';
import { X, Users, UserPlus, AlertCircle, Check, Clock, Calendar } from 'lucide-react';
import '../styles/UploadConfirmationModal.css';

function UploadConfirmationModal({ isOpen, onClose, onConfirm, data }) {
    if (!isOpen || !data) return null;

    const { novos, existentes, resumo } = data;

    return (
        <div className="upload-confirmation-overlay">
            <div className="upload-confirmation-modal">
                <div className="modal-header">
                    <div>
                        <h2>Confirmar Upload</h2>
                        <p>Revise os prestadores antes de salvar</p>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Resumo */}
                    <div className="summary-section">
                        <div className="summary-card">
                            <Users size={20} />
                            <div>
                                <span className="summary-label">Total de Prestadores</span>
                                <span className="summary-value">{resumo.total_prestadores}</span>
                            </div>
                        </div>
                        <div className="summary-card new">
                            <UserPlus size={20} />
                            <div>
                                <span className="summary-label">Novos (criar login)</span>
                                <span className="summary-value">{resumo.novos}</span>
                            </div>
                        </div>
                        <div className="summary-card existing">
                            <Check size={20} />
                            <div>
                                <span className="summary-label">Existentes</span>
                                <span className="summary-value">{resumo.existentes}</span>
                            </div>
                        </div>
                        <div className="summary-card">
                            <Clock size={20} />
                            <div>
                                <span className="summary-label">Turnos</span>
                                <span className="summary-value">{resumo.total_vinculos}</span>
                            </div>
                        </div>
                        <div className="summary-card">
                            <Calendar size={20} />
                            <div>
                                <span className="summary-label">Mês</span>
                                <span className="summary-value">{resumo.mes_referencia || 'Atual'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Prestadores Novos */}
                    {novos.length > 0 && (
                        <div className="providers-section">
                            <h3><UserPlus size={18} /> Prestadores Novos ({novos.length})</h3>
                            <p className="section-description">
                                Estes prestadores receberão um email para criar senha e acessar o sistema
                            </p>
                            <div className="providers-list">
                                {novos.map((prestador, idx) => (
                                    <div key={prestador.email || `novo-${idx}`} className="provider-card new">
                                        <div className="provider-header">
                                            <div>
                                                <strong>{prestador.nome}</strong>
                                                <span className="provider-email">{prestador.email}</span>
                                            </div>
                                            <span className="badge new-badge">NOVO</span>
                                        </div>
                                        <div className="vinculos-list">
                                            {prestador.vinculos.map((vinculo, vIdx) => (
                                                <div key={`${prestador.email || idx}-vinculo-${vIdx}-${vinculo.turno}-${vinculo.especialidade}-${vinculo.unidade}`} className="vinculo-item">
                                                    <span className="turno-badge">{vinculo.turno}</span>
                                                    <span>{vinculo.especialidade}</span>
                                                    <span className="unidade">{vinculo.unidade}</span>
                                                    {vinculo.meta_mensal && (
                                                        <span className="meta">
                                                            Meta: R$ {vinculo.meta_mensal.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Prestadores Existentes */}
                    {existentes.length > 0 && (
                        <div className="providers-section">
                            <h3><Check size={18} /> Prestadores Existentes ({existentes.length})</h3>
                            <p className="section-description">
                                Estes prestadores já possuem login. Novos vínculos serão adicionados.
                            </p>
                            <div className="providers-list">
                                {existentes.map((prestador, idx) => (
                                    <div key={prestador.email || prestador.id || `existente-${idx}`} className="provider-card existing">
                                        <div className="provider-header">
                                            <div>
                                                <strong>{prestador.nome}</strong>
                                                <span className="provider-email">{prestador.email}</span>
                                            </div>
                                            <span className="badge existing-badge">EXISTENTE</span>
                                        </div>

                                        {/* Vínculos Existentes */}
                                        {prestador.vinculos_existentes.length > 0 && (
                                            <div className="vinculos-group">
                                                <span className="vinculos-label">Vínculos atuais:</span>
                                                <div className="vinculos-list">
                                                    {prestador.vinculos_existentes.map((vinculo, vIdx) => (
                                                        <div key={`${prestador.email || prestador.id || idx}-existente-${vIdx}-${vinculo.turno}-${vinculo.especialidade}-${vinculo.unidade}`} className="vinculo-item existing">
                                                            <span className="turno-badge">{vinculo.turno}</span>
                                                            <span>{vinculo.especialidade}</span>
                                                            <span className="unidade">{vinculo.unidade}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Vínculos Novos */}
                                        {prestador.vinculos_novos.length > 0 && (
                                            <div className="vinculos-group">
                                                <span className="vinculos-label new">Novos vínculos a adicionar:</span>
                                                <div className="vinculos-list">
                                                    {prestador.vinculos_novos.map((vinculo, vIdx) => (
                                                        <div key={`${prestador.email || prestador.id || idx}-novo-${vIdx}-${vinculo.turno}-${vinculo.especialidade}-${vinculo.unidade}`} className="vinculo-item new">
                                                            <span className="turno-badge new">{vinculo.turno}</span>
                                                            <span>{vinculo.especialidade}</span>
                                                            <span className="unidade">{vinculo.unidade}</span>
                                                            {vinculo.meta_mensal && (
                                                                <span className="meta">
                                                                    Meta: R$ {vinculo.meta_mensal.toFixed(2)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Aviso */}
                    <div className="warning-box">
                        <AlertCircle size={20} />
                        <div>
                            <strong>Atenção:</strong>
                            <p>Ao confirmar, os dados serão salvos no banco de dados. Prestadores novos receberão email de confirmação.</p>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-cancel" onClick={onClose}>
                        Cancelar
                    </button>
                    <button className="btn-confirm" onClick={onConfirm}>
                        Confirmar e Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default UploadConfirmationModal;
