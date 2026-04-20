const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularValorPJ } = require('../calculoPJCore');

test('sem meta: total = VP + fixo (sem desconto de falta quando faltas=0)', () => {
  const r = calcularValorPJ({
    comissao: { pct_com_meta: 14, pct_sem_meta: 12 },
    valor_clinica: 10000,
    valor_clinica_total: 8000,
    valor_profissional_atend: 1200,
    valor_prof_part_oab: 0,
    valor_fixo_base: 500,
    desconto_por_falta: 20,
    meta_mensal: 50000,
    faltas: 0,
    extras: 0,
  });
  assert.equal(r.total, 1200 + 500);
  assert.equal(r.meta_batida, false);
});

test('meta batida e pct_com_meta: usa valor100Base e soma Part/OAB e fixo', () => {
  const comissao = { pct_com_meta: 14, pct_sem_meta: 12 };
  const vp = 1200;
  const vpPartOab = 100;
  const valorClinica = 10000;
  const valorTotal = 50000;
  const r = calcularValorPJ({
    comissao,
    valor_clinica: valorClinica,
    valor_clinica_total: valorTotal,
    valor_profissional_atend: vp,
    valor_prof_part_oab: vpPartOab,
    valor_fixo_base: 0,
    meta_mensal: 10000,
    faltas: 0,
    extras: 0,
  });
  const vpSemPartOab = vp - vpPartOab;
  const valor100Base = vpSemPartOab * 100 / 12;
  const esperado = valor100Base * 0.14 + vpPartOab;
  assert.ok(Math.abs(r.total - esperado) < 0.01);
  assert.equal(r.meta_batida, true);
  assert.equal(r.tipo_calculo, 'valor_pct_com_meta');
});

test('desconto por falta proporcional ao fixo (fixo/30 por falta)', () => {
  const r = calcularValorPJ({
    comissao: null,
    valor_clinica: 0,
    valor_clinica_total: 0,
    valor_profissional_atend: 1000,
    valor_prof_part_oab: 0,
    valor_fixo_base: 300,
    desconto_por_falta: 20,
    meta_mensal: 0,
    faltas: 3,
    extras: 50,
  });
  const fixoEsperado = Math.max(0, 300 - 3 * (300 / 30));
  assert.equal(r.total, 1000 + fixoEsperado + 50);
});
