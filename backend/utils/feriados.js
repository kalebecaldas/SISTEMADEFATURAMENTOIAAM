/**
 * Feriados brasileiros aplicáveis à clínica (Manaus/AM).
 *
 * Calculado, não baixado: folha de pagamento não pode depender de API externa
 * estar no ar, e o resultado precisa ser o mesmo toda vez que rodar.
 */

/**
 * Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher (calendário gregoriano).
 * Tudo em UTC para não escorregar de dia por causa de fuso.
 */
function domingoDePascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function somarDias(data, dias) {
  const d = new Date(data.getTime());
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

const iso = (d) => d.toISOString().slice(0, 10);
const em = (ano, mes, dia) => iso(new Date(Date.UTC(ano, mes - 1, dia)));

/**
 * Lista de feriados de um ano.
 * @param {number} ano
 * @returns {{data: string, nome: string, escopo: string, facultativo: boolean}[]}
 */
function feriadosDoAno(ano) {
  const pascoa = domingoDePascoa(ano);

  const lista = [
    // Nacionais fixos
    { data: em(ano, 1, 1), nome: 'Confraternização Universal', escopo: 'nacional', facultativo: false },
    { data: em(ano, 4, 21), nome: 'Tiradentes', escopo: 'nacional', facultativo: false },
    { data: em(ano, 5, 1), nome: 'Dia do Trabalho', escopo: 'nacional', facultativo: false },
    { data: em(ano, 9, 7), nome: 'Independência do Brasil', escopo: 'nacional', facultativo: false },
    { data: em(ano, 10, 12), nome: 'Nossa Senhora Aparecida', escopo: 'nacional', facultativo: false },
    { data: em(ano, 11, 2), nome: 'Finados', escopo: 'nacional', facultativo: false },
    { data: em(ano, 11, 15), nome: 'Proclamação da República', escopo: 'nacional', facultativo: false },
    { data: em(ano, 11, 20), nome: 'Consciência Negra', escopo: 'nacional', facultativo: false },
    { data: em(ano, 12, 25), nome: 'Natal', escopo: 'nacional', facultativo: false },

    // Móveis (dependem da Páscoa)
    { data: iso(somarDias(pascoa, -48)), nome: 'Carnaval (segunda)', escopo: 'nacional', facultativo: true },
    { data: iso(somarDias(pascoa, -47)), nome: 'Carnaval (terça)', escopo: 'nacional', facultativo: true },
    { data: iso(somarDias(pascoa, -46)), nome: 'Quarta-feira de Cinzas', escopo: 'nacional', facultativo: true },
    { data: iso(somarDias(pascoa, -2)), nome: 'Sexta-feira Santa', escopo: 'nacional', facultativo: false },
    { data: iso(somarDias(pascoa, 60)), nome: 'Corpus Christi', escopo: 'nacional', facultativo: true },

    // Amazonas
    { data: em(ano, 9, 5), nome: 'Elevação do Amazonas à categoria de Província', escopo: 'estadual', facultativo: false },

    // Manaus
    { data: em(ano, 10, 24), nome: 'Aniversário de Manaus', escopo: 'municipal', facultativo: false },
    { data: em(ano, 12, 8), nome: 'Nossa Senhora da Conceição (padroeira de Manaus)', escopo: 'municipal', facultativo: false },
  ];

  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Feriados de um intervalo de anos (inclusive).
 */
function feriadosDoPeriodo(anoInicial, anoFinal) {
  const out = [];
  for (let ano = anoInicial; ano <= anoFinal; ano++) out.push(...feriadosDoAno(ano));
  return out;
}

module.exports = { domingoDePascoa, feriadosDoAno, feriadosDoPeriodo };
