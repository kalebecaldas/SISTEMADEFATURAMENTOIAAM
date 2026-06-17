/**
 * Runner para importar histórico completo para a produção (PostgreSQL Railway).
 * Lê lista_import.json, checa quais meses já existem no banco e pula os que já têm dados.
 *
 * Uso:
 *   DATABASE_URL=<url_publica> NODE_ENV=production node scripts/runImportProducao.js [--force]
 *
 * --force: reimporta mesmo meses que já têm dados (apaga os existentes primeiro)
 */

const path = require('path');
const lista = require('./lista_import.json');
const { importarArquivo } = require('./importarHistorico');
const { db } = require('../database/init');

const PLANILHAS_BASE = path.resolve(__dirname, '../../planilhas antigas e novas');
const FORCE = process.argv.includes('--force');

async function checarExiste(mes, ano, tipo_colaborador) {
  const tipo = tipo_colaborador || 'prestador';
  const count = await db('dados_mensais')
    .where({ mes, ano, tipo_colaborador: tipo })
    .count('* as total')
    .first();
  return parseInt(count.total) > 0;
}

async function main() {
  console.log(`\n🚀 Iniciando importação histórica para PRODUÇÃO`);
  console.log(`📂 Base de planilhas: ${PLANILHAS_BASE}`);
  console.log(`🔄 Modo: ${FORCE ? 'FORCE (apaga dados existentes)' : 'SKIP (pula meses com dados)'}\n`);

  let importados = 0, pulados = 0, erros = 0;

  for (const entrada of lista) {
    const { caminho, aba, mes, ano, tipo_colaborador = 'prestador' } = entrada;
    const caminhoCompleto = path.join(PLANILHAS_BASE, caminho);

    const label = `${String(mes).padStart(2,'0')}/${ano} [${tipo_colaborador}] — ${path.basename(caminho)}`;

    const existe = await checarExiste(mes, ano, tipo_colaborador);

    if (existe && !FORCE) {
      console.log(`⏭  Pulando ${label} (já existe no banco)`);
      pulados++;
      continue;
    }

    if (existe && FORCE) {
      await db('dados_mensais').where({ mes, ano, tipo_colaborador }).del();
      console.log(`🗑  Dados ${label} apagados para reimportação`);
    }

    try {
      const resultado = await importarArquivo({ caminho: caminhoCompleto, aba, mes, ano, tipo_colaborador });

      if (resultado.erro) {
        console.error(`❌ ERRO em ${label}: ${resultado.erro}`);
        erros++;
      } else {
        console.log(`✅ ${label} — ${resultado.processados} registros, R$ ${resultado.valorTotal?.toFixed(2)}`);
        importados++;
      }
    } catch (e) {
      console.error(`❌ EXCEÇÃO em ${label}: ${e.message}`);
      erros++;
    }
  }

  console.log(`\n📊 Resultado final:`);
  console.log(`   ✅ Importados: ${importados}`);
  console.log(`   ⏭  Pulados:   ${pulados}`);
  console.log(`   ❌ Erros:     ${erros}`);
  process.exit(erros > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
