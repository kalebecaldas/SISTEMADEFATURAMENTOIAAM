import { describe, it, expect } from 'vitest';
import { analisarAtendimentosResponseSchema } from './atendimentos';
import { mockAnalisarAtendimentosResponse } from '../mocks/fixtures';

describe('analisarAtendimentosResponseSchema', () => {
  it('aceita o fixture MSW', () => {
    const r = analisarAtendimentosResponseSchema.safeParse(mockAnalisarAtendimentosResponse);
    expect(r.success).toBe(true);
  });
});
