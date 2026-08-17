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

test('turno extra acrescenta uma diária no fixo, espelhando a falta', () => {
  const base = {
    comissao: null,
    valor_clinica: 10000,
    valor_clinica_total: 10000,
    valor_profissional_atend: 1200,
    valor_fixo_base: 600,
    meta_mensal: null,
  };

  // Fixo de 600 => diária de 20.
  const limpo = calcularValorPJ({ ...base, faltas: 0, dias_extras: 0 });
  assert.strictEqual(limpo.fixo_ajustado, 600);

  const comFalta = calcularValorPJ({ ...base, faltas: 2, dias_extras: 0 });
  assert.strictEqual(comFalta.fixo_ajustado, 560); // 600 - 2x20

  const comExtra = calcularValorPJ({ ...base, faltas: 0, dias_extras: 3 });
  assert.strictEqual(comExtra.fixo_ajustado, 660); // 600 + 3x20
  assert.strictEqual(comExtra.adicional_turno_extra, 60);

  // Falta e extra no mesmo mês se compensam na mesma diária.
  const ambos = calcularValorPJ({ ...base, faltas: 2, dias_extras: 2 });
  assert.strictEqual(ambos.fixo_ajustado, 600);
});

test('sem fixo não há adicional de turno extra', () => {
  // A diária de 20 sai do fixo de 600. Quem não tem fixo não tem diária, e o
  // fallback de desconto_por_falta não pode virar pagamento: em julho/2026 isso
  // criou R$ 500 do nada para a Layane e a Laysa.
  const r = calcularValorPJ({
    comissao: null,
    valor_clinica: 5000,
    valor_clinica_total: 5000,
    valor_profissional_atend: 800,
    valor_fixo_base: 0,
    desconto_por_falta: 20,
    meta_mensal: null,
    faltas: 0,
    dias_extras: 13,
  });
  assert.strictEqual(r.fixo_ajustado, 0);
  assert.strictEqual(r.adicional_turno_extra, 0);
  assert.strictEqual(r.total, 800);
});

test('fixo por turno trabalhado: quem faz manhã e tarde conta os dois', () => {
  // Layane atende manhã e tarde em dias alternados: 13 manhãs + 13 tardes = 26
  // turnos. A R$ 20 o turno fecha R$ 520 no mês, perto do fixo mensal de 600.
  const r = calcularValorPJ({
    comissao: null,
    valor_clinica: 6000,
    valor_clinica_total: 6000,
    valor_profissional_atend: 813.14,
    valor_fixo_base: 26 * 20, // fixo efetivo já multiplicado pelos turnos
    meta_mensal: null,
    faltas: 0,
    dias_extras: 0,
  });
  assert.strictEqual(r.fixo_ajustado, 520);
  assert.strictEqual(Number(r.total.toFixed(2)), 1333.14);
});
