const { db } = require('../init');

/**
 * Adicionar campos de comprovante de pagamento
 */
async function adicionarCamposComprovante() {
    console.log('🔧 Adicionando campos de comprovante de pagamento...');

    try {
        // Verificar se os campos já existem
        const hasComprovanteArquivo = await db.schema.hasColumn('dados_mensais', 'comprovante_arquivo');
        const hasComprovanteEnviado = await db.schema.hasColumn('dados_mensais', 'comprovante_enviado');
        const hasDataEnvioComprovante = await db.schema.hasColumn('dados_mensais', 'data_envio_comprovante');

        if (hasComprovanteArquivo && hasComprovanteEnviado && hasDataEnvioComprovante) {
            console.log('ℹ️  Campos de comprovante já existem, pulando migração');
            return;
        }

        // Adicionar campos
        await db.schema.table('dados_mensais', (table) => {
            if (!hasComprovanteArquivo) {
                table.string('comprovante_arquivo', 255);
            }
            if (!hasComprovanteEnviado) {
                table.boolean('comprovante_enviado').defaultTo(false);
            }
            if (!hasDataEnvioComprovante) {
                table.datetime('data_envio_comprovante');
            }
        });

        console.log('✅ Campos de comprovante adicionados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao adicionar campos de comprovante:', error.message);
        throw error;
    }
}

module.exports = {
    adicionarCamposComprovante
};
