const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { loginValidation } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../services/logger');
const emailService = require('../services/emailService');
const crypto = require('crypto');

const router = express.Router();

// Login
router.post('/login', loginValidation, asyncHandler(async (req, res) => {
  const { email, senha } = req.body;

  logger.info('Login attempt', { email });

  // Buscar usuário
  const user = await db('usuarios').where({ email }).first();

  if (!user) {
    logger.warn('Login failed - user not found', { email });
    return res.status(401).json({ error: 'Email ou senha inválidos' });
  }

  // Verificar senha
  const senhaValida = bcrypt.compareSync(senha, user.senha);
  if (!senhaValida) {
    logger.warn('Login failed - invalid password', { email });
    return res.status(401).json({ error: 'Email ou senha inválidos' });
  }

  // Verificar se usuário está ativo
  if (!user.ativo) {
    logger.warn('Login failed - inactive user', { email });
    return res.status(403).json({ error: 'Usuário inativo' });
  }

  // Se o usuário está com status 'pendente' e fez login com sucesso, ativar
  if (user.status === 'pendente') {
    await db('usuarios')
      .where({ id: user.id })
      .update({
        status: 'ativo',
        cadastro_confirmado: true
      });

    logger.info('User activated on first login', { email, userId: user.id });
    user.status = 'ativo'; // Atualizar objeto local
  }

  // Gerar token JWT
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      nome: user.nome,
      tipo: user.tipo
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  logger.auth('Login successful', user.email, {
    userId: user.id,
    userType: user.tipo,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      nome: user.nome,
      tipo: user.tipo
    }
  });
}));

// Verificar token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    message: 'Token válido',
    user: req.user
  });
});

// Logout (cliente deve remover o token)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout realizado com sucesso' });
});

// Alterar senha
router.put('/change-password', authenticateToken, asyncHandler(async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;

  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
  }

  const user = await db('usuarios')
    .select('senha')
    .where({ id: req.user.id })
    .first();

  const senhaValida = await bcrypt.compare(senhaAtual, user.senha);
  if (!senhaValida) {
    logger.warn('Password change failed - incorrect current password', {
      userId: req.user.id,
    });
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }

  const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

  await db('usuarios')
    .where({ id: req.user.id })
    .update({
      senha: novaSenhaHash,
      updated_at: db.fn.now()
    });

  logger.auth('Password changed', req.user.email, {
    userId: req.user.id,
  });

  res.json({ message: 'Senha alterada com sucesso' });
}));

// Rota para criar prestador (Apenas Admin)
router.post('/register-provider', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { nome, email, cpf, telefone, funcao } = req.body;

  // Validação básica
  if (!nome || !email || !cpf) {
    return res.status(400).json({ error: 'Nome, email e CPF são obrigatórios' });
  }

  // Verificar se usuário já existe
  const existingUser = await db('usuarios').where({ email }).first();
  if (existingUser) {
    return res.status(400).json({ error: 'Email já cadastrado' });
  }

  // Gerar token de confirmação
  const token = crypto.randomBytes(32).toString('hex');

  // Gerar senha temporária (será substituída na confirmação)
  // Usar um hash de um valor aleatório para garantir que seja seguro
  const senhaTemporaria = crypto.randomBytes(32).toString('hex');
  const senhaHash = await bcrypt.hash(senhaTemporaria, 10);

  // Verificar quais colunas existem na tabela (para compatibilidade com tabelas antigas)
  let colunasExistentes = [];
  try {
    const tableInfo = await db.raw("PRAGMA table_info(usuarios)");
    colunasExistentes = tableInfo.map(col => col.name);
  } catch (error) {
    // Se falhar, assumir que todas as colunas padrão existem
    logger.warn('Could not check table columns, using defaults', error);
    colunasExistentes = ['nome', 'email', 'senha', 'tipo', 'status', 'token_confirmacao', 'created_at'];
  }

  // Preparar dados para inserção (apenas campos obrigatórios)
  const dadosUsuario = {
    nome,
    email,
    senha: senhaHash, // Senha temporária que será substituída
    tipo: 'prestador',
    created_at: db.fn.now()
  };

  // Adicionar campos opcionais apenas se existirem na tabela
  if (colunasExistentes.includes('status')) {
    dadosUsuario.status = 'pendente';
  }
  if (colunasExistentes.includes('token_confirmacao')) {
    dadosUsuario.token_confirmacao = token;
  }
  if (cpf && colunasExistentes.includes('cpf')) {
    dadosUsuario.cpf = cpf;
  }
  if (telefone && colunasExistentes.includes('telefone')) {
    dadosUsuario.telefone = telefone;
  }
  if (funcao && colunasExistentes.includes('funcao')) {
    dadosUsuario.funcao = funcao;
  }

  // Inserir usuário com status pendente
  const [id] = await db('usuarios').insert(dadosUsuario);

  // Enviar email de confirmação (não falhar se erro)
  let emailSent = false;
  try {
    emailSent = await emailService.enviarEmailConfirmacaoCadastro(email, nome, token);
  } catch (emailError) {
    logger.error('Failed to send confirmation email', emailError);
    // Não retornar erro para o cliente, apenas logar
  }

  logger.auth('Provider created', req.user.email, { providerId: id, email });

  res.status(201).json({
    message: 'Prestador criado com sucesso.' + (emailSent ? ' Email de confirmação enviado.' : ' Erro ao enviar email de confirmação.'),
    id,
    emailSent
  });
}));

// Rota para confirmar cadastro e definir senha
router.post('/confirm-registration', asyncHandler(async (req, res) => {
  const { token, senha } = req.body;

  if (!token || !senha) {
    return res.status(400).json({ error: 'Token e senha são obrigatórios' });
  }

  // Buscar usuário pelo token
  const user = await db('usuarios')
    .where({ token_confirmacao: token, status: 'pendente' })
    .first();

  if (!user) {
    return res.status(400).json({ error: 'Token inválido ou expirado' });
  }

  // Hash da senha
  const hashedPassword = await bcrypt.hash(senha, 10);

  // Atualizar usuário
  await db('usuarios')
    .where({ id: user.id })
    .update({
      senha: hashedPassword,
      status: 'ativo',
      token_confirmacao: null,
      data_confirmacao: db.fn.now(),
      updated_at: db.fn.now()
    });

  logger.auth('Provider registration confirmed', user.email);

  res.json({ message: 'Cadastro confirmado com sucesso! Você já pode fazer login.' });
}));

// Rota para reenviar email de confirmação (Admin)
router.post('/resend-confirmation', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { providerId } = req.body;

  const user = await db('usuarios')
    .where({ id: providerId, status: 'pendente' })
    .first();

  if (!user) {
    return res.status(404).json({ error: 'Prestador não encontrado ou já confirmado' });
  }

  // Gerar novo token se necessário (opcional, mantendo o mesmo por enquanto)
  const token = user.token_confirmacao;

  const emailSent = await emailService.enviarEmailConfirmacaoCadastro(user.email, user.nome, token);

  if (emailSent) {
    res.json({ message: 'Email de confirmação reenviado com sucesso' });
  } else {
    res.status(500).json({ error: 'Erro ao enviar email' });
  }
}));

// Rota para obter dados do usuário atual
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const user = await db('usuarios')
    .where({ id: req.user.id })
    .select('id', 'nome', 'email', 'tipo', 'funcao')
    .first();

  if (!user) {
    logger.warn('User not found in /me route', { userId: req.user.id });
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  res.json({ user });
}));

module.exports = router;