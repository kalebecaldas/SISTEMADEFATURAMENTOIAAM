const { db } = require('../init');

/**
 * Migração para adicionar tipo de contrato aos vínculos
 * Permite que um colaborador tenha vínculos como CLT e como Prestador simultaneamente
 */
const adicionarTipoContratoVinculos = async () => {
    try {
        console.log('🔧 Adicionando tipo_contrato à tabela prestador_vinculos...');

        const hasTable = await db.schema.hasTable('prestador_vinculos');

        if (!hasTable) {
            console.log('❌ Tabela prestador_vinculos não existe ainda');
            return false;
        }

        // Verificar se a coluna já existe
        const hasTipoContrato = await db.schema.hasColumn('prestador_vinculos', 'tipo_contrato');

        if (!hasTipoContrato) {
            await db.schema.table('prestador_vinculos', (table) => {
                // Tipo de contrato: 'prestador' ou 'clt'
                table.string('tipo_contrato', 20).defaultTo('prestador');

                // Índice para buscas
                table.index(['prestador_id', 'tipo_contrato']);
            });

            console.log('✅ Coluna tipo_contrato adicionada!');
        } else {
            console.log('ℹ️  Coluna tipo_contrato já existe');
        }

        // Atualizar registros existentes (todos são prestadores por padrão)
        await db('prestador_vinculos')
            .whereNull('tipo_contrato')
            .update({ tipo_contrato: 'prestador' });

        console.log('✅ Vínculos existentes atualizados para tipo "prestador"!');

        // Remover constraint UNIQUE antigo se existir e criar novo
        // Nota: Knex não tem método direto para modificar constraints, então vamos garantir
        // que o índice único correto seja criado na próxima vez que a tabela for recriada
        console.log('ℹ️  Para constraint UNIQUE completo, considere adicionar manualmente:');
        console.log('   UNIQUE(prestador_id, tipo_contrato, turno, especialidade, unidade)');

        return true;
    } catch (error) {
        console.error('❌ Erro ao adicionar tipo_contrato aos vínculos:', error);
        throw error;
    }
};

module.exports = { adicionarTipoContratoVinculos };
