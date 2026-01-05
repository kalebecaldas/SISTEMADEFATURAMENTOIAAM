const { db } = require('../init');

/**
 * Migração para adicionar tabelas do sistema de contratos
 */
const adicionarTabelasContratos = async () => {
    try {
        console.log('🔧 Criando tabelas do sistema de contratos...');

        // 1. Tabela de modelos de contratos
        const hasContratosModelos = await db.schema.hasTable('contratos_modelos');
        if (!hasContratosModelos) {
            await db.schema.createTable('contratos_modelos', (table) => {
                table.increments('id').primary();
                table.string('nome').notNullable();
                table.string('tipo').notNullable(); // 'profissional' ou 'estagio'
                table.string('especialidade');
                table.string('unidade'); // 'Matriz' ou 'São José'
                table.string('arquivo_path', 500).notNullable();
                table.text('campos_json'); // JSON com campos configuráveis
                table.decimal('meta_mensal', 10, 2); // Meta mensal do contrato
                table.boolean('ativo').defaultTo(true);
                table.timestamps(true, true);
            });
            console.log('✅ Tabela contratos_modelos criada');
        } else {
            // Verificar se coluna meta_mensal existe
            const hasMetaMensal = await db.schema.hasColumn('contratos_modelos', 'meta_mensal');
            if (!hasMetaMensal) {
                await db.schema.table('contratos_modelos', (table) => {
                    table.decimal('meta_mensal', 10, 2);
                });
                console.log('✅ Coluna meta_mensal adicionada a contratos_modelos');
            }
        }

        // 2. Tabela de contratos gerados
        const hasContratosGerados = await db.schema.hasTable('contratos_gerados');
        if (!hasContratosGerados) {
            await db.schema.createTable('contratos_gerados', (table) => {
                table.increments('id').primary();
                table.integer('prestador_id').unsigned().notNullable()
                    .references('id').inTable('usuarios').onDelete('CASCADE');
                table.integer('modelo_id').unsigned().notNullable()
                    .references('id').inTable('contratos_modelos').onDelete('RESTRICT');
                table.string('arquivo_path', 500).notNullable();
                table.text('dados_json'); // Dados usados no preenchimento
                table.date('data_geracao').notNullable();
                table.date('data_assinatura');
                table.string('status', 50).defaultTo('gerado'); // 'gerado', 'assinado', 'cancelado'
                table.text('observacoes');
                table.timestamps(true, true);
            });
            console.log('✅ Tabela contratos_gerados criada');
        }

        // 3. Tabela de documentos do prestador
        const hasDocumentosPrestador = await db.schema.hasTable('documentos_prestador');
        if (!hasDocumentosPrestador) {
            await db.schema.createTable('documentos_prestador', (table) => {
                table.increments('id').primary();
                table.integer('prestador_id').unsigned().notNullable()
                    .references('id').inTable('usuarios').onDelete('CASCADE');
                table.string('tipo', 100).notNullable(); // 'contrato', 'comprovante', 'documento_geral'
                table.string('categoria', 100);
                table.string('nome_arquivo').notNullable();
                table.string('arquivo_path', 500).notNullable();
                table.integer('tamanho_bytes');
                table.string('mime_type', 100);
                table.text('descricao');
                table.date('data_upload').notNullable();
                table.integer('uploaded_by').unsigned()
                    .references('id').inTable('usuarios');
                table.timestamps(true, true);
            });
            console.log('✅ Tabela documentos_prestador criada');

            // Criar índices para melhor performance
            await db.schema.table('documentos_prestador', (table) => {
                table.index('prestador_id');
                table.index('tipo');
            });
            console.log('✅ Índices criados em documentos_prestador');
        }

        console.log('✅ Todas as tabelas de contratos criadas com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao criar tabelas de contratos:', error);
        throw error;
    }
};

module.exports = { adicionarTabelasContratos };
