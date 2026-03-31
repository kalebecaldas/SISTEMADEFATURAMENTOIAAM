/**
 * Script: Registrar turnos por mês nos dados_mensais
 *
 * Para profissionais que trabalham em múltiplos turnos, analisa cada planilha
 * (mês a mês) e atualiza turno_manha/turno_tarde em dados_mensais.
 * Isso permite relatórios anuais precisos por turno.
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const db = require('../database/connection');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

function normalizarNome(nome) {
  if (!nome) return '';
  return String(nome)
    .replace(/^pilates\s+(manh[ãa]|tarde)\s*[-–]?\s*/i, '')
    .replace(/\s*\(manh[ãa]\)\s*$/i, '')
    .replace(/\s*\(tarde\)\s*$/i, '')
    .trim();
}

function similaridade(a, b) {
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 1;
  const wordsA = new Set(na.split(' ').filter(Boolean));
  const wordsB = new Set(nb.split(' ').filter(Boolean));
  const inter = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : inter / union;
}

function detectarTurno(horaStr) {
  if (!horaStr) return 'MANHÃ';
  const h = parseInt(String(horaStr).split(':')[0], 10);
  return h < 13 ? 'MANHÃ' : 'TARDE';
}

function extrairMesAno(dataStr) {
  if (!dataStr) return null;
  // Formato DD/MM/YYYY ou DD/MM/YY
  const m = String(dataStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const mes = parseInt(m[2], 10);
  let ano = parseInt(m[3], 10);
  if (ano < 100) ano += 2000;
  return { mes, ano };
}

/**
 * Lê todas as planilhas e agrupa atendimentos por (nome_norm, mes, ano, turno)
 * Retorna: Map<nome_norm, Map<`${mes}/${ano}`, { MANHÃ: n, TARDE: n }>>
 */
async function extrairTurnosPorMes() {
  const arquivos = fs.readdirSync(UPLOADS_DIR).filter(f => /\.(xlsm|xlsx)$/i.test(f));
  // Map: nome_norm -> Map: "mes/ano" -> { MANHÃ, TARDE }
  const resultado = new Map();

  console.log(`📂 Analisando ${arquivos.length} planilha(s) em ${UPLOADS_DIR}\n`);

  for (const arq of arquivos) {
    const filePath = path.join(UPLOADS_DIR, arq);
    try {
      const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
      const aba = wb.SheetNames.find(n => n.toLowerCase().includes('atendimento'));
      if (!aba) continue;

      const sheet = wb.Sheets[aba];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      if (!rows || rows.length < 2) continue;

      let contados = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const dataStr = row[0];
        const horaStr = row[1];
        const nomeBruto = row[5];
        if (!nomeBruto || !dataStr) continue;

        const mesAno = extrairMesAno(dataStr);
        if (!mesAno) continue;

        const nomeNorm = normalizarNome(nomeBruto);
        const turno = detectarTurno(horaStr);
        const chave = `${mesAno.mes}/${mesAno.ano}`;

        if (!resultado.has(nomeNorm)) resultado.set(nomeNorm, new Map());
        const porMes = resultado.get(nomeNorm);
        if (!porMes.has(chave)) porMes.set(chave, { MANHÃ: 0, TARDE: 0 });
        porMes.get(chave)[turno]++;
        contados++;
      }

      // Detectar mês principal desta planilha para log
      const mesesEncontrados = new Set();
      for (let i = 1; i < Math.min(rows.length, 50); i++) {
        const ma = extrairMesAno(rows[i][0]);
        if (ma) mesesEncontrados.add(`${ma.mes}/${ma.ano}`);
      }
      console.log(`  ✓ ${arq}: ${contados} registros | meses: ${[...mesesEncontrados].join(', ')}`);
    } catch (e) {
      console.warn(`  ⚠️  Erro ao ler ${arq}: ${e.message}`);
    }
  }

  return resultado;
}

