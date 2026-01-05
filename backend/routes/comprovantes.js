const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const emailService = require('../services/emailService');
const logger = require('../services/logger');

const router = express.Router();

// Configuração do multer para upload de comprovantes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/comprovantes');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'comprovante-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos PDF e imagens são permitidos'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

/**
 * POST /api/comprovantes/upload
 * Upload de comprovante de pagamento (Admin only)
 */
router.post('/upload', authenticateToken, requireAdmin, upload.single('comprovante'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        const { colaborador_id, mes, ano } = req.body;

        if (!colaborador_id || !mes || !ano) {
            return res.status(400).json({ error: 'Colaborador, mês e ano são obrigatórios' });
        }

        // Verificar se colaborador existe
        const colaborador = await db('usuarios').where({ id: colaborador_id }).first();
        if (!colaborador) {
            return res.status(404).json({ error: 'Colaborador não encontrado' });
        }

        // Verificar se já existe comprovante para este período
        const comprovanteExistente = await db('comprovantes_pagamento')
            .where({ colaborador_id: parseInt(colaborador_id), mes: parseInt(mes), ano: parseInt(ano) })
            .first();

        if (comprovanteExistente) {
            // Deletar arquivo antigo
            const oldFilePath = path.join(__dirname, '../uploads/comprovantes', comprovanteExistente.arquivo_path);
            if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
            }

            // Atualizar registro
            await db('comprovantes_pagamento')
                .where({ id: comprovanteExistente.id })
                .update({
                    arquivo_path: req.file.filename,
                    data_envio: db.fn.now(),
                    enviado_por: req.user.id
                });

            logger.info('Comprovante atualizado', {
                colaborador_id,
                mes,
                ano,
                admin_id: req.user.id
            });

            return res.json({
                message: 'Comprovante atualizado com sucesso',
                comprovante: {
                    id: comprovanteExistente.id,
                    arquivo_path: req.file.filename
                }
            });
        } else {
            // Inserir novo comprovante
            const [id] = await db('comprovantes_pagamento').insert({
                colaborador_id: parseInt(colaborador_id),
                mes: parseInt(mes),
                ano: parseInt(ano),
                arquivo_path: req.file.filename,
                data_envio: db.fn.now(),
                enviado_por: req.user.id
            });

            logger.info('Comprovante criado', {
                colaborador_id,
                mes,
                ano,
                admin_id: req.user.id
            });

            return res.json({
                message: 'Comprovante enviado com sucesso',
                comprovante: {
                    id,
                    arquivo_path: req.file.filename
                }
            });
        }
    } catch (error) {
        logger.error('Erro ao fazer upload de comprovante', error);
        res.status(500).json({ error: 'Erro ao processar comprovante: ' + error.message });
    }
});

/**
 * GET /api/comprovantes/:colaborador_id/:mes/:ano
 * Buscar comprovante específico
 */
