const db = require('../connection');

/**
 * Migração 008: Ajustar constraint de dados_mensais para suportar múltiplos vínculos
 * 
 * Remove constraint UNIQUE(prestador_id, mes, ano)
 * Adiciona constraint UNIQUE(vinculo_id, mes, ano)
 */

async function up() {
    console.log('🔄 Executando migração 008: Ajustando constraint de dados_mensais...');

    // SQLite não suporta DROP CONSTRAINT diretamente
    // Precisamos recriar a tabela

    // 1. Criar tabela temporária com nova estrutura
    await db.schema.createTable('dados_mensais_new', (table) => {
        table.increments('id').primary();
        table.integer('prestador_id').unsigned().notNullable();
        table.integer('mes').notNullable();
        table.integer('ano').notNullable();
        table.decimal('valor_liquido', 10, 2).notNullable();
        table.integer('faltas').defaultTo(0);
        table.boolean('meta_batida').defaultTo(false);
        table.decimal('valor_bruto', 10, 2);
        table.text('especialidade');
        table.text('unidade');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.boolean('valor_editado').defaultTo(false);
        table.integer('editado_por');
        table.timestamp('data_edicao');
        table.float('valor_original');
        table.text('observacoes_edicao');
        table.decimal('valor_clinica', 10, 2).defaultTo(0);
        table.string('turno', 20).defaultTo('integral');
        table.integer('vinculo_id').unsigned();

        // Foreign keys
        table.foreign('prestador_id').references('id').inTable('usuarios').onDelete('CASCADE');
        table.foreign('vinculo_id').references('id').inTable('prestador_vinculos').onDelete('SET NULL');

        // Nova constraint: UNIQUE por vínculo + mês + ano
        table.unique(['vinculo_id', 'mes', 'ano']);

        // Índices
        table.index(['prestador_id', 'mes', 'ano']);
        table.index('vinculo_id');
    });

    console.log('✅ Tabela temporária criada');

    // 2. Copiar dados existentes
    const dadosExistentes = await db('dados_mensais').select('*');

    if (dadosExistentes.length > 0) {
        await db('dados_mensais_new').insert(dadosExistentes);
        console.log(`✅ ${dadosExistentes.length} registros copiados`);
    }

    // 3. Dropar tabela antiga
    await db.schema.dropTable('dados_mensais');
    console.log('✅ Tabela antiga removida');

    // 4. Renomear tabela nova
    await db.schema.renameTable('dados_mensais_new', 'dados_mensais');
    console.log('✅ Tabela renomeada');

    console.log('✅ Migração 008 concluída com sucesso!');
}

async function down() {
    console.log('🔄 Revertendo migração 008...');

    // Recriar com constraint antiga
    await db.schema.createTable('dados_mensais_old', (table) => {
        table.increments('id').primary();
        table.integer('prestador_id').unsigned().notNullable();
        table.integer('vinculo_id').unsigned();
        table.integer('mes').notNullable();
        table.integer('ano').notNullable();
        table.decimal('valor_liquido', 10, 2).defaultTo(0);
        table.decimal('valor_clinica', 10, 2).defaultTo(0);
        table.integer('faltas').defaultTo(0);
        table.boolean('meta_batida').defaultTo(false);
        table.decimal('valor_editado', 10, 2);
        table.string('motivo_edicao', 500);
        table.integer('editado_por');
        table.timestamp('editado_em');
        table.timestamp('created_at').defaultTo(db.fn.now());

        table.foreign('prestador_id').references('id').inTable('usuarios').onDelete('CASCADE');
        table.foreign('vinculo_id').references('id').inTable('prestador_vinculos').onDelete('SET NULL');

        // Constraint antiga
        table.unique(['prestador_id', 'mes', 'ano']);
    });

    const dados = await db('dados_mensais').select('*');
    if (dados.length > 0) {
        await db('dados_mensais_old').insert(dados);
    }

    await db.schema.dropTable('dados_mensais');
    await db.schema.renameTable('dados_mensais_old', 'dados_mensais');

    console.log('✅ Migração 008 revertida');
}

module.exports = { up, down };
