/**
 * Importa uma planilha mensal histórica (formato pré-calculado: FUNCIONÁRIOS, Especialidade,
 * UNIDADE, Valor Total Clínica, Valor Profissional, FIXO, META, Valor Bruto, FALTAS, EMAIL,
 * TURNO, Valor Líquido — colunas lidas pelo NOME do cabeçalho, não por índice fixo, porque a
 * posição varia entre anos (ex: 2021/2022 não têm coluna EMAIL, deslocando tudo 1 posição).
 *
 * Reaproveita os mesmos serviços do fluxo normal de upload (cadastrarPrestadorRapido,
 * calcularFinanceiroUploadLinha, sincronizarStatusAtivos) pra garantir que o histórico
 * entre com a mesma lógica corrigida nesta sessão.
 *
 * Uso: node scripts/importarHistorico.js <caminhoArquivo> <abaNome> <mes> <ano> <tipo_colaborador>
 * Saída: uma linha JSON com o resumo do que foi processado.
 */
const XLSX = require('xlsx');
const { db } = require('../database/init');
const { cadastrarPrestadorRapido } = require('../services/prestadorCadastroRapido');
const { calcularFinanceiroUploadLinha, sincronizarStatusAtivos } = require('../services/calculoAtendimentos');
const { normalizarUnidade } = require('../utils/unidades');
const { normalizarEspecialidade } = require('../utils/especialidades');

function similaridade(a, b) {
  const normalize = (s) => String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '').trim();
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 1;
  const wordsA = new Set(na.split(' ').filter(Boolean));
  const wordsB = new Set(nb.split(' ').filter(Boolean));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

function normalizarTurno(turno) {
  if (!turno) return null;
  const t = String(turno).toUpperCase().trim();
  const map = {
    M: 'MANHÃ', MANHA: 'MANHÃ', 'MANHÃ': 'MANHÃ',
    T: 'TARDE', TARDE: 'TARDE',
    N: 'NOITE', NOITE: 'NOITE',
    I: 'INTEGRAL', INTEGRAL: 'INTEGRAL', COMPLETO: 'INTEGRAL',
  };
  return map[t] || null;
}

function limparNomeTurno(nome) {
  return String(nome)
    .replace(/\s*\(tarde\)/i, '')
    .replace(/\s*\(manhã\)/i, '')
    .replace(/\s*\(manha\)/i, '')
    .trim();
}

function detectarTurno(row, colTurno, nomeRaw) {
  if (colTurno !== -1 && row[colTurno] != null && String(row[colTurno]).trim()) {
    const t = normalizarTurno(row[colTurno]);
    if (t) return t;
  }
  if (/\(tarde\)/i.test(nomeRaw)) return 'TARDE';
  if (/\(manhã\)/i.test(nomeRaw) || /\(manha\)/i.test(nomeRaw)) return 'MANHÃ';
  return 'INDEFINIDO';
}

// Resolve índice de cada campo pelo NOME do cabeçalho, não por posição fixa
function buildColMap(header) {
  const norm = (s) => String(s || '').trim().toLowerCase();
  const find = (...candidatos) => {
    for (const cand of candidatos) {
      const idx = header.findIndex(h => norm(h) === norm(cand));
      if (idx !== -1) return idx;
    }
    return -1;
  };
  return {
    nome: find('FUNCIONÁRIOS', 'FUNCIONARIOS', 'Profissional'),
    especialidade: find('Especialidade'),
    unidade: find('UNIDADE'),
    valorClinica: find('Valor Total Clínica', 'Valor Total Clinica', 'Fat. Clínica', 'Fat. Clinica'),
    valorProfissional: find('Valor Profissional'),
    fixo: find('FIXO'),
    meta: find('META'),
    valorBruto: find('Valor Bruto', 'VALOR BRUTO', 'Remuneração Total', 'Remuneracao Total'),
    faltas: find('FALTAS'),
    email: find('EMAIL'),
    turno: find('TURNO'),
    valorLiquido: find('Valor Líquido', 'Valor Liquido', 'LIQ. A RECEBER', 'LIQ A RECEBER'),
  };
}

