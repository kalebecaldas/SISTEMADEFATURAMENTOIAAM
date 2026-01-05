const { db } = require('../init');

async function up() {
    console.log('Running migration: tipo_colaborador');

    // Verificar se a coluna já existe
    const hasColumn = await db.schema.hasColumn('usuarios', 'tipo_colaborador');

    if (!hasColumn) {
        await db.schema.table('usuarios', (table) => {
            table.string('tipo_colaborador').defaultTo('prestador_servico').notNullable();
            table.comment('Tipo: prestador_servico ou clt');
        });

        console.log('✓ Coluna tipo_colaborador adicionada à tabela usuarios');
    } else {
        console.log('✓ Coluna tipo_colaborador já existe');
    }
}

async function down() {
    console.log('Rolling back migration: tipo_colaborador');

    const hasColumn = await db.schema.hasColumn('usuarios', 'tipo_colaborador');

    if (hasColumn) {
        await db.schema.table('usuarios', (table) => {
            table.dropColumn('tipo_colaborador');
        });

        console.log('✓ Coluna tipo_colaborador removida');
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