router.get('/:colaborador_id/:mes/:ano', authenticateToken, async (req, res) => {
    try {
        const { colaborador_id, mes, ano } = req.params;

        // Verificar permissão: admin ou próprio colaborador
        if (req.user.tipo !== 'admin' && req.user.tipo !== 'master' && req.user.id !== parseInt(colaborador_id)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const comprovante = await db('comprovantes_pagamento')
            .select('id', 'arquivo_path', 'data_envio', 'enviado_por')
            .where({
                colaborador_id: parseInt(colaborador_id),
                mes: parseInt(mes),
                ano: parseInt(ano)
            })
            .first();

        if (!comprovante) {
            return res.json({ comprovante: null });
        }

        res.json({ comprovante });
    } catch (error) {
        logger.error('Erro ao buscar comprovante', error);
        res.status(500).json({ error: 'Erro ao buscar comprovante' });
    }
});

/**
 * GET /api/comprovantes/:colaborador_id/:mes/:ano/download
 * Download de comprovante
 */
router.get('/:colaborador_id/:mes/:ano/download', authenticateToken, async (req, res) => {
    try {
        const { colaborador_id, mes, ano } = req.params;

        // Verificar permissão
        if (req.user.tipo !== 'admin' && req.user.tipo !== 'master' && req.user.id !== parseInt(colaborador_id)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const comprovante = await db('comprovantes_pagamento')
            .select('arquivo_path')
            .where({
                colaborador_id: parseInt(colaborador_id),
                mes: parseInt(mes),
                ano: parseInt(ano)
            })
            .first();

        if (!comprovante) {
            return res.status(404).json({ error: 'Comprovante não encontrado' });
        }

        const filePath = path.join(__dirname, '../uploads/comprovantes', comprovante.arquivo_path);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Arquivo não encontrado' });
        }

        res.download(filePath);
    } catch (error) {
        logger.error('Erro ao baixar comprovante', error);
        res.status(500).json({ error: 'Erro ao baixar comprovante' });
    }
});

/**
 * GET /api/comprovantes/:colaborador_id/:mes/:ano/view
 * Visualizar comprovante (serve file)
 */
router.get('/:colaborador_id/:mes/:ano/view', authenticateToken, async (req, res) => {
    try {
        const { colaborador_id, mes, ano } = req.params;

        // Verificar permissão
        if (req.user.tipo !== 'admin' && req.user.tipo !== 'master' && req.user.id !== parseInt(colaborador_id)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const comprovante = await db('comprovantes_pagamento')
            .select('arquivo_path')
            .where({
                colaborador_id: parseInt(colaborador_id),
                mes: parseInt(mes),
                ano: parseInt(ano)
            })
            .first();

        if (!comprovante) {
            return res.status(404).json({ error: 'Comprovante não encontrado' });
        }

        const filePath = path.join(__dirname, '../uploads/comprovantes', comprovante.arquivo_path);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Arquivo não encontrado' });
        }

        // Definir tipo de conteúdo apropriado
        const ext = path.extname(filePath).toLowerCase();
        const contentType = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png'
        }[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.sendFile(filePath);
    } catch (error) {
        logger.error('Erro ao visualizar comprovante', error);
        res.status(500).json({ error: 'Erro ao visualizar comprovante' });
    }
});

/**
 * DELETE /api/comprovantes/:id
 * Deletar comprovante (Admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const comprovante = await db('comprovantes_pagamento')
            .where({ id })
            .first();

        if (!comprovante) {
            return res.status(404).json({ error: 'Comprovante não encontrado' });
        }

        // Deletar arquivo físico
        const filePath = path.join(__dirname, '../uploads/comprovantes', comprovante.arquivo_path);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Deletar registro
        await db('comprovantes_pagamento').where({ id }).del();

        logger.info('Comprovante deletado', { id, admin_id: req.user.id });

        res.json({ message: 'Comprovante deletado com sucesso' });
    } catch (error) {
        logger.error('Erro ao deletar comprovante', error);
        res.status(500).json({ error: 'Erro ao deletar comprovante' });
    }
});

/**
 * POST /api/comprovantes/enviar-email
 * Enviar email com comprovante para colaborador (Admin only)
 */
router.post('/enviar-email', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { colaborador_id, mes, ano } = req.body;

        if (!colaborador_id || !mes || !ano) {
            return res.status(400).json({ error: 'Colaborador, mês e ano são obrigatórios' });
        }

        // Buscar comprovante
        const comprovante = await db('comprovantes_pagamento')
            .where({
                colaborador_id: parseInt(colaborador_id),
                mes: parseInt(mes),
                ano: parseInt(ano)
            })
            .first();

        if (!comprovante) {
            return res.status(404).json({ error: 'Comprovante não encontrado. Faça o upload antes de enviar email.' });
        }

        // Buscar dados do colaborador e do mês
        const colaborador = await db('usuarios')
            .where({ id: colaborador_id })
            .first();

        const dadosMes = await db('dados_mensais')
            .where({
                prestador_id: colaborador_id,
                mes: parseInt(mes),
                ano: parseInt(ano)
            })
            .first();

        if (!dadosMes) {
            return res.status(404).json({ error: 'Dados do mês não encontrados' });
        }

        // Preparar anexo
        const filePath = path.join(__dirname, '../uploads/comprovantes', comprovante.arquivo_path);
        const comprovanteAnexo = {
            filename: `comprovante-${mes}-${ano}${path.extname(comprovante.arquivo_path)}`,
            path: filePath
        };

        // Enviar email APENAS com comprovante (sem detalhes completos)
        const emailEnviado = await emailService.enviarApenasComprovante(
            colaborador.email,
            {
                nome: colaborador.nome,
                mes: parseInt(mes),
                ano: parseInt(ano)
            },
            comprovanteAnexo
        );

        if (emailEnviado) {
            logger.info('Email com comprovante enviado', {
                colaborador_id,
                mes,
                ano,
                admin_id: req.user.id
            });
            res.json({ message: 'Email com comprovante enviado com sucesso' });
        } else {
            res.status(500).json({ error: 'Falha ao enviar email' });
        }
    } catch (error) {
        logger.error('Erro ao enviar email com comprovante', error);
        res.status(500).json({ error: 'Erro ao enviar email: ' + error.message });
    }
});

module.exports = router;
