const { db } = require('../init');

/**
 * Migração para adicionar/ajustar campos de status e confirmação aos prestadores
 * 
 * Hipóteses:
 * - H1/H2: coluna `cadastro_confirmado` pode não existir mesmo quando `status` já existe
 */
const adicionarCamposStatus = async () => {
    try {
        console.log('🔧 Adicionando campos de status aos prestadores...');

        const hasTable = await db.schema.hasTable('usuarios');
        if (!hasTable) {
            console.log('❌ Tabela usuarios não existe, pulando migração de status');
            return false;
        }

        // Verificar existência de cada coluna individualmente
        const hasStatusColumn = await db.schema.hasColumn('usuarios', 'status');
        const hasCadastroConfirmado = await db.schema.hasColumn('usuarios', 'cadastro_confirmado');
        const hasTokenConfirmacao = await db.schema.hasColumn('usuarios', 'token_confirmacao');
        const hasDataConfirmacao = await db.schema.hasColumn('usuarios', 'data_confirmacao');
        const hasTelefone = await db.schema.hasColumn('usuarios', 'telefone');
        const hasEspecialidade = await db.schema.hasColumn('usuarios', 'especialidade');
        const hasUnidade = await db.schema.hasColumn('usuarios', 'unidade');
        const hasContratoId = await db.schema.hasColumn('usuarios', 'contrato_id');
        const hasMetaMensal = await db.schema.hasColumn('usuarios', 'meta_mensal');

        let columnsAdded = false;

        await db.schema.table('usuarios', (table) => {
            // Status do cadastro
            if (!hasStatusColumn) {
                table.string('status', 20).defaultTo('incompleto');
                columnsAdded = true;
            }

            // Confirmação de cadastro (campo crítico para o erro de insert)
            if (!hasCadastroConfirmado) {
                table.boolean('cadastro_confirmado').defaultTo(false);
                columnsAdded = true;
            }

            // Token e data de confirmação
            if (!hasTokenConfirmacao) {
                table.string('token_confirmacao', 255).unique();
                columnsAdded = true;
            }
            if (!hasDataConfirmacao) {
                table.datetime('data_confirmacao');
                columnsAdded = true;
            }

            // Dados adicionais
            if (!hasTelefone) {
                table.string('telefone', 20);
                columnsAdded = true;
            }
            if (!hasEspecialidade) {
                table.string('especialidade', 100);
                columnsAdded = true;
            }
            if (!hasUnidade) {
                table.string('unidade', 50);
                columnsAdded = true;
            }

            // Contrato e meta
            if (!hasContratoId) {
                table.integer('contrato_id').unsigned()
                    .references('id').inTable('contratos_modelos').onDelete('SET NULL');
                columnsAdded = true;
            }
            if (!hasMetaMensal) {
                table.decimal('meta_mensal', 10, 2).defaultTo(5000.00);
                columnsAdded = true;
            }
        });

        if (columnsAdded) {
            console.log('✅ Campos de status/confirmacao adicionados ou atualizados');

            // Atualizar usuários existentes apenas quando novos campos são criados
            await db('usuarios')
                .where('tipo', 'prestador')
                .whereNull('cadastro_confirmado')
                .update({
                    status: 'ativo',
                    cadastro_confirmado: true
                });

            console.log('✅ Prestadores existentes sem cadastro_confirmado atualizados para status ativo');

            await db('usuarios')
                .where('tipo', 'admin')
                .whereNull('cadastro_confirmado')
                .update({
                    status: 'ativo',
                    cadastro_confirmado: true
                });

            console.log('✅ Admins sem cadastro_confirmado atualizados');
        } else {
            console.log('ℹ️  Campos de status já existentes, nenhuma alteração de estrutura necessária');
        }

        console.log('✅ Migração de status concluída!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao adicionar campos de status:', error);
        throw error;
    }
};

module.exports = { adicionarCamposStatus };
