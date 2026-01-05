const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../services/logger');

const router = express.Router();

// Configuração do multer para upload de notas fiscais
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/notas');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'nf-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.xml', '.jpg', '.jpeg', '.png'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos PDF, XML e Imagens são permitidos'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

// Upload de nota fiscal (Prestador)
router.post('/upload', authenticateToken, upload.single('nota_fiscal'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { mes, ano, observacoes } = req.body;

    if (!mes || !ano) {
        // Remover arquivo se faltar dados
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Mês e ano são obrigatórios' });
    }

    const prestadorId = req.user.id;

    // Verificar se já existe nota para este período
    const existingInvoice = await db('notas_fiscais')
        .where({
            prestador_id: prestadorId,
            mes: parseInt(mes),
            ano: parseInt(ano)
        })
        .first();

    if (existingInvoice) {
        if (existingInvoice.status === 'aprovado') {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Já existe uma nota fiscal aprovada para este período' });
        }

        // Se existir mas não estiver aprovada, atualiza (sobrescreve)
        // Remover arquivo antigo se existir
        if (existingInvoice.arquivo_path && fs.existsSync(existingInvoice.arquivo_path)) {
            try {
                fs.unlinkSync(existingInvoice.arquivo_path);
            } catch (err) {
                logger.warn('Erro ao remover arquivo antigo de nota fiscal', err);
            }
        }

        await db('notas_fiscais')
            .where({ id: existingInvoice.id })
            .update({
                arquivo_path: req.file.path,
                status: 'pendente',
                data_envio: db.fn.now(),
                observacoes: observacoes || existingInvoice.observacoes,
                updated_at: db.fn.now()
            });

        logger.info('Invoice updated', { userId: prestadorId, mes, ano });
        return res.json({ message: 'Nota fiscal atualizada com sucesso' });
    }

    // Criar nova nota
    const [id] = await db('notas_fiscais').insert({
        prestador_id: prestadorId,
        mes: parseInt(mes),
        ano: parseInt(ano),
        arquivo_path: req.file.path,
        status: 'pendente',
        data_envio: db.fn.now(),
        observacoes: observacoes,
        created_at: db.fn.now()
    }); // .returning('id') for Postgres

    logger.info('Invoice uploaded', { userId: prestadorId, mes, ano });
    res.status(201).json({ message: 'Nota fiscal enviada com sucesso', id });
}));

// Listar notas fiscais
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { mes, ano, status, prestador_id } = req.query;
    const user = req.user;

    let query = db('notas_fiscais as nf')
        .join('usuarios as u', 'nf.prestador_id', 'u.id')
        .select(
            'nf.id',
            'nf.mes',
            'nf.ano',
            'nf.status',
            'nf.data_envio',
            'nf.observacoes',
            'u.nome as prestador_nome',
            'u.email as prestador_email',
            'nf.prestador_id'
        );

    // Se não for admin, vê apenas as suas
    if (user.tipo !== 'admin') {
        query = query.where('nf.prestador_id', user.id);
    } else if (prestador_id) {
        // Admin pode filtrar por prestador
        query = query.where('nf.prestador_id', prestador_id);
    }

    if (mes) query = query.where('nf.mes', parseInt(mes));
    if (ano) query = query.where('nf.ano', parseInt(ano));
    if (status) query = query.where('nf.status', status);

    const invoices = await query.orderBy([
        { column: 'nf.ano', order: 'desc' },
        { column: 'nf.mes', order: 'desc' },
        { column: 'nf.created_at', order: 'desc' }
    ]);

    // Adicionar valor da nota buscando em dados_mensais
    // Isso poderia ser um join, mas dados_mensais pode não existir ainda
    const invoicesWithValues = await Promise.all(invoices.map(async (inv) => {
        const dados = await db('dados_mensais')
            .where({
                prestador_id: inv.prestador_id,
                mes: inv.mes,
                ano: inv.ano
            })
            .select('valor_liquido')
            .first();

        return {
            ...inv,
            valor: dados ? dados.valor_liquido : 0
        };
    }));

    res.json(invoicesWithValues);
}));

// Download de nota fiscal
router.get('/:id/download', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    const invoice = await db('notas_fiscais').where({ id }).first();

    if (!invoice) {
        return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    }

    // Verificar permissão
    if (user.tipo !== 'admin' && invoice.prestador_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    if (!invoice.arquivo_path || !fs.existsSync(invoice.arquivo_path)) {
        return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
    }

    res.download(invoice.arquivo_path);
}));

