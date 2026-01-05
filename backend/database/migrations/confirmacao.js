const { db } = require('../init');

/**
 * Migração para adicionar campos de confirmação de cadastro
 */
const adicionarCamposConfirmacao = async () => {
    try {
        console.log('🔧 Adicionando campos de confirmação de cadastro...');

        // Verificar se as colunas já existem usando Knex (funciona em SQLite e PostgreSQL)
        const hasStatus = await db.schema.hasColumn('usuarios', 'status');

        if (!hasStatus) {
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

        console.log('✅ Migração de confirmação concluída!');
        return true;
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        throw error;
    }
};

module.exports = { adicionarCamposConfirmacao };
