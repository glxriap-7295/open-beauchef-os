# Known Issues

Open items and things a new engineer should watch. Fixed bugs are listed at the bottom (each is now a regression test).

## Open / to verify
1. **`npm run build` not run in this environment.** The OneDrive sandbox mount truncated freshly-edited files, so a full Vite build / ESLint pass could not be executed here. **Action:** run `npm run build && npm test` on a clean checkout before release. Risk: low (all imports resolve statically; JSX reviewed by hand), but a build is the definitive check.
2. **Fintoc end-to-end unverified.** The Link-Intent → widget → exchange → movements flow and the serverless `api/fintoc/*` functions were built but not run against a live Fintoc environment. **Action:** validate with Fintoc test credentials; confirm the widget loads and movements import.
3. **Fintoc transactions lack ImportSession/provenance.** They currently go through the legacy `importarTransacciones` path and get backfilled to `imp-legacy`. **Action (small):** route Fintoc through `aprobarImportacion` so it gets a proper session.
4. **OCR robustness.** Only validated on generated scans. Real-world scanned cartolas (rotation, noise) may under-perform. **Action:** test with real scans; consider server-side OCR for V2.
5. **`porCategoria` in `importPipeline` return is unused** by the current review UI (dead-ish, harmless). Safe to remove in a future cleanup.
6. **Diagnosis narrative is import-scoped.** `generarDiagnostico` runs on the just-approved movements; the dashboard's insight cards run on the full dataset. Both are correct but can differ in emphasis — expected, worth knowing.

## Fixed during the internship (now covered by regression tests in `tests/`)
- **PDF imported 0 transactions** — the whole page collapsed into one line; fixed with position-based table reconstruction. (`bankParsing` two-header case.)
- **Manual category edit didn't persist / row vanished** — review select is now controlled and preserves the edit. (`importSessions`, `e2e`.)
- **Transactions dropped 5→1** — within-batch fuzzy dedup collapsed legitimate recurring movements; now only exact within-file repeats collapse. (`dedup`.)
- **Firestore rejected the whole document** — diagnosis stats contained nested arrays (`catOrden`/`topCategoria`); now flattened before persist. (Guarded in `PreparacionContext.sanitizarDiagnostico`.)
- **Everything classified as income** — Cargo/Abono sign detection fixed. (`bankParsing`.)
- **Amounts mis-parsed** — leading zeros, EU/US/CLP separators, parentheses, trailing minus; ref/account columns excluded; >1e9 flagged suspicious. (`bankParsing`.)
- **Transfers/loans/owner counted as revenue** — excluded from Revenue and the P&L via `ACCOUNTING_MAP`. (`accounting`, `e2e`, `insights`.)
- **README git merge conflict** — resolved during RC1.
