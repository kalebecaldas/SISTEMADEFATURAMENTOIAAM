/**
 * Serviço de cálculo de pagamentos a partir da aba Atendimentos
 *
 * Regras:
 * PJ: valor_clinica × % (tabela MATRIZ/SJ) + FIXO ajustado por faltas + extras
 * CLT Fisio: piso 3750 (ou 5000 se fat >= 25000) − faltas × 20
 * CLT Acup: fat × 17% ou 20% (se >= 30000) − faltas × 20
 */

const db = require('../database/connection');

// Mapeamento de nomes de clínicas do sistema para unidades internas
const CLINICA_UNIDADE_MAP = {
  'unidade vieiralves':          'MATRIZ',
  'unidade vieralves':           'MATRIZ',
  'unidade vieralves (anexo)':   'ANEXO',
  'unidade vieiralves (anexo)':  'ANEXO',
  'unidade sao jose':            'SÃO JOSÉ',
  'unidade são josé':            'SÃO JOSÉ',
};

/**
 * Converte nome de clínica (coluna Q do Atendimentos) para unidade interna
 */
function clinicaParaUnidade(nomeClinica) {
  if (!nomeClinica) return null;
  const lower = nomeClinica.toLowerCase().trim();
  return CLINICA_UNIDADE_MAP[lower] || nomeClinica.trim().toUpperCase();
}

/**
 * Detecta turno pela hora do atendimento
 * Manhã: 07:00–12:59 | Tarde: 13:00–20:00
 */
function detectarTurnoPorHora(horaStr) {
  if (!horaStr) return 'MANHÃ';
  const hora = parseInt(String(horaStr).split(':')[0], 10);
  return hora < 13 ? 'MANHÃ' : 'TARDE';
}

/**
 * Normaliza nome removendo prefixos de turno (ex: "Pilates Manhã - Lana")
 */
function normalizarNomePlanilha(nome) {
  if (!nome) return '';
  return nome
    .replace(/^pilates\s+(manh[ãa]|tarde)\s*[-–]?\s*/i, '')
    .replace(/\s*\(manh[ãa]\)\s*$/i, '')
    .replace(/\s*\(tarde\)\s*$/i, '')
    .trim();
}

/**
 * Calcula similaridade simples entre dois nomes (0–1)
 * Usado para fuzzy matching de nomes
 */
function similaridade(a, b) {
  const normalize = (s) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '').trim();

  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return 1;

  const wordsA = new Set(na.split(' ').filter(Boolean));
  const wordsB = new Set(nb.split(' ').filter(Boolean));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;

  return union === 0 ? 0 : intersection / union;
}

/**
 * Detecta se é CLT (período 26-25, abrangendo dois meses) ou PJ (dia 1–último dia)
 *
 * Estratégia: se as datas abrangem dois meses diferentes E o dia mais antigo
 * do mês mais antigo é >= 24, provavelmente é CLT (período 26–25).
 */
function detectarTipoContrato(datas) {
  if (!datas || datas.length === 0) return 'prestador';

  const parsed = datas.map(d => {
    const partes = String(d).split('/');
    if (partes.length >= 3) {
      return { dia: parseInt(partes[0]), mes: parseInt(partes[1]), ano: parseInt(partes[2]) };
    }
    return null;
  }).filter(Boolean);

  if (parsed.length === 0) return 'prestador';

  const meses = new Set(parsed.map(p => `${p.mes}-${p.ano}`));

  // Abrange dois meses diferentes?
  if (meses.size >= 2) {
    // Pegar o mês mais antigo e verificar se tem datas a partir do dia 24+
    parsed.sort((a, b) => (a.ano - b.ano) || (a.mes - b.mes) || (a.dia - b.dia));
    const primeiroMes = `${parsed[0].mes}-${parsed[0].ano}`;
    const diasPrimeiroMes = parsed
      .filter(p => `${p.mes}-${p.ano}` === primeiroMes)
      .map(p => p.dia);
    const minDiaPrimeiroMes = Math.min(...diasPrimeiroMes);
    if (minDiaPrimeiroMes >= 24) return 'clt';
  }

  // Um único mês: verificar se o dia mínimo >= 24 (raro mas possível)
  const diasUnicos = parsed.map(p => p.dia);
  const minDia = Math.min(...diasUnicos);
  return minDia >= 24 ? 'clt' : 'prestador';
}

