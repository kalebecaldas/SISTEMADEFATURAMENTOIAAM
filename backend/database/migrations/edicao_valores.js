const { db } = require('../init');

/**
 * Migração para adicionar campos de edição de valores
 */
const adicionarCamposEdicaoValores = async () => {
    try {
        console.log('🔧 Adicionando campos de edição de valores...');

        // Verificar se os campos já existem
        const hasValorEditado = await db.schema.hasColumn('dados_mensais', 'valor_editado');

        if (!hasValorEditado) {
            await db.schema.table('dados_mensais', (table) => {
                // Campos para rastrear edições
                table.boolean('valor_editado').defaultTo(false);
                table.integer('editado_por').unsigned()
                    .references('id').inTable('usuarios').onDelete('SET NULL');
                table.datetime('data_edicao');
                table.decimal('valor_original', 10, 2); // Guardar valor original da planilha
                table.text('observacoes_edicao'); // Motivo da edição
            });

            console.log('✅ Campos de edição adicionados');

            // Copiar valores atuais para valor_original
            await db.raw(`
                UPDATE dados_mensais 
                SET valor_original = valor_liquido 
                WHERE valor_original IS NULL
            `);

            console.log('✅ Valores originais copiados');
        } else {
            console.log('ℹ️  Campos de edição já existem, pulando migração');
        }

        console.log('✅ Migração de edição de valores concluída!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao adicionar campos de edição:', error);
        throw error;
    }
};

module.exports = { adicionarCamposEdicaoValores };
