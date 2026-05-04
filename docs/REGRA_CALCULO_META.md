# Regra de Negócio — Cálculo de Meta e Valor Bruto

> **Última atualização:** 2026-05-04  
> **Motivo:** Correção de bug — Douglas (bateu meta, aparecia FORA) e Leilany (não bateu, aparecia META)

---

## Regra Fundamental: CLT vs PJ

### CLT (Contratos Trabalhistas)

| Campo        | Valor usado |
|-------------|-------------|
| Base da META | `valor_clinica_total` — faturamento **bruto total**, incluindo Particular e OAB |
| Cálculo do valor bruto (com meta) | `valor_clinica_total × % configurada na especialidade` |
| Cálculo (sem meta) | `max(valor_profissional, fixo_base) + extras` |

**Motivo:** O CLT recebe o salário fixo independente de convênio. Não faz sentido excluir Particular/OAB da base — o trabalho foi feito e o faturamento da clínica inclui tudo.

### PJ (Prestador de Serviços)

| Campo        | Valor usado |
|-------------|-------------|
| Base da META | `valor_clinica` — faturamento de convênios regulares, **excluindo Particular e OAB** |
| Particular/OAB | Somado separadamente ao bruto como face-value (`valor_prof_part_oab`) |
| Cálculo do valor bruto (com meta) | `valor_clinica × % + valor_prof_part_oab + fixo_ajustado + extras` |
| Cálculo (sem meta) | `valor_profissional_atend + fixo_ajustado + extras` |

**Motivo:** Particular e OAB têm tabela própria de repasse. O prestador já recebe o valor profissional cheio nesses convênios, então não entra na base da meta percentual.

---

## Arquivos que implementam esta regra

| Arquivo | Responsabilidade |
|---------|-----------------|
| `backend/services/calculoAtendimentos.js` | Função `calcularValorCLT()` — lógica principal CLT |
| `backend/services/calculoPJCore.js` | Função `calcularValorPJ()` — lógica principal PJ |
| `backend/routes/dados-mensais.js` | PUT `/:id` — recalcula `meta_batida` ao editar manualmente |
| `backend/routes/upload.js` | POST `/confirmar` e POST `/planilha` (legado) — grava `meta_batida` |
| `frontend/components/ResumoMensalModal.jsx` | Modal de edição: envia `valor_clinica_total` para CLT |

---

## Como o `meta_batida` é gravado

```
processar planilha CLT
  └─ agregarAtendimentos() → valor_clinica_total = soma de TODOS os convênios
  └─ calcularValorCLT({ valor_clinica_total })
        └─ fatCLT = valor_clinica_total
        └─ meta_batida = fatCLT >= meta_mensal
```

```
processar planilha PJ
  └─ agregarAtendimentos() → valor_clinica = soma SEM Particular/OAB
  └─ calcularValorPJ({ valor_clinica, valor_clinica_total })
        └─ metaBatida = valor_clinica_total >= meta (verifica total mas exclui Part/OAB do cálculo)
```

---

## ⚠️ Não altere sem ler este documento

Qualquer mudança na lógica de `meta_batida` deve respeitar a separação CLT/PJ acima.  
Testar sempre com casos reais: profissional com Particular/OAB + profissional sem.
