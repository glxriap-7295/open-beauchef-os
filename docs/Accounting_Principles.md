# Accounting Principles

> Why the numbers are trustworthy. All accounting is deterministic and driven by stable `categoryId`s through one canonical map. AI never computes a figure.

## 1. Stable category ids

Categories live in `CATEGORY_REGISTRY` (`categorize.js`) as `{ id, name }`. The **id** is the source of truth; the **name** is display-only and may be renamed/localized without a data migration.

`revenue · marketplace · marketing · shipping · inventory · payroll · rent · utilities · software · taxes · bank_fees · transfers · owner_contributions · loans · other`

`resolveCategoryId(value)` maps any historical label (English name, legacy Spanish label, or id) back to a stable id, so pre-existing data keeps working.

## 2. The canonical `ACCOUNTING_MAP` (`accountingMap.js`)

Every category id maps to exactly one accounting treatment:

```ts
{
  statement:        'pl' | 'financing' | 'internal',
  plSection:        'revenue' | 'cogs' | 'opex' | null,
  plLine:           string | null,   // fine line for detailed reporting
  bucket:           'ingresos'|'cogsProd'|'cogsEnvio'|'cogsTrans'|'empleados'|'herramientas'|'otros'|null,
  cashFlow:         'operating' | 'financing' | 'investing' | 'internal',
  includeInRevenue: boolean,
  includeInPL:      boolean,
}
```

| categoryId | statement | plSection | cashFlow | inRevenue | inPL |
|---|---|---|---|---|---|
| revenue | pl | revenue | operating | ✅ | ✅ |
| inventory | pl | cogs (production) | operating | – | ✅ |
| shipping | pl | cogs (shipping) | operating | – | ✅ |
| bank_fees | pl | cogs (transaction) | operating | – | ✅ |
| payroll | pl | opex | operating | – | ✅ |
| software | pl | opex | operating | – | ✅ |
| marketing / rent / utilities / taxes / marketplace / other | pl | opex | operating | – | ✅ |
| **transfers** | **internal** | – | internal | ❌ | ❌ |
| **owner_contributions** | **financing** | – | financing | ❌ | ❌ |
| **loans** | **financing** | – | financing | ❌ | ❌ |

## 3. The hard rule (enforced, not hoped)

**Transfers, Loans and Owner Contributions can never appear in Revenue or the P&L** — even when they are inflows. This is enforced three ways:

1. **Categorization guardrail** (`categorize.js`): a glosa that looks like a transfer/loan/owner contribution can never resolve to `revenue`.
2. **Map validation** (`validateAccountingMap()`): asserts each of `transfers/loans/owner_contributions` has `includeInRevenue === false` and `includeInPL === false`. Runs at module load (loud console error if violated) and in tests.
3. **Aggregation** (`transaccionesAMeses`, `resumenContable`, `estadisticas`): every consumer checks `includeInPL` before counting; financing (loans/owner) is tracked in a separate `financingIn/Out`.

Coverage is also validated: **every** id in `CATEGORY_REGISTRY` must have a map entry, and there may be no orphan entries — so you cannot add a category and forget its accounting treatment.

## 4. How the statements are computed

- **Income Statement (`transaccionesAMeses`)**: for each transaction, route by `categoryId` → skip if not `includeInPL`; revenue-bucket adds signed (refunds reduce revenue); expense buckets add magnitude. Produces per month: `ingresos`, `cogs` (prod/envío/trans), `gastosOperacionales` (empleados/herramientas/otros), `gastosTotales`, `ebitda`, `margen`.
- **Accounting summary (`resumenContable`)**: `revenue`, `cogs`, `grossProfit = revenue − cogs`, `opex`, `ebitda = grossProfit − opex`, `margin`, `financingIn/Out`, `byLine`. This is the canonical input for KPIs and insights.
- **Number formats & signs**: Chilean CLP; inflows positive, outflows negative; the parser handles EU/US/CLP separators, parentheses, trailing minus, OCR noise (see `manualProvider.js`).

## 5. Worked example (from the E2E test)

Input month: Stripe +450,000; Meta −60,000; Bluexpress −9,000; Arriendo −400,000; **Traspaso +2,000,000 (transfer)**; **Aporte capital +5,000,000 (owner)**; unknown −30,000.

Result: **Revenue = 450,000** (Stripe only), COGS = 9,000, OPEX = 490,000, **EBITDA = −49,000**, financingIn = 5,000,000. The 7,000,000 of transfer + owner contribution contributes **zero** to Revenue or EBITDA.

## 6. Adding a new category (checklist)

1. Add `{ id, name }` to `CATEGORY_REGISTRY`.
2. Add an `ACCOUNTING_MAP[id]` entry (statement/plSection/bucket/cashFlow/flags).
3. If it's a non-P&L movement, ensure `includeInPL:false` and `includeInRevenue:false`.
4. Run the accounting tests — `validateAccountingMap()` will fail loudly if anything is missing.
