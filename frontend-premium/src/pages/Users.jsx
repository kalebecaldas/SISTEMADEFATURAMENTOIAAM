import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Edit2, Trash2, Shield, Lock, Unlock, Search, Key } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import '../styles/Users.css';

const Users = () => {
    const toast = useToast();
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState('prestador');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [passwordUser, setPasswordUser] = useState(null);
    const [formData, setFormData] = useState({
        email: '',
        nome: '',
        tipo: 'prestador',
        senha_temporaria: ''
    });
    const [passwordData, setPasswordData] = useState({
        senha: '',
        senha_atual: '',
        confirmar_senha: ''
    });

    useEffect(() => {
        fetchUsers();
    }, [activeTab, statusFilter]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params = {};
            if (activeTab !== 'all') params.tipo = activeTab;
            if (statusFilter !== 'all') params.status = statusFilter;

            const response = await api.get('/users', { params });
            setUsers(response.data.usuarios);
        } catch (error) {
            console.error('Erro ao buscar usuários:', error);
            toast.error('Erro ao carregar usuários', { detail: error.response?.data?.error });
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/users', formData);
            toast.success('Usuário criado com sucesso');
            setShowModal(false);
            resetForm();
            fetchUsers();
        } catch (error) {
            toast.error('Erro ao criar usuário', { detail: error.response?.data?.error });
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/users/${editingUser.id}`, formData);
            toast.success('Usuário atualizado com sucesso');
            setShowModal(false);
            resetForm();
            fetchUsers();
        } catch (error) {
            toast.error('Erro ao atualizar usuário', { detail: error.response?.data?.error });
        }
    };

    const handleDelete = async (id, email) => {
        const ok = await confirm({
            title: 'Deletar usuário?',
            message: `O usuário ${email} será removido permanentemente.`,
            confirmLabel: 'Deletar',
            variant: 'danger',
        });
        if (!ok) return;

        try {
            await api.delete(`/users/${id}`);
            toast.success('Usuário deletado com sucesso');
            fetchUsers();
        } catch (error) {
            toast.error('Erro ao deletar usuário', { detail: error.response?.data?.error });
        }
    };

    const handleToggleActive = async (id, currentStatus) => {
        try {
            await api.put(`/users/${id}`, { ativo: !currentStatus });
            fetchUsers();
        } catch (error) {
            toast.error('Erro ao atualizar status', { detail: error.response?.data?.error });
        }
    };

    const handleChangeRole = async (id, newRole) => {
        const ok = await confirm({
            title: `Mudar papel para ${newRole}?`,
            message: 'O nível de acesso do usuário será alterado.',
            confirmLabel: 'Mudar papel',
        });
        if (!ok) return;

        try {
            await api.patch(`/users/${id}/role`, { tipo: newRole });
            toast.success(`Papel alterado para ${newRole}`);
            fetchUsers();
        } catch (error) {
            toast.error('Erro ao mudar papel', { detail: error.response?.data?.error });
        }
    };

    const openCreateModal = () => {
        resetForm();
        setEditingUser(null);
        setShowModal(true);
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setFormData({
            email: user.email,
            nome: user.nome,
            tipo: user.tipo,
            senha_temporaria: ''
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({
            email: '',
            nome: '',
            tipo: 'prestador',
            senha_temporaria: ''
        });
        setEditingUser(null);
    };

    const openPasswordModal = (user) => {
        setPasswordUser(user);
        setPasswordData({
            senha: '',
            senha_atual: '',
            confirmar_senha: ''
        });
        setShowPasswordModal(true);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();

        // Validar senhas
        if (passwordData.senha !== passwordData.confirmar_senha) {
            toast.warning('As senhas não coincidem');
            return;
        }

        if (passwordData.senha.length < 6) {
            toast.warning('A senha deve ter no mínimo 6 caracteres');
            return;
        }

        try {
            const payload = {
                senha: passwordData.senha
            };

            // Se está alterando a própria senha, incluir senha atual
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            if (currentUser.id === passwordUser.id) {
                if (!passwordData.senha_atual) {
                    toast.warning('Para alterar sua própria senha, informe a senha atual');
                    return;
                }
                payload.senha_atual = passwordData.senha_atual;
            }

            await api.patch(`/users/${passwordUser.id}/password`, payload);
            toast.success('Senha alterada com sucesso');
            setShowPasswordModal(false);
            setPasswordUser(null);
            setPasswordData({
                senha: '',
                senha_atual: '',
                confirmar_senha: ''
            });
        } catch (error) {
            toast.error('Erro ao alterar senha', { detail: error.response?.data?.error });
        }
    };

    const filteredUsers = users
        .filter(user =>
            user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            const nomeA = (a.nome || '').toLowerCase();
            const nomeB = (b.nome || '').toLowerCase();
            return nomeA.localeCompare(nomeB);
        });

    const getRoleBadge = (tipo) => {
        const badges = {
            master: { label: 'Master', class: 'badge-master' },
            admin: { label: 'Admin', class: 'badge-admin' },
            prestador: { label: 'Prestador', class: 'badge-prestador' }
        };
        return badges[tipo] || badges.prestador;
    };

    return (
        <div className="users-page">
            <div className="page-header">
                <div>
                    <h1>👥 Gestão de Usuários</h1>
                    <p>Gerencie prestadores, admins e masters</p>
                </div>
                <button className="btn-primary" onClick={openCreateModal}>
                    <Plus size={20} />
                    <span>Novo Usuário</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="glass-card tabs-container">
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'prestador' ? 'active' : ''}`}
                        onClick={() => setActiveTab('prestador')}
                    >
                        <span>Prestadores</span>
                    </button>
                    <button
                        className={`tab ${activeTab === 'admin' ? 'active' : ''}`}
                        onClick={() => setActiveTab('admin')}
                    >
                        <span>Admins</span>
                    </button>
                    <button
                        className={`tab ${activeTab === 'master' ? 'active' : ''}`}
                        onClick={() => setActiveTab('master')}
                    >
                        <span>Masters</span>
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="glass-card filters">
                <div className="filter-group">
                    <label>Status:</label>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">Todos</option>
                        <option value="ativo">Ativos</option>
                        <option value="inativo">Inativos</option>
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

            {/* Tabela */}
            <div className="glass-card">
                {loading ? (
                    <div className="loading">Carregando...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="empty-state">
                        <UsersIcon size={48} />
                        <p>Nenhum usuário encontrado</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => {
                                const badge = getRoleBadge(user.tipo);
                                return (
                                    <tr key={user.id}>
                                        <td>{user.nome || '-'}</td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span className={`role-badge ${badge.class}`}>
                                                <Shield size={14} />
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className={`status-badge ${user.ativo ? 'active' : 'inactive'}`}
                                                onClick={() => handleToggleActive(user.id, user.ativo)}
                                            >
                                                {user.ativo ? <Unlock size={14} /> : <Lock size={14} />}
                                                {user.ativo ? 'Ativo' : 'Inativo'}
                                            </button>
                                        </td>
                                        <td>
                                            <div className="actions">
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => openEditModal(user)}
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => openPasswordModal(user)}
                                                    title="Alterar Senha"
                                                >
                                                    <Key size={16} />
                                                </button>
                                                <button
                                                    className="btn-icon btn-danger"
                                                    onClick={() => handleDelete(user.id, user.email)}
                                                    title="Deletar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
                        <form onSubmit={editingUser ? handleUpdate : handleCreate}>
                            <div className="form-group">
                                <label>Email:</label>
                                <input
                                    type="email"
                                    required
                                    disabled={editingUser}
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Nome:</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Tipo:</label>
                                <select
                                    value={formData.tipo}
                                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                                >
                                    <option value="prestador">Prestador</option>
                                    <option value="admin">Admin</option>
                                    <option value="master">Master</option>
                                </select>
                            </div>
                            {!editingUser && (
                                <div className="form-group">
                                    <label>Senha Temporária (opcional):</label>
                                    <input
                                        type="password"
                                        placeholder="Deixe vazio para senha padrão"
                                        value={formData.senha_temporaria}
                                        onChange={(e) => setFormData({ ...formData, senha_temporaria: e.target.value })}
                                    />
                                </div>
                            )}
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingUser ? 'Atualizar' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Alteração de Senha */}
            {showPasswordModal && passwordUser && (
                <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>🔑 Alterar Senha</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Alterando senha de: <strong>{passwordUser.nome}</strong> ({passwordUser.email})
                        </p>
                        <form onSubmit={handleChangePassword}>
                            {(() => {
                                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                                const isOwnPassword = currentUser.id === passwordUser.id;

                                return isOwnPassword && (
                                    <div className="form-group">
                                        <label>Senha Atual:</label>
                                        <input
                                            type="password"
                                            required
                                            placeholder="Digite sua senha atual"
                                            value={passwordData.senha_atual}
                                            onChange={(e) => setPasswordData({ ...passwordData, senha_atual: e.target.value })}
                                        />
                                    </div>
                                );
                            })()}
                            <div className="form-group">
                                <label>Nova Senha:</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    placeholder="Mínimo 6 caracteres"
                                    value={passwordData.senha}
                                    onChange={(e) => setPasswordData({ ...passwordData, senha: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Confirmar Nova Senha:</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    placeholder="Digite a senha novamente"
                                    value={passwordData.confirmar_senha}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirmar_senha: e.target.value })}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowPasswordModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary">
                                    Alterar Senha
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