/**
 * Detecta mês e ano de referência a partir das datas da planilha
 * Para PJ: mês/ano das datas principais
 * Para CLT: mês/ano do dia 25 (fim do período)
 */
function detectarMesAno(datas, tipoContrato) {
  if (!datas || datas.length === 0) return { mes: null, ano: null };

  const parsed = datas.map(d => {
    const partes = String(d).split('/');
    if (partes.length === 3) {
      return { dia: parseInt(partes[0]), mes: parseInt(partes[1]), ano: parseInt(partes[2]) };
    }
    return null;
  }).filter(Boolean);

  if (parsed.length === 0) return { mes: null, ano: null };

  if (tipoContrato === 'clt') {
    // Período CLT: 26/mês-anterior → 25/mês-atual
    // Pegar a data máxima (dia 25)
    parsed.sort((a, b) => (b.ano - a.ano) || (b.mes - a.mes) || (b.dia - a.dia));
    return { mes: parsed[0].mes, ano: parsed[0].ano };
  }

  // PJ: pegar o mês mais frequente
  const freq = {};
  parsed.forEach(({ mes, ano }) => {
    const k = `${mes}-${ano}`;
    freq[k] = (freq[k] || 0) + 1;
  });
  const [k] = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  const [mes, ano] = k.split('-').map(Number);
  return { mes, ano };
}

/**
 * Agrega linhas do Atendimentos por profissional + turno + unidade
 */
// Convênios particulares que têm cálculo diferente — excluídos da base de META
// e somados separadamente (valor profissional da planilha = face value)
const CONVENIOS_PART_OAB = ['particular', 'oab - ordem dos advogados do brasil', 'oab'];

function isConvenioParticular(convenio) {
  if (!convenio) return false;
  const c = String(convenio).toLowerCase().trim();
  return CONVENIOS_PART_OAB.some(p => c === p || c.startsWith('oab'));
}

function agregarAtendimentos(rows) {
  const grupos = new Map();

  for (const row of rows) {
    const nomeBruto = row[5]; // Col F: Profissional
    if (!nomeBruto) continue;

    const nomeNorm = normalizarNomePlanilha(nomeBruto);
    const hora = row[1]; // Col B: Hora
    const turno = detectarTurnoPorHora(hora);
    const clinica = row[16]; // Col Q: Clínica
    const unidade = clinicaParaUnidade(clinica);
    const especialidadeAtend = row[7]; // Col H: Especialidade do sistema
    const convenio = row[4];           // Col E: Convênio

    const valorClinica = parseFloat(row[12]) || 0;   // Col M: Valor Total
    const valorProf = parseFloat(row[11]) || 0;       // Col L: Valor Profissional
    const dataAtend = row[0];                          // Col A: Data

    const ehParticular = isConvenioParticular(convenio);

    const chave = `${nomeNorm}|${turno}|${unidade}`;

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        nome_planilha: nomeBruto.trim(),
        nome_normalizado: nomeNorm,
        turno,
        unidade,
        especialidade_atend: especialidadeAtend,
        valor_clinica: 0,           // valor total EXCLUINDO Particular/OAB (base da META)
        valor_clinica_total: 0,     // valor total incluindo todos os convênios
        valor_profissional_atend: 0, // valor profissional INCLUINDO todos (total pago)
        valor_prof_part_oab: 0,     // valor profissional de Particular/OAB (face value)
        atendimentos: 0,
        datas: [],
      });
    }

    const g = grupos.get(chave);
    g.valor_clinica_total += valorClinica;
    g.valor_profissional_atend += valorProf;
    g.atendimentos += 1;
    if (dataAtend) g.datas.push(dataAtend);

    if (ehParticular) {
      // PART/OAB: não entra na base da meta, contabilizado separado
      g.valor_prof_part_oab += valorProf;
    } else {
      // Regular: entra na base da meta
      g.valor_clinica += valorClinica;
    }
  }

  return [...grupos.values()];
}

/**
 * Busca a comissão para uma especialidade + unidade
 */
