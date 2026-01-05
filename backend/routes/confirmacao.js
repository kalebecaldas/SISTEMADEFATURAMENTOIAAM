const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');
const logger = require('../services/logger');

const router = express.Router();

/**
 * Enviar email de confirmação manualmente (Admin)
 */
router.post('/enviar/:prestadorId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { prestadorId } = req.params;

    const prestador = await db('usuarios')
        .where({ id: prestadorId, tipo: 'prestador' })
        .first();

    if (!prestador) {
        return res.status(404).json({ error: 'Prestador não encontrado' });
    }

    if (prestador.cadastro_confirmado) {
        return res.status(400).json({ error: 'Cadastro já confirmado' });
    }

    // Gerar novo token se não existir
    let token = prestador.token_confirmacao;
    if (!token) {
        const crypto = require('crypto');
        token = crypto.randomBytes(32).toString('hex');

        await db('usuarios')
            .where({ id: prestadorId })
            .update({ token_confirmacao: token });
    }

    // Enviar email
    if (emailService.isConfigurado()) {
        try {
            await emailService.enviarEmailConfirmacao(
                prestador.email,
                prestador.nome,
                token
            );

            logger.audit('Confirmation email sent', req.user.email, 'prestador', {
                prestadorId: prestador.id,
                prestadorEmail: prestador.email
            });

            res.json({
                message: 'Email de confirmação enviado com sucesso',
                email: prestador.email
            });
        } catch (error) {
            console.error('Erro ao enviar email:', error);
            res.status(500).json({
                error: 'Erro ao enviar email',
                details: error.message
            });
        }
    } else {
        res.status(503).json({
            error: 'Serviço de email não configurado',
            token: token // Retornar token para teste manual
        });
    }
}));

/**
 * Confirmar cadastro via token (Prestador)
 */
router.get('/confirmar/:token', asyncHandler(async (req, res) => {
    const { token } = req.params;

    const prestador = await db('usuarios')
        .where({ token_confirmacao: token })
        .first();

    if (!prestador) {
        return res.status(404).json({
            error: 'Token inválido ou expirado',
            success: false
        });
    }

    if (prestador.cadastro_confirmado) {
        return res.json({
            message: 'Cadastro já confirmado anteriormente',
            success: true,
            already_confirmed: true
        });
    }

    // Confirmar cadastro
    await db('usuarios')
        .where({ id: prestador.id })
        .update({
            status: 'ativo',
            cadastro_confirmado: true,
            data_confirmacao: db.fn.now(),
            token_confirmacao: null // Invalidar token
        });

    logger.audit('Registration confirmed', prestador.email, 'prestador', {
        prestadorId: prestador.id
    });

    res.json({
        message: 'Cadastro confirmado com sucesso!',
        success: true,
        nome: prestador.nome,
        email: prestador.email
    });
}));

/**
 * Reenviar email de confirmação
 */
router.post('/reenviar/:prestadorId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    // Reutilizar a mesma lógica do envio
    return router.stack.find(layer => layer.route?.path === '/enviar/:prestadorId')
        .route.stack[0].handle(req, res);
}));

module.exports = router;
