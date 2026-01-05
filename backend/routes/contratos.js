const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const contratoService = require('../services/contratoService');
const logger = require('../services/logger');
const { db } = require('../database/init');
const fs = require('fs');

const router = express.Router();

/**
 * Listar modelos de contratos disponíveis
 */
router.get('/modelos', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { ativo } = req.query;

    let query = db('contratos_modelos')
        .select('*')
        .orderBy('nome');

    if (ativo !== undefined) {
        query = query.where('ativo', ativo === 'true' ? 1 : 0);
    }

    const modelos = await query;

    res.json(modelos);
}));

/**
 * Atualizar modelo de contrato (meta mensal)
 */
router.put('/modelos/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { meta_mensal } = req.body;

    if (meta_mensal === undefined) {
        return res.status(400).json({ error: 'Meta mensal é obrigatória' });
    }

    const updated = await db('contratos_modelos')
        .where({ id })
        .update({
            meta_mensal: parseFloat(meta_mensal)
        });

    if (!updated) {
        return res.status(404).json({ error: 'Modelo não encontrado' });
    }

    try {
        logger.audit('Contract model updated', req.user.email, 'contrato_modelo', {
            modeloId: id,
            meta_mensal
        });
    } catch (logError) {
        console.log('Logger error (non-critical):', logError.message);
    }

    res.json({ message: 'Meta atualizada com sucesso' });
}));

/**
 * Buscar modelo específico
 */
router.get('/modelos/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const modelo = await db('contratos_modelos')
        .where({ id })
        .first();

    if (!modelo) {
        return res.status(404).json({ error: 'Modelo não encontrado' });
    }

    res.json(modelo);
}));

/**
 * Gerar contrato
 */
router.post('/gerar', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { prestador_id, modelo_id, dados } = req.body;

    if (!prestador_id || !modelo_id || !dados) {
        return res.status(400).json({
            error: 'Dados incompletos',
            required: ['prestador_id', 'modelo_id', 'dados']
        });
    }

    const contrato = await contratoService.gerarContrato(modelo_id, prestador_id, dados);

    logger.audit('Contract generated', req.user.email, 'contrato', {
        contratoId: contrato.id,
        prestadorId: prestador_id,
        modeloId: modelo_id,
    });

    res.json({
        message: 'Contrato gerado com sucesso',
        contrato,
    });
}));

/**
 * Listar contratos de um prestador
 */
router.get('/prestador/:prestadorId', authenticateToken, asyncHandler(async (req, res) => {
    const { prestadorId } = req.params;

    // Verificar permissão: admin ou o próprio prestador
    if (req.user.tipo !== 'admin' && req.user.id !== parseInt(prestadorId)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const contratos = await contratoService.listarContratosPrestador(prestadorId);

    res.json({
        contratos,
        total: contratos.length,
    });
}));

/**
 * Download de contrato
 */
router.get('/download/:contratoId', authenticateToken, asyncHandler(async (req, res) => {
    const { contratoId } = req.params;

    const contrato = await db('contratos_gerados')
        .where({ id: contratoId })
        .first();

    if (!contrato) {
        return res.status(404).json({ error: 'Contrato não encontrado' });
    }

    // Verificar permissão
    if (req.user.tipo !== 'admin' && req.user.id !== contrato.prestador_id) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    if (!fs.existsSync(contrato.arquivo_path)) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    res.download(contrato.arquivo_path);
}));

/**
 * Atualizar status do contrato
 */
router.put('/:id/status', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, data_assinatura, observacoes } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status é obrigatório' });
    }

    const validStatuses = ['gerado', 'assinado', 'cancelado'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            error: 'Status inválido',
            valid: validStatuses,
        });
    }

    await contratoService.atualizarStatus(id, status, data_assinatura);

    if (observacoes) {
        await db('contratos_gerados')
            .where({ id })
            .update({ observacoes });
    }

    logger.audit('Contract status updated', req.user.email, 'contrato', {
        contratoId: id,
        newStatus: status,
    });

    res.json({ message: 'Status atualizado com sucesso' });
}));

/**
 * Deletar contrato (soft delete)
 */
router.delete('/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const contrato = await db('contratos_gerados')
        .where({ id })
        .first();

    if (!contrato) {
        return res.status(404).json({ error: 'Contrato não encontrado' });
    }

    // Marcar como cancelado ao invés de deletar
    await db('contratos_gerados')
        .where({ id })
        .update({
            status: 'cancelado',
            updated_at: db.fn.now(),
        });

    logger.audit('Contract deleted', req.user.email, 'contrato', {
        contratoId: id,
    });

    res.json({ message: 'Contrato removido com sucesso' });
}));

/**
 * Listar todos os contratos (admin)
 */
router.get('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { status, prestador_id, limit = 50, offset = 0 } = req.query;

    let query = db('contratos_gerados as cg')
        .join('contratos_modelos as cm', 'cg.modelo_id', 'cm.id')
        .join('usuarios as u', 'cg.prestador_id', 'u.id')
        .select(
            'cg.id',
            'cg.arquivo_path',
            'cg.data_geracao',
            'cg.data_assinatura',
            'cg.status',
            'cm.nome as modelo_nome',
            'cm.especialidade',
            'u.id as prestador_id',
            'u.nome as prestador_nome',
            'u.email as prestador_email'
        );

    if (status) {
        query = query.where('cg.status', status);
    }

    if (prestador_id) {
        query = query.where('cg.prestador_id', prestador_id);
    }

    const contratos = await query
        .orderBy('cg.data_geracao', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset));

    const total = await db('contratos_gerados')
        .count('* as count')
        .first();

    res.json({
        contratos,
        total: total.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
    });
}));

module.exports = router;
