const { db } = require('../init');

async function up() {
    console.log('Running migration: lembretes_enviados');

    // Verificar se a tabela já existe
    const hasTable = await db.schema.hasTable('lembretes_enviados');

    if (!hasTable) {
        await db.schema.createTable('lembretes_enviados', (table) => {
            table.increments('id').primary();
            table.integer('colaborador_id').unsigned().notNullable();
            table.integer('mes').notNullable();
            table.integer('ano').notNullable();
            table.string('tipo').notNullable(); // 'manual' ou 'automatico'
            table.timestamp('data_envio').defaultTo(db.fn.now());
            table.integer('enviado_por').unsigned(); // NULL se automático
            table.text('observacoes');

            // Foreign keys
            table.foreign('colaborador_id').references('id').inTable('usuarios').onDelete('CASCADE');
            table.foreign('enviado_por').references('id').inTable('usuarios').onDelete('SET NULL');

            // Índices
            table.index(['colaborador_id', 'mes', 'ano']);
            table.index('data_envio');
        });

        console.log('✓ Tabela lembretes_enviados criada');
    } else {
        console.log('✓ Tabela lembretes_enviados já existe');
    }

    // Adicionar configurações de automação
    const configs = [
        { chave: 'lembrete_nf_intervalo_dias', valor: '2', descricao: 'Intervalo em dias entre lembretes automáticos de NF' },
        { chave: 'lembrete_nf_horario', valor: '12:00', descricao: 'Horário de envio dos lembretes automáticos (HH:MM)' },
        { chave: 'lembrete_nf_ativo', valor: 'true', descricao: 'Ativar/desativar lembretes automáticos de NF' }
    ];

    for (const config of configs) {
        const exists = await db('configuracoes').where('chave', config.chave).first();
        if (!exists) {
            await db('configuracoes').insert(config);
            console.log(`✓ Configuração ${config.chave} adicionada`);
        }
    }
}

async function down() {
    console.log('Rolling back migration: lembretes_enviados');

    const hasTable = await db.schema.hasTable('lembretes_enviados');

    if (hasTable) {
        await db.schema.dropTable('lembretes_enviados');
        console.log('✓ Tabela lembretes_enviados removida');
    }

    // Remover configurações
    await db('configuracoes')
        .whereIn('chave', ['lembrete_nf_intervalo_dias', 'lembrete_nf_horario', 'lembrete_nf_ativo'])
        .del();
    console.log('✓ Configurações de lembretes removidas');
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
