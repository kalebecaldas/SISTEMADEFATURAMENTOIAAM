const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');
const logger = require('../services/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// Configuração do multer para upload de comprovantes
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/comprovantes');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `comprovante-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Apenas arquivos PDF, JPG e PNG são permitidos'));
    }
});

/**
 * Listar dados mensais de todos os prestadores para um mês/ano
 */
router.get('/:mes/:ano', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { mes, ano } = req.params;

    const dados = await db('dados_mensais as dm')
        .join('usuarios as u', 'dm.prestador_id', 'u.id')
        .leftJoin('usuarios as editor', 'dm.editado_por', 'editor.id')
        .select(
            'dm.id',
            'dm.prestador_id',
            'u.nome as prestador_nome',
            'u.email as prestador_email',
            'u.especialidade',
            'u.meta_mensal',
            'dm.mes',
            'dm.ano',
            'dm.valor_liquido',
            'dm.valor_original',
            'dm.faltas',
            'dm.meta_batida',
            'dm.valor_editado',
            'dm.editado_por',
            'dm.data_edicao',
            'dm.observacoes_edicao',
            'editor.nome as editor_nome',
            'dm.comprovante_arquivo',
            'dm.comprovante_enviado',
            'dm.data_envio_comprovante'
        )
        .where({ 'dm.mes': parseInt(mes), 'dm.ano': parseInt(ano) })
        .orderBy('u.nome');

    res.json({
        dados,
        total: dados.length,
        mes: parseInt(mes),
        ano: parseInt(ano)
    });
}));

/**
 * Editar valor líquido de um prestador
 */
router.put('/editar/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { valor_liquido, observacoes } = req.body;

    if (!valor_liquido || valor_liquido < 0) {
        return res.status(400).json({ error: 'Valor líquido inválido' });
    }

    // Buscar dados atuais
    const dadoAtual = await db('dados_mensais').where({ id }).first();

    if (!dadoAtual) {
        return res.status(404).json({ error: 'Registro não encontrado' });
    }

    // Atualizar com novo valor
    await db('dados_mensais')
        .where({ id })
        .update({
            valor_liquido: parseFloat(valor_liquido),
            valor_editado: true,
            editado_por: req.user.id,
            data_edicao: db.fn.now(),
            observacoes_edicao: observacoes || null,
            updated_at: db.fn.now()
        });

    logger.audit('Payment value edited', req.user.email, 'dados_mensais', {
        registroId: id,
        valorAnterior: dadoAtual.valor_liquido,
        valorNovo: valor_liquido,
        observacoes
    });

    res.json({
        message: 'Valor atualizado com sucesso',
        valor_anterior: dadoAtual.valor_liquido,
        valor_novo: parseFloat(valor_liquido)
    });
}));

/**
 * Enviar email de comprovante individual
 */
router.post('/enviar-email/:prestadorId/:mes/:ano', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { prestadorId, mes, ano } = req.params;

    // Buscar dados do prestador
    const dados = await db('dados_mensais as dm')
        .join('usuarios as u', 'dm.prestador_id', 'u.id')
        .select(
            'u.nome',
            'u.email',
            'u.especialidade',
            'u.meta_mensal',
            'u.status',
            'dm.valor_liquido',
            'dm.valor_original',
            'dm.faltas',
            'dm.meta_batida',
            'dm.valor_editado'
        )
        .where({
            'dm.prestador_id': prestadorId,
            'dm.mes': parseInt(mes),
            'dm.ano': parseInt(ano)
        })
        .first();

    if (!dados) {
        return res.status(404).json({ error: 'Dados não encontrados para este prestador/período' });
    }

    // Enviar email
    if (emailService.isConfigurado()) {
        try {
            // Preparar anexo de comprovante se existir
            let comprovanteAnexo = null;
            if (dados.comprovante_arquivo) {
                const comprovantePathFile = path.join(__dirname, '../uploads/comprovantes', dados.comprovante_arquivo);
                try {
                    await fs.access(comprovantePathFile);
                    comprovanteAnexo = {
                        filename: dados.comprovante_arquivo,
                        path: comprovantePathFile
                    };
                } catch {
                    console.warn('Comprovante não encontrado:', dados.comprovante_arquivo);
                }
            }

            await emailService.enviarComprovantePagamento(dados.email, {
                nome: dados.nome,
                mes: parseInt(mes),
                ano: parseInt(ano),
                valor_liquido: dados.valor_liquido,
                faltas: dados.faltas,
                meta_batida: dados.meta_batida,
                meta_mensal: dados.meta_mensal || 5000,
                especialidade: dados.especialidade,
                valor_editado: dados.valor_editado,
                status: dados.status
            }, comprovanteAnexo);

            // Marcar como enviado se tinha comprovante
            if (dados.comprovante_arquivo) {
                await db('dados_mensais')
                    .where({ id: dados.id })
                    .update({
                        comprovante_enviado: true,
                        data_envio_comprovante: db.fn.now()
                    });
            }

            logger.audit('Payment notification sent', req.user.email, 'email', {
                prestadorId,
                prestadorEmail: dados.email,
                mes,
                ano,
                valor: dados.valor_liquido,
                comComprovante: !!comprovanteAnexo
            });

            res.json({
                message: 'Email enviado com sucesso',
                destinatario: dados.email,
                comprovanteAnexado: !!comprovanteAnexo
            });
        } catch (error) {
            console.error('Erro ao enviar email:', error);
            res.status(500).json({
                error: 'Erro ao enviar email',
                details: error.message
            });
        }
    } else {
        res.status(503).json({ error: 'Serviço de email não configurado' });
    }
}));

