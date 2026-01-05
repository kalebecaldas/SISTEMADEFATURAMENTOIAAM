const express = require('express');
const { db } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Buscar dados mensais de um prestador específico
 */
router.get('/:prestadorId/:mes/:ano', authenticateToken, asyncHandler(async (req, res) => {
    const { prestadorId, mes, ano } = req.params;
    const user = req.user;

    // Verificar permissão: admin ou o próprio prestador
    if (user.tipo !== 'admin' && user.id !== parseInt(prestadorId)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const dados = await db('dados_mensais as dm')
        .leftJoin('usuarios as editor', 'dm.editado_por', 'editor.id')
        .select(
            'dm.*',
            'editor.nome as editor_nome'
        )
        .where({
            'dm.prestador_id': prestadorId,
            'dm.mes': parseInt(mes),
            'dm.ano': parseInt(ano)
        })
        .first();

    if (!dados) {
        return res.status(404).json({ error: 'Dados não encontrados para este período' });
    }

    // Buscar meta do prestador
    const prestador = await db('usuarios')
        .select('meta_mensal')
        .where({ id: prestadorId })
        .first();

    res.json({
        ...dados,
        meta_mensal: prestador?.meta_mensal || dados.meta_mensal || 5000
    });
}));

/**
 * Buscar histórico completo de um prestador
 */
router.get('/:prestadorId/historico', authenticateToken, asyncHandler(async (req, res) => {
    const { prestadorId } = req.params;
    const user = req.user;

    // Verificar permissão
    if (user.tipo !== 'admin' && user.id !== parseInt(prestadorId)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const historico = await db('dados_mensais')
        .select('*')
        .where({ prestador_id: prestadorId })
        .orderBy([
            { column: 'ano', order: 'desc' },
            { column: 'mes', order: 'desc' }
        ]);

    res.json({
        historico,
        total: historico.length
    });
}));

module.exports = router;
