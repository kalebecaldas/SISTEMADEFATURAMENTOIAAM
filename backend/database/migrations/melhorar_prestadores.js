const { db } = require('../init');

/**
 * Migração para melhorar estrutura de prestadores
 */
const melhorarEstruturaPrestadores = async () => {
    try {
        console.log('🔧 Melhorando estrutura de prestadores...');

        const hasTable = await db.schema.hasTable('usuarios');
        if (!hasTable) {
            console.log('❌ Tabela usuarios não existe');
            return false;
        }

        // Verificar e adicionar colunas que faltam
        const hasEspecialidade = await db.schema.hasColumn('usuarios', 'especialidade');
        const hasUnidades = await db.schema.hasColumn('usuarios', 'unidades');
        const hasValorFixo = await db.schema.hasColumn('usuarios', 'valor_fixo');
        const hasMetaMensal = await db.schema.hasColumn('usuarios', 'meta_mensal');
        const hasStatus = await db.schema.hasColumn('usuarios', 'status');

        await db.schema.table('usuarios', (table) => {
            if (!hasEspecialidade) {
                table.string('especialidade', 100);
                console.log('✅ Coluna especialidade adicionada');
            }
            if (!hasUnidades) {
                table.text('unidades'); // JSON array: ["Matriz", "Anexo", "São José"]
                console.log('✅ Coluna unidades adicionada');
            }
            if (!hasValorFixo) {
                table.boolean('valor_fixo').defaultTo(false);
                console.log('✅ Coluna valor_fixo adicionada');
            }
            if (!hasMetaMensal) {
                table.decimal('meta_mensal', 10, 2);
                console.log('✅ Coluna meta_mensal adicionada');
            }
            if (!hasStatus) {
                table.string('status', 50).defaultTo('ativo'); // ativo, inativo, demitido, incompleto
                console.log('✅ Coluna status adicionada');
            }
        });

        // Atualizar prestadores existentes para status 'ativo' se não tiverem status
        await db('usuarios')
            .where({ tipo: 'prestador' })
            .whereNull('status')
            .update({ status: 'ativo' });

        console.log('✅ Estrutura de prestadores melhorada com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao melhorar estrutura de prestadores:', error);
        throw error;
    }
};

module.exports = { melhorarEstruturaPrestadores };
