/**
 * Sincroniza a configuração dos vínculos PJ ativos a partir de uma planilha mensal
 * já conferida (a aba do mês, não a Atendimentos).
 *
 * Motivo: o motor de cálculo já agrega a planilha crua com precisão de centavos —
 * o que sai errado é a CONFIGURAÇÃO do vínculo. Em Jan/2026, 21 dos 23 vínculos PJ
 * ativos estavam sem `valor_fixo_base`, o que sozinho gerou R$ 5.780,00 de diferença
 * numa única competência.
 *
 * Sincroniza três campos, lendo as colunas da aba do mês:
 *   B (1) → especialidade   — é a CHAVE DA COMISSÃO. Na planilha, quem decide o
 *                             percentual é esta coluna, não a unidade: no mesmo
 *                             São José convivem "Fisio" (12/14%) e "SJFisio" (16/18%).
 *   F (5) → valor_fixo_base
 *   G (6) → meta_mensal     ('N/P' = sem meta)
 *
 * Uso:
 *   DATABASE_URL=<url> NODE_ENV=production \
 *     node scripts/sincronizar-vinculos-planilha.js "<caminho.xlsm>" "<Aba>" [--apply]
 */

const path = require('path');
const XLSX = require('xlsx');
const { db } = require('../database/init');

const FLAGS = ['--apply', '--criar-faltantes'];
const args = process.argv.slice(2).filter(a => !FLAGS.includes(a));
const APPLY = process.argv.includes('--apply');
const CRIAR = process.argv.includes('--criar-faltantes');
const ARQUIVO = args[0];
const ABA = args[1];

if (!ARQUIVO || !ABA) {
  console.error('Uso: node scripts/sincronizar-vinculos-planilha.js "<arquivo>" "<Aba>" [--apply]');
  process.exit(1);
}

