/**
 * FASE 0 — Correção do regime CLT/PJ em produção.
 *
 * Contexto: profissionais que migraram para CLT continuaram com vínculo PJ ativo e
 * receberam registros em `dados_mensais` nos DOIS regimes, no mesmo mês, sobre o mesmo
 * faturamento (a planilha PJ e a planilha CLT contam o mesmo trabalho).
 *
 * O que faz:
 *   1. Backup completo de prestador_vinculos, dados_mensais e usuarios.
 *   2. Adiciona vigência ao vínculo (data_inicio/data_fim/motivo_encerramento) e
 *      anulação lógica em dados_mensais (anulado/anulado_motivo/anulado_em).
 *   3. Encerra os vínculos PJ ativos de quem tem vínculo CLT ativo hoje, datando o
 *      fim na véspera da primeira competência CLT da pessoa.
 *   4. Anula (sem apagar) os registros PJ desses profissionais em competências nas
 *      quais eles já foram pagos como CLT.
 *   5. Faz merge dos cadastros duplicados: o cadastro com email fictício
 *      @cadastro-rapido.local é absorvido pelo cadastro de email real.
 *
 * Decisões do cliente (2026-08-16):
 *   - Sobreposição: ANULAR sem apagar (auditável e reversível).
 *   - Turno fora do contrato: quem é CLT não é mais PJ. Atendimento em outro turno
 *     vira EXTRA sobre o contrato CLT (implementado na Fase 5), nunca pagamento PJ.
 *
 * Uso:
 *   DATABASE_URL=<url> NODE_ENV=production node scripts/fase0-corrigir-regime-clt.js          # dry-run
 *   DATABASE_URL=<url> NODE_ENV=production node scripts/fase0-corrigir-regime-clt.js --apply  # escreve
 */

const { db } = require('../database/init');

const APPLY = process.argv.includes('--apply');
const STAMP = (process.env.BACKUP_STAMP || '').replace(/[^0-9]/g, '') || null;

// Cadastros duplicados: { absorvido: mantido }. O mantido é sempre o de email real.
const MERGES = { 71: 57, 72: 41 };

const norm = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, '')
  .trim();

const log = (...a) => console.log(...a);
const brl = (v) => `R$ ${(parseFloat(v) || 0).toFixed(2)}`;