async function buscarComissao(especialidade, unidade) {
  if (!especialidade) return null;

  const esp = String(especialidade).trim();
  const uni = String(unidade || '').trim();

  // Busca exata especialidade + unidade
  const exact = await db('comissoes_tabela')
    .where({ especialidade: esp, unidade: uni, ativo: true })
    .first();
  if (exact) return exact;

  // Busca só por especialidade (sem unidade específica)
  const byEsp = await db('comissoes_tabela')
    .where({ especialidade: esp, ativo: true })
    .whereNull('unidade')
    .first();
  if (byEsp) return byEsp;

  return null;
}

/**
 * Normaliza especialidade do Atendimentos para a chave usada na tabela de comissões
 * Ex: "Fisioterapia" → "Fisio", "Acupuntura" → "Acup"
 */
function normalizarEspParaComissao(espAtend, unidade) {
  const map = {
    'fisioterapia': 'Fisio',
    'acupuntura': 'Acup',
    'rpg': 'RPG',
    'neurologia': 'Neuro',
    'fisioterapia pélvica e neurológica': 'Fisio Pelv',
    'fisioterapia pélvica': 'Fisio Pelv',
    'pilates': 'Pilates',
  };

  const lower = (espAtend || '').toLowerCase().trim();
  const base = map[lower];
  if (!base) return null;

  // São José usa prefixo SJ para Acup e Fisio
  const isSJ = ['SÃO JOSÉ', 'SAO JOSE'].includes(String(unidade || '').toUpperCase());
  if (isSJ) {
    if (base === 'Acup') return 'SJAcup';
    if (base === 'Fisio') return 'SJFisio';
    if (base === 'RPG') return 'SJRPG';
  }

  return base;
}

/**
 * Calcula o valor bruto PJ para um grupo.
 * Regra: valor_bruto = valor_profissional (da planilha) + fixo (se tiver).
 * A planilha já traz o valor profissional correto (com % aplicada por convênio).
 * Meta serve apenas para o indicador BATEU? (meta batida ou fora).
 */
function calcularValorPJ({ comissao, valor_clinica, valor_clinica_total, valor_profissional_atend, valor_prof_part_oab, valor_fixo_base, desconto_por_falta, meta_mensal, faltas, extras }) {
  const faltasNum = parseInt(faltas) || 0;
  const extrasNum = parseFloat(extras) || 0;
  const fixoBase = parseFloat(valor_fixo_base) || 0;
  const vp = parseFloat(valor_profissional_atend) || 0;
  const vpPartOab = parseFloat(valor_prof_part_oab) || 0;

  const pctComMeta = comissao ? (parseFloat(comissao.pct_com_meta) || 0) : 0;
  const pctSemMeta = comissao ? (parseFloat(comissao.pct_sem_meta) || 0) : 0;

  // valor_prof_sem_part_oab = VP convenios (já vem a 12% da planilha)
  // 100% valor = valor_prof_sem_part_oab × 100 / pct_sem_meta → base para aplicar pct_com_meta na fórmula
  const vpSemPartOab = Math.max(0, vp - vpPartOab);
  const valor100Base = pctSemMeta > 0 ? vpSemPartOab * 100 / pctSemMeta : (parseFloat(valor_clinica) || 0);

  // Meta é checada contra o TOTAL faturado (convenios + Part/OAB) — valor_clinica_total
  const valorFaturadoTotal = parseFloat(valor_clinica_total) || parseFloat(valor_clinica) || 0;
  const meta = parseFloat(meta_mensal) || 0;
  const metaBatida = meta > 0 && valorFaturadoTotal >= meta;

  const pctAplicado = pctComMeta > 0 || pctSemMeta > 0
    ? (metaBatida ? pctComMeta : pctSemMeta)
    : null;

  const descontoPorFalta = fixoBase > 0 ? fixoBase / 30 : (parseFloat(desconto_por_falta) || 20);
  let fixoAjustado = Math.max(0, fixoBase - (faltasNum * descontoPorFalta));
  let total;

  if (metaBatida && pctComMeta > 0) {
    // ── META BATIDA: 100% valor × 14% = valor com meta ──
    // valor100Base já derivado de (valor_prof - part/oab) × 100/12
    // valor_com_meta = valor100Base × pct_com_meta / 100
    const valorComMeta = valor100Base * (pctComMeta / 100);
    total = Math.max(0, valorComMeta + vpPartOab + fixoAjustado + extrasNum);
  } else {
    // ── SEM META: usar valor_profissional da planilha + fixo ──
    total = Math.max(0, vp + fixoAjustado + extrasNum);
  }

  return {
    total,
    meta_batida: metaBatida,
    fixo_ajustado: fixoAjustado,
    pct_aplicado: pctAplicado,
    tipo_calculo: metaBatida && pctComMeta > 0
      ? 'valor_pct_com_meta'
      : (fixoBase > 0 ? 'valor_profissional_mais_fixo' : 'valor_profissional'),
    valor_prof_part_oab: vpPartOab,
  };
}