const norm = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\((tarde|manh[ãa])\)/g, '')
  .replace(/[^a-z0-9 ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const turnoDaLinha = (nome) => {
  if (/\(tarde\)/i.test(nome)) return 'TARDE';
  if (/\(manh[ãa]\)/i.test(nome)) return 'MANHÃ';
  return null;
};

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const igual = (a, b) => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(parseFloat(a) - parseFloat(b)) < 0.005;
};

async function main() {
  console.log(`\n${'='.repeat(84)}`);
  console.log(`SINCRONIZAR VÍNCULOS  ·  ${path.basename(ARQUIVO)} / aba "${ABA}"  ·  ${APPLY ? '⚠️  APLICANDO' : 'DRY-RUN'}`);
  console.log('='.repeat(84));

  const wb = XLSX.readFile(ARQUIVO, { raw: true });
  const nomeAba = wb.SheetNames.find(n => n.toLowerCase().trim() === ABA.toLowerCase().trim());
  if (!nomeAba) {
    throw new Error(`Aba "${ABA}" não encontrada. Disponíveis: ${wb.SheetNames.join(', ')}`);
  }
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nomeAba], { header: 1, defval: null });

  // Linhas úteis: têm nome e faturamento numérico em D. Descarta cabeçalho e totais.
  const daPlanilha = [];
  for (const r of linhas.slice(1)) {
    const nome = r[0];
    if (!nome || String(nome).trim().length < 4) continue;
    if (num(r[3]) == null) continue;
    if (/valor total|^total/i.test(String(nome))) continue;
    daPlanilha.push({
      nome: String(nome).trim(),
      chave: norm(nome),
      turno: turnoDaLinha(String(nome)),
      especialidade: r[1] ? String(r[1]).trim() : null,
      unidade: r[2] ? String(r[2]).trim() : null,
      valor_fixo_base: num(r[5]),
      meta_mensal: num(r[6]),
    });
  }
  console.log(`\n${daPlanilha.length} linhas úteis na planilha\n`);

  const vinculos = await db('prestador_vinculos as pv')
    .join('usuarios as u', 'u.id', 'pv.prestador_id')
    .where('pv.tipo_contrato', 'prestador')
    .where('pv.ativo', true)
    .whereNull('pv.data_fim')
    .select('pv.id', 'pv.prestador_id', 'pv.especialidade', 'pv.unidade', 'pv.turno',
            'pv.valor_fixo_base', 'pv.meta_mensal', 'u.nome');

  const usados = new Set();
  const mudancas = [];
  const semVinculo = [];

  for (const p of daPlanilha) {
    let candidatos = vinculos.filter(v => norm(v.nome) === p.chave && !usados.has(v.id));
    // Linha marcada "(Tarde)"/"(Manhã)" prioriza o vínculo daquele turno.
    if (p.turno && candidatos.length > 1) {
      const doTurno = candidatos.filter(v => v.turno === p.turno);
      if (doTurno.length) candidatos = doTurno;
    }
    const v = candidatos[0];
    if (!v) { semVinculo.push(p); continue; }
    usados.add(v.id);

    const patch = {};
    if (p.especialidade && p.especialidade !== v.especialidade) patch.especialidade = p.especialidade;
    if (p.valor_fixo_base != null && !igual(p.valor_fixo_base, v.valor_fixo_base)) patch.valor_fixo_base = p.valor_fixo_base;
    if (p.meta_mensal != null && !igual(p.meta_mensal, v.meta_mensal)) patch.meta_mensal = p.meta_mensal;

    if (Object.keys(patch).length) mudancas.push({ vinculo: v, planilha: p, patch });
  }

  if (mudancas.length) {
    console.log('ALTERAÇÕES'.padEnd(34) + 'campo'.padEnd(18) + 'de'.padStart(12) + '  →' + 'para'.padStart(12));
    console.log('-'.repeat(84));
    for (const m of mudancas) {
      const cab = `${m.vinculo.nome.slice(0, 26)} [${m.vinculo.turno}]`;
      let primeira = true;
      for (const [campo, valor] of Object.entries(m.patch)) {
        const antes = m.vinculo[campo];
        console.log(
          (primeira ? cab : '').padEnd(34) +
          campo.padEnd(18) +
          String(antes ?? '—').slice(0, 11).padStart(12) + '  →' +
          String(valor).slice(0, 11).padStart(12)
        );
        primeira = false;
      }
    }
  } else {
    console.log('Nenhuma alteração necessária — vínculos já batem com a planilha.');
  }

  // Linha na planilha sem vínculo no banco é perigoso nos DOIS sentidos: ou a pessoa
  // fica sem receber aquele turno, ou — pior — os atendimentos do turno órfão são
  // mesclados no vínculo que existe e o sistema paga a mais. Foi o caso do Silvino em
  // Maio/2026: sem o vínculo de TARDE, saía R$ 7.746 numa linha só contra R$ 4.292 da
  // planilha. Só cria com --criar-faltantes, e só para quem já é usuário conhecido.
  if (semVinculo.length) {
    console.log(`\n⚠️  ${semVinculo.length} linha(s) da planilha sem vínculo PJ ativo correspondente:`);
    for (const p of semVinculo) {
      const dono = await db('usuarios')
        .where('tipo', 'prestador')
        .whereRaw('LOWER(nome) LIKE ?', [`%${p.chave.split(' ')[0]}%`])
        .select('id', 'nome');
      const exato = dono.find(u => norm(u.nome) === p.chave);
      const destino = exato ? `usuário #${exato.id}` : 'SEM USUÁRIO — precisa cadastrar antes';
      console.log(`     ${p.nome}  (${p.especialidade} · ${p.unidade} · ${p.turno || 'INDEFINIDO'})  → ${destino}`);

      if (CRIAR && exato) {
        if (APPLY) {
          const [novo] = await db('prestador_vinculos').insert({
            prestador_id: exato.id,
            tipo_contrato: 'prestador',
            especialidade: p.especialidade,
            unidade: p.unidade,
            turno: p.turno || 'INDEFINIDO',
            valor_fixo_base: p.valor_fixo_base,
            meta_mensal: p.meta_mensal,
            desconto_por_falta: 20,
            ativo: true,
          }).returning('id');
          const id = typeof novo === 'object' ? novo.id : novo;
          console.log(`        ✅ vínculo ${id} criado`);
        } else {
          console.log('        [dry-run] criaria este vínculo');
        }
      }
    }
    if (!CRIAR) console.log('     → rode com --criar-faltantes para criar os que têm usuário.');
  }

  const semUso = vinculos.filter(v => !usados.has(v.id));
  if (semUso.length) {
    console.log(`\nℹ️  ${semUso.length} vínculo(s) PJ ativo(s) que não aparecem nesta planilha:`);
    semUso.forEach(v => console.log(`     ${v.nome} · ${v.especialidade} ${v.turno} ${v.unidade}`));
  }

  if (APPLY && mudancas.length) {
    for (const m of mudancas) {
      await db('prestador_vinculos').where('id', m.vinculo.id).update(m.patch);
    }
    console.log(`\n✅ ${mudancas.length} vínculo(s) atualizado(s).`);
  } else if (mudancas.length) {
    console.log(`\n${mudancas.length} vínculo(s) seriam atualizados. Rode com --apply para efetivar.`);
  }

  console.log('='.repeat(84) + '\n');
  await db.destroy();
}

main().catch(async (e) => {
  console.error('\n❌ FALHOU:', e.message);
  try { await db.destroy(); } catch {}
  process.exit(1);
});
