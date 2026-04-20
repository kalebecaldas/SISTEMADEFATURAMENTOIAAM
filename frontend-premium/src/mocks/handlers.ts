import { http, HttpResponse } from 'msw';
import { mockAnalisarAtendimentosResponse, mockPrestadoresList } from './fixtures';

/**
 * Intercepta chamadas independentemente de VITE_API_URL (qualquer origem).
 * Ative com `VITE_USE_MSW=true` em desenvolvimento.
 */
export const handlers = [
  http.post('*/atendimentos/analisar', async () =>
    HttpResponse.json(mockAnalisarAtendimentosResponse),
  ),
  http.get('*/atendimentos/prestadores', async () => HttpResponse.json(mockPrestadoresList)),
];
