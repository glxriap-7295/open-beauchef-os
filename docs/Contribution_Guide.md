# Contribution Guide

Conventions so the next engineer can extend the Financial Copilot without breaking its guarantees.

## Golden rules
1. **Accounting is deterministic.** Never let AI compute a financial number. AI may only rewrite text produced by the deterministic engine.
2. **Key on stable ids.** Store and compute on `categoryId` / `merchantId`, never on display names. Use `categoryName(id)` only for rendering.
3. **One map to rule them all.** Any change to how a category flows into the P&L / Cash Flow / KPIs happens in `accountingMap.js`. Don't scatter category logic.
4. **Nothing touches accounting before Approve.** Keep the draft → review → approve boundary.
5. **Every bug becomes a test.** Add a permanent assertion in `tests/` (see `Testing_Guide.md`).

## Common tasks

### Add a merchant
Edit `services/finance/merchants.js` — add `{ id, merchant, categoryId, aliases }`. No logic changes. Use a new stable `id`; never reuse an id.

### Add a category
1. `CATEGORY_REGISTRY` in `categorize.js` — add `{ id, name }`.
2. `ACCOUNTING_MAP` in `accountingMap.js` — add its treatment (statement/plSection/bucket/cashFlow/flags). Non-P&L movements must set `includeInPL:false` and `includeInRevenue:false`.
3. Run `npm test` — `validateAccountingMap()` fails loudly if a mapping is missing.

### Add a rule (keyword)
Edit `RULES` in `categorize.js`. Keep the most accounting-sensitive rules (transfers/loans/owner) first.

### Add an insight
Add to `computeInsights()` in `insightEngine.js`. Return a structured object `{id, severity, metric, value, title, explanation}` with a deterministic `explanation` (real numbers). Never call AI here.

### Add an AI provider
Implement the same interface as `ollamaProvider` (esp. `json(prompt)`) and register it in `services/ai/index.js`. No UI or business-logic change.

## Style
- Plain ESM modules; pure functions where possible (they're the tested core).
- Comments explain **why**, not what. Spanish is fine (the product is Chilean).
- No new npm deps without discussion — heavy libs (SheetJS, pdf.js, Tesseract) are loaded from CDN on demand to keep the bundle light and the registry-free build working.
- Keep provider details out of the UI; the UI asks `getAIProvider()`, `banking.*`, `notifications.*`, `persistence.*`.

## Before you open a PR
```bash
npm run build     # must compile
npm test          # must pass
npm run lint      # if configured
```
Then do one manual pass of upload → review → approve → dashboard with a real statement.

## Firestore safety
- The whole state is one document; keep it under ~1 MB (see `DECISIONS.md` ADR-008).
- **No nested arrays** in anything persisted (Firestore rejects them). Flatten to objects — this already bit us once (`Known_Issues.md`).
