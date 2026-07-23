# Final Engineering Review (RC1)

Honest end-of-internship assessment. What's solid, what's debt, what's risky, and where V2 should go.

## Overall

The Financial Copilot reached its intended shape: **deterministic accounting engine with an AI explanation layer on top.** The manual workflow (PDF/CSV/Excel → review → approve → statements → KPIs → insights) is complete, regression-tested, and enforces the accounting guardrails by construction. Another engineer can continue from here confidently.

## Highest-risk modules (watch these)

1. **`services/banking/manualProvider.js`** — the universal parser. Highest surface area and the most heuristic (column classification, number/date parsing, table shapes). Most past bugs lived here. It's well-tested now, but new bank formats are the likeliest source of future issues. *Mitigation:* the `bankParsing` regression suite; add a fixture per new bank.
2. **`services/finance/extractor.js` (PDF/OCR)** — position-based reconstruction + browser OCR. Real-world scanned statements are the least-validated path. *Mitigation:* server-side OCR in V2.
3. **`services/finance/accountingMap.js`** — now load-bearing for all accounting. A wrong entry silently mis-states financials. *Mitigation:* `validateAccountingMap()` + `accounting` tests; the hard guardrails are asserted.
4. **`context/PreparacionContext.jsx`** — large single state container + CloudSync race handling + backfill. Complex but stable; the nested-array Firestore trap is guarded. *Mitigation:* keep persisted data free of nested arrays; consider splitting the context in V2.

## Remaining technical debt

- **No `npm run build` / lint executed in this environment** (OneDrive sandbox truncation). Run both on a clean checkout before release — this is the one must-do.
- **Legacy compatibility layer** (`categorizer.js` adapter, Spanish labels, `resolveCategoryId`) exists to avoid breaking stored data. It can be retired once the UI/persistence fully move to ids.
- **`importPipeline.porCategoria`** is dead in the current UI (harmless).
- **Fintoc** isn't on the session/provenance path and isn't live-validated.
- **Tests live only for the pure core**; React components rely on manual QA. A component test layer (e.g., Vitest + Testing Library) is a good V2 add.
- **JavaScript, not TypeScript.** The pure core would benefit most from types.

## Performance

- Import parsing is O(rows); categorization is O(rows × merchants/rules) with tiny constants — fine for founder-scale (hundreds–few thousand rows). Heavy libs (SheetJS/pdf.js/Tesseract) load on demand from CDN, keeping the bundle light.
- Statements/insights recompute from the full transaction array on each dashboard render via `useMemo`. At a few thousand rows this is negligible; if a user grows past ~10k rows it should be memoized per-import or moved server-side (ties into the Firestore scaling item).
- OCR is the only slow path (seconds) and runs in the browser — a candidate to offload in V2.

## Firestore scaling

- **Model:** one document `startups/{uid}.estado` holding everything, mirrored to LocalStorage by CloudSync. Additive, no migrations, no rules churn.
- **Ceiling:** the 1 MB document limit ≈ 3–4k transactions (a transaction ≈ 0.2–0.3 KB). This is the single hard scaling limit.
- **Migration path (designed, not done):** move `transacciones`/`importSessions` to subcollections. Because every transaction already carries `importId` + provenance and everything keys on stable ids, this is a straight copy, not a reshape. See `V2_Roadmap.md` #1.
- **Trap to remember:** Firestore rejects nested arrays; keep persisted structures flat (already enforced for diagnosis stats).

## Future Open Banking integration

- Serverless functions (`api/fintoc/`) and the widget flow exist; the secret key stays server-side. **Not yet live-validated.**
- Next steps: (1) validate with Fintoc test credentials; (2) route Fintoc imports through `aprobarImportacion` so they get sessions/provenance and dedup against existing data; (3) add scheduled continuous sync (V2). The dedup engine already handles "same movement from file + bank".

## Recommended V2 improvements (top 5)

1. Firestore **subcollections** (removes the scaling ceiling).
2. **Fintoc on the session path** + live validation + continuous sync.
3. **Full 3-section Cash Flow** statement (data already classified in the map).
4. **Server-side OCR** and off-main-thread heavy work.
5. **TypeScript** for the pure financial core.

## Bottom line

Stable, well-tested, well-documented v1. The deterministic-accounting + AI-explains architecture is the right foundation and is enforced, not just intended. The two things to do before calling it released: run `npm run build && npm test` on a clean checkout, and a manual `QA_Checklist.md` pass. Everything else is documented as limitations or roadmap rather than hidden.