// Atualizar status (Admin)
router.put('/:id/status', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, observacoes } = req.body;

    if (!['aprovado', 'rejeitado', 'pendente'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
    }

    const updated = await db('notas_fiscais')
        .where({ id })
        .update({
            status,
            observacoes,
            updated_at: db.fn.now()
        });

    if (!updated) {
        return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    }

    // Notificar prestador (TODO: Implementar notificação por email/socket)

    logger.info('Invoice status updated', { invoiceId: id, status, adminId: req.user.id });
    res.json({ message: `Nota fiscal ${status} com sucesso` });
}));

/**
 * Dashboard de controle de notas fiscais (Admin)
 * Mostra todos os prestadores do mês com status de envio
 */
router.get('/dashboard/:mes/:ano', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { mes, ano } = req.params;

    // Buscar todos os prestadores que têm dados neste mês
    const prestadores = await db('dados_mensais as dm')
        .join('usuarios as u', 'dm.prestador_id', 'u.id')
        .leftJoin('notas_fiscais as nf', function () {
            this.on('nf.prestador_id', '=', 'dm.prestador_id')
                .andOn('nf.mes', '=', db.raw('?', [parseInt(mes)]))
                .andOn('nf.ano', '=', db.raw('?', [parseInt(ano)]));
        })
        .select(
            'u.id as prestador_id',
            'u.nome',
            'u.email',
            'u.especialidade',
            'dm.valor_liquido',
            'dm.meta_batida',
            'nf.id as nota_id',
            'nf.status as nota_status',
            'nf.data_envio',
            'nf.observacoes'
        )
        .where({
            'dm.mes': parseInt(mes),
            'dm.ano': parseInt(ano)
        })
        .orderBy('u.nome');

    // Calcular estatísticas
    const total = prestadores.length;
    const enviadas = prestadores.filter(p => p.nota_id).length;
    const pendentes = total - enviadas;
    const aprovadas = prestadores.filter(p => p.nota_status === 'aprovado').length;

    res.json({
        mes: parseInt(mes),
        ano: parseInt(ano),
        estatisticas: {
            total,
            enviadas,
            pendentes,
            aprovadas
        },
        prestadores: prestadores.map(p => ({
            prestador_id: p.prestador_id,
            nome: p.nome,
            email: p.email,
            especialidade: p.especialidade,
            valor_liquido: p.valor_liquido,
            meta_batida: p.meta_batida,
            nota_enviada: !!p.nota_id,
            nota_status: p.nota_status || 'pendente',
            data_envio: p.data_envio,
            observacoes: p.observacoes
        }))
    });
}));

/**
 * Aprovar nota fiscal
 */
router.post('/:id/approve', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const nota = await db('notas_fiscais').where({ id: parseInt(id) }).first();

    if (!nota) {
        return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    }

    await db('notas_fiscais')
        .where({ id: parseInt(id) })
        .update({
            status_aprovacao: 'aprovada',
            status: 'aprovado',
            aprovado_por: req.user.id,
            data_aprovacao: db.fn.now(),
            motivo_reprovacao: null
        });

    logger.audit('Invoice approved', req.user.email, 'approval', {
        invoiceId: id,
        prestadorId: nota.prestador_id
    });

    res.json({ message: 'Nota fiscal aprovada com sucesso' });
}));

/**
 * Reprovar nota fiscal
 */
router.post('/:id/reject', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo || motivo.trim() === '') {
        return res.status(400).json({ error: 'Motivo da reprovação é obrigatório' });
    }

    const nota = await db('notas_fiscais').where({ id: parseInt(id) }).first();

    if (!nota) {
        return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    }

    await db('notas_fiscais')
        .where({ id: parseInt(id) })
        .update({
            status_aprovacao: 'reprovada',
            status: 'rejeitado',
            motivo_reprovacao: motivo,
            aprovado_por: req.user.id,
            data_aprovacao: db.fn.now()
        });

    logger.audit('Invoice rejected', req.user.email, 'rejection', {
        invoiceId: id,
        prestadorId: nota.prestador_id,
        motivo
    });

    res.json({ message: 'Nota fiscal reprovada' });
}));

/**
 * Listar notas pendentes do prestador logado
 */
