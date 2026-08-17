/**
 * Configura os vínculos que pagam fixo por turno trabalhado, em vez de fixo mensal.
 *
 * Regra do cliente (08/2026):
 *   Layane — R$ 20 por turno trabalhado. Atende manhã E tarde em dias alternados,
 *            então fecha o mês em ~26 turnos (13 + 13) ≈ R$ 520, perto dos R$ 600
 *            de um fixo mensal cheio.
 *   Bruna Loretta (tarde) — R$ 20 por dia trabalhado. Como ela só faz tarde nesse
 *            vínculo, turnos = dias.
 *
 * A unidade de contagem é a mesma nos dois casos: o par (dia, turno). Quem faz um
 * turno só tem turnos = dias; quem faz os dois conta em dobro.
 *
 * A manhã da Bruna Loretta segue mensal (R$ 600) — ela atende todos os dias.
 *
 * Uso:
 *   DATABASE_URL=<url> NODE_ENV=production node scripts/configurar-fixo-por-turno.js [--apply]
 */

const db = require('../database/connection');

const APPLY = process.argv.includes('--apply');

const ALVOS = [
  { nome: 'Layane de Cássia Araújo Guedes', turno: 'MANHÃ', valor_dia: 20 },
  { nome: 'Bruna Loretta Flores da Silva', turno: 'TARDE', valor_dia: 20 },
];

const chave = (s) => String(s || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

async function main() {
  console.log(`\nFixo por turno trabalhado  [${APPLY ? '⚠️  APLICANDO' : 'DRY-RUN'}]\n`);

  const vinculos = await db('prestador_vinculos as pv')
    .join('usuarios as u', 'u.id', 'pv.prestador_id')
    .where('pv.tipo_contrato', 'prestador')
    .where('pv.ativo', true)
    .whereNull('pv.data_fim')
    .select('pv.id', 'pv.turno', 'pv.unidade', 'pv.especialidade',
            'pv.modelo_fixo', 'pv.valor_fixo_base', 'u.nome');

  for (const alvo of ALVOS) {
    const achados = vinculos.filter(v =>
      chave(v.nome) === chave(alvo.nome) && v.turno === alvo.turno);

    if (!achados.length) {
      console.log(`  ⏭  ${alvo.nome} [${alvo.turno}] — vínculo não encontrado`);
      continue;
    }
    if (achados.length > 1) {
      console.log(`  ⛔ ${alvo.nome} [${alvo.turno}] — ${achados.length} vínculos com a mesma combinação; resolva a duplicata antes`);
      achados.forEach(v => console.log(`        vínculo ${v.id} · ${v.especialidade} ${v.unidade}`));
      continue;
    }

    const v = achados[0];
    console.log(`  ${APPLY ? '✅' : '[dry-run]'} vínculo ${v.id} · ${v.nome} [${v.turno}]`);
    console.log(`        de:   ${v.modelo_fixo || 'mensal'} · R$ ${Number(v.valor_fixo_base || 0).toFixed(2)}`);
    console.log(`        para: por_dia · R$ ${alvo.valor_dia.toFixed(2)} por turno trabalhado`);

    if (APPLY) {
      await db('prestador_vinculos').where('id', v.id).update({
        modelo_fixo: 'por_dia',
        valor_fixo_base: alvo.valor_dia,
      });
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
