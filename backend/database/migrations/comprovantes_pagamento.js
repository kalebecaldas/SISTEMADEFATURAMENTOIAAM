const { db } = require('../init');

async function up() {
    console.log('Running migration: comprovantes_pagamento');

    // Verificar se a tabela já existe
    const hasTable = await db.schema.hasTable('comprovantes_pagamento');

    if (!hasTable) {
        await db.schema.createTable('comprovantes_pagamento', (table) => {
            table.increments('id').primary();
            table.integer('colaborador_id').unsigned().notNullable();
            table.integer('mes').notNullable();
            table.integer('ano').notNullable();
            table.string('arquivo_path').notNullable();
            table.timestamp('data_envio').defaultTo(db.fn.now());
            table.integer('enviado_por').unsigned(); // Admin que fez upload
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.timestamp('updated_at').defaultTo(db.fn.now());

            // Foreign key
            table.foreign('colaborador_id').references('id').inTable('usuarios').onDelete('CASCADE');
            table.foreign('enviado_por').references('id').inTable('usuarios').onDelete('SET NULL');

            // Índices para busca rápida
            table.index(['colaborador_id', 'mes', 'ano']);

            // Constraint: apenas um comprovante por colaborador/mês/ano
            table.unique(['colaborador_id', 'mes', 'ano']);
        });

        console.log('✓ Tabela comprovantes_pagamento criada');
    } else {
        console.log('✓ Tabela comprovantes_pagamento já existe');
    }
}

async function down() {
    console.log('Rolling back migration: comprovantes_pagamento');

    const hasTable = await db.schema.hasTable('comprovantes_pagamento');

    if (hasTable) {
        await db.schema.dropTable('comprovantes_pagamento');
        console.log('✓ Tabela comprovantes_pagamento removida');
    }
}

// Auto-executar se chamado diretamente
if (require.main === module) {
    up()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { up, down };
