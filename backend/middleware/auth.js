const jwt = require('jsonwebtoken');
const { db } = require('../database/init');

// Middleware para verificar token JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso necessário' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Middleware para verificar se é admin OU master
const requireAdmin = (req, res, next) => {
  if (req.user.tipo !== 'admin' && req.user.tipo !== 'master') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
  next();
};

// Middleware para verificar se é APENAS master
const requireMaster = (req, res, next) => {
  if (req.user.tipo !== 'master') {
    return res.status(403).json({ error: 'Acesso negado. Apenas usuários Master.' });
  }
  next();
};

// Middleware para verificar se é prestador
const requirePrestador = (req, res, next) => {
  if (req.user.tipo !== 'prestador' && req.user.tipo !== 'admin' && req.user.tipo !== 'master') {
    return res.status(403).json({ error: 'Acesso negado. Apenas prestadores.' });
  }
  next();
};

// Middleware para verificar se o usuário está ativo
const checkUserActive = (req, res, next) => {
  const { db } = require('../database/init');

  db.get('SELECT ativo FROM usuarios WHERE id = ?', [req.user.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao verificar status do usuário' });
    }

    if (!row || !row.ativo) {
      return res.status(403).json({ error: 'Usuário inativo' });
    }

    next();
  });
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireMaster,
  requirePrestador,
  checkUserActive
};