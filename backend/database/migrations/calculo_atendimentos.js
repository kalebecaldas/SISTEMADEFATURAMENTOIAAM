const db = require('../connection');

async function migrarCalculoAtendimentos() {
  try {
    // 1. Adicionar valor_fixo_base e desconto_por_falta em prestador_vinculos
    const hasValorFixoBase = await db.schema.hasColumn('prestador_vinculos', 'valor_fixo_base');
    if (!hasValorFixoBase) {
      await db.schema.table('prestador_vinculos', (table) => {
        table.decimal('valor_fixo_base', 10, 2).nullable().defaultTo(null);
        table.decimal('desconto_por_falta', 10, 2).nullable().defaultTo(20);
      });
      console.log('✅ Colunas valor_fixo_base e desconto_por_falta adicionadas a prestador_vinculos');
    } else {
      console.log('ℹ️  Colunas de cálculo já existem em prestador_vinculos');
    }

    // 2. Criar tabela comissoes_tabela
    const hasComissoes = await db.schema.hasTable('comissoes_tabela');
    if (!hasComissoes) {
      await db.schema.createTable('comissoes_tabela', (table) => {
        table.increments('id').primary();
        table.string('especialidade', 50).notNullable();
        table.string('unidade', 20).nullable();
        table.decimal('pct_sem_meta', 5, 2).nullable();
        table.decimal('pct_com_meta', 5, 2).nullable();
        table.string('tipo_contrato', 20).defaultTo('prestador');
        table.boolean('ativo').defaultTo(true);
        table.datetime('created_at').defaultTo(db.fn.now());
      });
      console.log('✅ Tabela comissoes_tabela criada');

      // Inserir registros MATRIZ/SJ (estáveis há 12+ meses)
      await db('comissoes_tabela').insert([
        // PJ — Matriz/Anexo
        { especialidade: 'RPG',        unidade: 'MATRIZ', pct_sem_meta: 20, pct_com_meta: 22, tipo_contrato: 'prestador' },
        { especialidade: 'RPG',        unidade: 'ANEXO',  pct_sem_meta: 20, pct_com_meta: 22, tipo_contrato: 'prestador' },
        { especialidade: 'Acup',       unidade: 'MATRIZ', pct_sem_meta: 16, pct_com_meta: 18, tipo_contrato: 'prestador' },
        { especialidade: 'Acup',       unidade: 'ANEXO',  pct_sem_meta: 16, pct_com_meta: 18, tipo_contrato: 'prestador' },
        { especialidade: 'Fisio',      unidade: 'MATRIZ', pct_sem_meta: 12, pct_com_meta: 14, tipo_contrato: 'prestador' },
        { especialidade: 'Fisio',      unidade: 'ANEXO',  pct_sem_meta: 12, pct_com_meta: 14, tipo_contrato: 'prestador' },
        { especialidade: 'Neuro',      unidade: 'MATRIZ', pct_sem_meta: 20, pct_com_meta: 22, tipo_contrato: 'prestador' },
        { especialidade: 'Neuro',      unidade: 'ANEXO',  pct_sem_meta: 20, pct_com_meta: 22, tipo_contrato: 'prestador' },
        // PJ — São José
        { especialidade: 'SJRPG',      unidade: 'SÃO JOSÉ', pct_sem_meta: 22, pct_com_meta: 22, tipo_contrato: 'prestador' },
        { especialidade: 'RPG',        unidade: 'SÃO JOSÉ', pct_sem_meta: 22, pct_com_meta: 22, tipo_contrato: 'prestador' },
        { especialidade: 'SJAcup',     unidade: 'SÃO JOSÉ', pct_sem_meta: 16, pct_com_meta: 18, tipo_contrato: 'prestador' },
        { especialidade: 'Acup',       unidade: 'SÃO JOSÉ', pct_sem_meta: 16, pct_com_meta: 18, tipo_contrato: 'prestador' },
        { especialidade: 'SJFisio',    unidade: 'SÃO JOSÉ', pct_sem_meta: 16, pct_com_meta: 18, tipo_contrato: 'prestador' },
        { especialidade: 'Fisio',      unidade: 'SÃO JOSÉ', pct_sem_meta: 16, pct_com_meta: 18, tipo_contrato: 'prestador' },
      ]);
      console.log('✅ Tabela MATRIZ/SJ populada com 14 registros');
    } else {
      console.log('ℹ️  Tabela comissoes_tabela já existe');
    }

    // 3. Criar tabela mapeamento_nomes
    const hasMapeamento = await db.schema.hasTable('mapeamento_nomes');
    if (!hasMapeamento) {
      await db.schema.createTable('mapeamento_nomes', (table) => {
        table.increments('id').primary();
        table.string('nome_planilha', 255).notNullable();
        table.integer('prestador_id').references('id').inTable('usuarios').nullable();
        table.integer('vinculo_id').references('id').inTable('prestador_vinculos').nullable();
        table.datetime('created_at').defaultTo(db.fn.now());
        table.unique('nome_planilha');
      });
      console.log('✅ Tabela mapeamento_nomes criada');
    } else {
      console.log('ℹ️  Tabela mapeamento_nomes já existe');
    }

  } catch (error) {
    console.error('❌ Erro na migration calculo_atendimentos:', error);
    throw error;
  }
}

