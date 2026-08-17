/**
 * Ajustes pontuais informados pelo cliente no fechamento de julho/2026.
 *
 *   Ana Clara dos Santos Costa — saiu da clínica. Encerra o vínculo com data_fim
 *     em vez de só desativar, para que nenhum upload futuro a ressuscite.
 *   Laysa Palmira — férias. A janela veio do próprio histórico: ela atende
 *     seg/qua/sex e some exatamente entre 20/07 e 27/07 (faltam 22 e 24).
 *
 * Idempotente. Uso:
 *   DATABASE_URL=<url> NODE_ENV=production node scripts/ajustes-julho-2026.js [--apply]
 */

const { db } = require('../database/init');

const APPLY = process.argv.includes('--apply');

const SAIRAM = [
  { nome: 'Ana Clara dos Santos Costa', data_fim: '2026-07-31', motivo: 'Saiu da clínica (informado em 08/2026)' },
];

const AUSENCIAS = [
  {
    nome: 'Laysa Palmira Nogueira de Aquino',
    tipo: 'ferias',
    data_inicio: '2026-07-21',
    data_fim: '2026-07-26',
    observacao: 'Férias — janela deduzida do histórico (ausente 22/07 e 24/07, escala seg/qua/sex)',
  },
];

const chave = (s) => String(s || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

async function acharUsuario(nome) {
  const todos = await db('usuarios').where('tipo', 'prestador').select('id', 'nome');
  return todos.find(u => chave(u.nome) === chave(nome)) || null;
}

async function main() {
  console.log(`\nAjustes de julho/2026  [${APPLY ? '⚠️  APLICANDO' : 'DRY-RUN'}]\n`);

  console.log('SAÍDAS');
  for (const s of SAIRAM) {
    const u = await acharUsuario(s.nome);
    if (!u) { console.log(`   ⏭  ${s.nome} — não encontrado`); continue; }
    const vincs = await db('prestador_vinculos')
      .where('prestador_id', u.id).whereNull('data_fim').select('id', 'especialidade', 'unidade', 'turno');
    if (!vincs.length) { console.log(`   ✓ ${s.nome} — já encerrado`); continue; }
    for (const v of vincs) {
      console.log(`   ${APPLY ? '✅' : '[dry-run]'} vínculo ${v.id} · ${s.nome} · ${v.especialidade} ${v.turno} ${v.unidade} → data_fim ${s.data_fim}`);
      if (APPLY) {
        await db('prestador_vinculos').where('id', v.id).update({
          ativo: false, data_fim: s.data_fim, motivo_encerramento: s.motivo,
        });
      }
    }
  }

  console.log('\nAUSÊNCIAS PROGRAMADAS');
  for (const a of AUSENCIAS) {
    const u = await acharUsuario(a.nome);
    if (!u) { console.log(`   ⏭  ${a.nome} — não encontrado`); continue; }
    const existe = await db('ausencias_programadas')
      .where({ prestador_id: u.id, tipo: a.tipo, data_inicio: a.data_inicio, data_fim: a.data_fim })
      .first();
    if (existe) { console.log(`   ✓ ${a.nome} — ${a.tipo} ${a.data_inicio}→${a.data_fim} já registrada`); continue; }
    console.log(`   ${APPLY ? '✅' : '[dry-run]'} ${a.nome} · ${a.tipo} · ${a.data_inicio} → ${a.data_fim}`);
    if (APPLY) {
      await db('ausencias_programadas').insert({
        prestador_id: u.id,
        vinculo_id: null,           // férias são da pessoa, valem para todos os turnos
        tipo: a.tipo,
        data_inicio: a.data_inicio,
        data_fim: a.data_fim,
        observacao: a.observacao,
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
