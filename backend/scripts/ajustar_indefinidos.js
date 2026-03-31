/**
 * Script: Ajustar vínculos INDEFINIDO com base nas planilhas de Atendimentos
 *
 * Analisa todas as planilhas em backend/uploads e extrai turno (MANHÃ/TARDE)
 * por profissional. Atualiza vínculos INDEFINIDO para o turno correto quando
 * há evidência clara (só MANHÃ ou só TARDE).
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

function clinicaParaUnidade(clinica) {
  if (!clinica) return null;
  const m = {
    'unidade vieiralves': 'MATRIZ',
    'unidade vieralves': 'MATRIZ',
    'unidade vieiralves (anexo)': 'ANEXO',
    'unidade vieralves (anexo)': 'ANEXO',
    'unidade sao jose': 'SÃO JOSÉ',
    'unidade são josé': 'SÃO JOSÉ',
  };
  return m[String(clinica).toLowerCase().trim()] || String(clinica).trim().toUpperCase();
}

async function extrairTurnosDasPlanilhas() {
  const arquivos = fs.readdirSync(UPLOADS_DIR).filter(f => /\.(xlsm|xlsx)$/i.test(f));
  const porProfissional = new Map(); // nome_norm -> { MANHÃ: count, TARDE: count, unidade: Map }

  for (const arq of arquivos) {
    const filePath = path.join(UPLOADS_DIR, arq);
    try {
      const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
      const aba = wb.SheetNames.find(n => n.toLowerCase().includes('atendimento'));
      if (!aba) continue;

      const sheet = wb.Sheets[aba];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

      if (!rows || rows.length < 2) continue;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const nomeBruto = row[5];
        if (!nomeBruto) continue;

        const nomeNorm = normalizarNome(nomeBruto);
        const turno = detectarTurno(row[1]);
        const clinica = row[16];
        const unidade = clinicaParaUnidade(clinica) || 'MATRIZ';

        if (!porProfissional.has(nomeNorm)) {
          porProfissional.set(nomeNorm, { MANHÃ: 0, TARDE: 0, unidades: new Map(), nomeBruto });
        }
        const p = porProfissional.get(nomeNorm);
        p[turno]++;
        p.unidades.set(unidade, (p.unidades.get(unidade) || 0) + 1);
      }
    } catch (e) {
      console.warn('  ⚠️  Erro ao ler', arq, e.message);
    }
  }

  return porProfissional;
}

async function main() {
  console.log('📂 Analisando planilhas em', UPLOADS_DIR);
  const turnosPlanilha = await extrairTurnosDasPlanilhas();

  console.log('\n📊 Turnos detectados por profissional (amostra):');
  let count = 0;
  for (const [nome, d] of turnosPlanilha) {
    if (count++ < 15) {
      const turnoInferido = d.MANHÃ > 0 && d.TARDE === 0 ? 'MANHÃ' : d.TARDE > 0 && d.MANHÃ === 0 ? 'TARDE' : 'AMBOS';
      console.log(`  ${nome}: MANHÃ=${d.MANHÃ} TARDE=${d.TARDE} → ${turnoInferido}`);
    }
  }

  const indefinidos = await db('usuarios as u')
    .join('prestador_vinculos as pv', 'pv.prestador_id', 'u.id')
    .where('pv.turno', 'INDEFINIDO')
    .where('pv.ativo', 1)
    .select('u.id as prestador_id', 'u.nome', 'pv.id as vinculo_id', 'pv.especialidade', 'pv.unidade');

  console.log('\n🔧 Vínculos INDEFINIDO a ajustar:', indefinidos.length);

  let atualizados = 0;
  for (const v of indefinidos) {
    let melhorNome = null;
    let melhorSim = 0;
    let dados = null;

    for (const [nomePlanilha, d] of turnosPlanilha) {
      const sim = similaridade(v.nome, nomePlanilha);
      if (sim >= 0.6 && sim > melhorSim) {
        melhorSim = sim;
        melhorNome = nomePlanilha;
        dados = d;
      }
    }

    if (!dados) {
      console.log(`  ⏭️  ${v.nome} (${v.especialidade}): sem dados nas planilhas`);
      continue;
    }

    const total = dados.MANHÃ + dados.TARDE;
    let turnoInferido = null;
    if (dados.MANHÃ > 0 && dados.TARDE === 0) turnoInferido = 'MANHÃ';
    else if (dados.TARDE > 0 && dados.MANHÃ === 0) turnoInferido = 'TARDE';
    else if (total > 0) {
      // Turno dominante: se um tem >= 70% dos atendimentos
      const pctManha = dados.MANHÃ / total;
      const pctTarde = dados.TARDE / total;
      if (pctManha >= 0.7) turnoInferido = 'MANHÃ';
      else if (pctTarde >= 0.7) turnoInferido = 'TARDE';
    }

    if (!turnoInferido) {
      console.log(`  ⏭️  ${v.nome} (${v.especialidade}): MANHÃ=${dados.MANHÃ} TARDE=${dados.TARDE} → mantém INDEFINIDO`);
      continue;
    }

    // Verificar unidade mais comum nas planilhas
    let unidadePlanilha = null;
    if (dados.unidades && dados.unidades.size > 0) {
      const entries = [...dados.unidades.entries()].sort((a, b) => b[1] - a[1]);
      unidadePlanilha = entries[0][0];
    }

    await db('prestador_vinculos').where('id', v.vinculo_id).update({
      turno: turnoInferido,
      ...(unidadePlanilha && !v.unidade ? { unidade: unidadePlanilha } : {}),
    });

    console.log(`  ✅ ${v.nome} (${v.especialidade} ${v.unidade || ''}): ${turnoInferido}`);
    atualizados++;
  }

  console.log(`\n✅ ${atualizados} vínculo(s) atualizado(s).`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
