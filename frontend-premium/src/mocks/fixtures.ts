import { z } from 'zod';
import { prestadoresListSchema, type AnalisarAtendimentosResponse } from '../schemas/atendimentos';

/** JSON compatível com `analisarAtendimentosResponseSchema` — usado por MSW e testes. */
export const mockAnalisarAtendimentosResponse: AnalisarAtendimentosResponse = {
  sucesso: true,
  tipo_contrato: 'prestador',
  mes: 4,
  ano: 2026,
  total_atendimentos: 5,
  calculados: [
    {
      prestador_id: 1,
      vinculo_id: 10,
      nome: 'Profissional Mock',
      nome_planilha: 'Profissional Mock',
      especialidade: 'Fisio',
      especialidade_comissao: 'Fisio',
      unidade: 'MATRIZ',
      turno: 'MANHÃ',
      tipo_contrato: 'prestador',
      valor_clinica: 20000,
      valor_clinica_total: 22000,
      valor_profissional_atend: 2400,
      valor_prof_part_oab: 0,
      meta_mensal: 25000,
      valor_fixo_base: 500,
      num_turnos: 1,
      fixo_efetivo: 500,
      faltas: 0,
      extras: 0,
      meta_batida: false,
      fixo_ajustado: 500,
      pct_aplicado: 12,
      valor_bruto: 2900,
      tipo_calculo: 'valor_profissional_mais_fixo',
      revisao_manual: false,
    },
  ],
  nao_reconhecidos: [],
  conflitos_clt: [],
  resumo: {
    reconhecidos: 1,
    nao_reconhecidos: 0,
    revisao_manual: 0,
    valor_total: 2900,
  },
};

export const mockPrestadoresList: z.infer<typeof prestadoresListSchema> = [
  {
    prestador_id: 1,
    nome: 'Profissional Mock',
    email: 'mock@example.com',
    vinculo_id: 10,
    especialidade: 'Fisio',
    unidade: 'MATRIZ',
    turno: 'MANHÃ',
    tipo_contrato: 'prestador',
    meta_mensal: 25000,
    valor_fixo_base: 500,
  },
];