/** Véspera da competência informada (AAAAMM) em ISO date. */
function vesperaDaCompetencia(aaaamm) {
  const ano = Math.floor(aaaamm / 100);
  const mes = aaaamm % 100;
  const d = new Date(Date.UTC(ano, mes - 1, 1));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function garantirColunas() {
  const add = async (tabela, coluna, fn, label) => {
    if (await db.schema.hasColumn(tabela, coluna)) {
      log(`   ✓ ${tabela}.${coluna} já existe`);
      return false;
    }
    if (APPLY) {
      await db.schema.table(tabela, fn);
      log(`   ✅ ${tabela}.${coluna} criada — ${label}`);
    } else {
      log(`   [dry-run] criaria ${tabela}.${coluna} — ${label}`);
    }
    return true;
  };

  await add('prestador_vinculos', 'data_inicio', (t) => t.date('data_inicio'), 'início da vigência do contrato');
  await add('prestador_vinculos', 'data_fim', (t) => t.date('data_fim'), 'fim da vigência (null = vigente)');
  await add('prestador_vinculos', 'motivo_encerramento', (t) => t.string('motivo_encerramento', 200), 'por que o contrato acabou');
  await add('dados_mensais', 'anulado', (t) => t.boolean('anulado').defaultTo(false), 'registro desconsiderado dos totais');
  await add('dados_mensais', 'anulado_motivo', (t) => t.string('anulado_motivo', 200), 'justificativa da anulação');
  await add('dados_mensais', 'anulado_em', (t) => t.timestamp('anulado_em'), 'quando foi anulado');
}

async function fazerBackup() {
  const stamp = STAMP || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (const tabela of ['prestador_vinculos', 'dados_mensais', 'usuarios']) {
    const alvo = `bkp_${tabela}_${stamp}`;
    const existe = await db.schema.hasTable(alvo);
    if (existe) {
      log(`   ✓ backup ${alvo} já existe (mantido)`);
      continue;
    }
    if (APPLY) {
      await db.raw(`CREATE TABLE ?? AS SELECT * FROM ??`, [alvo, tabela]);
      const { rows } = await db.raw(`SELECT COUNT(*) n FROM ??`, [alvo]);
      log(`   ✅ backup ${alvo} — ${rows[0].n} linhas`);
    } else {
      log(`   [dry-run] criaria backup ${alvo}`);
    }
  }
  return stamp;
}

async function main() {
  log(`\n${'='.repeat(78)}`);
  log(`FASE 0 — Correção do regime CLT/PJ    [${APPLY ? '⚠️  APLICANDO' : 'DRY-RUN — nada é escrito'}]`);
  log('='.repeat(78));

  // ── 1. Backup ────────────────────────────────────────────────────────────────
  log('\n1) BACKUP');
  const stamp = await fazerBackup();

  // ── 2. Schema ────────────────────────────────────────────────────────────────
  log('\n2) SCHEMA (vigência do vínculo + anulação lógica)');
  await garantirColunas();

  const podeEscreverVigencia = APPLY || await db.schema.hasColumn('prestador_vinculos', 'data_fim');
  const podeAnular = APPLY || await db.schema.hasColumn('dados_mensais', 'anulado');

  // ── 3. Quem é CLT hoje ───────────────────────────────────────────────────────
  log('\n3) IDENTIFICAÇÃO');
  const vinculos = await db('prestador_vinculos as pv')
    .join('usuarios as u', 'u.id', 'pv.prestador_id')
    .select('pv.id as vinculo_id', 'pv.prestador_id', 'pv.tipo_contrato', 'pv.ativo',
            'pv.especialidade', 'pv.unidade', 'pv.turno', 'u.nome', 'u.email');

  const nomesCLT = new Set(
    vinculos.filter(v => v.tipo_contrato === 'clt' && v.ativo).map(v => norm(v.nome))
  );
  const pjParaEncerrar = vinculos.filter(
    v => v.tipo_contrato === 'prestador' && v.ativo && nomesCLT.has(norm(v.nome))
  );
  const idsCLT = [...new Set(
    vinculos.filter(v => nomesCLT.has(norm(v.nome))).map(v => v.prestador_id)
  )];

  log(`   Pessoas com vínculo CLT ativo: ${nomesCLT.size}`);
  log(`   Vínculos PJ ativos a encerrar: ${pjParaEncerrar.length}`);

  // Primeira competência CLT por pessoa (agrupada por nome, não por id — há duplicados)
  const compCLT = await db('dados_mensais as dm')
    .join('usuarios as u', 'u.id', 'dm.prestador_id')
    .where('dm.tipo_colaborador', 'clt')
    .whereIn('dm.prestador_id', idsCLT)
    .groupBy('u.nome')
    .select('u.nome')
    .min({ primeira: db.raw('dm.ano * 100 + dm.mes') });

  const primeiraPorNome = new Map(compCLT.map(r => [norm(r.nome), parseInt(r.primeira, 10)]));

  // ── 4. Encerrar vínculos PJ ──────────────────────────────────────────────────
  log('\n4) ENCERRAR VÍNCULOS PJ DE QUEM É CLT');
  let encerrados = 0;
  for (const v of pjParaEncerrar) {
    const primeira = primeiraPorNome.get(norm(v.nome));
    if (!primeira) {
      log(`   ⏭  ${v.nome} — sem competência CLT registrada, pulando por segurança`);
      continue;
    }
    const dataFim = vesperaDaCompetencia(primeira);
    const motivo = `Migração para CLT em ${String(primeira % 100).padStart(2, '0')}/${Math.floor(primeira / 100)}`;
    log(`   ${APPLY ? '✅' : '[dry-run]'} vínculo ${v.vinculo_id} · ${v.nome} · ${v.especialidade} ${v.turno} ${v.unidade} → data_fim ${dataFim}`);
    if (APPLY && podeEscreverVigencia) {
      await db('prestador_vinculos').where('id', v.vinculo_id).update({
        ativo: false,
        data_fim: dataFim,
        motivo_encerramento: motivo,
      });
    }
    encerrados++;
  }

  // ── 5. Anular registros PJ sobrepostos ───────────────────────────────────────
  log('\n5) ANULAR REGISTROS PJ EM COMPETÊNCIAS JÁ PAGAS COMO CLT');
  const competenciasCLT = await db('dados_mensais')
    .where('tipo_colaborador', 'clt')
    .whereIn('prestador_id', idsCLT)
    .distinct('mes', 'ano');
  const chavesCLT = new Set(competenciasCLT.map(c => `${c.ano}-${c.mes}`));

  const registrosPJ = await db('dados_mensais as dm')
    .join('usuarios as u', 'u.id', 'dm.prestador_id')
    .where('dm.tipo_colaborador', 'prestador')
    .whereIn('dm.prestador_id', idsCLT)
    .select('dm.id', 'dm.mes', 'dm.ano', 'dm.valor_liquido', 'dm.especialidade', 'dm.turno', 'u.nome');

  const aAnular = registrosPJ.filter(r => chavesCLT.has(`${r.ano}-${r.mes}`));
  const total = aAnular.reduce((s, r) => s + (parseFloat(r.valor_liquido) || 0), 0);

  for (const r of aAnular) {
    log(`   ${APPLY ? '✅' : '[dry-run]'} #${r.id} · ${r.nome} · ${String(r.mes).padStart(2, '0')}/${r.ano} · ${r.especialidade} ${r.turno} · ${brl(r.valor_liquido)}`);
  }
  log(`   → ${aAnular.length} registros, ${brl(total)}`);

  if (APPLY && podeAnular && aAnular.length) {
    await db('dados_mensais').whereIn('id', aAnular.map(r => r.id)).update({
      anulado: true,
      anulado_motivo: 'Duplicidade CLT/PJ — profissional já pago como CLT nesta competência',
      anulado_em: db.fn.now(),
    });
  }

  // ── 6. Merge de cadastros duplicados ─────────────────────────────────────────
  log('\n6) MERGE DE CADASTROS DUPLICADOS');
  for (const [absorvidoStr, mantido] of Object.entries(MERGES)) {
    const absorvido = parseInt(absorvidoStr, 10);
    const uA = await db('usuarios').where('id', absorvido).first();
    const uM = await db('usuarios').where('id', mantido).first();
    if (!uA || !uM) {
      log(`   ⏭  ${absorvido} → ${mantido}: um dos cadastros não existe mais, pulando`);
      continue;
    }
    if (norm(uA.nome) !== norm(uM.nome)) {
      log(`   ⛔ ${absorvido} → ${mantido}: nomes divergem ("${uA.nome}" vs "${uM.nome}"), ABORTANDO este merge`);
      continue;
    }

    const nVinc = await db('prestador_vinculos').where('prestador_id', absorvido).count('* as n').first();
    const nDados = await db('dados_mensais').where('prestador_id', absorvido).count('* as n').first();
    const nMap = await db('mapeamento_nomes').where('prestador_id', absorvido).count('* as n').first();

    log(`   ${APPLY ? '✅' : '[dry-run]'} ${uA.nome}: ${absorvido} (${uA.email}) → ${mantido} (${uM.email})`);
    log(`        ${nVinc.n} vínculo(s), ${nDados.n} registro(s) mensais, ${nMap.n} mapeamento(s)`);

    if (APPLY) {
      await db('prestador_vinculos').where('prestador_id', absorvido).update({ prestador_id: mantido });
      await db('dados_mensais').where('prestador_id', absorvido).update({ prestador_id: mantido });
      await db('mapeamento_nomes').where('prestador_id', absorvido).update({ prestador_id: mantido });
      await db('usuarios').where('id', absorvido).del();
      log(`        cadastro ${absorvido} removido`);
    }
  }

  // ── 7. Resumo ────────────────────────────────────────────────────────────────
  log(`\n${'='.repeat(78)}`);
  log(`RESUMO ${APPLY ? '(APLICADO)' : '(DRY-RUN)'}`);
  log(`  Vínculos PJ encerrados ......... ${encerrados}`);
  log(`  Registros PJ anulados .......... ${aAnular.length}  (${brl(total)})`);
  log(`  Cadastros mesclados ............ ${Object.keys(MERGES).length}`);
  log(`  Backup ......................... bkp_*_${stamp}`);
  if (!APPLY) log(`\n  Nada foi escrito. Rode de novo com --apply para efetivar.`);
  log('='.repeat(78) + '\n');

  await db.destroy();
}

main().catch(async (e) => {
  console.error('\n❌ FALHOU:', e.message);
  console.error(e.stack);
  try { await db.destroy(); } catch {}
  process.exit(1);
});
