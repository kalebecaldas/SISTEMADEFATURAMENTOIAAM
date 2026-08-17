/**
 * Serviço de cálculo de pagamentos a partir da aba Atendimentos
 *
 * Regras:
 * PJ: valor_clinica × % (tabela MATRIZ/SJ) + FIXO ajustado por faltas + extras
 * CLT Fisio: piso 3750 (ou 5000 se fat >= 25000) − faltas × 20
 * CLT Acup: fat × 17% ou 20% (se >= 30000) − faltas × 20
 */

const db = require('../database/connection');
const { calcularValorPJ } = require('./calculoPJCore');

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
// O sistema da clínica exporta o profissional com enfeites em volta do nome:
//   "Pilates Tarde - Christie Anne Clementino Silva"      → prefixo de serviço + turno
//   "Toc - Terap. Ondas de Choque - Douglas Almeida"      → prefixo de procedimento
//   "Romilton Santos - CRM: 3797"                          → sufixo de conselho
// Sem remover isso o nome nunca casa com o cadastro. Em julho/2026 esse sufixo sozinho
// jogou 5 profissionais para "não reconhecido" (Romilton, Franklin, Sandra, Edivaldo,
// Clemerson) — todos com vínculo ativo no banco.
const PREFIXO_SERVICO = /^(pilates\s+(?:manh[ãa]|tarde)|toc\s*[-–]\s*terap\.?\s*ondas?\s+de\s+choque)\s*[-–]\s*/i;
// O número do conselho vem em formatos livres: "CRM: 3797", "CREFITO: 317748-F",
// "CREFITO: 318422.1.F". Depois da sigla, tudo até o fim da string é registro —
// tentar casar só dígitos deixava passar os CREFITO com letra/ponto, e aí o nome
// "Silvino Viana Reis Sobrinho - CREFITO: 317748-F" não casava com o cadastro.
const SUFIXO_CONSELHO = /\s*[-–]\s*(?:CRM|CRF|CREFITO|CREFONO|COREN|CRO|CRN|CRP|CRBM|CRESS|CRMV)\b.*$/i;