async function importarArquivo({ caminho, aba: abaArg, mes, ano, tipo_colaborador }) {
  tipo_colaborador = tipo_colaborador === 'clt' ? 'clt' : 'prestador';

  if (!caminho || !abaArg || !mes || !ano) {
    return { erro: 'parâmetros obrigatórios: caminho, aba, mes, ano' };
  }

  // Duas passadas: primeiro só os nomes das abas (leve), depois parseia só a aba que
  // interessa. Workbooks antigos costumam ter uma aba "Atendimentos"/"Planilha2" gigante
  // e inchada que derruba o processo por memória se a gente deixar o XLSX parsear tudo.
  const wbNomes = XLSX.readFile(caminho, { bookSheets: true });
  const abaReal = wbNomes.SheetNames.find(n => n.toLowerCase() === abaArg.toLowerCase())
    || wbNomes.SheetNames.find(n => n.toLowerCase().includes(abaArg.toLowerCase()));
  if (!abaReal) {
    return { erro: 'aba não encontrada', abas_disponiveis: wbNomes.SheetNames };
  }
  const wb = XLSX.readFile(caminho, { sheets: [abaReal] });

  // Planilhas antigas às vezes têm um "!ref" fantasma (ex: A1:XFC1048576 — toda a grade do
  // Excel) por formatação aplicada à toa. sheet_to_json materializaria isso em um array de
  // ~17 bilhões de células e explode a memória. Limita ao range real de dados antes de converter.
  const sheet = wb.Sheets[abaReal];
  if (sheet['!ref']) {
    const rangeReal = XLSX.utils.decode_range(sheet['!ref']);
    rangeReal.e.r = Math.min(rangeReal.e.r, 1999); // no máx. 2000 linhas
    rangeReal.e.c = Math.min(rangeReal.e.c, 77); // no máx. coluna BZ
    sheet['!ref'] = XLSX.utils.encode_range(rangeReal);
  }

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // Alguns formatos (ex: "CLT 2026 att") têm título/subtítulo antes do cabeçalho real —
  // procurar nas primeiras linhas até achar uma que pareça um cabeçalho de verdade.
  let headerRowIdx = 0;
  let col = buildColMap(data[0] || []);
  for (let h = 0; h < Math.min(10, data.length); h++) {
    const tentativa = buildColMap(data[h] || []);
    if (tentativa.nome !== -1) { headerRowIdx = h; col = tentativa; break; }
  }

  // Alguns formatos (ex: "CLT 2026" simplificado) não têm Valor Líquido separado —
  // nesse caso o Valor Bruto é o valor final mesmo (deduções ficam com a contabilidade)
  if (col.valorLiquido === -1) col.valorLiquido = col.valorBruto;
  if (col.nome === -1 || col.valorLiquido === -1) {
    return { erro: 'colunas essenciais não encontradas (nome/valor líquido ou bruto)', col, header: data[headerRowIdx] };
  }

  const existentes = await db('usuarios').where('tipo', 'prestador').select('id', 'nome', 'email');
  const ultimoDiaMes = new Date(ano, mes, 0).getDate();
  const periodo = tipo_colaborador === 'clt' ? { inicio: 26, fim: 25 } : { inicio: 1, fim: ultimoDiaMes };

  let processados = 0, novosUsuarios = 0, novosVinculos = 0, historicosSemEmail = 0, valorTotal = 0;
  const detalhes = [];

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row[col.nome] == null) continue;
    const nomeRaw = String(row[col.nome]).trim();
    if (!nomeRaw) continue;
    const nomeUpper = nomeRaw.toUpperCase();
    if (nomeUpper.startsWith('TOTAL') || nomeUpper.includes('VALOR TOTAL') || nomeUpper === 'MENUS' || nomeUpper.includes('COLE DA TABELA')) break;

    const especialidadeRaw = col.especialidade !== -1 ? row[col.especialidade] : null;
    const unidadeRaw = col.unidade !== -1 ? row[col.unidade] : null;
    const valorClinica = col.valorClinica !== -1 ? (parseFloat(row[col.valorClinica]) || 0) : 0;
    const valorProfissional = col.valorProfissional !== -1 ? (parseFloat(row[col.valorProfissional]) || 0) : 0;
    const valorFixo = col.fixo !== -1 ? (parseFloat(row[col.fixo]) || 0) : 0;
    const metaRaw = col.meta !== -1 ? row[col.meta] : null;
    const valorBrutoPlanilha = col.valorBruto !== -1 ? (parseFloat(row[col.valorBruto]) || 0) : 0;
    const faltas = col.faltas !== -1 ? (parseInt(row[col.faltas], 10) || 0) : 0;
    const emailRaw = col.email !== -1 ? row[col.email] : null;
    const valorLiquidoPlanilha = parseFloat(row[col.valorLiquido]) || 0;

    if (!valorLiquidoPlanilha && !valorBrutoPlanilha && !valorClinica) continue;

    const nomeLimpo = limparNomeTurno(nomeRaw);
    const turno = detectarTurno(row, col.turno, nomeRaw);
    const unidade = normalizarUnidade(unidadeRaw) || 'MATRIZ';
    // Sem coluna de especialidade no arquivo (ex: alguns formatos de 2021): usar um valor
    // que nunca bate em comissoes_tabela/especialidades_clt, pra sempre confiar no valor
    // já calculado da planilha em vez de arriscar recalcular com a % errada.
    const especialidade = normalizarEspecialidade(especialidadeRaw) || especialidadeRaw || 'DESCONHECIDA';

    let metaMensalValue = null;
    if (metaRaw != null && metaRaw !== 'N/P' && metaRaw !== 'NP' && !isNaN(parseFloat(metaRaw))) {
      metaMensalValue = parseFloat(metaRaw);
    }
    const metaBatida = metaMensalValue !== null && valorClinica > metaMensalValue;

    let emailFinal = (emailRaw && String(emailRaw).includes('@')) ? String(emailRaw).trim().toLowerCase() : null;
    let semEmailOriginal = false;

    if (!emailFinal) {
      let melhor = null, melhorSim = 0;
      for (const u of existentes) {
        const sim = similaridade(u.nome, nomeLimpo);
        if (sim > melhorSim) { melhorSim = sim; melhor = u; }
      }
      if (melhor && melhorSim >= 0.7) {
        emailFinal = melhor.email;
      } else {
        semEmailOriginal = true;
        historicosSemEmail++;
      }
    }

    let usuario = emailFinal ? await db('usuarios').where('email', emailFinal).first() : null;
    let vinculoId;
    let vinculoExistente = null;
    if (usuario) {
      // Prioridade: vínculo ATIVO com turno+unidade exatos > ativo só por especialidade
      // (quando o arquivo não informa turno e/ou a unidade da linha está desatualizada,
      // ex: "CLT 2026" simplificado) > inativo como último recurso. Nunca preferir um
      // vínculo órfão/inativo sobre um ativo só porque casou turno/unidade por coincidência.
      const porTipo = () => db('prestador_vinculos').where({ prestador_id: usuario.id, tipo_contrato: tipo_colaborador });
      if (turno !== 'INDEFINIDO') {
        vinculoExistente = await porTipo().where({ turno, especialidade, unidade, ativo: true }).first();
      }
      if (!vinculoExistente) {
        vinculoExistente = await porTipo().where({ especialidade, ativo: true }).first();
      }
      if (!vinculoExistente) {
        // último recurso: aceita inativo, mantendo turno+unidade exatos se conhecidos
        vinculoExistente = turno !== 'INDEFINIDO'
          ? await porTipo().where({ turno, especialidade, unidade }).first()
          : await porTipo().where({ especialidade }).first();
      }
    }

    let turnoFinal = turno;
    let unidadeFinal = unidade;
    if (vinculoExistente) {
      vinculoId = vinculoExistente.id;
      // Refletir turno/unidade reais do vínculo encontrado, não os do arquivo (que podem
      // estar desatualizados em planilhas antigas — ex: 'INDEFINIDO' ou unidade trocada)
      if (vinculoExistente.turno && vinculoExistente.turno !== 'INDEFINIDO') turnoFinal = vinculoExistente.turno;
      if (vinculoExistente.unidade) unidadeFinal = vinculoExistente.unidade;
    } else {
      const cr = await cadastrarPrestadorRapido({
        nome: nomeLimpo,
        email: emailFinal,
        especialidade, unidade, turno,
        tipo_contrato: tipo_colaborador,
        meta_mensal: metaMensalValue,
        valor_fixo_base: valorFixo,
      });
      vinculoId = cr.vinculo_id;
      usuario = await db('usuarios').where('id', cr.prestador_id).first();
      if (!emailFinal) novosUsuarios++;
      novosVinculos++;
    }

    const resultadoFin = await calcularFinanceiroUploadLinha({
      tipo_colaborador, especialidade, unidade,
      valor_clinica: valorClinica, valor_clinica_total: valorClinica,
      valor_profissional: valorProfissional, valor_fixo: valorFixo,
      meta_mensal: metaMensalValue, faltas, extras: 0,
    });
    const totalBruto = resultadoFin.total;
    const fixoAjustado = resultadoFin.fixo_ajustado != null ? resultadoFin.fixo_ajustado : 0;
    const isCLT = tipo_colaborador === 'clt';
    const valorLiquidoFinal = isCLT
      ? ((totalBruto != null && !Number.isNaN(totalBruto)) ? totalBruto : valorLiquidoPlanilha)
      : (resultadoFin.tipo_calculo === 'valor_pct_com_meta' ? totalBruto : valorLiquidoPlanilha);
    const valorBrutoFinal = valorBrutoPlanilha > 0 ? valorBrutoPlanilha : valorLiquidoFinal;

    const dadoExistente = await db('dados_mensais').where({ vinculo_id: vinculoId, mes, ano }).first();
    const payload = {
      prestador_id: usuario.id, vinculo_id: vinculoId, mes, ano,
      tipo_colaborador,
      dia_inicio: periodo.inicio, dia_fim: periodo.fim,
      valor_clinica: valorClinica, valor_clinica_meta: valorClinica,
      valor_profissional: valorProfissional, valor_prof_part_oab: 0,
      valor_bruto: valorBrutoFinal, valor_original: valorLiquidoFinal, valor_liquido: valorLiquidoFinal,
      valor_fixo: fixoAjustado,
      meta_mensal: metaMensalValue, meta_batida: metaBatida ? 1 : 0,
      faltas, extras: 0,
      especialidade, unidade: unidadeFinal, turno: turnoFinal || 'INDEFINIDO',
      turno_manha: turnoFinal === 'MANHÃ' ? 1 : 0, turno_tarde: turnoFinal === 'TARDE' ? 1 : 0,
      foi_editado: 0,
    };

    if (dadoExistente) {
      await db('dados_mensais').where('id', dadoExistente.id).update(payload);
    } else {
      await db('dados_mensais').insert(payload);
    }

    processados++;
    valorTotal += valorLiquidoFinal;
    if (semEmailOriginal) {
      detalhes.push({ nome: nomeLimpo, semEmail: true, criadoComo: usuario.email });
    }
  }

  await sincronizarStatusAtivos(tipo_colaborador);

  return {
    sucesso: true, mes, ano, tipo_colaborador, aba: abaReal,
    processados, novosUsuarios, novosVinculos, historicosSemEmail,
    valorTotal: Math.round(valorTotal * 100) / 100,
    semEmailDetalhes: detalhes,
  };
}

module.exports = { importarArquivo };

// Permite uso direto via CLI: node importarHistorico.js <arquivo> <aba> <mes> <ano> <tipo>
if (require.main === module) {
  const [, , caminho, aba, mesArg, anoArg, tipo_colaborador] = process.argv;
  importarArquivo({ caminho, aba, mes: parseInt(mesArg, 10), ano: parseInt(anoArg, 10), tipo_colaborador })
    .then(r => { console.log(JSON.stringify(r)); process.exit(r?.erro ? 1 : 0); })
    .catch(e => { console.log(JSON.stringify({ erro: e.message })); process.exit(1); });
}