/**
 * Calcula o valor bruto CLT para um grupo
 *
 * CLT: faltas NÃO são descontadas aqui — contabilidade faz o desconto.
 * Apenas armazenamos a quantidade de faltas para repasse.
 *
 * Fórmula: FORA da meta: max(VP, fixo) + extras | COM meta: valor_clinica × pct + extras
 */
// Cache em memória do config CLT — recarregado a cada processamento
let _cltConfigCache = null;

async function carregarConfigCLT() {
  if (_cltConfigCache) return _cltConfigCache;
  try {
    const rows = await db('especialidades_clt').where('ativo', 1);
    _cltConfigCache = rows;
    // Expirar cache após 60 segundos
    setTimeout(() => { _cltConfigCache = null; }, 60000);
  } catch {
    _cltConfigCache = [];
  }
  return _cltConfigCache;
}

/**
 * Encontra config CLT na tabela para uma especialidade.
 * Usa correspondência por keyword (contém) para compatibilidade com nomes parciais.
 */
function encontrarConfigCLT(configs, especialidade_vinculo) {
  const esp = String(especialidade_vinculo || '').toLowerCase().trim();
  // Tenta match exato primeiro
  const exato = configs.find(c => c.especialidade.toLowerCase() === esp);
  if (exato) return exato;
  // Tenta match por keyword
  return configs.find(c => {
    const key = c.especialidade.toLowerCase();
    return esp.includes(key) || key.includes(esp);
  }) || null;
}

function calcularValorCLT({
  especialidade_vinculo,
  valor_clinica,
  valor_profissional_atend,
  valor_fixo_base,
  meta_mensal,
  faltas,
  extras,
  configCLT, // array de especialidades_clt do banco
}) {
  const extrasNum = parseFloat(extras) || 0;
  const fixo      = parseFloat(valor_fixo_base) || 0;
  const vp        = parseFloat(valor_profissional_atend) || 0;
  const baseForaMeta = Math.max(vp, fixo);

  const esp = String(especialidade_vinculo || '').toLowerCase().trim();

  // Buscar config do banco (se disponível)
  const config = configCLT ? encontrarConfigCLT(configCLT, especialidade_vinculo) : null;

  // Se há config no banco e cálculo automático está habilitado, usar dados do banco
  if (config && config.tem_calculo_automatico) {
    const meta = parseFloat(meta_mensal) || parseFloat(config.meta_mensal) || 0;
    const pctComMeta = parseFloat(config.pct_com_meta) || 0;
    const pctExtra = parseFloat(config.pct_meta_extra) || 0;
    const limiarExtra = parseFloat(config.limiar_meta_extra) || 0;

    if (meta > 0 && valor_clinica >= meta) {
      // Se há limiar extra e faturamento está abaixo do limiar → usa % extra
      const pctAplicado = (pctExtra > 0 && limiarExtra > 0 && valor_clinica < limiarExtra) ? pctExtra : pctComMeta;
      return {
        total: Math.max(0, valor_clinica * (pctAplicado / 100) + extrasNum),
        meta_batida: true,
        tipo_calculo: `clt_${config.especialidade.toLowerCase()}`,
        pct_aplicado: pctAplicado,
      };
    }
    return {
      total: Math.max(0, baseForaMeta + extrasNum),
      meta_batida: false,
      tipo_calculo: `clt_${config.especialidade.toLowerCase()}`,
      pct_aplicado: null,
    };
  }

  // Fallback hardcoded (compatibilidade retroativa caso tabela não tenha a especialidade)
  // Fisio CLT
  if (esp.includes('fisio') && !esp.includes('pelv') && !esp.includes('pélv')) {
    const meta = parseFloat(meta_mensal) || 25000;
    if (valor_clinica >= meta) {
      return { total: Math.max(0, valor_clinica * 0.20 + extrasNum), meta_batida: true, tipo_calculo: 'clt_fisio', pct_aplicado: 20 };
    }
    return { total: Math.max(0, baseForaMeta + extrasNum), meta_batida: false, tipo_calculo: 'clt_fisio', pct_aplicado: null };
  }

  // Neuro CLT
  if (esp.includes('neuro')) {
    const meta = parseFloat(meta_mensal) || 16000;
    if (valor_clinica >= meta) {
      return { total: Math.max(0, valor_clinica * 0.30 + extrasNum), meta_batida: true, tipo_calculo: 'clt_neuro', pct_aplicado: 30 };
    }
    return { total: Math.max(0, baseForaMeta + extrasNum), meta_batida: false, tipo_calculo: 'clt_neuro', pct_aplicado: null };
  }

  // Acup CLT
  if (esp.includes('acup')) {
    const meta = parseFloat(meta_mensal) || 30000;
    if (valor_clinica >= meta) {
      const pct = valor_clinica >= 30000 ? 20 : 17;
      return { total: Math.max(0, valor_clinica * (pct / 100) + extrasNum), meta_batida: true, tipo_calculo: 'clt_acup', pct_aplicado: pct };
    }
    return { total: Math.max(0, baseForaMeta + extrasNum), meta_batida: false, tipo_calculo: 'clt_acup', pct_aplicado: null };
  }

  // RPG, Pilates, Fisio Pelv e demais → revisão manual
  return { total: null, meta_batida: false, tipo_calculo: 'clt_revisao_manual', pct_aplicado: null };
}

