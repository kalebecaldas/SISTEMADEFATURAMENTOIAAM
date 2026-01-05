const db = require('../connection');

/**
 * Migração 007: Sistema de Vínculos Multi-Turno/Especialidade
 * 
 * Permite que um prestador (mesmo email/login) tenha múltiplos vínculos:
 * - Diferentes turnos (Manhã, Tarde, Integral)
 * - Diferentes especialidades
 * - Diferentes unidades
 */

async function up() {
    console.log('🔄 Executando migração 007: Criando tabela prestador_vinculos...');

    // 1. Criar tabela de vínculos
    await db.schema.createTable('prestador_vinculos', (table) => {
        table.increments('id').primary();
        table.integer('prestador_id').unsigned().notNullable();
        table.string('turno', 20); // 'MANHÃ', 'TARDE', 'INTEGRAL', NULL
        table.string('especialidade', 100);
        table.string('unidade', 100);
        table.decimal('meta_mensal', 10, 2);
        table.boolean('ativo').defaultTo(true);
        table.timestamp('created_at').defaultTo(db.fn.now());

        // Foreign key
        table.foreign('prestador_id').references('id').inTable('usuarios').onDelete('CASCADE');

        // Índices para performance
        table.index('prestador_id');
        table.index(['prestador_id', 'turno', 'especialidade']);
    });

    console.log('✅ Tabela prestador_vinculos criada');

    // 2. Migrar dados existentes
    console.log('🔄 Migrando prestadores existentes para vínculos...');

    const prestadores = await db('usuarios')
        .where('tipo', 'prestador')
        .select('id', 'nome', 'especialidade', 'unidades', 'meta_mensal');

    for (const prestador of prestadores) {
        // Detectar turno pelo nome
        let turno = 'INTEGRAL';
        if (/\(tarde\)/i.test(prestador.nome)) {
            turno = 'TARDE';
        } else if (/\(manhã\)/i.test(prestador.nome) || /\(manha\)/i.test(prestador.nome)) {
            turno = 'MANHÃ';
        }

        // Extrair primeira unidade
        let unidade = null;
        try {
            const unidadesArray = JSON.parse(prestador.unidades || '[]');
            unidade = unidadesArray[0] || null;
        } catch (e) {
            unidade = prestador.unidades;
        }

        // Criar vínculo
        await db('prestador_vinculos').insert({
            prestador_id: prestador.id,
            turno: turno,
            especialidade: prestador.especialidade,
            unidade: unidade,
            meta_mensal: prestador.meta_mensal,
            ativo: true
        });
    }

    console.log(`✅ ${prestadores.length} prestadores migrados para vínculos`);

    // 3. Adicionar coluna vinculo_id em dados_mensais
    await db.schema.table('dados_mensais', (table) => {
        table.integer('vinculo_id').unsigned();
        table.foreign('vinculo_id').references('id').inTable('prestador_vinculos').onDelete('SET NULL');
        table.index('vinculo_id');
    });

    console.log('✅ Coluna vinculo_id adicionada em dados_mensais');

    // 4. Atualizar dados_mensais com vinculo_id
    console.log('🔄 Vinculando dados mensais aos vínculos...');

    const dadosMensais = await db('dados_mensais').select('id', 'prestador_id');

    for (const dado of dadosMensais) {
        // Buscar primeiro vínculo do prestador
        const vinculo = await db('prestador_vinculos')
            .where('prestador_id', dado.prestador_id)
            .first();

        if (vinculo) {
            await db('dados_mensais')
                .where('id', dado.id)
                .update({ vinculo_id: vinculo.id });
        }
    }

    console.log(`✅ ${dadosMensais.length} registros vinculados`);
    console.log('✅ Migração 007 concluída com sucesso!');
}

async function down() {
    console.log('🔄 Revertendo migração 007...');

    // Remover coluna vinculo_id de dados_mensais
    await db.schema.table('dados_mensais', (table) => {
        table.dropForeign('vinculo_id');
        table.dropColumn('vinculo_id');
    });

    // Dropar tabela prestador_vinculos
    await db.schema.dropTableIfExists('prestador_vinculos');

    console.log('✅ Migração 007 revertida');
}

module.exports = { up, down };
