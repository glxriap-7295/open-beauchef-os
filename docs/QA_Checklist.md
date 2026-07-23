# QA Checklist (RC1)

Manual browser pass for release. Run on a clean `npm run build` + `npm run preview`. Fixtures are in `QA-Testing/fixtures/`; a longer platform-wide checklist (login, persistence, notifications, OCR, confidence banner) is in `QA-Testing/QA_CHECKLIST.md` — this doc focuses on the **Financial Copilot workflow**.

Tick each; note PASS/FAIL.

## A. Import — formats
- [ ] **CSV** (`banco_de_chile_mayo.csv`) parses; processing steps show; draft appears.
- [ ] **Excel** (.xlsx export) parses (SheetJS loads from CDN).
- [ ] **Digital PDF** (`extracto_digital_mayo.pdf`) parses; rows appear (position-based reconstruction).
- [ ] **Scanned PDF** (`extracto_escaneado_junio.pdf`) → "Reconociendo texto (OCR)" step, then rows (allow 10–40s); or a clear scanned-PDF message.
- [ ] **Malformed CSV** → no crash; friendly message or best-effort rows + data-quality warning.

## B. Review draft (nothing has hit accounting yet)
- [ ] Header shows institution, period, live **A importar / Ingresos / Egresos**.
- [ ] Low-confidence rows are highlighted (amber bar + "baja confianza").
- [ ] Duplicates panel: "Se omitirán N que ya existen"; expand shows them.
- [ ] **Edit a category** on any row (dropdown by category name) — row shows "editado", totals update live.
- [ ] **Delete a transaction** (🗑) — it disappears; totals update.
- [ ] Confirm the dashboard/statements have **not** changed yet.

## C. Approve
- [ ] Click **Aprobar e importar N** — success panel + diagnosis appears.
- [ ] Dashboard now shows the data; Income Statement, Cash Flow and KPIs populate.
- [ ] **Insight cards** appear (deterministic), with "Cifras calculadas por el motor contable; la IA solo las explica."
- [ ] Refresh the page — data persists (LocalStorage; Firestore if configured).

## D. Import history & delete
- [ ] Reopen the import modal → "Importaciones anteriores" lists the session (filename · date · source · income/expenses · count).
- [ ] **Delete an import** (confirm) removes only its transactions; other imports and totals remain.

## E. Accounting correctness (the critical checks)
Use a statement containing a **transfer**, a **loan**, and an **owner contribution** (or edit rows to those categories).
- [ ] Revenue does **not** include the transfer/loan/owner amounts.
- [ ] EBITDA is unaffected by those inflows.
- [ ] The Income Statement never shows transfers/loans/owner as income.
- [ ] Edit a transaction's category → statements/KPIs/insights update accordingly; the original categorization is preserved internally.

## F. Duplicates
- [ ] Import a statement, approve it, then import the **same** statement as a different format (CSV then its PDF) → duplicates detected, only new rows offered.
- [ ] A statement with recurring same-amount movements imports **all** of them (not collapsed).

## G. Resilience
- [ ] With AI/Ollama off: insights still show (deterministic text); import still works.
- [ ] Upload a non-financial file → clear error, no crash.

**Sign-off:** ______  **Date:** ______  **Build/commit:** ______
