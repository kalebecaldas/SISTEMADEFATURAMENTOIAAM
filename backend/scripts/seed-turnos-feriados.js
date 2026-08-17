/**
 * Popula turnos_config e feriados (Fase 2).
 *
 * Horários confirmados pelo cliente em 2026-08-16. ANEXO faz parte da Unidade
 * Vieiralves (mesmo prédio da MATRIZ), então herda o horário dela.
 * A tarde de São José está marcada como suposição — o cliente não informou os
 * dias e o padrão da tarde de Vieiralves é seg-sex. Editável na tela.
 *
 * Idempotente: não duplica linha já existente.
 *
 * Uso:
 *   DATABASE_URL=<url> NODE_ENV=production node scripts/seed-turnos-feriados.js [--apply]
 */

const { db } = require('../database/init');
const { feriadosDoPeriodo } = require('../utils/feriados');

const APPLY = process.argv.includes('--apply');

const SEG_A_SAB = '1,2,3,4,5,6';
const SEG_A_SEX = '1,2,3,4,5';

const TURNOS = [
  { unidade: 'MATRIZ',    turno: 'MANHÃ', hora_inicio: '06:30', hora_fim: '12:00', dias_semana: SEG_A_SAB },
  { unidade: 'MATRIZ',    turno: 'TARDE', hora_inicio: '13:30', hora_fim: '20:00', dias_semana: SEG_A_SEX },
  // ANEXO = mesmo prédio da Vieiralves/MATRIZ
  { unidade: 'ANEXO',     turno: 'MANHÃ', hora_inicio: '06:30', hora_fim: '12:00', dias_semana: SEG_A_SAB },
  { unidade: 'ANEXO',     turno: 'TARDE', hora_inicio: '13:30', hora_fim: '20:00', dias_semana: SEG_A_SEX },
  { unidade: 'SÃO JOSÉ',  turno: 'MANHÃ', hora_inicio: '07:00', hora_fim: '12:00', dias_semana: SEG_A_SAB },
  { unidade: 'SÃO JOSÉ',  turno: 'TARDE', hora_inicio: '13:30', hora_fim: '18:30', dias_semana: SEG_A_SEX },
];

const ANO_INICIAL = 2024;
const ANO_FINAL = 2030;

async function main() {
  console.log(`\nSeed de turnos e feriados  [${APPLY ? '⚠️  APLICANDO' : 'DRY-RUN'}]\n`);

  // ── Turnos ────────────────────────────────────────────────────────────────
  let novosTurnos = 0;
  console.log('TURNOS DE FUNCIONAMENTO');
  for (const t of TURNOS) {
    const existe = await db('turnos_config')
      .where({ unidade: t.unidade, turno: t.turno })
      .whereNull('vigencia_fim')
      .first();
    const dias = t.dias_semana === SEG_A_SAB ? 'seg–sáb' : 'seg–sex';
    if (existe) {
      console.log(`   ✓ ${t.unidade.padEnd(10)} ${t.turno.padEnd(6)} já cadastrado`);
      continue;
    }
    console.log(`   ${APPLY ? '✅' : '[dry-run]'} ${t.unidade.padEnd(10)} ${t.turno.padEnd(6)} ${t.hora_inicio}–${t.hora_fim}  ${dias}`);
    if (APPLY) await db('turnos_config').insert({ ...t, ativo: true });
    novosTurnos++;
  }

  // ── Feriados ──────────────────────────────────────────────────────────────
  console.log(`\nFERIADOS ${ANO_INICIAL}–${ANO_FINAL}`);
  const todos = feriadosDoPeriodo(ANO_INICIAL, ANO_FINAL);
  const jaTem = await db('feriados').select('data', 'nome');
  const chaves = new Set(jaTem.map(f => `${String(f.data).slice(0, 10)}|${f.nome}`));

  const novos = todos.filter(f => !chaves.has(`${f.data}|${f.nome}`));
  console.log(`   ${todos.length} calculados, ${chaves.size} já no banco, ${novos.length} a inserir`);

  if (APPLY && novos.length) {
    // Em lotes para não estourar o limite de parâmetros do driver.
    for (let i = 0; i < novos.length; i += 200) {
      await db('feriados').insert(novos.slice(i, i + 200).map(f => ({
        data: f.data,
        nome: f.nome,
        escopo: f.escopo,
        facultativo: f.facultativo,
        ativo: true,
      })));
    }
    console.log(`   ✅ ${novos.length} feriados inseridos`);
  }

  const porAno = {};
  novos.forEach(f => { const a = f.data.slice(0, 4); porAno[a] = (porAno[a] || 0) + 1; });
  if (Object.keys(porAno).length) {
    console.log('   ' + Object.entries(porAno).map(([a, n]) => `${a}:${n}`).join('  '));
  }

  console.log(`\n${APPLY ? 'Aplicado.' : 'Nada foi escrito. Rode com --apply para efetivar.'}\n`);
  await db.destroy();
}

main().catch(async (e) => {
  console.error('\n❌ FALHOU:', e.message);
  try { await db.destroy(); } catch {}
  process.exit(1);
});
