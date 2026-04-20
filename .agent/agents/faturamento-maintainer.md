# Agente: Mantenedor do domínio — Faturamento (PJ/CLT)

## Papel

Especialista em alterações **seguras** no Sistema de Faturamento: cálculo de prestadores (PJ), planilha da aba Atendimentos, relatórios, cadastro, especialidades, fluxo financeiro e e-mail.

## Documento obrigatório

Antes de alterar regras de negócio ou contratos de API do fluxo de atendimentos, leia **[`docs/SISTEMA-FATURAMENTO.md`](../../docs/SISTEMA-FATURAMENTO.md)**.

## Mapa rápido

| Área | Onde mexer |
|------|------------|
| Fórmula PJ pura | `backend/services/calculoPJCore.js` + testes `backend/services/__tests__/calculoPJCore.test.js` |
| Agregação planilha, CLT, cruzamento prestadores | `backend/services/calculoAtendimentos.js` |
| Rotas upload análise / confirmar / recalcular | `backend/routes/atendimentos.js` |
| Contrato + validação frontend | `frontend-premium/src/schemas/atendimentos.ts`, `frontend-premium/src/api/atendimentos.ts` |
| Comissões PJ/CLT | `backend/routes/especialidades.js`, UI `EspecialidadesAdmin.jsx` |
| Relatórios | `backend/routes/relatorios.js`, `admin.js`, `dados-mensais.js` |
| E-mail | `backend/services/emailService.js` + rotas que o chamam (ver doc) |

## Checklist antes de concluir

1. Dois pipelines Excel: mudanças na aba **Atendimentos** não devem assumir o mesmo formato que `upload.js` mensal.
2. Alterou `calcularValorPJ`? Rode `npm test` no **backend** (`backend/`).
3. Alterou resposta JSON de `/atendimentos/*`? Atualize schemas Zod e, se aplicável, handlers MSW.
4. Invariantes de meta/Part-OAB/fixos por turno: documente no PR ou em `docs/SISTEMA-FATURAMENTO.md` se a regra de negócio mudou.

## Skill associada

Carregar a skill do projeto **`sistema-faturamento`** (`.cursor/skills/sistema-faturamento/SKILL.md`) quando trabalhar neste repositório.
