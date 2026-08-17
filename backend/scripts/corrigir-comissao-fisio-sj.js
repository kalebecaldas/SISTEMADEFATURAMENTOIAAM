/**
 * Corrige o percentual de "Fisio @ SÃO JOSÉ" na comissoes_tabela.
 *
 * Regra confirmada na planilha (Janeiro e Maio/2026): quem define o percentual é a
 * COLUNA DE ESPECIALIDADE, não a unidade. Na mesma unidade São José convivem:
 *   Silvino  → especialidade "Fisio"    → 12% / 14%
 *   Thalita  → especialidade "SJFisio"  → 16% / 18%
 *   Eduardo  → especialidade "SJAcup"   → 16% / 18%
 *
 * O banco tinha "Fisio @ SÃO JOSÉ" com 16/18, o que pagava o Silvino a 18% quando o
 * contrato dele é 14%. Derivado da planilha: E/AB = 12,0% e AD/AB = 14,0%.
 *
 * Uso:
 *   DATABASE_URL=<url> NODE_ENV=production node scripts/corrigir-comissao-fisio-sj.js [--apply]
 */

const { db } = require('../database/init');

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`\nCorreção de comissão · Fisio @ SÃO JOSÉ  [${APPLY ? '⚠️  APLICANDO' : 'DRY-RUN'}]\n`);

  const alvo = await db('comissoes_tabela')
    .where({ especialidade: 'Fisio', unidade: 'SÃO JOSÉ' })
    .first();

  if (!alvo) {
    console.log('Linha "Fisio @ SÃO JOSÉ" não encontrada — nada a fazer.');
  } else {
    console.log(`  de:   sem_meta=${alvo.pct_sem_meta}%  com_meta=${alvo.pct_com_meta}%`);
    console.log(`  para: sem_meta=12%  com_meta=14%   (igual a Fisio MATRIZ/ANEXO)\n`);

    if (APPLY) {
      await db('comissoes_tabela')
        .where({ especialidade: 'Fisio', unidade: 'SÃO JOSÉ' })
        .update({ pct_sem_meta: 12, pct_com_meta: 14 });
      console.log('  ✅ atualizado\n');
    }
  }

  const tabela = await db('comissoes_tabela')
    .where('ativo', true)
    .select('especialidade', 'unidade', 'pct_sem_meta', 'pct_com_meta')
    .orderBy(['especialidade', 'unidade']);
  console.log('Tabela de comissões atual:');
  console.table(tabela);

  if (!APPLY) console.log('Nada foi escrito. Rode com --apply para efetivar.\n');
  await db.destroy();
}

main().catch(async (e) => {
  console.error('\n❌ FALHOU:', e.message);
  try { await db.destroy(); } catch {}
  process.exit(1);
});
