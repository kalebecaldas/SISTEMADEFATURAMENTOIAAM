/**
 * Remove faltas detectadas que deixaram de valer.
 *
 * A detecção de uma competência era gravada por upsert e nunca limpa, então
 * mudar a escala de alguém deixava para trás os dias que não são mais esperados.
 * Em julho/2026, 84 das 115 linhas eram desse tipo — a Layane tinha 13 faltas em
 * terça/quinta/sábado depois de virar seg/qua/sex.
 *
 * Recalcula a detecção a partir da planilha crua e apaga o que não aparece mais.
 * Nunca toca em falta 'confirmada' ou 'justificada': isso é decisão do admin.
 *
 * Uso:
 *   DATABASE_URL=<url> NODE_ENV=production \
 *     node scripts/limpar-faltas-obsoletas.js "<atendimentos.xlsx>" <mes> <ano> [--tipo=prestador] [--apply]
 */

const path = require('path');
const XLSX = require('xlsx');
const { db } = require('../database/init');
const { processarAtendimentos } = require('../services/calculoAtendimentos');
const { detectarFaltas } = require('../services/detectorFaltas');

const APPLY = process.argv.includes('--apply');
const tipoArg = process.argv.find(a => a.startsWith('--tipo='));
const TIPO = tipoArg ? tipoArg.split('=')[1] : 'prestador';
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const [ARQUIVO, MES, ANO] = args;

if (!ARQUIVO || !MES || !ANO) {
  console.error('Uso: node scripts/limpar-faltas-obsoletas.js "<arquivo>" <mes> <ano> [--tipo=clt] [--apply]');
  process.exit(1);
}

const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function periodoDaCompetencia(mes, ano, tipo) {
  if (tipo === 'clt') {
    return { inicio: new Date(Date.UTC(ano, mes - 2, 26)), fim: new Date(Date.UTC(ano, mes - 1, 25)) };
  }
  return { inicio: new Date(Date.UTC(ano, mes - 1, 1)), fim: new Date(Date.UTC(ano, mes, 0)) };
}

async function main() {
  const mes = parseInt(MES, 10);
  const ano = parseInt(ANO, 10);
  console.log(`\nLimpeza de faltas obsoletas · ${String(mes).padStart(2, '0')}/${ano} (${TIPO}) · ${path.basename(ARQUIVO)}  [${APPLY ? '⚠️  APLICANDO' : 'DRY-RUN'}]\n`);

  const wb = XLSX.readFile(ARQUIVO, { raw: true });
  const aba = wb.SheetNames.find(n => n.toLowerCase().trim() === 'atendimentos');
  if (!aba) throw new Error(`Aba "Atendimentos" não encontrada. Abas: ${wb.SheetNames.join(', ')}`);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: null });

  const resultado = await processarAtendimentos(rows, TIPO);
  const validas = await detectarFaltas(rows, resultado.calculados, periodoDaCompetencia(mes, ano, TIPO));
  const chaves = new Set(validas.map(f => `${f.vinculo_id}|${f.data}|${f.turno}`));

  const gravadas = await db('faltas_detectadas as f')
    .join('usuarios as u', 'u.id', 'f.prestador_id')
    .where({ 'f.mes': mes, 'f.ano': ano })
    .select('f.id', 'f.vinculo_id', 'f.data', 'f.turno', 'f.status', 'u.nome');

  const obsoletas = gravadas.filter(g =>
    !chaves.has(`${g.vinculo_id}|${iso(g.data)}|${g.turno}`)
    && ['suspeita', 'descartada'].includes(g.status));

  const protegidas = gravadas.filter(g =>
    !chaves.has(`${g.vinculo_id}|${iso(g.data)}|${g.turno}`)
    && !['suspeita', 'descartada'].includes(g.status));

  console.log(`  gravadas no banco ... ${gravadas.length}`);
  console.log(`  válidas hoje ........ ${validas.length}`);
  console.log(`  obsoletas ........... ${obsoletas.length}`);
  if (protegidas.length) {
    console.log(`  ⚠️  ${protegidas.length} obsoleta(s) já decidida(s) pelo admin — preservada(s)`);
  }

  if (obsoletas.length) {
    const porPessoa = {};
    obsoletas.forEach(o => { porPessoa[o.nome] = (porPessoa[o.nome] || 0) + 1; });
    console.log('\n  a remover, por profissional:');
    Object.entries(porPessoa).sort((a, b) => b[1] - a[1])
      .forEach(([nome, n]) => console.log(`     ${String(nome).slice(0, 34).padEnd(36)}${n}`));

    const amostra = obsoletas.slice(0, 5);
    console.log('\n  amostra:');
    amostra.forEach(o => {
      const d = iso(o.data);
      console.log(`     ${String(o.nome).slice(0, 28).padEnd(30)}${d} ${DIA[new Date(`${d}T00:00:00Z`).getUTCDay()]} ${o.turno}`);
    });
  }

  if (APPLY && obsoletas.length) {
    await db('faltas_detectadas').whereIn('id', obsoletas.map(o => o.id)).del();
    console.log(`\n  ✅ ${obsoletas.length} removida(s).`);
  } else if (obsoletas.length) {
    console.log('\n  Rode com --apply para remover.');
  }

  console.log('');
  await db.destroy();
}

main().catch(async (e) => {
  console.error('\n❌ FALHOU:', e.message);
  try { await db.destroy(); } catch {}
  process.exit(1);
});