/**
 * Cruza grupos com prestadores cadastrados no banco.
 * tipoContrato: 'clt' → só usa vínculos CLT; 'prestador' → só usa vínculos PJ.
 * Retorna: reconhecidos (com prestador/vínculo) e não reconhecidos.
 */
async function cruzarComPrestadores(grupos, tipoContrato) {
  const ehCLT = tipoContrato === 'clt';

  // Carregar TODOS os vínculos ativos (CLT e PJ)
  const prestadores = await db('usuarios as u')
    .join('prestador_vinculos as pv', 'pv.prestador_id', 'u.id')
    .where('u.tipo', 'prestador')
    .where('pv.ativo', true)
    .select(
      'u.id as prestador_id', 'u.nome', 'u.email',
      'pv.id as vinculo_id', 'pv.especialidade', 'pv.unidade', 'pv.turno',
      'pv.meta_mensal', 'pv.valor_fixo_base', 'pv.desconto_por_falta',
      'pv.tipo_contrato'
    );

  // Separar vínculos CLT e PJ
  const vinculosCLT = prestadores.filter(p => p.tipo_contrato === 'clt');
  const vinculosPJ  = prestadores.filter(p => p.tipo_contrato !== 'clt');

  // Buscar mapeamentos salvos anteriormente
  const mapeamentosSalvos = await db('mapeamento_nomes').select('*');
  const mapNomes = new Map(mapeamentosSalvos.map(m => [m.nome_planilha.toLowerCase(), m]));

  const reconhecidos = [];
  const naoReconhecidos = [];

  /**
   * Tenta encontrar o melhor vínculo em uma lista de candidatos.
   * strictTurno=true  → só turno exato ou INDEFINIDO (usado para CLT — evita duplicar turnos)
   * strictTurno=false → também aceita fallback relaxado por nome (usado para PJ)
   */
  function encontrarVinculo(candidates, grupo, strictTurno = false) {
    // 1. Turno exato
    let match = candidates.find(p => {
      const nomeMatch = similaridade(p.nome, grupo.nome_normalizado) >= 0.7;
      const unidadeMatch = !p.unidade || !grupo.unidade || p.unidade === grupo.unidade;
      return nomeMatch && unidadeMatch && p.turno === grupo.turno;
    });
    if (match) return match;

    // 2. Fallback: vínculo INDEFINIDO ou AMBOS (aceita qualquer turno)
    match = candidates.find(p => {
      const nomeMatch = similaridade(p.nome, grupo.nome_normalizado) >= 0.7;
      const unidadeMatch = !p.unidade || !grupo.unidade || p.unidade === grupo.unidade;
      return nomeMatch && unidadeMatch && (!p.turno || p.turno === 'INDEFINIDO' || p.turno === 'AMBOS');
    });
    if (match) return match;

    // 3. Fallback relaxado: só nome — apenas para PJ; CLT exige turno correto
    if (strictTurno) return null;
    return candidates.find(p => similaridade(p.nome, grupo.nome_normalizado) >= 0.6);
  }

  for (const grupo of grupos) {
    const nomeLower = grupo.nome_normalizado.toLowerCase();
    const nomePlanilhaLower = grupo.nome_planilha.toLowerCase();

    // 1. Verificar mapeamento salvo — respeitar tipo da planilha
    const mapeado = mapNomes.get(nomePlanilhaLower) || mapNomes.get(nomeLower);
    if (mapeado) {
      const vinculo = prestadores.find(p => {
        if (p.vinculo_id !== mapeado.vinculo_id) return false;
        // Só usar o mapeamento se o tipo_contrato bate com o da planilha
        const tipoVinculo = p.tipo_contrato === 'clt' ? 'clt' : 'prestador';
        return tipoVinculo === (ehCLT ? 'clt' : 'prestador');
      });
      if (vinculo) {
        reconhecidos.push({ ...grupo, ...vinculo, turno_planilha: grupo.turno, mapeado: true });
        continue;
      }
    }

    if (ehCLT) {
      // Planilha CLT: só casar com vínculos CLT, turno estrito (sem fallback relaxado)
      const matchCLT = encontrarVinculo(vinculosCLT, grupo, true);
      if (matchCLT) {
        reconhecidos.push({ ...grupo, ...matchCLT, turno_planilha: grupo.turno, mapeado: false });
        continue;
      }
    } else {
      // Planilha PJ: só casar com vínculos PJ, com fallback relaxado
      const matchPJ = encontrarVinculo(vinculosPJ, grupo, false);
      if (matchPJ) {
        reconhecidos.push({ ...grupo, ...matchPJ, turno_planilha: grupo.turno, mapeado: false });
        continue;
      }
    }

    // 4. Não reconhecido
    naoReconhecidos.push({
      ...grupo,
      sugestoes: prestadores
        .map(p => ({ ...p, sim: similaridade(p.nome, grupo.nome_normalizado) }))
        .filter(p => p.sim >= 0.3)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 5),
    });
  }

  // Mesclar entradas com mesmo vínculo:
  // - Vínculos INDEFINIDO: merge por vinculo_id (MANHÃ + TARDE somam num único registro)
  // - Vínculos AMBOS: split por turno da planilha → 2 linhas separadas (MANHÃ + TARDE)
  // - Vínculos com turno fixo: merge por vinculo_id|turno_planilha (não mistura turnos)
  const mergedMap = new Map();
  for (const item of reconhecidos) {
    const turnoVinculo = (item.turno || '').toUpperCase();
    const isAmbos = turnoVinculo === 'AMBOS';
    const isIndefinido = !turnoVinculo || turnoVinculo === 'INDEFINIDO';
    // AMBOS → chave inclui turno_planilha (cria 2 linhas separadas)
    // INDEFINIDO → chave só vinculo_id (merge em 1 linha)
    const key = isAmbos
      ? `${item.vinculo_id}|${item.turno_planilha}`
      : isIndefinido
        ? String(item.vinculo_id)
        : `${item.vinculo_id}|${item.turno_planilha}`;

    if (mergedMap.has(key)) {
      const ex = mergedMap.get(key);
      ex.valor_clinica            += item.valor_clinica;
      ex.valor_clinica_total       = (ex.valor_clinica_total || 0) + (item.valor_clinica_total || 0);
      ex.valor_profissional_atend += item.valor_profissional_atend;
      ex.valor_prof_part_oab       = (ex.valor_prof_part_oab || 0) + (item.valor_prof_part_oab || 0);
      ex.atendimentos              = (ex.atendimentos || 0) + (item.atendimentos || 0);
      ex.datas                     = [...(ex.datas || []), ...(item.datas || [])];
      ex._turnos_planilha.add(item.turno_planilha);
    } else {
      mergedMap.set(key, { ...item, _turnos_planilha: new Set([item.turno_planilha]) });
    }
  }

  // Deduplicar naoReconhecidos por nome_planilha — mesmo profissional em MANHÃ e TARDE
  // deve aparecer apenas uma vez na tela de mapeamento (valores somados)
  const naoRecMap = new Map();
  for (const item of naoReconhecidos) {
    const k = item.nome_planilha.toLowerCase();
    if (naoRecMap.has(k)) {
      const ex = naoRecMap.get(k);
      ex.valor_clinica            = (ex.valor_clinica || 0) + (item.valor_clinica || 0);
      ex.valor_profissional_atend = (ex.valor_profissional_atend || 0) + (item.valor_profissional_atend || 0);
      ex.atendimentos             = (ex.atendimentos || 0) + (item.atendimentos || 0);
      ex.turno                    = 'MANHÃ/TARDE'; // indica múltiplos turnos
    } else {
      naoRecMap.set(k, { ...item });
    }
  }

  return { reconhecidos: [...mergedMap.values()], naoReconhecidos: [...naoRecMap.values()] };
}

