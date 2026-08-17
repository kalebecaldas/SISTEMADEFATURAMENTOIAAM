/**
 * Recalcula uma competência já salva a partir da planilha crua de Atendimentos,
 * sem passar pela tela.
 *
 * Serve para quando a CONFIGURAÇÃO mudou depois do fechamento — fixo, escala,
 * modelo de pagamento, comissão — e os valores gravados ficaram velhos. Reenviar
 * a planilha pela tela faria o mesmo, mas obriga a refazer as quatro etapas.
 *
 * NUNCA sobrescreve linha com foi_editado: valor ajustado à mão pelo admin tem
 * precedência sobre a fórmula. Só recalcula o que o sistema mesmo produziu.
 *
 * Uso:
 *   DATABASE_URL=<url> NODE_ENV=production \
 *     node scripts/reprocessar-competencia.js "<atendimentos.xlsx>" <mes> <ano> [--tipo=clt] [--apply]
 */

const path = require('path');
const XLSX = require('xlsx');
const db = require('../database/connection');
const { processarAtendimentos } = require('../services/calculoAtendimentos');

const APPLY = process.argv.includes('--apply');
const tipoArg = process.argv.find(a => a.startsWith('--tipo='));
const TIPO = tipoArg ? tipoArg.split('=')[1] : 'prestador';
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const [ARQUIVO, MES, ANO] = args;

if (!ARQUIVO || !MES || !ANO) {
  console.error('Uso: node scripts/reprocessar-competencia.js "<arquivo>" <mes> <ano> [--tipo=clt] [--apply]');
  process.exit(1);
}

const brl = (v) => `R$ ${(Number(v) || 0).toFixed(2)}`;

async function main() {
  const mes = parseInt(MES, 10);
  const ano = parseInt(ANO, 10);
  console.log(`\n${'='.repeat(92)}`);
  console.log(`REPROCESSAR ${String(mes).padStart(2, '0')}/${ano} (${TIPO})  ·  ${path.basename(ARQUIVO)}  ·  ${APPLY ? '⚠️  APLICANDO' : 'DRY-RUN'}`);
  console.log('='.repeat(92));

  const wb = XLSX.readFile(ARQUIVO, { raw: true });
  const aba = wb.SheetNames.find(n => n.toLowerCase().trim() === 'atendimentos');
  if (!aba) throw new Error(`Aba "Atendimentos" não encontrada. Abas: ${wb.SheetNames.join(', ')}`);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: null });

  const { calculados } = await processarAtendimentos(rows, TIPO);

  const salvos = await db('dados_mensais as d')
    .join('usuarios as u', 'u.id', 'd.prestador_id')
    .where({ 'd.mes': mes, 'd.ano': ano, 'd.tipo_colaborador': TIPO })
    .where(q => q.where('d.anulado', false).orWhereNull('d.anulado'))
    .select('d.id', 'd.vinculo_id', 'd.turno', 'd.valor_bruto', 'd.valor_fixo',
            'd.foi_editado', 'u.nome');

  const porVinculo = new Map(salvos.map(s => [`${s.vinculo_id}|${s.turno}`, s]));

  const mudancas = [];
  const protegidas = [];
  const semLinha = [];

  for (const c of calculados) {
    if (c.valor_bruto == null) continue;
    const alvo = porVinculo.get(`${c.vinculo_id}|${c.turno}`)
      || salvos.find(s => s.vinculo_id === c.vinculo_id);
    if (!alvo) { semLinha.push(c); continue; }

    const antes = Number(alvo.valor_bruto) || 0;
    const depois = c.valor_bruto;
    if (Math.abs(depois - antes) < 0.01) continue;

    if (alvo.foi_editado) { protegidas.push({ alvo, antes, depois }); continue; }
    mudancas.push({ alvo, antes, depois, fixo: c.fixo_ajustado || 0, item: c });
  }

  if (mudancas.length) {
    console.log('\nALTERAÇÕES');
    console.log('  ' + 'profissional'.padEnd(32) + 'turno'.padEnd(8) + 'antes'.padStart(11) + 'depois'.padStart(12) + 'diferença'.padStart(12) + '   fixo');
    console.log('  ' + '-'.repeat(88));
    for (const m of mudancas) {
      const d = m.depois - m.antes;
      console.log('  ' + String(m.alvo.nome).slice(0, 30).padEnd(32) + String(m.alvo.turno).padEnd(8)
        + m.antes.toFixed(2).padStart(11) + m.depois.toFixed(2).padStart(12)
        + ((d >= 0 ? '+' : '') + d.toFixed(2)).padStart(12) + '   ' + m.fixo.toFixed(2));
    }
    const total = mudancas.reduce((s, m) => s + (m.depois - m.antes), 0);
    console.log(`\n  ${mudancas.length} linha(s), diferença total: ${brl(total)}`);
  } else {
    console.log('\nNenhuma alteração — os valores gravados já refletem a configuração atual.');
  }

  if (protegidas.length) {
    console.log('\n🔒 PRESERVADAS (ajuste manual do admin tem precedência sobre a fórmula):');
    protegidas.forEach(p => console.log(
      `     ${String(p.alvo.nome).slice(0, 30).padEnd(32)}${String(p.alvo.turno).padEnd(8)}`
      + `mantém ${p.antes.toFixed(2)}  (fórmula daria ${p.depois.toFixed(2)})`));
  }

  if (semLinha.length) {
    console.log(`\n⚠️  ${semLinha.length} profissional(is) calculado(s) sem linha salva nesta competência:`);
    semLinha.forEach(c => console.log(`     ${String(c.nome).slice(0, 34)} [${c.turno}] — ${brl(c.valor_bruto)}`));
    console.log('     → este script só ATUALIZA o que já existe; para incluir alguém novo, use o upload.');
  }

  if (APPLY && mudancas.length) {
    for (const m of mudancas) {
      await db('dados_mensais').where('id', m.alvo.id).update({
        valor_bruto: m.depois,
        valor_liquido: m.depois,
        valor_original: m.depois,
        valor_fixo: m.fixo,
      });
    }
    console.log(`\n✅ ${mudancas.length} linha(s) atualizada(s).`);
  } else if (mudancas.length) {
    console.log('\nNada foi escrito. Rode com --apply para efetivar.');
  }

  const totalFinal = await db('dados_mensais')
    .where({ mes, ano, tipo_colaborador: TIPO })
    .where(q => q.where('anulado', false).orWhereNull('anulado'))
    .sum('valor_bruto as t').first();
  console.log(`\nTotal da competência ${APPLY ? 'agora' : 'hoje'}: ${brl(totalFinal.t)}`);
  console.log('='.repeat(92) + '\n');

  await db.destroy();
}

main().catch(async (e) => {
  console.error('\n❌ FALHOU:', e.message);
  try { await db.destroy(); } catch {}
  process.exit(1);
});
