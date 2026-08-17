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

            // Vigência do contrato. data_fim preenchida = encerrado (ex: migrou de PJ
            // para CLT) e o vínculo nunca mais casa com planilha nem é reativado.
            const colunasVigencia = {
                'data_inicio': (table) => table.date('data_inicio'),
                'data_fim': (table) => table.date('data_fim'),
                'motivo_encerramento': (table) => table.string('motivo_encerramento', 200),
            };
            for (const [coluna, fn] of Object.entries(colunasVigencia)) {
                if (!await db.schema.hasColumn('prestador_vinculos', coluna)) {
                    await db.schema.table('prestador_vinculos', fn);
                    console.log(`  ✅ Coluna ${coluna} adicionada em prestador_vinculos`);
                }
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
                'observacoes_edicao': 'text',
                // Anulação lógica: registro fica no histórico para auditoria mas sai
                // de todos os totais (usado na duplicidade CLT/PJ de 2026).
                'anulado': 'boolean',
                'anulado_motivo': 'string',
                'anulado_em': 'timestamp'
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
                        } else if (tipo === 'timestamp') {
                            table.timestamp(coluna);
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

        // ========================================
        // TABELA: turnos_config  (Fase 2)
        // Horário de funcionamento por unidade + turno. É a base do detector de
        // faltas: sem saber que dias/horas a unidade abre, não dá pra dizer que
        // a ausência de atendimento num dia foi falta.
        // Tem vigência porque horário muda com o tempo e recalcular uma
        // competência antiga precisa usar o horário que valia na época.
        // ========================================
        if (!await db.schema.hasTable('turnos_config')) {
            await db.schema.createTable('turnos_config', (table) => {
                table.increments('id').primary();
                table.string('unidade', 100).notNullable();
                table.string('turno', 20).notNullable();          // MANHÃ | TARDE
                table.string('hora_inicio', 5).notNullable();     // "06:30"
                table.string('hora_fim', 5).notNullable();        // "12:00"
                // Dias da semana em ISO: 1=segunda ... 7=domingo. Guardado como
                // CSV ("1,2,3,4,5,6") para funcionar igual em SQLite e Postgres.
                table.string('dias_semana', 20).notNullable().defaultTo('1,2,3,4,5');
                table.date('vigencia_inicio');
                table.date('vigencia_fim');
                table.boolean('ativo').defaultTo(true);
                table.timestamps(true, true);
                table.index(['unidade', 'turno']);
            });
            console.log('✅ Tabela turnos_config criada');
        } else {
            console.log('✓ Tabela turnos_config existe');
        }

        // ========================================
        // TABELA: feriados  (Fase 2)
        // Dia sem expediente não pode virar falta. escopo: nacional | estadual |
        // municipal | unidade (recesso próprio da clínica).
        // ========================================
        if (!await db.schema.hasTable('feriados')) {
            await db.schema.createTable('feriados', (table) => {
                table.increments('id').primary();
                table.date('data').notNullable();
                table.string('nome', 160).notNullable();
                table.string('escopo', 20).defaultTo('nacional');
                table.string('unidade', 100);   // null = vale para todas
                table.boolean('facultativo').defaultTo(false);
                table.boolean('ativo').defaultTo(true);
                table.timestamps(true, true);
                table.index(['data']);
            });
            console.log('✅ Tabela feriados criada');
        } else {
            console.log('✓ Tabela feriados existe');
        }

        // ========================================
        // TABELA: faltas_detectadas  (Fase 3)
        // Resultado do detector. NUNCA desconta sozinho: nasce como 'suspeita' e
        // só entra no cálculo depois que o admin confirma. Guardamos o motivo
        // pré-classificado para a conferência ser rápida.
        // ========================================
        if (!await db.schema.hasTable('faltas_detectadas')) {
            await db.schema.createTable('faltas_detectadas', (table) => {
                table.increments('id').primary();
                table.integer('prestador_id').unsigned().notNullable();
                table.integer('vinculo_id').unsigned();
                table.integer('mes').notNullable();
                table.integer('ano').notNullable();
                table.date('data').notNullable();
                table.string('turno', 20).notNullable();
                table.string('unidade', 100);
                // suspeita | confirmada | justificada | descartada
                table.string('status', 20).defaultTo('suspeita');
                // feriado | fora_da_vigencia | atendeu_outro_turno | sem_motivo
                table.string('motivo_deteccao', 40);
                table.string('justificativa', 200);
                table.integer('confirmado_por').unsigned();
                table.timestamp('confirmado_em');
                table.timestamps(true, true);

                table.foreign('prestador_id').references('id').inTable('usuarios').onDelete('CASCADE');
                table.foreign('vinculo_id').references('id').inTable('prestador_vinculos').onDelete('CASCADE');
                table.unique(['vinculo_id', 'data', 'turno']);
                table.index(['mes', 'ano', 'status']);
            });
            console.log('✅ Tabela faltas_detectadas criada');
        } else {
            console.log('✓ Tabela faltas_detectadas existe');
        }

        console.log('\n✅ Esquema do banco validado e atualizado!\n');

    } catch (error) {
        console.error('❌ Erro ao validar esquema:', error);
        throw error;
    }
}

module.exports = { ensureSchema };