function normalizarNomePlanilha(nome) {
  if (!nome) return '';
  return nome
    .replace(PREFIXO_SERVICO, '')
    .replace(SUFIXO_CONSELHO, '')
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

/**
 * Especialidades PJ que têm FIXO no contrato.
 *
 * Importa em dois lugares e eles precisam concordar: o cálculo desconta a falta
 * do fixo (fixo/30 x faltas), e o detector só faz sentido para quem tem fixo —
 * sem fixo não há de onde descontar, então detectar falta de fisioterapeuta
 * pélvica ou de pilates é ruído puro na conferência.
 *
 * Fisio aqui é a ortopédica; "Fisio Pelv" e "Pilates" ficam de fora de propósito.
 */
const ESPECIALIDADES_COM_FIXO_PJ = ['RPG', 'Fisio', 'Acup', 'Neuro', 'SJFisio', 'SJAcup', 'SJRPG'];

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
 * Calcula o valor bruto CLT para um grupo
 *
 * CLT: faltas NÃO são descontadas aqui — contabilidade faz o desconto.
 * Apenas armazenamos a quantidade de faltas para repasse.
 *
 * Fórmula: FORA da meta: max(VP, fixo) + extras | COM meta: valor_clinica × pct + extras
 */
/**
 * REGRA DE NEGÓCIO:
 * CLT  → meta e cálculo usam SEMPRE o faturamento total (valor_clinica_total),
 *        incluindo Particular/OAB. Não há exclusão de convênios para CLT.
 * PJ   → meta usa valor_clinica (excluindo Particular/OAB); valor_prof_part_oab
 *        é somado separado como face-value.
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

/**
 * Calcula o valor bruto CLT para um grupo.
 *
 * REGRA: CLT usa valor_clinica_total (faturamento bruto completo, incluindo
 * Particular/OAB) tanto para checagem quanto para cálculo da meta.
 * Exclusão de Particular/OAB é exclusiva do fluxo PJ.
 *
 * @param {number} valor_clinica_total - Faturamento total da clínica (incluindo Part/OAB)
 * @param {number} valor_profissional_atend - Valor profissional da planilha
 * @param {number} valor_fixo_base - Salário fixo base
 * @param {number|null} meta_mensal - Meta mensal configurada no vínculo
 * @param {number} extras - Adicionais (dias extras, etc)
 * @param {object[]|null} configCLT - Configurações da tabela especialidades_clt
 */
function calcularValorCLT({
  especialidade_vinculo,
  valor_clinica,        // mantido por compatibilidade (PJ); CLT usa valor_clinica_total
  valor_clinica_total,  // faturamento bruto completo (CLT usa este)
  valor_profissional_atend,
  valor_fixo_base,
  meta_mensal,
  faltas,
  extras,
  configCLT,
}) {
  const extrasNum = parseFloat(extras) || 0;
  const fixo      = parseFloat(valor_fixo_base) || 0;
  const vp        = parseFloat(valor_profissional_atend) || 0;
  const baseForaMeta = Math.max(vp, fixo);

  // CLT: usa SEMPRE o faturamento total (sem exclusão de Part/OAB)
  const fatCLT = parseFloat(valor_clinica_total ?? valor_clinica) || 0;

  const esp = String(especialidade_vinculo || '').toLowerCase().trim();

  // Buscar config do banco (se disponível)
  const config = configCLT ? encontrarConfigCLT(configCLT, especialidade_vinculo) : null;

  // Config do banco com cálculo automático
  if (config && config.tem_calculo_automatico) {
    const meta = parseFloat(meta_mensal) || parseFloat(config.meta_mensal) || 0;
    const pctComMeta  = parseFloat(config.pct_com_meta) || 0;
    const pctExtra    = parseFloat(config.pct_meta_extra) || 0;
    const limiarExtra = parseFloat(config.limiar_meta_extra) || 0;
    const salarioBase = parseFloat(config.salario_base) || 0;

    if (meta > 0 && fatCLT >= meta) {
      // Limiar extra: se existe e o faturamento está abaixo → usa % extra
      const pctAplicado = (pctExtra > 0 && limiarExtra > 0 && fatCLT < limiarExtra)
        ? pctExtra
        : pctComMeta;
      return {
        total: Math.max(0, fatCLT * (pctAplicado / 100) + extrasNum),
        meta_batida: true,
        tipo_calculo: `clt_${config.especialidade.toLowerCase()}`,
        pct_aplicado: pctAplicado,
      };
    }
    // Fora da meta: salário fixo da tabela especialidades_clt (não usa vp da planilha)
    return {
      total: Math.max(0, salarioBase + extrasNum),
      meta_batida: false,
      tipo_calculo: `clt_${config.especialidade.toLowerCase()}`,
      pct_aplicado: null,
    };
  }

  // Fallback hardcoded (retrocompatibilidade quando especialidade não está na tabela)

  // Fisio CLT
  if (esp.includes('fisio') && !esp.includes('pelv') && !esp.includes('pélv')) {
    const meta = parseFloat(meta_mensal) || 25000;
    if (fatCLT >= meta) {
      return { total: Math.max(0, fatCLT * 0.20 + extrasNum), meta_batida: true, tipo_calculo: 'clt_fisio', pct_aplicado: 20 };
    }
    return { total: Math.max(0, baseForaMeta + extrasNum), meta_batida: false, tipo_calculo: 'clt_fisio', pct_aplicado: null };
  }

  // Neuro CLT
  if (esp.includes('neuro')) {
    const meta = parseFloat(meta_mensal) || 16000;
    if (fatCLT >= meta) {
      return { total: Math.max(0, fatCLT * 0.30 + extrasNum), meta_batida: true, tipo_calculo: 'clt_neuro', pct_aplicado: 30 };
    }
    return { total: Math.max(0, baseForaMeta + extrasNum), meta_batida: false, tipo_calculo: 'clt_neuro', pct_aplicado: null };
  }

  // Acup CLT
  if (esp.includes('acup')) {
    const meta = parseFloat(meta_mensal) || 30000;
    if (fatCLT >= meta) {
      const pct = fatCLT >= 30000 ? 20 : 17;
      return { total: Math.max(0, fatCLT * (pct / 100) + extrasNum), meta_batida: true, tipo_calculo: 'clt_acup', pct_aplicado: pct };
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

  // Carregar TODOS os vínculos ativos (CLT e PJ).
  // data_fim preenchida = contrato encerrado (ex: migrou de PJ para CLT). Esse vínculo
  // nunca mais pode casar com uma planilha, senão a pessoa volta a ser paga no regime
  // antigo — foi exatamente assim que 29 registros PJ/CLT duplicados nasceram em 2026.
  const prestadores = await db('usuarios as u')
    .join('prestador_vinculos as pv', 'pv.prestador_id', 'u.id')
    .where('u.tipo', 'prestador')
    .where('pv.ativo', true)
    .whereNull('pv.data_fim')
    .select(
      'u.id as prestador_id', 'u.nome', 'u.email',
      'pv.id as vinculo_id', 'pv.especialidade', 'pv.unidade', 'pv.turno',
      'pv.meta_mensal', 'pv.valor_fixo_base', 'pv.desconto_por_falta',
      'pv.tipo_contrato', 'pv.modelo_fixo'
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
   *
   * Retorna { vinculo, turnoDivergente }. turnoDivergente=true quando o atendimento só
   * casou via fallback (nome ± unidade, ignorando turno) com um vínculo PJ de turno FIXO
   * (MANHÃ ou TARDE) diferente do turno detectado — ex: vínculo é só MANHÃ mas apareceu
   * atendimento de TARDE. Isso some no PJ sob risco de faltar um fixo/turno separado
   * (caso real: Silvino, Bruna Loretta). Para CLT não se aplica — salário fixo já cobre
   * qualquer turno, então nunca diverge.
   */
  function encontrarVinculo(candidates, grupo, strictTurno = false) {
    // 1. Turno exato — nunca diverge
    let match = candidates.find(p => {
      const nomeMatch = similaridade(p.nome, grupo.nome_normalizado) >= 0.7;
      const unidadeMatch = !p.unidade || !grupo.unidade || p.unidade === grupo.unidade;
      return nomeMatch && unidadeMatch && p.turno === grupo.turno;
    });
    if (match) return { vinculo: match, turnoDivergente: false };

    // 2. Fallback: vínculo INDEFINIDO ou AMBOS — aceitam qualquer turno por definição, não diverge
    match = candidates.find(p => {
      const nomeMatch = similaridade(p.nome, grupo.nome_normalizado) >= 0.7;
      const unidadeMatch = !p.unidade || !grupo.unidade || p.unidade === grupo.unidade;
      return nomeMatch && unidadeMatch && (!p.turno || p.turno === 'INDEFINIDO' || p.turno === 'AMBOS');
    });
    if (match) return { vinculo: match, turnoDivergente: false };

    // 3. CLT: fallback por nome + unidade (ignora turno) — cobre MANHÃ/TARDE no mesmo vínculo,
    //    nunca diverge (salário CLT é único independente de turno)
    if (strictTurno) {
      match = candidates.find(p => {
        const nomeMatch = similaridade(p.nome, grupo.nome_normalizado) >= 0.7;
        const unidadeMatch = !p.unidade || !grupo.unidade || p.unidade === grupo.unidade;
        return nomeMatch && unidadeMatch;
      }) || null;
      return match ? { vinculo: match, turnoDivergente: false } : null;
    }
    // 4. PJ: fallback relaxado — só nome. Vínculo de turno fixo recebendo turno oposto = diverge.
    match = candidates.find(p => similaridade(p.nome, grupo.nome_normalizado) >= 0.6);
    if (!match) return null;
    const turnoFixo = match.turno && match.turno !== 'AMBOS' && match.turno !== 'INDEFINIDO';
    const turnoDivergente = turnoFixo && match.turno !== grupo.turno;
    return { vinculo: match, turnoDivergente };
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
        reconhecidos.push({ ...grupo, ...matchCLT.vinculo, turno_planilha: grupo.turno, mapeado: false, turno_divergente: false });
        continue;
      }
    } else {
      // Planilha PJ: só casar com vínculos PJ, com fallback relaxado
      const matchPJ = encontrarVinculo(vinculosPJ, grupo, false);
      if (matchPJ) {
        reconhecidos.push({ ...grupo, ...matchPJ.vinculo, turno_planilha: grupo.turno, mapeado: false, turno_divergente: matchPJ.turnoDivergente });
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
  // - AMBOS: o único caso que legitimamente representa 2 pagamentos (1 por turno trabalhado) →
  //   chave inclui turno_planilha, gerando até 2 linhas (MANHÃ + TARDE).
  // - Todo o resto (CLT, INDEFINIDO, turno fixo MANHÃ/TARDE): representa 1 vínculo = 1 pagamento
  //   mensal único → merge sempre por vinculo_id, mesmo que atendimentos tenham sido detectados
  //   em grupos/turnos diferentes (evita duplicar a mesma pessoa em 2 linhas, ex: Silvino/Layane).
  const mergedMap = new Map();
  for (const item of reconhecidos) {
    const turnoVinculo = (item.turno || '').toUpperCase();
    const isAmbos = turnoVinculo === 'AMBOS';
    const key = isAmbos
      ? `${item.vinculo_id}|${item.turno_planilha}`
      : String(item.vinculo_id);

    // Subtotal por turno da planilha. Sem isso o merge perde de vista quanto veio
    // de cada turno, e não dá pra separar o que foi EXTRA (turno fora do contrato)
    // do que é o turno contratado — que é o que a Fase 5 precisa mostrar.
    const somarTurno = (alvo, origem) => {
      const t = origem.turno_planilha || 'INDEFINIDO';
      if (!alvo._por_turno) alvo._por_turno = {};
      const acc = alvo._por_turno[t] || {
        turno: t, valor_clinica: 0, valor_clinica_total: 0,
        valor_profissional_atend: 0, valor_prof_part_oab: 0, atendimentos: 0,
      };
      acc.valor_clinica            += origem.valor_clinica || 0;
      acc.valor_clinica_total      += origem.valor_clinica_total || 0;
      acc.valor_profissional_atend += origem.valor_profissional_atend || 0;
      acc.valor_prof_part_oab      += origem.valor_prof_part_oab || 0;
      acc.atendimentos             += origem.atendimentos || 0;
      alvo._por_turno[t] = acc;
    };

    if (mergedMap.has(key)) {
      const ex = mergedMap.get(key);
      ex.valor_clinica            += item.valor_clinica;
      ex.valor_clinica_total       = (ex.valor_clinica_total || 0) + (item.valor_clinica_total || 0);
      ex.valor_profissional_atend += item.valor_profissional_atend;
      ex.valor_prof_part_oab       = (ex.valor_prof_part_oab || 0) + (item.valor_prof_part_oab || 0);
      ex.atendimentos              = (ex.atendimentos || 0) + (item.atendimentos || 0);
      ex.datas                     = [...(ex.datas || []), ...(item.datas || [])];
      ex._turnos_planilha.add(item.turno_planilha);
      ex.turno_divergente          = ex.turno_divergente || item.turno_divergente;
      somarTurno(ex, item);
    } else {
      const novo = { ...item, _turnos_planilha: new Set([item.turno_planilha]) };
      somarTurno(novo, item);
      mergedMap.set(key, novo);
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
 * Isola os turnos que o profissional atendeu mas que NÃO são o turno do contrato.
 *
 * Vínculo AMBOS ou INDEFINIDO cobre qualquer turno por definição — nada é extra.
 * Para turno fixo (MANHÃ/TARDE), tudo que veio do turno oposto é cobertura e
 * aparece separado na revisão, em vez de sumir dentro do total.
 *
 * @param {object} item          item já mesclado, com _por_turno acumulado
 * @param {string} turnoContrato turno do vínculo, em maiúsculas
 */
function montarExtrasTurno(item, turnoContrato) {
  if (!item._por_turno) return [];
  if (!turnoContrato || turnoContrato === 'AMBOS' || turnoContrato === 'INDEFINIDO') return [];

  return Object.values(item._por_turno)
    .filter(t => t.turno && t.turno !== 'INDEFINIDO' && t.turno !== turnoContrato)
    .map(t => ({
      turno: t.turno,
      atendimentos: t.atendimentos,
      valor_clinica: Number(t.valor_clinica_total.toFixed(2)),
      valor_profissional: Number(t.valor_profissional_atend.toFixed(2)),
    }));
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

    // A especialidade do VÍNCULO é a chave contratual da comissão e tem precedência.
    // Na planilha quem define o percentual é a coluna de especialidade, não a unidade:
    // em São José convivem "Fisio" (12/14%), "SJFisio" (16/18%) e "SJAcup" (16/18%) na
    // mesma unidade. Derivar a chave da unidade forçava todo mundo de São José para o
    // prefixo SJ e pagava o Silvino a 18% quando o contrato dele é 14%.
    // Só cai no valor derivado do atendimento quando o vínculo não resolve.
    let comissao = espVinculo ? await buscarComissao(espVinculo, item.unidade) : null;
    if (!comissao && espComissao) {
      comissao = await buscarComissao(espComissao, item.unidade);
    }

    // Usa o tipo_contrato do vínculo do profissional (CLT ou PJ individual)
    const tipoIndividual = item.tipo_contrato === 'clt' ? 'clt' : 'prestador';

    // Especialidades PJ que têm fixo (CLT não usa fixo por turno — regido por salário)
    // Mesma precedência da comissão: o vínculo manda.
    const temFixoPJ = tipoIndividual === 'prestador' && ESPECIALIDADES_COM_FIXO_PJ.includes(espVinculo || espComissao);

    // Para PJ com vínculo AMBOS: contar quantos turnos reais foram trabalhados neste mês
    // Cada turno = 1 fixo. Vínculo de turno fixo (MANHÃ/TARDE) ou INDEFINIDO nunca dobra —
    // representa um único contrato, mesmo que atendimentos tenham sido mesclados de turnos
    // diferentes. CLT não multiplica — o salário CLT já cobre todos os turnos.
    let numTurnos = 1;
    const turnoVinculoItem = (item.turno || '').toUpperCase();
    if (tipoIndividual === 'prestador' && turnoVinculoItem === 'AMBOS' && item._turnos_planilha instanceof Set) {
      const turnosReais = [...item._turnos_planilha].filter(t => t === 'MANHÃ' || t === 'TARDE');
      numTurnos = Math.max(1, turnosReais.length);
    }

    // Dias em que a pessoa efetivamente compareceu neste vínculo. Basta um
    // atendimento no dia para o dia contar.
    const diasTrabalhados = new Set((item.datas || []).map(d => String(d).trim()).filter(Boolean)).size;

    // Dois modelos de fixo:
    //   mensal  → valor cheio, e a falta desconta valor/30 (padrão histórico)
    //   por_dia → valor x dias comparecidos. Quem atende em dias alternados recebe
    //             por dia trabalhado, mesmo que tenha atendido um paciente só; o dia
    //             não trabalhado nem entra, então não há falta a descontar.
    const fixoBase = temFixoPJ ? (parseFloat(item.valor_fixo_base) || 0) : 0;
    const porDia = item.modelo_fixo === 'por_dia';
    const fixoEfetivo = porDia ? fixoBase * diasTrabalhados : fixoBase * numTurnos;

    let resultado;
    if (tipoIndividual === 'clt') {
      // CLT: usa valor_clinica_total (faturamento completo, sem exclusão Part/OAB)
      resultado = calcularValorCLT({
        especialidade_vinculo: espVinculo,
        valor_clinica: item.valor_clinica,
        valor_clinica_total: item.valor_clinica_total, // ← faturamento bruto completo
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
        valor_fixo_base: fixoEfetivo,
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
      valor_fixo_base: item.valor_fixo_base,    // fixo unitário (1 turno ou 1 dia)
      modelo_fixo: porDia ? 'por_dia' : 'mensal',
      dias_trabalhados: diasTrabalhados,
      num_turnos: numTurnos,                    // quantos turnos foram trabalhados
      fixo_efetivo: fixoEfetivo,                // o que realmente entrou no cálculo
      faltas: 0,
      extras: 0,
      meta_batida: resultado.meta_batida,
      fixo_ajustado: resultado.fixo_ajustado || 0,
      pct_aplicado: resultado.pct_aplicado,
      valor_bruto: resultado.total,
      tipo_calculo: resultado.tipo_calculo,
      revisao_manual: resultado.tipo_calculo === 'clt_revisao_manual',
      // Vínculo de turno fixo (MANHÃ/TARDE) recebeu atendimento do turno oposto — pode estar
      // faltando um 2º vínculo/fixo (caso real: Silvino) ou ser só uma cobertura ocasional
      // (caso real: Bruna Loretta). Admin decide na tela: "extra" ou "criar vínculo do turno".
      turno_divergente: !!item.turno_divergente,
      turnos_detectados: item._turnos_planilha instanceof Set ? [...item._turnos_planilha] : [item.turno_planilha],
      // Fase 5 — EXTRA: atendimento em turno diferente do contratado. Para CLT o
      // salário já cobre qualquer turno, então isso é sempre cobertura/extra e
      // nunca um contrato paralelo. Vem separado para o admin decidir na revisão.
      extras_turno: montarExtrasTurno(item, turnoVinculoItem),
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
      valor_clinica_total: item.valor_clinica_total, // ← faturamento bruto completo para CLT
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

/**
 * Mesmas regras de Calcular Pagamentos para uma linha da planilha mensal (rotas upload).
 */
async function calcularFinanceiroUploadLinha(input) {
  const tipoCollab = input.tipo_colaborador === 'clt' ? 'clt' : 'prestador';
  const extras = parseFloat(input.extras) || 0;
  const faltas = parseInt(input.faltas, 10) || 0;
  const valorProfissional = parseFloat(input.valor_profissional) || 0;
  const valorClinica = parseFloat(input.valor_clinica) || 0;
  const valorClinicaTotal = input.valor_clinica_total != null && input.valor_clinica_total !== ''
    ? parseFloat(input.valor_clinica_total)
    : valorClinica;

  let metaMensal = null;
  if (input.meta_mensal != null && input.meta_mensal !== '' && input.meta_mensal !== 'N/P' && input.meta_mensal !== 'NP') {
    const m = parseFloat(input.meta_mensal);
    if (!Number.isNaN(m)) metaMensal = m;
  }

  const valorFixoSheet = parseFloat(input.valor_fixo) || 0;
  const especialidade = (input.especialidade || '').trim();
  const unidade = (input.unidade || '').trim();

  if (tipoCollab === 'clt') {
    const configCLT = await carregarConfigCLT();
    return calcularValorCLT({
      especialidade_vinculo: especialidade,
      valor_clinica: valorClinica,
      valor_clinica_total: valorClinicaTotal, // ← faturamento bruto para CLT
      valor_profissional_atend: valorProfissional,
      valor_fixo_base: valorFixoSheet,
      meta_mensal: metaMensal,
      faltas,
      extras,
      configCLT,
    });
  }

  let espComissao = normalizarEspParaComissao(especialidade, unidade);
  if (!espComissao) espComissao = especialidade || null;

  let comissao = null;
  if (espComissao) {
    comissao = await buscarComissao(espComissao, unidade);
  }

  const espKey = espComissao || especialidade;
  const temFixoPJ = espKey && ESPECIALIDADES_COM_FIXO_PJ.includes(espKey);
  const fixoEfetivo = temFixoPJ ? valorFixoSheet : 0;

  return calcularValorPJ({
    comissao,
    valor_clinica: valorClinica,
    valor_clinica_total: valorClinicaTotal,
    valor_profissional_atend: valorProfissional,
    valor_prof_part_oab: 0,
    valor_fixo_base: fixoEfetivo,
    desconto_por_falta: input.desconto_por_falta != null ? input.desconto_por_falta : 20,
    meta_mensal: metaMensal,
    faltas,
    extras,
  });
}

/**
 * Sincroniza prestador_vinculos.ativo com base no período mais recente já cadastrado
 * em dados_mensais para o tipo informado ('prestador' ou 'clt').
 *
 * Regra de negócio: o vínculo só fica ativo se aparece na planilha do período mais
 * recente daquele tipo. Permite importar planilhas antigas fora de ordem sem efeito —
 * sempre resincroniza contra o período mais recente já existente no banco (não contra
 * o período que acabou de ser confirmado).
 *
 * Depois recalcula usuarios.status ('ativo'/'inativo') com base em ter ao menos 1
 * vínculo ativo (PJ ou CLT) — usuarios 'pendente' (cadastro não confirmado) não são
 * tocados. Não altera usuarios.ativo (campo usado pelo login) — inativo continua
 * acessando o sistema e seu próprio histórico, só sai das listas de "ativos".
 *
 * @param {'prestador'|'clt'} tipoColaborador
 */
async function sincronizarStatusAtivos(tipoColaborador) {
  const ultimoPeriodo = await db('dados_mensais')
    .where('tipo_colaborador', tipoColaborador)
    .orderBy('ano', 'desc')
    .orderBy('mes', 'desc')
    .first(['mes', 'ano']);

  if (!ultimoPeriodo) return;

  const vinculosDoUltimoPeriodo = await db('dados_mensais')
    .where({ tipo_colaborador: tipoColaborador, mes: ultimoPeriodo.mes, ano: ultimoPeriodo.ano })
    .whereNotNull('vinculo_id')
    .where(qb => qb.where('anulado', false).orWhereNull('anulado'))
    .pluck('vinculo_id');

  // Vínculo recém-criado tem carência: um upload que erra o matching (nome sujo,
  // turno colapsado) deixaria de listá-lo e ele seria desligado no mesmo instante
  // em que foi configurado — foi o que matou o vínculo de manhã do Silvino no
  // fechamento de julho/2026. Sem a carência, reprocessar não conserta, porque o
  // matcher só enxerga vínculo ativo.
  const carencia = new Date();
  carencia.setDate(carencia.getDate() - 30);

  await db('prestador_vinculos')
    .where('tipo_contrato', tipoColaborador)
    .where('created_at', '<', carencia)
    .update({ ativo: false });

  if (vinculosDoUltimoPeriodo.length > 0) {
    // Nunca reativar contrato encerrado: data_fim é decisão manual do admin e tem
    // precedência sobre a presença na planilha do período mais recente.
    await db('prestador_vinculos')
      .whereIn('id', vinculosDoUltimoPeriodo)
      .whereNull('data_fim')
      .update({ ativo: true });
  }

  // usuarios.status deriva de "tem ao menos 1 vínculo ativo, de qualquer tipo"
  const prestadorIdsComVinculoAtivo = await db('prestador_vinculos')
    .where('ativo', true)
    .distinct('prestador_id')
    .pluck('prestador_id');

  const baseQuery = db('usuarios')
    .where('tipo', 'prestador')
    .whereIn('status', ['ativo', 'inativo']); // nunca tocar em 'pendente' ou outros estados

  if (prestadorIdsComVinculoAtivo.length > 0) {
    await baseQuery.clone()
      .whereNotIn('id', prestadorIdsComVinculoAtivo)
      .update({ status: 'inativo' });

    await baseQuery.clone()
      .whereIn('id', prestadorIdsComVinculoAtivo)
      .update({ status: 'ativo' });
  } else {
    await baseQuery.update({ status: 'inativo' });
  }
}

module.exports = {
  processarAtendimentos,
  recalcularItem,
  calcularFinanceiroUploadLinha,
  sincronizarStatusAtivos,
  detectarTipoContrato,
  detectarMesAno,
  clinicaParaUnidade,
  detectarTurnoPorHora,
  normalizarNomePlanilha,
  normalizarEspParaComissao,
  ESPECIALIDADES_COM_FIXO_PJ,
};