async function main() {
  const turnosPorMes = await extrairTurnosPorMes();

  // Buscar todos os dados_mensais com vínculo
  const registros = await db('dados_mensais as dm')
    .join('prestador_vinculos as pv', 'pv.id', 'dm.vinculo_id')
    .join('usuarios as u', 'u.id', 'dm.prestador_id')
    .select(
      'dm.id as dm_id',
      'dm.mes',
      'dm.ano',
      'dm.turno_manha',
      'dm.turno_tarde',
      'dm.turno',
      'u.nome',
      'pv.id as vinculo_id',
      'pv.especialidade',
      'pv.unidade',
      'pv.turno as turno_vinculo'
    )
    .orderBy(['u.nome', 'dm.ano', 'dm.mes']);

  console.log(`\n📋 Atualizando turno_manha/turno_tarde para ${registros.length} registros de dados_mensais...\n`);

  let atualizados = 0;
  let semDados = 0;
  const relatorio = [];

  for (const reg of registros) {
    const chave = `${reg.mes}/${reg.ano}`;

    // Encontrar melhor match de nome na planilha
    let melhorSim = 0;
    let dadosMes = null;

    for (const [nomePlanilha, porMes] of turnosPorMes) {
      const sim = similaridade(reg.nome, nomePlanilha);
      if (sim >= 0.6 && sim > melhorSim && porMes.has(chave)) {
        melhorSim = sim;
        dadosMes = porMes.get(chave);
      }
    }

    if (!dadosMes) {
      semDados++;
      continue;
    }

    const temManha = dadosMes.MANHÃ > 0 ? 1 : 0;
    const temTarde = dadosMes.TARDE > 0 ? 1 : 0;

    // Determinar turno para o mês
    let turnoMes;
    if (temManha && !temTarde) turnoMes = 'MANHÃ';
    else if (temTarde && !temManha) turnoMes = 'TARDE';
    else if (temManha && temTarde) {
      // Turno dominante no mês (>= 70% = define turno, senão AMBOS)
      const total = dadosMes.MANHÃ + dadosMes.TARDE;
      if (dadosMes.MANHÃ / total >= 0.7) turnoMes = 'MANHÃ';
      else if (dadosMes.TARDE / total >= 0.7) turnoMes = 'TARDE';
      else turnoMes = 'AMBOS';
    } else {
      continue;
    }

    // Só atualiza se mudou
    const mudou = reg.turno_manha !== temManha || reg.turno_tarde !== temTarde || reg.turno !== turnoMes;
    if (mudou) {
      await db('dados_mensais').where('id', reg.dm_id).update({
        turno_manha: temManha,
        turno_tarde: temTarde,
        turno: turnoMes,
      });
      atualizados++;
    }

    relatorio.push({
      nome: reg.nome,
      especialidade: reg.especialidade || '-',
      unidade: reg.unidade || '-',
      mes: reg.mes,
      ano: reg.ano,
      manha: dadosMes.MANHÃ,
      tarde: dadosMes.TARDE,
      turno: turnoMes,
    });
  }

  // Exibir relatório de profissionais com turnos variados
  console.log('\n📊 RELATÓRIO ANUAL DE TURNOS (profissionais com variação)\n');
  const porNome = new Map();
  for (const r of relatorio) {
    const key = `${r.nome}|${r.especialidade}|${r.unidade}`;
    if (!porNome.has(key)) porNome.set(key, []);
    porNome.get(key).push(r);
  }

  const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  for (const [key, meses] of porNome) {
    const turnos = new Set(meses.map(m => m.turno));
    if (turnos.size <= 1 && !turnos.has('AMBOS')) continue; // Só mostrar quem varia

    const [nome, esp, uni] = key.split('|');
    console.log(`👤 ${nome} (${esp} - ${uni})`);
    for (const m of meses.sort((a, b) => a.ano - b.ano || a.mes - b.mes)) {
      const barra = `M:${m.manha} T:${m.tarde}`;
      const emoji = m.turno === 'AMBOS' ? '↕️' : m.turno === 'MANHÃ' ? '🌅' : '🌇';
      console.log(`   ${MESES[m.mes]}/${m.ano} → ${emoji} ${m.turno.padEnd(6)} (${barra})`);
    }
    console.log('');
  }

  console.log(`✅ ${atualizados} registro(s) de dados_mensais atualizados.`);
  console.log(`ℹ️  ${semDados} registro(s) sem dados nas planilhas.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
