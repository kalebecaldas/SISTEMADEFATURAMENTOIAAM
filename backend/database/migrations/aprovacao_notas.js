const { db } = require('../init');

/**
 * Adicionar campos de aprovação de notas fiscais
 */
async function adicionarCamposAprovacaoNotas() {
    console.log('🔧 Adicionando campos de aprovação de notas fiscais...');

    try {
        // Verificar se os campos já existem
        const hasStatusAprovacao = await db.schema.hasColumn('notas_fiscais', 'status_aprovacao');
        const hasMotivoReprovacao = await db.schema.hasColumn('notas_fiscais', 'motivo_reprovacao');
        const hasAprovadoPor = await db.schema.hasColumn('notas_fiscais', 'aprovado_por');
        const hasDataAprovacao = await db.schema.hasColumn('notas_fiscais', 'data_aprovacao');

        if (hasStatusAprovacao && hasMotivoReprovacao && hasAprovadoPor && hasDataAprovacao) {
            console.log('ℹ️  Campos de aprovação já existem, pulando migração');
            return;
        }

        // Adicionar campos
        await db.schema.table('notas_fiscais', (table) => {
            if (!hasStatusAprovacao) {
                table.string('status_aprovacao', 20).defaultTo('pendente');
                // valores: 'pendente', 'enviada', 'aprovada', 'reprovada'
            }
            if (!hasMotivoReprovacao) {
                table.text('motivo_reprovacao');
            }
            if (!hasAprovadoPor) {
                table.integer('aprovado_por').unsigned()
                    .references('id').inTable('usuarios').onDelete('SET NULL');
            }
            if (!hasDataAprovacao) {
                table.datetime('data_aprovacao');
            }
        });

        console.log('✅ Campos de aprovação de notas fiscais adicionados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao adicionar campos de aprovação:', error.message);
        throw error;
    }
}

module.exports = {
    adicionarCamposAprovacaoNotas
};