/**
 * Desativa vínculos com turno INDEFINIDO que são redundantes:
 * o mesmo prestador_id + especialidade + unidade já tem um vínculo com turno específico (MANHÃ/TARDE).
 *
 * Idempotente: verifica antes de rodar e reporta quantos foram desativados.
 */
async function limparVinculosIndefinidosRedundantes() {
  try {
    // Contar quantos seriam afetados antes de rodar
    const afetados = await db.raw(`
      SELECT COUNT(*) as total FROM prestador_vinculos
      WHERE turno = 'INDEFINIDO'
        AND ativo = 1
        AND EXISTS (
          SELECT 1 FROM prestador_vinculos pv2
          WHERE pv2.prestador_id  = prestador_vinculos.prestador_id
            AND pv2.especialidade = prestador_vinculos.especialidade
            AND pv2.unidade       = prestador_vinculos.unidade
            AND pv2.tipo_contrato = prestador_vinculos.tipo_contrato
            AND pv2.turno NOT IN ('INDEFINIDO')
            AND pv2.ativo = 1
        )
    `);

    const total = afetados[0]?.total ?? afetados?.total ?? 0;

    if (total === 0) {
      console.log('ℹ️  Nenhum vínculo INDEFINIDO redundante encontrado — limpeza não necessária');
      return;
    }

    await db.raw(`
      UPDATE prestador_vinculos SET ativo = 0
      WHERE turno = 'INDEFINIDO'
        AND ativo = 1
        AND EXISTS (
          SELECT 1 FROM prestador_vinculos pv2
          WHERE pv2.prestador_id  = prestador_vinculos.prestador_id
            AND pv2.especialidade = prestador_vinculos.especialidade
            AND pv2.unidade       = prestador_vinculos.unidade
            AND pv2.tipo_contrato = prestador_vinculos.tipo_contrato
            AND pv2.turno NOT IN ('INDEFINIDO')
            AND pv2.ativo = 1
        )
    `);

    console.log(`✅ ${total} vínculo(s) INDEFINIDO redundante(s) desativados com sucesso`);
  } catch (error) {
    console.error('❌ Erro na limpeza de vínculos INDEFINIDO redundantes:', error);
    throw error;
  }
}

/**
 * Cria vínculos CLT iniciais para os 10 profissionais CLT conhecidos.
 * Idempotente: verifica antes de inserir. Também atualiza tipo_colaborador = 'clt' no usuario.
 */
