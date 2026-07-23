# V2 Roadmap

Direction after v1, ordered roughly by value/effort. The v1 architecture was chosen to make these additive, not rewrites.

## Near-term (unblocks scale & trust)
1. **Firestore subcollections.** Move `transacciones` (and optionally `importSessions`) to `startups/{uid}/transactions/{id}`. Because every transaction already carries `importId` + provenance, this is a **copy, not a reshape**. Removes the ~1 MB / ~3–4k-transaction ceiling.
2. **Fintoc → ImportSession.** Route Open Banking through the same draft/approve/provenance path as manual imports (currently backfilled to `imp-legacy`). Then finish live Fintoc validation.
3. **Persisted draft (V1.1).** One `estado.draftSession` slot so a mid-review refresh doesn't lose work.
4. **Append-only event log.** `ImportCreated / CategoryChanged / ImportCommitted / ImportArchived` (see `IMPORT_SESSION.md` §12). The model is already event-ready; "delete import" becomes "archive".

## Reporting & intelligence
5. **Full 3-section Cash Flow statement** (operating/investing/financing) rendered from `ACCOUNTING_MAP.cashFlow` (data already classified).
6. **Forecasting & cash runway** from the verified monthly series (deterministic projection; AI explains).
7. **Scenario planning** ("what if revenue +X% / hire Y") on top of the deterministic engine.
8. **Financial Health Score** derived from margins, runway, concentration, data completeness.
9. **Benchmarking** vs. anonymized cohort metrics.

## Integrations
10. **Live Open Banking + continuous sync** (scheduled Fintoc pulls, dedup against stored data — already supported).
11. **XML / OFX / QIF** import (extractor is designed for new formats).
12. **ERP / accounting**: QuickBooks, Xero, and **SII** (Chile) — export the id-keyed ledger.
13. **Invoice / receipt OCR** (likely server-side OCR for reliability) feeding the same pipeline.
14. **Budget tracking** against categories (per-`categoryId` targets vs. actuals).

## Platform
15. **Server-side heavy work.** Move OCR and any LLM calls off the main thread to a worker/queue with retries.
16. **TypeScript migration.** The pure core (`categorize`, `accountingMap`, `importSessions`, `insightEngine`) is the highest-value target for types.
17. **Autonomous Financial Assistant** — only after the above; must stay deterministic-facts + AI-explains.

## Guardrails to keep across all of the above
- Accounting stays deterministic; AI only explains.
- All accounting keys on stable ids via one `ACCOUNTING_MAP`.
- Nothing affects accounting before explicit approval.
- Transfers / loans / owner contributions never enter Revenue or the P&L.
