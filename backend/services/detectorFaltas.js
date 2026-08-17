/**
 * Detector de faltas prováveis a partir da planilha crua de Atendimentos.
 *
 * REGRA: para cada dia em que a unidade abre no turno contratado, se o profissional
 * não tem NENHUM atendimento naquele dia/turno, é uma falta SUSPEITA.
 *
 * Isto é uma TRIAGEM, não uma apuração. O detector nunca desconta: ele só reduz o
 * que o admin precisa olhar, de "o mês inteiro" para "esses N dias". A confirmação
 * é sempre humana, porque a planilha não sabe distinguir falta de férias, atestado,
 * folga combinada ou dia em que simplesmente não houve paciente marcado.
 *
 * Motivos pré-classificados (para a conferência ser rápida):
 *   feriado             → o dia é feriado; quase sempre não é falta
 *   atendeu_outro_turno → trabalhou no turno oposto naquele dia (provável troca)
 *   fora_da_vigencia    → dia fora do período do contrato
 *   sem_motivo          → nada explica; é aqui que o admin precisa olhar
 */

const db = require('../database/connection');

const ISO = (d) => d.toISOString().slice(0, 10);

/** "31/07/2026" ou "2026-07-31" → Date UTC. Retorna null se não parsear. */
function parseData(valor) {
  if (!valor) return null;
  const s = String(valor).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return new Date(Date.UTC(+br[3], +br[2] - 1, +br[1]));
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  return null;
}

/** Dia da semana ISO: 1=segunda … 7=domingo. */
function diaSemanaISO(data) {
  const d = data.getUTCDay(); // 0=domingo
  return d === 0 ? 7 : d;
}

/**
 * Turno de um horário, a partir da configuração da unidade.
 * Fora de qualquer janela configurada, cai no padrão histórico (< 13h = manhã).
 */
function turnoPorHora(horaStr, turnosDaUnidade) {
  const m = String(horaStr || '').match(/^(\d{1,2}):?(\d{2})?/);
  if (!m) return 'MANHÃ';
  const minutos = (+m[1]) * 60 + (+(m[2] || 0));
  for (const t of turnosDaUnidade || []) {
    const [hi, mi] = t.hora_inicio.split(':').map(Number);
    const [hf, mf] = t.hora_fim.split(':').map(Number);
    if (minutos >= hi * 60 + mi && minutos <= hf * 60 + mf) return t.turno;
  }
  return (+m[1]) < 13 ? 'MANHÃ' : 'TARDE';
}

/** Carrega a config de turnos vigente numa data. */
async function carregarTurnosVigentes(dataRef) {
  const ref = ISO(dataRef);
  return db('turnos_config')
    .where('ativo', true)
    .where(q => q.whereNull('vigencia_inicio').orWhere('vigencia_inicio', '<=', ref))
    .where(q => q.whereNull('vigencia_fim').orWhere('vigencia_fim', '>=', ref))
    .select('*');
}

/** Feriados do intervalo, indexados por data ISO. */
async function carregarFeriados(inicio, fim) {
  const linhas = await db('feriados')
    .where('ativo', true)
    .whereBetween('data', [ISO(inicio), ISO(fim)])
    .select('data', 'nome', 'escopo', 'unidade', 'facultativo');
  const mapa = new Map();
  for (const f of linhas) {
    const k = String(f.data).slice(0, 10);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(f);
  }
  return mapa;
}

/**
 * Detecta faltas suspeitas.
 *
 * @param {Array[]} rows        linhas cruas da aba Atendimentos (com cabeçalho)
 * @param {object[]} calculados itens já reconhecidos (saída de processarAtendimentos)
 * @param {object} periodo      { inicio: Date, fim: Date }
 * @returns {Promise<object[]>} uma entrada por (vínculo, dia, turno) ausente
 */