async function criarVinculosCLTIniciais() {
  const CLT_PROFISSIONAIS = [
    { nome: 'Leiliany Palmeira da Silva',       especialidade: 'Acupuntura', unidade: 'MATRIZ', turno: 'TARDE', valor_fixo_base: 2200, meta_mensal: 18000 },
    { nome: 'Nicholas Timoteo Roque da Silva',  especialidade: 'Acupuntura', unidade: 'ANEXO',  turno: 'TARDE', valor_fixo_base: 2200, meta_mensal: 18000 },
    { nome: 'Renata Mariana Leão Miyake',       especialidade: 'Acupuntura', unidade: 'MATRIZ', turno: 'MANHÃ', valor_fixo_base: 2200, meta_mensal: 18000 },
    { nome: 'Douglas Almeida da Silva',         especialidade: 'Fisio',      unidade: 'MATRIZ', turno: 'MANHÃ', valor_fixo_base: 3745, meta_mensal: 25000 },
    { nome: 'Fernanda Tayanara de Jesus',       especialidade: 'Fisio',      unidade: 'MATRIZ', turno: 'MANHÃ', valor_fixo_base: 3745, meta_mensal: 25000 },
    { nome: 'Jackeline Tavares do Nascimento',  especialidade: 'Fisio',      unidade: 'MATRIZ', turno: 'TARDE', valor_fixo_base: 3745, meta_mensal: 25000 },
    { nome: 'Nialen dos Santos Melo',           especialidade: 'Fisio',      unidade: 'MATRIZ', turno: 'TARDE', valor_fixo_base: 3745, meta_mensal: 25000 },
    { nome: 'Joiceane Martins de Brito',        especialidade: 'Neuro',      unidade: 'MATRIZ', turno: 'TARDE', valor_fixo_base: 3745, meta_mensal: 16000 },
    { nome: 'Luziane Seixas de Almeida',        especialidade: 'Neuro',      unidade: 'MATRIZ', turno: 'MANHÃ', valor_fixo_base: 3745, meta_mensal: 16000 },
    { nome: 'Mariane do Amaral Felix',          especialidade: 'RPG',        unidade: 'MATRIZ', turno: 'TARDE', valor_fixo_base: 3745, meta_mensal: 15000 },
  ];

  try {
    let criados = 0;
    let jaCriados = 0;

    for (const prof of CLT_PROFISSIONAIS) {
      // Localizar o usuario por nome (busca flexível)
      const usuario = await db('usuarios')
        .where('nome', 'like', `%${prof.nome.split(' ')[0]}%`)
        .andWhere('nome', 'like', `%${prof.nome.split(' ').pop()}%`)
        .where('tipo', 'prestador')
        .first();

      if (!usuario) {
        console.log(`⚠️  CLT: usuário não encontrado: ${prof.nome}`);
        continue;
      }

      // Verificar se vínculo CLT ativo já existe
      const vinculoAtivo = await db('prestador_vinculos')
        .where({
          prestador_id: usuario.id,
          tipo_contrato: 'clt',
          especialidade: prof.especialidade,
          unidade: prof.unidade,
          turno: prof.turno,
          ativo: 1,
        })
        .first();

      if (vinculoAtivo) {
        jaCriados++;
        continue;
      }

      // Se existir vínculo CLT inativo, reativar em vez de criar novo
      const vinculoInativo = await db('prestador_vinculos')
        .where({
          prestador_id: usuario.id,
          tipo_contrato: 'clt',
          especialidade: prof.especialidade,
          unidade: prof.unidade,
          turno: prof.turno,
        })
        .where('ativo', 0)
        .first();

      if (vinculoInativo) {
        await db('prestador_vinculos').where('id', vinculoInativo.id).update({
          ativo: 1,
          valor_fixo_base: prof.valor_fixo_base,
          meta_mensal: prof.meta_mensal,
        });
        await db('usuarios').where('id', usuario.id).update({ tipo_colaborador: 'clt' });
        console.log(`♻️  CLT vínculo reativado: ${usuario.nome} (${prof.especialidade} ${prof.turno})`);
        criados++;
        continue;
      }

      // Criar vínculo CLT novo
      await db('prestador_vinculos').insert({
        prestador_id:       usuario.id,
        tipo_contrato:      'clt',
        especialidade:      prof.especialidade,
        unidade:            prof.unidade,
        turno:              prof.turno,
        valor_fixo_base:    prof.valor_fixo_base,
        desconto_por_falta: 20,
        meta_mensal:        prof.meta_mensal,
        ativo:              1,
      });

      // Atualizar tipo_colaborador do usuario para 'clt'
      await db('usuarios').where('id', usuario.id).update({ tipo_colaborador: 'clt' });

      criados++;
      console.log(`✅ CLT vínculo criado: ${usuario.nome} (${prof.especialidade} ${prof.turno})`);
    }

    if (criados > 0) {
      console.log(`✅ ${criados} vínculo(s) CLT inicial(is) criado(s)`);
    } else if (jaCriados > 0) {
      console.log(`ℹ️  Vínculos CLT iniciais já existiam (${jaCriados} encontrados)`);
    }
  } catch (error) {
    console.error('❌ Erro ao criar vínculos CLT iniciais:', error);
    throw error;
  }
}

module.exports = { migrarCalculoAtendimentos, limparVinculosIndefinidosRedundantes, criarVinculosCLTIniciais };