/**
 * Processa arquivo de Atendimentos e retorna preview de cálculos
 */
async function processarAtendimentos(rows, tipoContratoForcado) {
  // Coletar datas para detectar tipo
  const datas = rows.slice(1).map(r => r[0]).filter(Boolean);
  const tipoContrato = tipoContratoForcado || detectarTipoContrato(datas);
  const { mes, ano } = detectarMesAno(datas, tipoContrato);

  // Agregar por profissional + turno + unidade
  const grupos = agregarAtendimentos(rows.slice(1));

  // Cruzar com prestadores filtrando pelo tipo detectado (CLT → só vínculos CLT, PJ → só vínculos PJ)
  const { reconhecidos, naoReconhecidos } = await cruzarComPrestadores(grupos, tipoContrato);

  // Carregar config CLT do banco uma única vez
  const configCLT = await carregarConfigCLT();

  // Calcular valores para os reconhecidos (cada item usa seu próprio tipo_contrato)
  const calculados = await Promise.all(reconhecidos.map(async (item) => {
    const espComissao = normalizarEspParaComissao(item.especialidade_atend, item.unidade);
    const espVinculo = item.especialidade || '';
    let comissao = null;

    if (espComissao) {
      comissao = await buscarComissao(espComissao, item.unidade);
    }

    // Usa o tipo_contrato do vínculo do profissional (CLT ou PJ individual)
    const tipoIndividual = item.tipo_contrato === 'clt' ? 'clt' : 'prestador';

    // Especialidades PJ que têm fixo (CLT não usa fixo por turno — regido por salário)
    const ESPECIALIDADES_COM_FIXO_PJ = ['RPG', 'Fisio', 'Acup', 'Neuro', 'SJFisio', 'SJAcup', 'SJRPG'];
    const temFixoPJ = tipoIndividual === 'prestador' && ESPECIALIDADES_COM_FIXO_PJ.includes(espComissao || espVinculo);

    // Para PJ com AMBOS turnos: contar quantos turnos reais foram trabalhados neste mês
    // Cada turno = 1 fixo. CLT não multiplica — o salário CLT já cobre todos os turnos.
    let numTurnos = 1;
    if (tipoIndividual === 'prestador' && item._turnos_planilha instanceof Set) {
      const turnosReais = [...item._turnos_planilha].filter(t => t === 'MANHÃ' || t === 'TARDE');
      numTurnos = Math.max(1, turnosReais.length);
    }

    // Fixo PJ multiplicado pelos turnos trabalhados (só para especialidades com fixo)
    const fixoBase = temFixoPJ ? (parseFloat(item.valor_fixo_base) || 0) : 0;
    const fixoEfetivo = fixoBase * numTurnos;

    let resultado;
    if (tipoIndividual === 'clt') {
      // CLT: sem fixo por turno, sem multiplicador — regido por holerite
      resultado = calcularValorCLT({
        especialidade_vinculo: espVinculo,
        valor_clinica: item.valor_clinica,
        valor_profissional_atend: item.valor_profissional_atend,
        valor_fixo_base: item.valor_fixo_base,
        meta_mensal: item.meta_mensal,
        faltas: 0,
        extras: 0,
        configCLT,
      });
    } else {
      // PJ: usa fixo efetivo (fixo × num_turnos para especialidades com fixo)
      resultado = calcularValorPJ({
        comissao,
        valor_clinica: item.valor_clinica,              // SEM Particular/OAB → base da meta
        valor_clinica_total: item.valor_clinica_total,
        valor_profissional_atend: item.valor_profissional_atend,
        valor_prof_part_oab: item.valor_prof_part_oab || 0,
        valor_fixo_base: fixoEfetivo,                   // fixo × num_turnos
        desconto_por_falta: item.desconto_por_falta,
        meta_mensal: item.meta_mensal,
        faltas: 0,
        extras: 0,
      });
    }

    return {
      prestador_id: item.prestador_id,
      vinculo_id: item.vinculo_id,
      nome: item.nome,
      nome_planilha: item.nome_planilha,
      especialidade: espVinculo,
      especialidade_comissao: espComissao,
      unidade: item.unidade,
      turno: item.turno,
      tipo_contrato: item.tipo_contrato,
      valor_clinica: item.valor_clinica,
      valor_clinica_total: item.valor_clinica_total,
      valor_prof_part_oab: item.valor_prof_part_oab || 0,
      valor_profissional_atend: item.valor_profissional_atend,
      meta_mensal: item.meta_mensal,
      valor_fixo_base: item.valor_fixo_base,    // fixo unitário (1 turno)
      num_turnos: numTurnos,                    // quantos turnos foram trabalhados
      fixo_efetivo: fixoEfetivo,                // fixo × turnos (o que entrou no cálculo)
      faltas: 0,
      extras: 0,
      meta_batida: resultado.meta_batida,
      fixo_ajustado: resultado.fixo_ajustado || 0,
      pct_aplicado: resultado.pct_aplicado,
      valor_bruto: resultado.total,
      tipo_calculo: resultado.tipo_calculo,
      revisao_manual: resultado.tipo_calculo === 'clt_revisao_manual',
    };
  }));

  return {
    tipo_contrato: tipoContrato,
    mes,
    ano,
    calculados,
    nao_reconhecidos: naoReconhecidos,
  };
}

