const { db } = require('../init');

/**
 * Migração para adicionar tipo de colaborador e período de referência
 */
const adicionarTipoColaborador = async () => {
    try {
        console.log('🔧 Adicionando colunas tipo_colaborador e período...');

        const hasTable = await db.schema.hasTable('dados_mensais');

        if (!hasTable) {
            console.log('❌ Tabela dados_mensais não existe ainda');
            return false;
        }

        // Verificar se as colunas já existem
        const hasTypeColumn = await db.schema.hasColumn('dados_mensais', 'tipo_colaborador');

        if (!hasTypeColumn) {
            await db.schema.table('dados_mensais', (table) => {
                // Tipo de colaborador: 'prestador' ou 'clt'
                table.string('tipo_colaborador', 20).defaultTo('prestador');

                // Período de referência
                table.integer('dia_inicio').defaultTo(1); // CLT: 1 | Prestador: 1
                table.integer('dia_fim').defaultTo(null); // CLT: 25 | Prestador: null (último dia do mês)

                // Índice para buscas
                table.index(['mes', 'ano', 'tipo_colaborador']);
            });

            console.log('✅ Colunas adicionadas com sucesso!');
        } else {
            console.log('ℹ️  Colunas já existem');
        }

        // Atualizar registros existentes (todos são prestadores por padrão)
        await db('dados_mensais')
            .whereNull('tipo_colaborador')
            .update({
                tipo_colaborador: 'prestador',
                dia_inicio: 1,
                dia_fim: null
            });

        console.log('✅ Registros existentes atualizados!');

        return true;
    } catch (error) {
        console.error('❌ Erro ao adicionar tipo_colaborador:', error);
        throw error;
    }
};

module.exports = { adicionarTipoColaborador };
