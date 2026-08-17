/**
 * Infere a escala semanal de cada vínculo a partir dos atendimentos reais.
 *
 * Motivo: o detector de faltas assume que todo dia em que a unidade abre é dia de
 * trabalho de todo mundo. Quem atende 3x/semana aparecia com 14 "faltas" no mês.
 * Em vez de perguntar a escala de 20 pessoas, deduzimos do que já aconteceu.
 *
 * Método: para cada dia da semana, mede em que porcentagem das ocorrências daquele
 * dia no período o profissional atendeu. Dia com presença acima do corte entra na
 * escala. Dias sem nenhuma ocorrência ficam de fora.
 *
 * Nunca aplica sozinho sem --apply, e imprime a evidência (presença por dia) para
 * o resultado ser conferível.
 *
 * Uso:
 *   DATABASE_URL=<url> NODE_ENV=production \
 *     node scripts/inferir-escala-semanal.js "<atendimentos.xlsx>" [--apply] [--corte=0.4]
 */

const path = require('path');
const XLSX = require('xlsx');
const { db } = require('../database/init');
const { normalizarNomePlanilha } = require('../services/calculoAtendimentos');
const { parseData, diaSemanaISO, turnoPorHora } = require('../services/detectorFaltas');

const FLAGS = ['--apply'];
const args = process.argv.slice(2).filter(a => !FLAGS.includes(a) && !a.startsWith('--corte='));
const APPLY = process.argv.includes('--apply');
const corteArg = process.argv.find(a => a.startsWith('--corte='));
const CORTE = corteArg ? parseFloat(corteArg.split('=')[1]) : 0.4;
const ARQUIVO = args[0];

if (!ARQUIVO) {
  console.error('Uso: node scripts/inferir-escala-semanal.js "<atendimentos.xlsx>" [--apply] [--corte=0.4]');
  process.exit(1);
}

const NOMES_DIA = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sáb', 7: 'dom' };

const chaveNome = (s) => String(s || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

async function main() {
  console.log(`\n${'='.repeat(88)}`);
  console.log(`INFERIR ESCALA SEMANAL  ·  ${path.basename(ARQUIVO)}  ·  corte ${(CORTE * 100).toFixed(0)}%  ·  ${APPLY ? '⚠️  APLICANDO' : 'DRY-RUN'}`);
  console.log('='.repeat(88));

  const wb = XLSX.readFile(ARQUIVO, { raw: true });
  const aba = wb.SheetNames.find(n => n.toLowerCase().trim() === 'atendimentos');
  if (!aba) throw new Error(`Aba "Atendimentos" não encontrada. Abas: ${wb.SheetNames.join(', ')}`);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: null });

  const turnos = await db('turnos_config').where('ativo', true).select('*');
  const porUnidade = new Map();
  for (const t of turnos) {
    if (!porUnidade.has(t.unidade)) porUnidade.set(t.unidade, []);
    porUnidade.get(t.unidade).push(t);
  }

  // presenca[nome|turno][diaSemana] = Set de datas em que atendeu
  const presenca = new Map();
  const datas = new Set();
  for (const r of rows.slice(1)) {
    if (!r[5]) continue;
    const d = parseData(r[0]);
    if (!d) continue;
    const iso = d.toISOString().slice(0, 10);
    datas.add(iso);
    const turno = turnoPorHora(r[1], porUnidade.get(String(r[16] || '').toUpperCase()));
    const k = `${chaveNome(normalizarNomePlanilha(r[5]))}|${turno}`;
    if (!presenca.has(k)) presenca.set(k, new Map());
    const porDia = presenca.get(k);
    const ds = diaSemanaISO(d);
    if (!porDia.has(ds)) porDia.set(ds, new Set());
    porDia.get(ds).add(iso);
  }

  // Quantas vezes cada dia da semana ocorreu no período coberto pela planilha.
  const ocorrencias = new Map();
  for (const iso of datas) {
    const ds = diaSemanaISO(new Date(`${iso}T00:00:00Z`));
    ocorrencias.set(ds, (ocorrencias.get(ds) || 0) + 1);
  }
  // datas só tem os dias em que ALGUÉM atendeu; o denominador certo é o número de
  // vezes que aquele dia da semana apareceu no calendário do período.
  const todosOsDias = [...datas].sort();
  const inicio = new Date(`${todosOsDias[0]}T00:00:00Z`);
  const fim = new Date(`${todosOsDias[todosOsDias.length - 1]}T00:00:00Z`);
  const calendario = new Map();
  for (let d = new Date(inicio); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
    const ds = diaSemanaISO(d);
    calendario.set(ds, (calendario.get(ds) || 0) + 1);
  }

  const vinculos = await db('prestador_vinculos as pv')
    .join('usuarios as u', 'u.id', 'pv.prestador_id')
    .where('pv.tipo_contrato', 'prestador')
    .where('pv.ativo', true)
    .whereNull('pv.data_fim')
    .whereNotIn('pv.turno', ['INDEFINIDO', 'AMBOS'])
    .select('pv.id', 'pv.turno', 'pv.unidade', 'pv.dias_semana', 'u.nome');

  console.log(`\nPeríodo da planilha: ${todosOsDias[0]} a ${todosOsDias[todosOsDias.length - 1]}\n`);
  console.log('profissional'.padEnd(32) + 'turno'.padEnd(7) + 'presença por dia (seg→dom)'.padEnd(40) + 'escala inferida');
  console.log('-'.repeat(88));

  const mudancas = [];
  for (const v of vinculos.sort((a, b) => a.nome.localeCompare(b.nome))) {
    const porDia = presenca.get(`${chaveNome(v.nome)}|${v.turno}`);
    if (!porDia) continue;

    const linha = [];
    const escala = [];
    for (let ds = 1; ds <= 7; ds++) {
      const possiveis = calendario.get(ds) || 0;
      if (!possiveis) { linha.push('  · '); continue; }
      const feitos = porDia.has(ds) ? porDia.get(ds).size : 0;
      const taxa = feitos / possiveis;
      linha.push(`${NOMES_DIA[ds]}${String(Math.round(taxa * 100)).padStart(3)}%`);
      if (taxa >= CORTE) escala.push(ds);
    }
    if (!escala.length) continue;

    const nova = escala.join(',');
    const igual = String(v.dias_semana || '') === nova;
    const completa = escala.length >= 5; // trabalha a semana toda → não precisa gravar
    console.log(
      String(v.nome).slice(0, 31).padEnd(32) +
      String(v.turno).padEnd(7) +
      linha.join(' ').padEnd(40) +
      escala.map(d => NOMES_DIA[d]).join('/') +
      (igual ? '   (já é)' : completa ? '   (semana cheia)' : '   ←')
    );
    if (!igual && !completa) mudancas.push({ vinculo: v, dias_semana: nova, escala });
  }

  console.log(`\n${mudancas.length} vínculo(s) com escala parcial a gravar.`);
  if (APPLY && mudancas.length) {
    for (const m of mudancas) {
      await db('prestador_vinculos').where('id', m.vinculo.id).update({ dias_semana: m.dias_semana });
    }
    console.log(`✅ gravado.`);
  } else if (mudancas.length) {
    console.log('Rode com --apply para gravar.');
  }
  console.log('='.repeat(88) + '\n');
  await db.destroy();
}

main().catch(async (e) => {
  console.error('\n❌ FALHOU:', e.message);
  try { await db.destroy(); } catch {}
  process.exit(1);
});
