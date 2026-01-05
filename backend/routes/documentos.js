const express = require('express');
const multer = require('multer');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const documentoService = require('../services/documentoService');
const logger = require('../services/logger');
const fs = require('fs');

const router = express.Router();

// Configurar multer
const upload = multer({
    storage: documentoService.getMulterStorage(),
    fileFilter: documentoService.getFileFilter(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});

/**
 * Upload de documento
 */
router.post('/upload', authenticateToken, upload.single('arquivo'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { prestador_id, tipo, categoria, descricao, solicitacao_id } = req.body;

    if (!prestador_id || !tipo) {
        // Remove arquivo se validação falhar
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
            error: 'Dados incompletos',
            required: ['prestador_id', 'tipo']
        });
    }

    // Verificar permissão: admin ou o próprio prestador
    if (req.user.tipo !== 'admin' && req.user.id !== parseInt(prestador_id)) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const documento = await documentoService.uploadDocumento(req.file, {
        prestador_id,
        tipo,
        categoria,
        descricao,
        uploaded_by: req.user.id,
    });

    // Se houver solicitacao_id, atualizar status da solicitação
    if (solicitacao_id) {
        const db = require('../database/init').db;
        await db('solicitacoes_documentos')
            .where({ id: solicitacao_id })
            .update({
                status: 'enviado',
                documento_id: documento.id,
                updated_at: new Date()
            });
    }

    logger.audit('Document uploaded', req.user.email, 'documento', {
        documentoId: documento.id,
        prestadorId: prestador_id,
        tipo,
        solicitacaoId: solicitacao_id
    });

    res.json({
        message: 'Documento enviado com sucesso',
        documento,
    });
}));

/**
 * Listar documentos de um prestador
 */
router.get('/prestador/:prestadorId', authenticateToken, asyncHandler(async (req, res) => {
    const { prestadorId } = req.params;
    const { tipo } = req.query;

    // Verificar permissão
    if (req.user.tipo !== 'admin' && req.user.id !== parseInt(prestadorId)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const documentos = await documentoService.listarDocumentos(prestadorId, tipo);

    res.json({
        documentos,
        total: documentos.length,
    });
}));

/**
 * Download de documento
 */
router.get('/download/:documentoId', authenticateToken, asyncHandler(async (req, res) => {
    const { documentoId } = req.params;

    const documento = await documentoService.buscarDocumento(documentoId);

    // Verificar permissão
    if (req.user.tipo !== 'admin' && req.user.id !== documento.prestador_id) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    if (!fs.existsSync(documento.arquivo_path)) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    res.download(documento.arquivo_path, documento.nome_arquivo);
}));

/**
 * Atualizar metadados do documento
 */
router.put('/:documentoId', authenticateToken, asyncHandler(async (req, res) => {
    const { documentoId } = req.params;
    const updates = req.body;

    const documento = await documentoService.buscarDocumento(documentoId);

    // Verificar permissão
    if (req.user.tipo !== 'admin' && req.user.id !== documento.prestador_id) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    await documentoService.atualizarDocumento(documentoId, updates);

    logger.audit('Document updated', req.user.email, 'documento', {
        documentoId,
        updates,
    });

    res.json({ message: 'Documento atualizado com sucesso' });
}));

/**
 * Deletar documento
 */
router.delete('/:documentoId', authenticateToken, asyncHandler(async (req, res) => {
    const { documentoId } = req.params;

    const documento = await documentoService.buscarDocumento(documentoId);

    // Verificar permissão: apenas admin pode deletar
    if (req.user.tipo !== 'admin') {
        return res.status(403).json({ error: 'Apenas administradores podem deletar documentos' });
    }

    await documentoService.deletarDocumento(documentoId);

    logger.audit('Document deleted', req.user.email, 'documento', {
        documentoId,
        prestadorId: documento.prestador_id,
    });

    res.json({ message: 'Documento removido com sucesso' });
}));

/**
 * Estatísticas de documentos
 */
router.get('/prestador/:prestadorId/estatisticas', authenticateToken, asyncHandler(async (req, res) => {
    const { prestadorId } = req.params;

    // Verificar permissão
    if (req.user.tipo !== 'admin' && req.user.id !== parseInt(prestadorId)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const stats = await documentoService.getEstatisticas(prestadorId);

    res.json(stats);
}));

/**
 * Criar solicitação de documento (Admin)
 */
router.post('/solicitar', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { prestador_id, tipo, descricao } = req.body;

    if (!prestador_id || !tipo) {
        return res.status(400).json({ error: 'Prestador e tipo são obrigatórios' });
    }

    const [id] = await require('../database/init').db('solicitacoes_documentos').insert({
        prestador_id,
        tipo,
        descricao,
        status: 'pendente',
        created_at: new Date(),
        updated_at: new Date()
    }); // .returning('id')

    // Enviar email de notificação (TODO)

    res.status(201).json({ message: 'Solicitação criada com sucesso', id });
}));

/**
 * Listar solicitações
 */
router.get('/solicitacoes/:prestadorId', authenticateToken, asyncHandler(async (req, res) => {
    const { prestadorId } = req.params;
    const db = require('../database/init').db;

    // Verificar permissão
    if (req.user.tipo !== 'admin' && req.user.id !== parseInt(prestadorId)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const solicitacoes = await db('solicitacoes_documentos')
        .where({ prestador_id: prestadorId })
        .orderBy('created_at', 'desc');

    res.json(solicitacoes);
}));

/**
 * Atender solicitação (Upload vinculado)
 * Nota: O upload real acontece na rota /upload, aqui apenas vinculamos ou atualizamos status
 * Mas para facilitar, vamos permitir que o upload normal receba 'solicitacao_id'
 */

// Vamos modificar a rota de upload para aceitar solicitacao_id
// Mas como não posso editar o bloco anterior facilmente sem substituir tudo, 
// vou criar uma rota específica para vincular se necessário, 
// ou melhor, assumir que o frontend manda o ID na rota de upload e eu altero a rota de upload.
// Por enquanto, vou deixar simples: Admin vê solicitações, Prestador vê solicitações.
// Prestador faz upload normal e Admin marca solicitação como concluída?
// Não, o ideal é vincular.

// Vou adicionar uma rota para atualizar status da solicitação
router.put('/solicitacoes/:id/status', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, observacoes } = req.body;
    const db = require('../database/init').db;

    await db('solicitacoes_documentos')
        .where({ id })
        .update({
            status,
            observacoes_admin: observacoes,
            updated_at: new Date()
        });

    res.json({ message: 'Status atualizado com sucesso' });
}));

module.exports = router;
