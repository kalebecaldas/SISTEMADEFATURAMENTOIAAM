const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const emailService = require('../services/emailService');

// Listar todas as configurações
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const configs = await db('configuracoes').select('*');

        // Transformar array em objeto para facilitar no frontend
        const configMap = {};
        configs.forEach(c => {
            configMap[c.chave] = c.valor;
        });

        res.json(configMap);
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

// Salvar/Atualizar configurações
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const settings = req.body; // Objeto { chave: valor, ... }

        await db.transaction(async (trx) => {
            for (const [key, value] of Object.entries(settings)) {
                // Verificar se a configuração já existe
                const existing = await trx('configuracoes').where({ chave: key }).first();

                if (existing) {
                    await trx('configuracoes').where({ chave: key }).update({ valor: String(value) });
                } else {
                    await trx('configuracoes').insert({
                        chave: key,
                        valor: String(value),
                        descricao: 'Configuração do sistema'
                    });
                }
            }
        });

        // Recarregar configurações no serviço de email se houver alterações de email
        if (Object.keys(settings).some(k => k.startsWith('email_'))) {
            await emailService.reloadConfig();
        }

        res.json({ message: 'Configurações salvas com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

// Testar conexão de email com as configurações salvas
router.post('/test-email', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await emailService.testarConexao();
        res.json(result);
    } catch (error) {
        console.error('Erro ao testar email:', error);
        res.status(500).json({ error: 'Erro ao testar conexão de email' });
    }
});

// Atualizar configurações de automação de lembretes
router.post('/automation', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { lembrete_nf_ativo, lembrete_nf_intervalo_dias, lembrete_nf_horario } = req.body;

        await db.transaction(async (trx) => {
            // Atualizar ou inserir cada configuração
            const configs = [
                { chave: 'lembrete_nf_ativo', valor: String(lembrete_nf_ativo) },
                { chave: 'lembrete_nf_intervalo_dias', valor: String(lembrete_nf_intervalo_dias) },
                { chave: 'lembrete_nf_horario', valor: String(lembrete_nf_horario) }
            ];

            for (const config of configs) {
                const existing = await trx('configuracoes').where({ chave: config.chave }).first();
                if (existing) {
                    await trx('configuracoes').where({ chave: config.chave }).update({ valor: config.valor });
                } else {
                    await trx('configuracoes').insert({
                        chave: config.chave,
                        valor: config.valor,
                        descricao: 'Configuração de automação de lembretes'
                    });
                }
            }
        });

        // Reiniciar o scheduler para aplicar novas configurações
        const schedulerService = require('../services/schedulerService');
        schedulerService.stop();
        await schedulerService.init();

        res.json({ message: 'Configurações de automação atualizadas com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar automação:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações de automação' });
    }
});

module.exports = router;