/**
 * Recalcula um item com novos valores de faltas e extras (chamado do frontend).
 * Usa item.tipo_contrato para determinar as regras (CLT ou PJ por profissional).
 */
async function recalcularItem(item) {
  const espComissao = item.especialidade_comissao;
  const tipoIndividual = item.tipo_contrato === 'clt' ? 'clt' : 'prestador';
  let comissao = null;

  if (espComissao && tipoIndividual !== 'clt') {
    comissao = await buscarComissao(espComissao, item.unidade);
  }

  const configCLT = tipoIndividual === 'clt' ? await carregarConfigCLT() : null;

  let resultado;
  if (tipoIndividual === 'clt') {
    resultado = calcularValorCLT({
      especialidade_vinculo: item.especialidade,
      valor_clinica: item.valor_clinica,
      valor_profissional_atend: item.valor_profissional_atend,
      valor_fixo_base: item.valor_fixo_base,
      meta_mensal: item.meta_mensal,
      faltas: item.faltas,
      extras: item.extras,
      configCLT,
    });
  } else {
    // Preservar fixo efetivo (fixo × num_turnos) calculado originalmente
    const fixoEfetivo = item.fixo_efetivo != null ? item.fixo_efetivo : (parseFloat(item.valor_fixo_base) || 0);
    resultado = calcularValorPJ({
      comissao,
      valor_clinica: item.valor_clinica,
      valor_clinica_total: item.valor_clinica_total,
      valor_profissional_atend: item.valor_profissional_atend,
      valor_prof_part_oab: item.valor_prof_part_oab || 0,
      valor_fixo_base: fixoEfetivo,              // usa o fixo já multiplicado pelos turnos
      desconto_por_falta: item.desconto_por_falta || 20,
      meta_mensal: item.meta_mensal,
      faltas: item.faltas,
      extras: item.extras,
    });
  }

  return {
    ...item,
    meta_batida: resultado.meta_batida,
    fixo_ajustado: resultado.fixo_ajustado || 0,
    pct_aplicado: resultado.pct_aplicado,
    valor_bruto: resultado.total !== null ? resultado.total : item.valor_bruto,
    tipo_calculo: resultado.tipo_calculo,
    revisao_manual: resultado.tipo_calculo === 'clt_revisao_manual',
  };
}

module.exports = {
  processarAtendimentos,
  recalcularItem,
  detectarTipoContrato,
  detectarMesAno,
  clinicaParaUnidade,
  detectarTurnoPorHora,
  normalizarNomePlanilha,
  normalizarEspParaComissao,
};
