const { db } = require('../init');

const adicionarTabelasSolicitacoes = async () => {
    try {
        console.log('🔧 Criando tabela de solicitações de documentos...');

        const hasTable = await db.schema.hasTable('solicitacoes_documentos');
        if (!hasTable) {
            await db.schema.createTable('solicitacoes_documentos', (table) => {
                table.increments('id').primary();
                table.integer('prestador_id').unsigned().notNullable()
                    .references('id').inTable('usuarios').onDelete('CASCADE');
                table.string('tipo').notNullable(); // ex: 'cnh', 'diploma'
                table.text('descricao');
                table.string('status').defaultTo('pendente'); // 'pendente', 'enviado', 'aprovado', 'rejeitado'
                table.integer('documento_id').unsigned()
                    .references('id').inTable('documentos_prestador').onDelete('SET NULL');
                table.text('observacoes_admin');
                table.timestamps(true, true);
            });
            console.log('✅ Tabela solicitacoes_documentos criada');
        }

        return true;
    } catch (error) {
        console.error('❌ Erro ao criar tabela de solicitações:', error);
        throw error;
    }
};

module.exports = { adicionarTabelasSolicitacoes };
