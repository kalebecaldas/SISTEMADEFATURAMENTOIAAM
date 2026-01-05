const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database/init');
const { authenticateToken, requireMaster, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../services/logger');

const router = express.Router();

/**
 * Listar todos os usuários (filtrar por tipo)
 */
router.get('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { tipo, status } = req.query;

    let query = db('usuarios').select('id', 'email', 'nome', 'tipo', 'ativo', 'created_at');

    if (tipo) {
        query = query.where({ tipo });
    }

    if (status === 'ativo') {
        query = query.where({ ativo: true });
    } else if (status === 'inativo') {
        query = query.where({ ativo: false });
    }

    const usuarios = await query.orderBy('created_at', 'desc');

    res.json({ usuarios });
}));

/**
 * Criar novo usuário
 */
router.post('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { email, nome, tipo, senha_temporaria } = req.body;

    // Validações
    if (!email || !nome || !tipo) {
        return res.status(400).json({ error: 'Email, nome e tipo são obrigatórios' });
    }

    if (!['prestador', 'admin', 'master'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo inválido' });
    }

    // Verificar se email já existe
    const existingUser = await db('usuarios').where({ email }).first();
    if (existingUser) {
        return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Senha padrão ou temporária
    const senha = senha_temporaria || 'Senha123';
    const senhaHash = bcrypt.hashSync(senha, 10);

    const [id] = await db('usuarios').insert({
        email,
        nome,
        tipo,
        senha: senhaHash,
        ativo: true
    });

    logger.audit('User created', req.user.email, 'create_user', {
        userId: id,
        tipo,
        createdEmail: email
    });

    res.json({
        message: 'Usuário criado com sucesso',
        id,
        senha_temporaria: senha
    });
}));

/**
 * Atualizar usuário
 */
router.put('/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { nome, tipo, ativo, senha } = req.body;

    const usuario = await db('usuarios').where({ id: parseInt(id) }).first();
    if (!usuario) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const updates = {};
    if (nome) updates.nome = nome;
    if (tipo) {
        if (!['prestador', 'admin', 'master'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo inválido' });
        }
        updates.tipo = tipo;
    }
    if (typeof ativo === 'boolean') updates.ativo = ativo;
    if (senha) updates.senha = bcrypt.hashSync(senha, 10);

    await db('usuarios').where({ id: parseInt(id) }).update(updates);

    logger.audit('User updated', req.user.email, 'update_user', {
        userId: id,
        updates: Object.keys(updates)
    });

    res.json({ message: 'Usuário atualizado com sucesso' });
}));

/**
 * Deletar usuário
 */
router.delete('/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Não permitir deletar a si mesmo
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Você não pode deletar sua própria conta' });
    }

    const usuario = await db('usuarios').where({ id: parseInt(id) }).first();
    if (!usuario) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    await db('usuarios').where({ id: parseInt(id) }).del();

    logger.audit('User deleted', req.user.email, 'delete_user', {
        userId: id,
        deletedEmail: usuario.email
    });

    res.json({ message: 'Usuário deletado com sucesso' });
}));

/**
 * Mudar role do usuário
 */
router.patch('/:id/role', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.body;

    if (!['prestador', 'admin', 'master'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo inválido' });
    }

    const usuario = await db('usuarios').where({ id: parseInt(id) }).first();
    if (!usuario) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    await db('usuarios').where({ id: parseInt(id) }).update({ tipo });

    logger.audit('User role changed', req.user.email, 'change_role', {
        userId: id,
        oldRole: usuario.tipo,
        newRole: tipo
    });

    res.json({ message: `Usuário promovido/rebaixado para ${tipo}` });
}));

/**
 * Alterar senha de usuário
 * Regras:
 * - Prestador: só pode alterar a própria senha
 * - Admin: pode alterar senha de prestadores e outros admins
 * - Master: pode alterar senha de qualquer usuário
 */
router.patch('/:id/password', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { senha, senha_atual } = req.body;
    const userLogado = req.user;

    // Validar senha nova
    if (!senha || senha.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres' });
    }

    // Buscar usuário alvo
    const usuarioAlvo = await db('usuarios').where({ id: parseInt(id) }).first();
    if (!usuarioAlvo) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar permissões
    const isAlterandoPropriaSenha = parseInt(id) === userLogado.id;
    const isPrestador = userLogado.tipo === 'prestador';
    const isAdmin = userLogado.tipo === 'admin';
    const isMaster = userLogado.tipo === 'master';

    // Prestador só pode alterar a própria senha
    if (isPrestador && !isAlterandoPropriaSenha) {
        return res.status(403).json({
            error: 'Você não tem permissão para alterar a senha de outros usuários'
        });
    }

    // Admin pode alterar senha de prestadores e outros admins, mas não de masters
    if (isAdmin && !isAlterandoPropriaSenha) {
        if (usuarioAlvo.tipo === 'master') {
            return res.status(403).json({
                error: 'Você não tem permissão para alterar a senha de um usuário master'
            });
        }
    }

    // Se está alterando a própria senha, validar senha atual
    if (isAlterandoPropriaSenha) {
        if (!senha_atual) {
            return res.status(400).json({
                error: 'Para alterar sua própria senha, você deve informar a senha atual'
            });
        }

        const senhaAtualValida = await bcrypt.compare(senha_atual, usuarioAlvo.senha);
        if (!senhaAtualValida) {
            return res.status(401).json({ error: 'Senha atual incorreta' });
        }
    }

    // Hash da nova senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Atualizar senha
    await db('usuarios')
        .where({ id: parseInt(id) })
        .update({ senha: senhaHash });

    logger.audit('Password changed', userLogado.email, 'change_password', {
        targetUserId: id,
        targetUserEmail: usuarioAlvo.email,
        changedByOwnUser: isAlterandoPropriaSenha
    });

    res.json({
        message: isAlterandoPropriaSenha
            ? 'Sua senha foi alterada com sucesso'
            : `Senha de ${usuarioAlvo.nome} alterada com sucesso`
    });
}));

module.exports = router;