/**
 * Enviar emails em massa para todos os prestadores do mês
 */
router.post('/enviar-email-massa/:mes/:ano', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { mes, ano } = req.params;

    // Buscar todos os prestadores do mês
    const prestadores = await db('dados_mensais as dm')
        .join('usuarios as u', 'dm.prestador_id', 'u.id')
        .select(
            'u.id as prestador_id',
            'u.nome',
            'u.email',
            'u.especialidade',
            'u.meta_mensal',
            'u.status',
            'dm.valor_liquido',
            'dm.faltas',
            'dm.meta_batida',
            'dm.valor_editado'
        )
        .where({
            'dm.mes': parseInt(mes),
            'dm.ano': parseInt(ano),
            'u.status': 'ativo' // Apenas prestadores ativos
        });

    if (prestadores.length === 0) {
        return res.status(404).json({ error: 'Nenhum prestador encontrado para este período' });
    }

    if (!emailService.isConfigurado()) {
        return res.status(503).json({ error: 'Serviço de email não configurado' });
    }

    // Enviar emails
    let sucessos = 0;
    let erros = 0;
    const resultados = [];

    for (const prestador of prestadores) {
        try {
            await emailService.enviarComprovantePagamento(prestador.email, {
                nome: prestador.nome,
                mes: parseInt(mes),
                ano: parseInt(ano),
                valor_liquido: prestador.valor_liquido,
                faltas: prestador.faltas,
                meta_batida: prestador.meta_batida,
                meta_mensal: prestador.meta_mensal || 5000,
                especialidade: prestador.especialidade,
                valor_editado: prestador.valor_editado,
                status: prestador.status
            });

            sucessos++;
            resultados.push({
                prestador: prestador.nome,
                email: prestador.email,
                status: 'enviado'
            });
        } catch (error) {
            erros++;
            resultados.push({
                prestador: prestador.nome,
                email: prestador.email,
                status: 'erro',
                erro: error.message
            });
        }
    }

    logger.audit('Mass payment notification sent', req.user.email, 'email', {
        mes,
        ano,
        total: prestadores.length,
        sucessos,
        erros
    });

    res.json({
        message: `Emails enviados: ${sucessos} sucesso(s), ${erros} erro(s)`,
        total: prestadores.length,
        sucessos,
        erros,
        resultados
    });
}));

/**
 * Upload de comprovante de pagamento
 */
router.post('/upload-comprovante/:id', authenticateToken, requireAdmin, upload.single('comprovante'), asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    try {
        // Atualizar registro com o arquivo
        await db('dados_mensais')
            .where({ id: parseInt(id) })
            .update({
                comprovante_arquivo: req.file.filename,
                updated_at: db.fn.now()
            });

        logger.audit('Payment receipt uploaded', req.user.email, 'upload', {
            dadosMensaisId: id,
            filename: req.file.filename
        });

        res.json({
            message: 'Comprovante enviado com sucesso',
            filename: req.file.filename
        });
    } catch (error) {
        // Remover arquivo se houver erro
        if (req.file) {
            await fs.unlink(req.file.path).catch(() => { });
        }
        throw error;
    }
}));

/**
 * Download de comprovante de pagamento
 */
router.get('/comprovante/:id/download', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Buscar dados
    const dado = await db('dados_mensais as dm')
        .join('usuarios as u', 'dm.prestador_id', 'u.id')
        .select('dm.comprovante_arquivo', 'dm.prestador_id', 'u.nome')
        .where({ 'dm.id': parseInt(id) })
        .first();

    if (!dado) {
        return res.status(404).json({ error: 'Registro não encontrado' });
    }

    if (!dado.comprovante_arquivo) {
        return res.status(404).json({ error: 'Comprovante não encontrado' });
    }

    // Verificar permissão (admin ou próprio prestador)
    if (req.user.tipo !== 'admin' && req.user.id !== dado.prestador_id) {
        return res.status(403).json({ error: 'Sem permissão para acessar este comprovante' });
    }

    const filePath = path.join(__dirname, '../uploads/comprovantes', dado.comprovante_arquivo);

    // Verificar se arquivo existe
    try {
        await fs.access(filePath);
    } catch {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    res.download(filePath, dado.comprovante_arquivo);
}));

/**
 * Marcar comprovante como enviado (ao enviar email)
 */
router.post('/marcar-enviado/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    await db('dados_mensais')
        .where({ id: parseInt(id) })
        .update({
            comprovante_enviado: true,
            data_envio_comprovante: db.fn.now()
        });

    logger.audit('Payment receipt marked as sent', req.user.email, 'update', {
        dadosMensaisId: id
    });

    res.json({ message: 'Comprovante marcado como enviado' });
}));

module.exports = router;
