/**
 * Migration: especialidades_clt
 *
 * Cria a tabela de configuração CLT e garante colunas necessárias em dados_mensais.
 * Idempotente: usa hasTable / hasColumn antes de qualquer operação.
 *
 * REGRA DE NEGÓCIO:
 *   CLT → valor_bruto = valor_clinica_total × pct_com_meta  (quando meta batida)
 *   PJ  → valor_bruto calculado excluindo Particular/OAB da base da meta
 */

const db = require('../connection');

async function criarEspecialidadesClt() {
  try {
    // ──────────────────────────────────────────────
    // 1. Tabela especialidades_clt
    // ──────────────────────────────────────────────
    const hasTable = await db.schema.hasTable('especialidades_clt');
    if (!hasTable) {
      await db.schema.createTable('especialidades_clt', (table) => {
        table.increments('id').primary();
        table.string('especialidade', 100).notNullable().unique();
        table.string('label', 100);
        table.decimal('meta_mensal', 10, 2).nullable();
        table.decimal('salario_base', 10, 2).defaultTo(0);
        // % aplicada sobre valor_clinica_total quando meta batida
        table.decimal('pct_com_meta', 5, 2).defaultTo(0);
        // % alternativa aplicada quando fat. está abaixo de limiar_meta_extra
        table.decimal('pct_meta_extra', 5, 2).defaultTo(0);
        table.decimal('limiar_meta_extra', 10, 2).defaultTo(0);
        table.decimal('desconto_por_falta', 10, 2).defaultTo(0);
        table.boolean('tem_calculo_automatico').defaultTo(true);
        table.text('observacoes').nullable();
        table.boolean('ativo').defaultTo(true);
        table.timestamps(true, true);
      });
      console.log('✅ Tabela especialidades_clt criada');

      // Seed com especialidades CLT conhecidas
      await db('especialidades_clt').insert([
        {
          especialidade: 'Fisio',
          label: 'Fisioterapia CLT',
          meta_mensal: 25000,
          salario_base: 3745,
          pct_com_meta: 20,
          pct_meta_extra: 0,
          limiar_meta_extra: 0,
          desconto_por_falta: 20,
          tem_calculo_automatico: true,
        },
        {
          especialidade: 'Neuro',
          label: 'Neurologia CLT',
          meta_mensal: 16000,
          salario_base: 3745,
          pct_com_meta: 30,
          pct_meta_extra: 0,
          limiar_meta_extra: 0,
          desconto_por_falta: 20,
          tem_calculo_automatico: true,
        },
        {
          especialidade: 'Acupuntura',
          label: 'Acupuntura CLT',
          meta_mensal: 18000,
          salario_base: 2200,
          pct_com_meta: 20,
          pct_meta_extra: 17,
          limiar_meta_extra: 30000,
          desconto_por_falta: 20,
          tem_calculo_automatico: true,
        },
        {
          especialidade: 'RPG',
          label: 'RPG CLT',
          meta_mensal: 15000,
          salario_base: 3745,
          pct_com_meta: 20,
          pct_meta_extra: 0,
          limiar_meta_extra: 0,
          desconto_por_falta: 20,
          tem_calculo_automatico: true,
        },
      ]);
      console.log('✅ especialidades_clt populada com 4 registros (Fisio, Neuro, Acup, RPG)');
    } else {
      console.log('ℹ️  Tabela especialidades_clt já existe');

      // Garantir colunas que podem ter sido adicionadas depois
      const colsToCheck = [
        ['label',                 () => t => t.string('label', 100).nullable()],
        ['salario_base',          () => t => t.decimal('salario_base', 10, 2).defaultTo(0)],
        ['pct_meta_extra',        () => t => t.decimal('pct_meta_extra', 5, 2).defaultTo(0)],
        ['limiar_meta_extra',     () => t => t.decimal('limiar_meta_extra', 10, 2).defaultTo(0)],
        ['desconto_por_falta',    () => t => t.decimal('desconto_por_falta', 10, 2).defaultTo(0)],
        ['tem_calculo_automatico',() => t => t.boolean('tem_calculo_automatico').defaultTo(true)],
        ['observacoes',           () => t => t.text('observacoes').nullable()],
        ['ativo',                 () => t => t.boolean('ativo').defaultTo(true)],
      ];
      for (const [col, addFn] of colsToCheck) {
        const has = await db.schema.hasColumn('especialidades_clt', col);
        if (!has) {
          await db.schema.table('especialidades_clt', addFn());
          console.log(`  ✅ Coluna ${col} adicionada em especialidades_clt`);
        }
      }
    }

    // ──────────────────────────────────────────────
    // 2. Colunas adicionais em dados_mensais
    // ──────────────────────────────────────────────
    const colsDadosMensais = [
      // CLT usa este campo como base da meta (faturamento bruto total)
      ['valor_clinica_total',   () => t => t.decimal('valor_clinica_total', 10, 2).nullable()],
      ['observacoes_edicao',    () => t => t.text('observacoes_edicao').nullable()],
      ['editado_por',           () => t => t.integer('editado_por').nullable()],
      ['valor_bruto_original',  () => t => t.decimal('valor_bruto_original', 10, 2).nullable()],
    ];
    for (const [col, addFn] of colsDadosMensais) {
      const has = await db.schema.hasColumn('dados_mensais', col);
      if (!has) {
        await db.schema.table('dados_mensais', addFn());
        console.log(`  ✅ Coluna ${col} adicionada em dados_mensais`);
      }
    }

    // ──────────────────────────────────────────────
    // 3. Colunas adicionais em comissoes_tabela (PJ)
    // ──────────────────────────────────────────────
    const hasCt = await db.schema.hasTable('comissoes_tabela');
    if (hasCt) {
      const colsCt = [
        ['valor_fixo_base', () => t => t.decimal('valor_fixo_base', 10, 2).defaultTo(0)],
        ['meta_mensal',     () => t => t.decimal('meta_mensal', 10, 2).nullable()],
        ['nao_possui_meta', () => t => t.boolean('nao_possui_meta').defaultTo(false)],
        ['nao_possui_fixo', () => t => t.boolean('nao_possui_fixo').defaultTo(false)],
      ];
      for (const [col, addFn] of colsCt) {
        const has = await db.schema.hasColumn('comissoes_tabela', col);
        if (!has) {
          await db.schema.table('comissoes_tabela', addFn());
          console.log(`  ✅ Coluna ${col} adicionada em comissoes_tabela`);
        }
      }
    }

    console.log('✅ Migration especialidades_clt concluída');
  } catch (error) {
    console.error('❌ Erro na migration especialidades_clt:', error);
    throw error;
  }
}

module.exports = { criarEspecialidadesClt };
