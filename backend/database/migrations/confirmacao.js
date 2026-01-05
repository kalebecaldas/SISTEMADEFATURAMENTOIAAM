const { db } = require('../init');

/**
 * Migração para adicionar campos de confirmação de cadastro
 */
const adicionarCamposConfirmacao = async () => {
    try {
        console.log('🔧 Adicionando campos de confirmação de cadastro...');

        // Verificar se as colunas já existem
        const tableInfo = await db.raw("PRAGMA table_info(usuarios)");
        const columns = tableInfo.map(col => col.name);

        // #region agent log
        try {
            // Hipótese H2: migração de confirmação pode estar pulando colunas importantes
            fetch('http://127.0.0.1:7245/ingest/c587a5fd-0753-44cb-be2b-c15533efa8d7', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'debug-session',
                    runId: 'initial',
                    hypothesisId: 'H2',
                    location: 'backend/database/migrations/confirmacao.js:11',
                    message: 'PRAGMA table_info(usuarios) before confirmacao migration',
                    data: { columns },
                    timestamp: Date.now()
                })
            }).catch(() => {});
        } catch (_) {
            // Ignorar falhas de log
        }
        // #endregion

        if (!columns.includes('status')) {
            await db.schema.table('usuarios', (table) => {
                table.string('status', 20).defaultTo('ativo');
                table.string('token_confirmacao', 255);
                table.datetime('data_confirmacao');
            });
            console.log('✅ Campos adicionados: status, token_confirmacao, data_confirmacao');

            // Atualizar prestadores existentes para 'ativo'
            await db('usuarios')
                .where({ tipo: 'prestador' })
                .update({
                    status: 'ativo',
                    data_confirmacao: db.fn.now()
                });
            console.log('✅ Prestadores existentes marcados como ativos');
        } else {
            console.log('ℹ️  Campos já existem, pulando migração');
        }

        console.log('✅ Migração de confirmação concluída!');
        return true;
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        throw error;
    }
};

module.exports = { adicionarCamposConfirmacao };
