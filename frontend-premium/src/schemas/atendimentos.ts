import { z } from 'zod';

/** Item calculado — campos fixos conhecidos + chaves extras da API (Set serializado como array em runtime em alguns fluxos). */
export const itemCalculadoSchema = z
  .object({
    prestador_id: z.union([z.number(), z.null()]).optional(),
    vinculo_id: z.union([z.number(), z.null()]).optional(),
    nome: z.string().optional(),
    nome_planilha: z.string().optional(),
    especialidade: z.string().optional().nullable(),
    especialidade_comissao: z.string().optional().nullable(),
    unidade: z.string().optional().nullable(),
    turno: z.string().optional().nullable(),
    tipo_contrato: z.string().optional(),
    valor_clinica: z.number().optional().nullable(),
    valor_clinica_total: z.number().optional().nullable(),
    valor_profissional_atend: z.number().optional().nullable(),
    valor_prof_part_oab: z.number().optional().nullable(),
    meta_mensal: z.number().optional().nullable(),
    valor_fixo_base: z.number().optional().nullable(),
    fixo_efetivo: z.number().optional().nullable(),
    num_turnos: z.number().optional().nullable(),
    faltas: z.number().optional().nullable(),
    extras: z.number().optional().nullable(),
    meta_batida: z.boolean().optional(),
    fixo_ajustado: z.number().optional().nullable(),
    pct_aplicado: z.union([z.number(), z.string(), z.null()]).optional(),
    valor_bruto: z.number().nullable().optional(),
    tipo_calculo: z.string().optional().nullable(),
    revisao_manual: z.boolean().optional(),
  })
  .passthrough();

export const naoReconhecidoSchema = z
  .object({
    nome_planilha: z.string(),
    valor_clinica: z.number().optional().nullable(),
    valor_profissional_atend: z.number().optional().nullable(),
    atendimentos: z.number().optional().nullable(),
    turno: z.string().optional().nullable(),
    unidade: z.string().optional().nullable(),
  })
  .passthrough();

export const conflitoCltSchema = z.object({
  prestador_id: z.number(),
  nome: z.string(),
  especialidade: z.string().optional().nullable(),
  unidade: z.string().optional().nullable(),
  turno: z.string().optional().nullable(),
  motivo: z.string().optional(),
});

export const turnoDivergenteSchema = z.object({
  prestador_id: z.number().optional().nullable(),
  vinculo_id: z.number().optional().nullable(),
  nome: z.string(),
  especialidade: z.string().optional().nullable(),
  unidade: z.string().optional().nullable(),
  turno_vinculo: z.string().optional().nullable(),
  turnos_detectados: z.array(z.string().nullable()).optional(),
  valor_clinica: z.number().optional().nullable(),
});

/** Uma ausência detectada: vínculo x dia x turno em que a unidade abriu e ninguém foi atendido. */
export const faltaDetectadaSchema = z
  .object({
    prestador_id: z.number().optional().nullable(),
    vinculo_id: z.number().optional().nullable(),
    nome: z.string().optional().nullable(),
    especialidade: z.string().optional().nullable(),
    unidade: z.string().optional().nullable(),
    data: z.string(),
    turno: z.string(),
    motivo_deteccao: z.string().optional().nullable(),
    feriado_nome: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
  })
  .passthrough();

export const faltaAgrupadaSchema = z
  .object({
    prestador_id: z.number().optional().nullable(),
    vinculo_id: z.number().optional().nullable(),
    nome: z.string().optional().nullable(),
    especialidade: z.string().optional().nullable(),
    unidade: z.string().optional().nullable(),
    turno: z.string().optional().nullable(),
    dias: z.array(
      z.object({
        data: z.string(),
        motivo: z.string().optional().nullable(),
        feriado_nome: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
      }),
    ),
    suspeitas: z.number().optional(),
    principal: z.number().optional(),
  })
  .passthrough();

export const resumoAnaliseSchema = z.object({
  reconhecidos: z.number(),
  nao_reconhecidos: z.number(),
  revisao_manual: z.number(),
  valor_total: z.number(),
});

export const analisarAtendimentosResponseSchema = z.object({
  sucesso: z.literal(true),
  tipo_contrato: z.string(),
  mes: z.union([z.number(), z.null()]),
  ano: z.union([z.number(), z.null()]),
  total_atendimentos: z.number(),
  calculados: z.array(itemCalculadoSchema),
  nao_reconhecidos: z.array(naoReconhecidoSchema),
  conflitos_clt: z.array(conflitoCltSchema),
  turnos_divergentes: z.array(turnoDivergenteSchema).optional(),
  faltas_detectadas: z.array(faltaDetectadaSchema).optional(),
  faltas_por_profissional: z.array(faltaAgrupadaSchema).optional(),
  resumo: resumoAnaliseSchema,
});

export type AnalisarAtendimentosResponse = z.infer<typeof analisarAtendimentosResponseSchema>;

export const recalcularResponseSchema = z.object({
  sucesso: z.literal(true),
  item: itemCalculadoSchema,
});

export const confirmarRequestSchema = z.object({
  calculados: z.array(itemCalculadoSchema),
  mapeamentos_novos: z
    .array(
      z.object({
        nome_planilha: z.string(),
        prestador_id: z.number(),
        vinculo_id: z.number().optional().nullable(),
      }),
    )
    .optional(),
  tipo_contrato: z.string(),
  mes: z.number(),
  ano: z.number(),
  substituir: z.boolean().optional(),
});

export const prestadorMapeamentoSchema = z.object({
  prestador_id: z.coerce.number(),
  nome: z.string(),
  email: z.string().optional().nullable(),
  vinculo_id: z.coerce.number(),
  especialidade: z.string().optional().nullable(),
  unidade: z.string().optional().nullable(),
  turno: z.string().optional().nullable(),
  tipo_contrato: z.string().optional().nullable(),
  meta_mensal: z.coerce.number().optional().nullable(),
  valor_fixo_base: z.coerce.number().optional().nullable(),
});

export const prestadoresListSchema = z.array(prestadorMapeamentoSchema);
