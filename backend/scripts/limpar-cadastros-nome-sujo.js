/**
 * Limpa cadastros criados pelo "cadastro rápido" com o nome CRU da planilha.
 *
 * O formulário pré-preenchia com `nome_planilha`, então o profissional era salvo como
 * "Pilates Tarde - Christie Anne Clementino Silva - CREFITO: 382419". Esse cadastro
 * nunca mais casa com nenhuma planilha e ainda vira duplicata a cada tentativa.
 *
 * Faz duas coisas:
 *   1. Limpa o nome (mesma regra do normalizarNomePlanilha) e regenera o email
 *      @cadastro-rapido.local a partir do nome limpo.
 *   2. Quando sobram dois cadastros para a mesma pessoa, mantém o mais novo,
 *      reaponta vínculos/dados/mapeamentos e apaga o outro.
 *
 * Uso:
 *   DATABASE_URL=<url> NODE_ENV=production node scripts/limpar-cadastros-nome-sujo.js [--apply]
 */

const { db } = require('../database/init');
const { normalizarNomePlanilha } = require('../services/calculoAtendimentos');

const APPLY = process.argv.includes('--apply');

const chave = (s) => String(s || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

const emailDe = (nome) => `${nome.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '.')
  .replace(/^\.|\.$/g, '')}@cadastro-rapido.local`;

async function main() {
  console.log(`\nLimpeza de cadastros com nome cru  [${APPLY ? '⚠️  APLICANDO' : 'DRY-RUN'}]\n`);

  const sujos = await db('usuarios')
    .where('tipo', 'prestador')
    .where(q => q
      .whereRaw("nome ~* '(CRM|CRF|CREFITO|CREFONO|COREN|CRO|CRN|CRP|CRBM|CRESS|CRMV)\\s*:'")
      .orWhereRaw("nome ~* '^(pilates\\s+(manh[ãa]|tarde)|toc\\s*-)'"))
    .select('id', 'nome', 'email');

  if (!sujos.length) {
    console.log('Nenhum cadastro com nome cru encontrado.');
    await db.destroy();
    return;
  }

  // Agrupa pelo nome já limpo para descobrir duplicatas da mesma pessoa.
  const porPessoa = new Map();
  for (const u of sujos) {
    const limpo = normalizarNomePlanilha(u.nome);
    const k = chave(limpo);
    if (!porPessoa.has(k)) porPessoa.set(k, { limpo, ids: [] });
    porPessoa.get(k).ids.push(u);
  }

  for (const [, grupo] of porPessoa) {
    // Também considera cadastros já limpos da mesma pessoa, para não criar um terceiro.
    const jaLimpos = await db('usuarios')
      .where('tipo', 'prestador')
      .whereNotIn('id', grupo.ids.map(u => u.id))
      .select('id', 'nome', 'email');
    const irmaos = jaLimpos.filter(u => chave(u.nome) === chave(grupo.limpo));

    // Quem fica é o cadastro com mais histórico, não o mais novo: o "Lana Sabrina
    // Castro Said" original (#67, 20+ competências) tem que absorver o
    // "Pilates Manhã - Lana Sabrina Castro Said" criado ontem, e não o contrário.
    // Critério: email real > mais registros em dados_mensais > id menor.
    const comPeso = [];
    for (const u of [...grupo.ids, ...irmaos]) {
      const { n } = await db('dados_mensais').where('prestador_id', u.id).count('* as n').first();
      comPeso.push({ ...u, regs: parseInt(n, 10) || 0, real: !String(u.email || '').includes('@cadastro-rapido.local') });
    }
    const candidatos = comPeso.sort((a, b) =>
      (b.real - a.real) || (b.regs - a.regs) || (a.id - b.id));
    const manter = candidatos[0];
    const absorver = candidatos.slice(1);

    console.log(`  ${grupo.limpo}`);
    console.log(`     manter  #${manter.id}  "${manter.nome}"`);
    for (const u of absorver) console.log(`     absorver #${u.id}  "${u.nome}"`);

    if (APPLY) {
      for (const u of absorver) {
        await db('prestador_vinculos').where('prestador_id', u.id).update({ prestador_id: manter.id });
        await db('dados_mensais').where('prestador_id', u.id).update({ prestador_id: manter.id });
        await db('mapeamento_nomes').where('prestador_id', u.id).update({ prestador_id: manter.id });
        await db('usuarios').where('id', u.id).del();
      }
      await db('usuarios').where('id', manter.id).update({
        nome: grupo.limpo,
        email: manter.email && !manter.email.includes('@cadastro-rapido.local')
          ? manter.email
          : emailDe(grupo.limpo),
      });
      console.log(`     ✅ nome corrigido para "${grupo.limpo}"`);
    }

    // Vínculos duplicados na mesma combinação viram um só.
    const vincs = await db('prestador_vinculos')
      .where('prestador_id', APPLY ? manter.id : candidatos[0].id)
      .select('id', 'especialidade', 'unidade', 'turno', 'tipo_contrato', 'ativo');
    const vistos = new Map();
    for (const v of vincs.sort((a, b) => a.id - b.id)) {
      const k = `${v.tipo_contrato}|${v.especialidade}|${v.unidade}|${v.turno}`;
      if (!vistos.has(k)) { vistos.set(k, v); continue; }
      console.log(`     vínculo ${v.id} é duplicata de ${vistos.get(k).id} (${k})`);
      if (APPLY) {
        // mapeamento_nomes.vinculo_id também aponta pra cá — sem reapontar, o delete
        // esbarra na foreign key.
        await db('dados_mensais').where('vinculo_id', v.id).update({ vinculo_id: vistos.get(k).id });
        await db('mapeamento_nomes').where('vinculo_id', v.id).update({ vinculo_id: vistos.get(k).id });
        await db('prestador_vinculos').where('id', v.id).del();
      }
    }
    // O vínculo que sobra precisa estar ativo para casar no próximo upload.
    if (APPLY) {
      for (const v of vistos.values()) {
        await db('prestador_vinculos').where('id', v.id).update({ ativo: true });
      }
    }
  }

  if (!APPLY) console.log('\nNada foi escrito. Rode com --apply para efetivar.');
  console.log('');
  await db.destroy();
}

main().catch(async (e) => {
  console.error('\n❌ FALHOU:', e.message);
  try { await db.destroy(); } catch {}
  process.exit(1);
});
