/**
 * Núcleo puro do cálculo PJ (prestador) — sem I/O.
 * Extraído para testes unitários e documentação de invariantes.
 */

/**
 * Calcula o valor bruto PJ para um grupo.
 * Regra: valor_profissional (da planilha) + fixo ajustado + extras;
 * com meta batida e pct_com_meta, aplica a parcela variável conforme tabela.
 *
 * @param {object} params
 * @param {object|null} params.comissao - linha de comissoes_tabela (opcional)
 * @param {number|string} params.valor_clinica - base meta sem Part/OAB
 * @param {number|string} params.valor_clinica_total - total faturado para checagem de meta
 * @param {number|string} params.valor_profissional_atend
 * @param {number|string} [params.valor_prof_part_oab]
 * @param {number|string} [params.valor_fixo_base]
 * @param {number|string} [params.desconto_por_falta]
 * @param {number|string} [params.meta_mensal]
 * @param {number|string} [params.faltas]
 * @param {number|string} [params.extras]
 */
function calcularValorPJ({
  comissao,
  valor_clinica,
  valor_clinica_total,
  valor_profissional_atend,
  valor_prof_part_oab,
  valor_fixo_base,
  desconto_por_falta,
  meta_mensal,
  faltas,
  extras,
}) {
  const faltasNum = parseInt(faltas) || 0;
  const extrasNum = parseFloat(extras) || 0;
  const fixoBase = parseFloat(valor_fixo_base) || 0;
  const vp = parseFloat(valor_profissional_atend) || 0;
  const vpPartOab = parseFloat(valor_prof_part_oab) || 0;

  const pctComMeta = comissao ? (parseFloat(comissao.pct_com_meta) || 0) : 0;
  const pctSemMeta = comissao ? (parseFloat(comissao.pct_sem_meta) || 0) : 0;

  const vpSemPartOab = Math.max(0, vp - vpPartOab);
  const valor100Base = pctSemMeta > 0 ? vpSemPartOab * 100 / pctSemMeta : (parseFloat(valor_clinica) || 0);

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
    const valorComMeta = valor100Base * (pctComMeta / 100);
    total = Math.max(0, valorComMeta + vpPartOab + fixoAjustado + extrasNum);
  } else {
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

module.exports = {
  calcularValorPJ,
};
