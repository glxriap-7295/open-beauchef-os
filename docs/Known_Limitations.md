# Known Limitations

Honest scope of v1 (RC1). These are *by-design boundaries*, not bugs. Open bugs are in `Known_Issues.md`.

## Parsing & import
- **Credit-card statements** parse correctly when they expose Cargos/Abonos or a signed amount, but statements that list all charges as bare positive numbers with no debit/credit column can misread sign. Prefer a column-typed export.
- **Scanned PDFs (OCR)** run Tesseract in the browser: 10–40s, Spanish only, and quality varies. Rotated/low-contrast scans may fail; the app then asks for a text PDF/CSV. OCR was validated by construction, not exhaustively.
- **PDF table reconstruction** uses text-position heuristics. Exotic multi-column layouts, multi-account statements in one file, or heavily merged cells may need review.
- **Currency** is CLP-only. No multi-currency P&L (mixed currencies are flagged, not converted).
- **XML/OFX/QIF** are not implemented (architecture is ready; see roadmap).

## Accounting
- The Income Statement is EBITDA-level (Revenue, COGS, OPEX). No depreciation/amortization, taxes-on-income, or below-the-line items.
- **Cash Flow** currently mirrors operating P&L per month; a full 3-section statement (operating/investing/financing) is modeled in `ACCOUNTING_MAP.cashFlow` but not yet rendered as its own statement. Financing (loans/owner) is correctly excluded from the P&L and tracked in `resumenContable.financingIn/Out`.
- Category → statement-line mapping is a sensible default (e.g., `bank_fees`→COGS transaction, `marketplace`→OPEX other). A founder may reasonably disagree for their business; the map is the single place to adjust.

## AI
- AI is a **wording** layer only. With Ollama absent, insights show deterministic text (correct, slightly less polished). AI never affects numbers.
- The low-confidence AI categorization step depends on the provider returning valid JSON; on failure it falls back to rules (never blocks import).

## Persistence & sync
- Single Firestore document per user (`startups/{uid}`). Hard ceiling ~1 MB (~3–4k transactions). See `DECISIONS.md` ADR-008 and the V2 subcollection plan.
- Import **drafts are in-memory**: a browser refresh mid-review discards the draft (V1.1 will optionally persist one draft).
- **Fintoc-imported transactions** don't yet get their own ImportSession/provenance; the idempotent backfill assigns them to `imp-legacy`. Fintoc → sessions is a small follow-up.

## Notifications
- **Desktop** (Web Notifications) works. **Mobile push (FCM)** is architected but not activated (needs a service worker, VAPID key, server sender; iOS requires the PWA installed). Treat mobile push as N/A for v1.

## Testing / environment
- The pure financial core is regression-tested (`tests/`). React/JSX and browser-only paths (OCR, Fintoc widget, notifications) are covered by build + the manual `QA_Checklist.md`.
- Development happened under a OneDrive-synced folder whose sandbox mount lagged, so in-sandbox `npm run build`/`node` could read truncated files. Logic was validated against byte-identical mirrors. **Run `npm run build` + `npm test` on a clean checkout before release** (a normal checkout has no such lag).