async function detectarFaltas(rows, calculados, periodo) {
  if (!calculados || !calculados.length) return [];

  const turnosConfig = await carregarTurnosVigentes(periodo.fim);
  if (!turnosConfig.length) return []; // sem config não há como afirmar nada

  const porUnidade = new Map();
  for (const t of turnosConfig) {
    if (!porUnidade.has(t.unidade)) porUnidade.set(t.unidade, []);
    porUnidade.get(t.unidade).push(t);
  }

  const feriados = await carregarFeriados(periodo.inicio, periodo.fim);

  // ── Dias/turnos realmente trabalhados, por profissional ────────────────────
  // Chave do profissional é o nome normalizado que o matcher já usou, então
  // fecha exatamente com os itens de `calculados`.
  const { normalizarNomePlanilha } = require('./calculoAtendimentos');
  const chaveNome = (s) => String(s || '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

  const trabalhou = new Map(); // nomeChave -> Set("2026-07-03|MANHÃ")
  for (const r of rows.slice(1)) {
    const nome = r[5];
    if (!nome) continue;
    const data = parseData(r[0]);
    if (!data) continue;
    const unidade = String(r[16] || '').toUpperCase();
    const turno = turnoPorHora(r[1], porUnidade.get(unidade));
    const k = chaveNome(normalizarNomePlanilha(nome));
    if (!trabalhou.has(k)) trabalhou.set(k, new Set());
    trabalhou.get(k).add(`${ISO(data)}|${turno}`);
  }

  // ── Para cada vínculo reconhecido, varre o calendário do período ───────────
  const faltas = [];
  for (const item of calculados) {
    // Vínculo sem turno definido atende em qualquer horário — não dá para
    // afirmar que faltou num turno específico.
    const turnoContrato = String(item.turno || '').toUpperCase();
    if (!turnoContrato || turnoContrato === 'INDEFINIDO' || turnoContrato === 'AMBOS') continue;

    const cfg = (porUnidade.get(String(item.unidade || '').toUpperCase()) || [])
      .find(t => t.turno === turnoContrato);
    if (!cfg) continue; // unidade/turno sem horário cadastrado

    const diasAbertos = new Set(String(cfg.dias_semana).split(',').map(n => parseInt(n, 10)));
    const k = chaveNome(item.nome);
    const dias = trabalhou.get(k) || new Set();

    for (let d = new Date(periodo.inicio.getTime()); d <= periodo.fim; d.setUTCDate(d.getUTCDate() + 1)) {
      if (!diasAbertos.has(diaSemanaISO(d))) continue;

      const dia = ISO(d);
      if (dias.has(`${dia}|${turnoContrato}`)) continue; // trabalhou, não é falta

      const doDia = feriados.get(dia) || [];
      const feriado = doDia.find(f => !f.unidade || f.unidade === item.unidade);
      const outroTurno = [...dias].some(x => x.startsWith(`${dia}|`));

      faltas.push({
        prestador_id: item.prestador_id,
        vinculo_id: item.vinculo_id,
        nome: item.nome,
        especialidade: item.especialidade,
        unidade: item.unidade,
        data: dia,
        turno: turnoContrato,
        motivo_deteccao: feriado ? 'feriado' : (outroTurno ? 'atendeu_outro_turno' : 'sem_motivo'),
        feriado_nome: feriado ? feriado.nome : null,
        // Feriado já nasce descartado — aparece na lista para conferência, mas
        // não conta. O resto nasce suspeito e espera decisão do admin.
        status: feriado ? 'descartada' : 'suspeita',
      });
    }
  }

  return faltas;
}

/**
 * Agrupa as faltas por profissional para a tela de conferência.
 */
function agruparPorProfissional(faltas) {
  const mapa = new Map();
  for (const f of faltas) {
    const k = String(f.vinculo_id);
    if (!mapa.has(k)) {
      mapa.set(k, {
        prestador_id: f.prestador_id,
        vinculo_id: f.vinculo_id,
        nome: f.nome,
        especialidade: f.especialidade,
        unidade: f.unidade,
        turno: f.turno,
        dias: [],
        suspeitas: 0,
        principal: 0,
      });
    }
    const g = mapa.get(k);
    g.dias.push({
      data: f.data,
      motivo: f.motivo_deteccao,
      feriado_nome: f.feriado_nome,
      status: f.status,
    });
    if (f.status === 'suspeita') g.suspeitas++;
    if (f.motivo_deteccao === 'sem_motivo') g.principal++;
  }
  return [...mapa.values()].sort((a, b) => b.principal - a.principal);
}

module.exports = {
  detectarFaltas,
  agruparPorProfissional,
  parseData,
  diaSemanaISO,
  turnoPorHora,
};