router.get('/pending', authenticateToken, asyncHandler(async (req, res) => {
    const prestadorId = req.user.id;

    // Buscar meses com pagamento mas sem nota ou com nota reprovada
    const pagamentos = await db('dados_mensais')
        .where({ prestador_id: prestadorId })
        .select('mes', 'ano', 'valor_liquido')
        .orderBy('ano', 'desc')
        .orderBy('mes', 'desc');

    const pendencias = [];

    for (const pag of pagamentos) {
        const nota = await db('notas_fiscais')
            .where({
                prestador_id: prestadorId,
                mes: pag.mes,
                ano: pag.ano
            })
            .first();

        if (!nota || nota.status_aprovacao === 'reprovada') {
            pendencias.push({
                mes: pag.mes,
                ano: pag.ano,
                valor: pag.valor_liquido,
                status: nota ? 'reprovada' : 'pendente',
                motivo: nota?.motivo_reprovacao
            });
        }
    }

    res.json({ pendencias });
}));

/**
 * Enviar lembrete de nota fiscal por email (Admin)
 */
router.post('/reminder/:prestadorId/:mes/:ano', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { prestadorId, mes, ano } = req.params;

    // Buscar dados do prestador
    const prestador = await db('usuarios')
        .where({ id: parseInt(prestadorId) })
        .first();

    if (!prestador) {
        return res.status(404).json({ error: 'Prestador não encontrado' });
    }

    // Verificar se existe pagamento para este período
    const pagamento = await db('dados_mensais')
        .where({
            prestador_id: parseInt(prestadorId),
            mes: parseInt(mes),
            ano: parseInt(ano)
        })
        .first();

    if (!pagamento) {
        return res.status(404).json({ error: 'Não há pagamento registrado para este período' });
    }

    // Importar emailService
    const emailService = require('../services/emailService');

    // Enviar email de lembrete
    const mesesNomes = {
        1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril',
        5: 'Maio', 6: 'Junho', 7: 'Julho', 8: 'Agosto',
        9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'
    };

    const mesNome = mesesNomes[parseInt(mes)];
    const prazo = 'até o dia 5 do mês seguinte';

    const emailEnviado = await emailService.enviarLembreteNotaFiscal(
        prestador.email,
        prestador.nome,
        {
            mes: mesNome,
            ano: parseInt(ano),
            prazo
        }
    );

    if (emailEnviado) {
        logger.info('Invoice reminder sent', {
            prestadorId: parseInt(prestadorId),
            mes: parseInt(mes),
            ano: parseInt(ano),
            adminId: req.user.id
        });

        res.json({
            message: 'Lembrete enviado com sucesso',
            email: prestador.email
        });
    } else {
        res.status(500).json({
            error: 'Falha ao enviar lembrete. Verifique as configurações de email.'
        });
    }
}));

/**
 * Enviar lembrete em massa (Admin)
 */
router.post('/reminder/mass/:mes/:ano', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { mes, ano } = req.params;
    const { prestadorIds } = req.body; // Array de IDs

    if (!prestadorIds || !Array.isArray(prestadorIds) || prestadorIds.length === 0) {
        return res.status(400).json({ error: 'Lista de prestadores é obrigatória' });
    }

    const emailService = require('../services/emailService');
    const mesesNomes = {
        1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril',
        5: 'Maio', 6: 'Junho', 7: 'Julho', 8: 'Agosto',
        9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'
    };

    const mesNome = mesesNomes[parseInt(mes)];
    let enviados = 0;
    let erros = 0;

    for (const prestadorId of prestadorIds) {
        try {
            const prestador = await db('usuarios').where({ id: parseInt(prestadorId) }).first();
            if (!prestador) continue;

            await emailService.enviarLembreteNotaFiscal(
                prestador.email,
                prestador.nome,
                {
                    mes: mesNome,
                    ano: parseInt(ano),
                    prazo: `até o final do mês ${mesNome}/${ano}`
                }
            );

            // Registrar lembrete
            await db('lembretes_enviados').insert({
                colaborador_id: prestador.id,
                mes: parseInt(mes),
                ano: parseInt(ano),
                tipo: 'manual',
                enviado_por: req.user.id
            });

            enviados++;
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 seg entre emails
        } catch (error) {
            logger.error('Error sending reminder', error);
            erros++;
        }
    }

    res.json({
        message: `Lembretes enviados: ${enviados}, Erros: ${erros}`,
        enviados,
        erros
    });
}));

module.exports = router;

