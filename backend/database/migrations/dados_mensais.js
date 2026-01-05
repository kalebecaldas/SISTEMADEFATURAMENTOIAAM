const { db } = require('../init');

/**
 * Migração para criar tabela de dados mensais dos prestadores
 */
const criarTabelaDadosMensais = async () => {
    try {
        console.log('🔧 Criando tabela de dados mensais...');

        const hasTable = await db.schema.hasTable('dados_mensais');

        if (!hasTable) {
            await db.schema.createTable('dados_mensais', (table) => {
                table.increments('id').primary();
                table.integer('prestador_id').unsigned().notNullable()
                    .references('id').inTable('usuarios').onDelete('CASCADE');
                table.integer('mes').notNullable(); // 1-12
                table.integer('ano').notNullable(); // 2024, 2025, etc
                table.decimal('valor_liquido', 10, 2).defaultTo(0);
                table.decimal('valor_clinica', 10, 2).defaultTo(0); // Valor bruto faturado para a clínica
                table.integer('faltas').defaultTo(0);
                table.boolean('meta_batida').defaultTo(false);
                table.decimal('meta_mensal', 10, 2); // Meta do mês (pode ser diferente da meta do prestador)

                // Campos de edição
                table.decimal('valor_editado', 10, 2);
                table.integer('editado_por').unsigned()
                    .references('id').inTable('usuarios').onDelete('SET NULL');
                table.datetime('data_edicao');
                table.decimal('valor_original', 10, 2);
                table.text('observacoes_edicao');

                table.timestamps(true, true);

                // Índice único para evitar duplicatas
                table.unique(['prestador_id', 'mes', 'ano']);
            });

            console.log('✅ Tabela dados_mensais criada com sucesso!');
        } else {
            console.log('ℹ️  Tabela dados_mensais já existe');
        }

        return true;
    } catch (error) {
        console.error('❌ Erro ao criar tabela dados_mensais:', error);
        throw error;
    }
};

module.exports = { criarTabelaDadosMensais };
