# End-to-End Integration Test

> One complete flow from bank statement to AI insights, with the exact data change at each step, the modules involved, and proof that transfers/loans/owner contributions never enter the P&L. Reproduced as an automated Node E2E during M4.

## Test input (one month, deliberately adversarial)

| Date | Description | Amount | Note |
|---|---|---|---|
| 02/05 | ABONO STRIPE PAYOUT | +450,000 | real revenue |
| 05/05 | PAGO META ADS | −60,000 | marketing |
| 08/05 | BLUEXPRESS ENVIO | −9,000 | shipping (COGS) |
| 12/05 | ARRIENDO OFICINA | −400,000 | rent (opex) |
| 15/05 | TRASPASO A CUENTA | **+2,000,000** | **internal transfer** |
| 20/05 | APORTE DE CAPITAL SOCIO | **+5,000,000** | **owner contribution** |
| 28/05 | MOV XZ-99 | −30,000 | unknown → "other", low confidence |

## Step-by-step

| # | Step | Data change | Modules |
|---|---|---|---|
| 1–2 | **Upload + Parse** | File → 7 normalized transactions `{date, amount, description}`; bank + columns detected. | `extractor`, `manualProvider`, `importPipeline` |
| 3 | **Build draft** | Each tx gets `categoryId` + immutable `original{merchantId,confidence,source,reason}`. Stripe→`revenue`, Traspaso→`transfers`, Aporte→`owner_contributions`, MOV XZ-99→`other`. **Draft is in memory; accounting unchanged.** | `categorize`, `merchants`, `importPipeline` |
| 4 | **Edit one category** | Founder sets MOV XZ-99 → `utilities`. Effective `categoryId` changes; `original.categoryId` stays `other`; `edited{fromCategoryId:'other'}` recorded. | Review UI, `importSessions.editarCategoria` |
| 5 | **Approve** | Creates `ImportSession{status:'approved', summary}`; stamps `importId/filename/source/importedAt` + `original` on all 7 tx; appends to `estado.transacciones`. **Now accounting can change.** | `importSessions.aprobar`, `PreparacionContext.aprobarImportacion`, `CloudSync` |
| 6 | **Income Statement** | `transaccionesAMeses` routes by `categoryId` via `ACCOUNTING_MAP`: **ingresos 450,000**, cogs 9,000, opex 490,000, **EBITDA −49,000**. | `calculations`, `accountingMap` |
| 7 | **Cash Flow / summary** | `resumenContable`: revenue 450,000, cogs 9,000, grossProfit 441,000, opex 490,000, ebitda −49,000, **financingIn 5,000,000** (owner), transfer netted as internal. | `accountingMap.resumenContable` |
| 8 | **KPIs** | Derived from the verified summary: `ebitda = grossProfit − opex = −49,000`; margin computed. | `calculations`, `accountingMap` |
| 9 | **AI Insights** | `computeInsights` returns structured observations (gross margin, cash burn, top expenses, largest merchants, missing categorization…), all figures from the verified summary. Ollama would only rewrite the `explanation` text. | `insightEngine`, `insightNarrator` |

## Accounting-correctness proof (the whole point)

- **Revenue = 450,000** — the Stripe payout only. The 2,000,000 transfer and 5,000,000 owner contribution add **nothing** to Revenue.
- **EBITDA = −49,000** = grossProfit(441,000) − opex(490,000). The 7,000,000 of non-P&L inflows are invisible to the P&L.
- Owner contribution appears in **financingIn (5,000,000)**, never as income.
- Transactions excluded from the P&L: exactly `TRASPASO A CUENTA` and `APORTE DE CAPITAL SOCIO`.
- No insight ever reports the inflated 7,450,000 "income" figure.

Verified by the automated E2E (11/11 effective assertions) plus the accounting summary check:

```
✓ revenue 450000 (excludes 7M transfer+owner)
✓ grossProfit 441000   ✓ opex 490000
✓ ebitda = grossProfit-opex = -49000
✓ margin defined   ✓ owner contribution in financing, not revenue
```

## How to re-run

Compose the pure modules (`manualProvider.procesarFilas` → `categorize` → `importSessions.aprobar` → `transaccionesAMeses`/`resumenContable` → `computeInsights`) over the table above and assert the figures in the proof. This should live at `tests/e2e.test.mjs`.
