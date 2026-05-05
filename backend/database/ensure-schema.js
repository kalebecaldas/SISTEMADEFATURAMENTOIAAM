/**
 * Script para GARANTIR que todas as tabelas e colunas existam
 * Roda sempre que o servidor iniciar
 */

const db = require('./connection');

async function ensureSchema() {
    console.log('🔍 Verificando esquema do banco de dados...\n');

    try {
        // ========================================
        // TABELA: usuarios
        // ========================================
        const hasUsuarios = await db.schema.hasTable('usuarios');
        if (!hasUsuarios) {
            await db.schema.createTable('usuarios', (table) => {
                table.increments('id').primary();
                table.string('email').unique().notNullable();
                table.string('senha').notNullable();
                table.string('nome').notNullable();
                table.string('tipo').defaultTo('prestador'); // admin, master, prestador
                table.boolean('ativo').defaultTo(true);
                table.string('especialidade');
                table.text('unidades'); // JSON array
                table.decimal('meta_mensal', 10, 2);
                table.string('status').defaultTo('ativo');
                table.boolean('cadastro_confirmado').defaultTo(false);
                table.string('token_confirmacao');
                table.timestamps(true, true);
            });
            console.log('✅ Tabela usuarios criada');
        } else {
            console.log('✓ Tabela usuarios existe');

            // Garantir colunas adicionais
            const colunas = ['especialidade', 'unidades', 'meta_mensal', 'status', 'cadastro_confirmado', 'token_confirmacao'];
            for (const col of colunas) {
                const hasCol = await db.schema.hasColumn('usuarios', col);
                if (!hasCol) {
                    await db.schema.table('usuarios', (table) => {
                        if (col === 'meta_mensal') table.decimal(col, 10, 2);
                        else if (col === 'cadastro_confirmado' || col === 'ativo') table.boolean(col).defaultTo(false);
                        else if (col === 'unidades') table.text(col);
                        else table.string(col);
                    });
                    console.log(`  ✅ Coluna ${col} adicionada em usuarios`);
                }
            }

            // tipo_colaborador em usuarios (PJ/CLT/prestador_servico) — usado no cadastro rápido e edição
            const hasTipoColaboradorUsuario = await db.schema.hasColumn('usuarios', 'tipo_colaborador');
            if (!hasTipoColaboradorUsuario) {
                await db.schema.table('usuarios', (table) => {
                    table.string('tipo_colaborador', 30).defaultTo('prestador_servico');
                });
                console.log('  ✅ Coluna tipo_colaborador adicionada em usuarios');
            }
        }

        // ========================================
        // TABELA: prestador_vinculos
        // ========================================
        const hasVinculos = await db.schema.hasTable('prestador_vinculos');
        if (!hasVinculos) {
            await db.schema.createTable('prestador_vinculos', (table) => {
                table.increments('id').primary();
                table.integer('prestador_id').unsigned().notNullable();
                table.string('tipo_contrato').defaultTo('prestador'); // prestador ou clt
                table.string('turno', 20); // MANHÃ, TARDE, INTEGRAL
                table.string('especialidade', 100);
                table.string('unidade', 100);
                table.decimal('meta_mensal', 10, 2);
                table.boolean('ativo').defaultTo(true);
                table.timestamp('created_at').defaultTo(db.fn.now());

                table.foreign('prestador_id').references('id').inTable('usuarios').onDelete('CASCADE');
                table.index('prestador_id');
                table.index(['prestador_id', 'turno', 'especialidade']);
            });
            console.log('✅ Tabela prestador_vinculos criada');
        } else {
            console.log('✓ Tabela prestador_vinculos existe');

            // Garantir coluna tipo_contrato
            const hasTipoContrato = await db.schema.hasColumn('prestador_vinculos', 'tipo_contrato');
            if (!hasTipoContrato) {
                await db.schema.table('prestador_vinculos', (table) => {
                    table.string('tipo_contrato').defaultTo('prestador');
                });
                console.log('  ✅ Coluna tipo_contrato adicionada em prestador_vinculos');
            }
        }

        // ========================================
        // TABELA: dados_mensais (COMPLETA!)
        // ========================================
        const hasDadosMensais = await db.schema.hasTable('dados_mensais');
        if (!hasDadosMensais) {
            await db.schema.createTable('dados_mensais', (table) => {
                table.increments('id').primary();
                table.integer('prestador_id').unsigned().notNullable();
                table.integer('vinculo_id').unsigned();
                table.integer('mes').notNullable();
                table.integer('ano').notNullable();
                table.string('tipo_colaborador').defaultTo('prestador'); // prestador ou clt
                table.integer('dia_inicio').defaultTo(1);
                table.integer('dia_fim');

                // Valores financeiros
                table.decimal('valor_liquido', 10, 2).notNullable();
                table.decimal('valor_bruto', 10, 2);
                table.decimal('valor_clinica', 10, 2); // Faturamento bruto
                table.decimal('valor_profissional', 10, 2);
                table.decimal('valor_fixo', 10, 2);
                table.decimal('valor_original', 10, 2);
                table.decimal('valor_editado', 10, 2);
                table.boolean('foi_editado').defaultTo(false);
                table.text('motivo_edicao');
                table.decimal('meta_mensal', 10, 2);
                table.decimal('valor_clinica_meta', 10, 2);
                table.decimal('valor_prof_part_oab', 10, 2);
                table.decimal('extras', 10, 2).defaultTo(0);
                table.string('turno', 50);
                table.boolean('turno_manha').defaultTo(false);
                table.boolean('turno_tarde').defaultTo(false);
                table.text('observacoes_edicao');

                // Outros campos
                table.integer('faltas').defaultTo(0);
                table.boolean('meta_batida').defaultTo(false);
                table.string('especialidade');
                table.string('unidade');

                table.timestamps(true, true);

                table.foreign('prestador_id').references('id').inTable('usuarios').onDelete('CASCADE');
                table.foreign('vinculo_id').references('id').inTable('prestador_vinculos').onDelete('SET NULL');
                table.unique(['vinculo_id', 'mes', 'ano', 'turno']);
                table.index(['mes', 'ano']);
            });
            console.log('✅ Tabela dados_mensais criada (COMPLETA)');
        } else {
            console.log('✓ Tabela dados_mensais existe');

            // Garantir TODAS as colunas
            const colunasNecessarias = {
                'vinculo_id': 'integer',
                'tipo_colaborador': 'string',
                'dia_inicio': 'integer',
                'dia_fim': 'integer',
                'valor_clinica': 'decimal',
                'valor_profissional': 'decimal',
                'valor_fixo': 'decimal',
                'valor_original': 'decimal',
                'valor_editado': 'decimal',
                'foi_editado': 'boolean',
                'motivo_edicao': 'text',
                'meta_mensal': 'decimal',
                'valor_clinica_meta': 'decimal',
                'valor_prof_part_oab': 'decimal',
                'extras': 'decimal',
                'turno': 'string',
                'turno_manha': 'boolean',
                'turno_tarde': 'boolean',
                'observacoes_edicao': 'text'
            };

            for (const [coluna, tipo] of Object.entries(colunasNecessarias)) {
                const hasCol = await db.schema.hasColumn('dados_mensais', coluna);
                if (!hasCol) {
                    await db.schema.table('dados_mensais', (table) => {
                        if (tipo === 'decimal') {
                            table.decimal(coluna, 10, 2);
                        } else if (tipo === 'integer') {
                            table.integer(coluna);
                        } else if (tipo === 'boolean') {
                            table.boolean(coluna).defaultTo(false);
                        } else if (tipo === 'text') {
                            table.text(coluna);
                        } else {
                            table.string(coluna);
                        }
                    });
                    console.log(`  ✅ Coluna ${coluna} adicionada em dados_mensais`);
                }
            }

            // Garantir UNIQUE (vinculo_id, mes, ano, turno) no PostgreSQL
            // Sem essa constraint o ON CONFLICT da rota /confirmar falha
            const clientName = (db.client && db.client.config && db.client.config.client) || '';
            const isPg = clientName === 'pg' || clientName === 'postgres' || clientName === 'postgresql';
            if (isPg) {
                try {
                    // Remover possíveis constraints antigas que conflitam com a nova
                    await db.raw(`
                        ALTER TABLE dados_mensais
                        DROP CONSTRAINT IF EXISTS dados_mensais_prestador_id_vinculo_id_mes_ano_unique
                    `).catch(() => {});
                    await db.raw(`
                        DROP INDEX IF EXISTS dados_mensais_prestador_id_vinculo_id_mes_ano_unique
                    `).catch(() => {});

                    // Criar índice único que o ON CONFLICT espera
                    await db.raw(`
                        CREATE UNIQUE INDEX IF NOT EXISTS dados_mensais_vinculo_mes_ano_turno_unique
                        ON dados_mensais (vinculo_id, mes, ano, turno)
                    `);
                    console.log('  ✅ Índice UNIQUE (vinculo_id, mes, ano, turno) garantido em dados_mensais');
                } catch (e) {
                    console.warn('  ⚠️  Não foi possível criar índice UNIQUE em dados_mensais:', e.message);
                }
            }
        }

        // ========================================
        // TABELA: notas_fiscais
        // ========================================
        const hasNotas = await db.schema.hasTable('notas_fiscais');
        if (!hasNotas) {
            await db.schema.createTable('notas_fiscais', (table) => {
                table.increments('id').primary();
                table.integer('prestador_id').unsigned().notNullable();
                table.integer('mes').notNullable();
                table.integer('ano').notNullable();
                table.string('arquivo_path');
                table.string('status').defaultTo('pendente'); // pendente, enviada, aprovada, rejeitada
                table.datetime('data_envio');
                table.datetime('data_aprovacao');
                table.text('observacoes');
                table.text('motivo_rejeicao');
                table.timestamps(true, true);

                table.foreign('prestador_id').references('id').inTable('usuarios').onDelete('CASCADE');
            });
            console.log('✅ Tabela notas_fiscais criada');
        } else {
            console.log('✓ Tabela notas_fiscais existe');
        }

        // ========================================
        // TABELA: configuracoes
        // ========================================
        const hasConfig = await db.schema.hasTable('configuracoes');
        if (!hasConfig) {
            await db.schema.createTable('configuracoes', (table) => {
                table.increments('id').primary();
                table.string('chave').unique().notNullable();
                table.string('valor').notNullable();
                table.string('descricao');
                table.timestamps(true, true);
            });
            console.log('✅ Tabela configuracoes criada');

            // Inserir configs padrão
            await db('configuracoes').insert([
                { chave: 'prazo_nota_fiscal', valor: '15', descricao: 'Prazo em dias para envio da nota fiscal' },
                { chave: 'meta_padrao', valor: '5000', descricao: 'Meta padrão em reais' },
                { chave: 'sistema_ativo', valor: '1', descricao: 'Status do sistema (1=ativo, 0=inativo)' }
            ]).onConflict('chave').ignore();
        } else {
            console.log('✓ Tabela configuracoes existe');
        }

        // ========================================
        // TABELA: contratos
        // ========================================
        const hasContratos = await db.schema.hasTable('contratos');
        if (!hasContratos) {
            await db.schema.createTable('contratos', (table) => {
                table.increments('id').primary();
                table.string('nome').notNullable();
                table.text('descricao');
                table.string('arquivo_template');
                table.boolean('ativo').defaultTo(true);
                table.timestamps(true, true);
            });
            console.log('✅ Tabela contratos criada');
        } else {
            console.log('✓ Tabela contratos existe');
        }

        // ========================================
        // TABELA: comprovantes_pagamento
        // ========================================
        const hasComprovantes = await db.schema.hasTable('comprovantes_pagamento');
        if (!hasComprovantes) {
            await db.schema.createTable('comprovantes_pagamento', (table) => {
                table.increments('id').primary();
                table.integer('dados_mensais_id').unsigned().notNullable();
                table.string('arquivo_path').notNullable();
                table.datetime('data_upload').defaultTo(db.fn.now());
                table.timestamps(true, true);

                table.foreign('dados_mensais_id').references('id').inTable('dados_mensais').onDelete('CASCADE');
            });
            console.log('✅ Tabela comprovantes_pagamento criada');
        } else {
            console.log('✓ Tabela comprovantes_pagamento existe');
        }

        console.log('\n✅ Esquema do banco validado e atualizado!\n');

    } catch (error) {
        console.error('❌ Erro ao validar esquema:', error);
        throw error;
    }
}

module.exports = { ensureSchema };
