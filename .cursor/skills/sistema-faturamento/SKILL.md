---
name: sistema-faturamento
description: >-
  Domínio do Sistema de Faturamento (Node/React): cálculo PJ na planilha Atendimentos,
  comissões, relatórios, cadastro e e-mail. Use ao alterar calculoPJCore, calculoAtendimentos,
  rotas atendimentos, schemas Zod ou fluxo CalcularPagamentos.
---

# Sistema de Faturamento — skill do projeto

## Leitura obrigatória

1. **[`docs/SISTEMA-FATURAMENTO.md`](../../../docs/SISTEMA-FATURAMENTO.md)** — glossário, rotas, invariantes, dois pipelines Excel.

## Regras de domínio (PJ)

- **PJ** no código = prestador (`tipo_contrato !== 'clt'`). Heurística de datas: `detectarTipoContrato` em `backend/services/calculoAtendimentos.js`.
- Lógica fechada do valor PJ: **`backend/services/calculoPJCore.js`** (`calcularValorPJ`). Não duplicar a fórmula em outro ficheiro.
- Especialidades com fixo × turnos: lista `ESPECIALIDADES_COM_FIXO_PJ` em `processarAtendimentos` (mesmo ficheiro de serviço).

## APIs críticas

- `POST /api/atendimentos/analisar` — multipart planilha.
- `POST /api/atendimentos/recalcular` — body `{ item }`.
- `POST /api/atendimentos/confirmar` — body com `calculados`, `mes`, `ano`, `tipo_contrato`.

Contratos TypeScript/Zod: `frontend-premium/src/schemas/atendimentos.ts`.

## Testes

- Backend: na pasta `backend/`, `npm test` executa `node:test` sobre `services/__tests__/calculoPJCore.test.js`.
- Ao mudar fórmula PJ, adicionar ou ajustar casos nesse ficheiro.

## Harness (desenvolvimento sem API real)

- Com `VITE_USE_MSW=true`, o frontend pode usar MSW (`frontend-premium/src/mocks/`). Handlers devem devolver JSON que passe `parseAnalisarAtendimentosResponse`.

## O que evitar

- Refatorações largas fora do pedido ao mexer em cálculo ou rotas de atendimentos.
- Assumir um único tipo de planilha: existe também `backend/routes/upload.js` (abas por mês).
