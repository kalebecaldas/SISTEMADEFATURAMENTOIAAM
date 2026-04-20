import { z } from 'zod';
import {
  analisarAtendimentosResponseSchema,
  recalcularResponseSchema,
  prestadoresListSchema,
  type AnalisarAtendimentosResponse,
} from '../schemas/atendimentos';

function warnParse(label: string, err: unknown): void {
  if (import.meta.env.DEV) {
    console.warn(`[${label}] resposta fora do contrato Zod`, err);
  }
}

/** Valida a resposta de POST /atendimentos/analisar; em falha devolve os dados crus para não quebrar a UI. */
export function parseAnalisarAtendimentosResponse(data: unknown): AnalisarAtendimentosResponse {
  const r = analisarAtendimentosResponseSchema.safeParse(data);
  if (r.success) return r.data;
  warnParse('analisar', r.error);
  return data as AnalisarAtendimentosResponse;
}

export function parseRecalcularResponse(data: unknown): { sucesso: true; item: Record<string, unknown> } {
  const r = recalcularResponseSchema.safeParse(data);
  if (r.success) return r.data;
  warnParse('recalcular', r.error);
  if (data && typeof data === 'object' && 'item' in data && (data as { sucesso?: boolean }).sucesso === true) {
    return data as { sucesso: true; item: Record<string, unknown> };
  }
  return data as { sucesso: true; item: Record<string, unknown> };
}

export type PrestadoresList = z.infer<typeof prestadoresListSchema>;

export function parsePrestadoresList(data: unknown): PrestadoresList {
  const r = prestadoresListSchema.safeParse(data);
  if (r.success) return r.data;
  warnParse('prestadores', r.error);
  return data as PrestadoresList;
}
