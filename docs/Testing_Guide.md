# Testing Guide

> How to verify the Financial Copilot and how to grow the regression suite. Philosophy: **every discovered bug becomes a permanent test case.**

## 1. What we test and how

The financial core is **pure, deterministic functions** — categorization, accounting map, statements, dedup, import sessions, insights. These are covered by fast Node ESM tests (no browser needed). React/JSX and browser-only paths (OCR, Fintoc widget, notifications) are verified by build + manual QA.

### Layered coverage

| Layer | Module(s) | How it's tested |
|---|---|---|
| Parsing | `manualProvider`, `extractor` | Node tests over many bank layouts (Cargo/Abono, signed, Tipo, two-header, PDF reconstruction, EU/US/CLP, OCR-shape). |
| Categorization | `categorize`, `merchants` | Merchant aliases, rules, memory-first, confidence tiers, **guardrails** (Transfers/Loans/Owner never Revenue). |
| Domain | `importSessions` | Approve stamps provenance + `original`; edit preserves original; delete-import removes only its rows; **idempotent backfill**. |
| Accounting | `accountingMap`, `calculations` | `validateAccountingMap` (coverage + hard rule); statement bucketing; transfers/loans/owner excluded from P&L. |
| Insights | `insightEngine` | Revenue MoM, expense growth, top merchants, recurring subs, missing categorization; all figures exclude non-P&L. |
| E2E | full pipeline | The 9-step flow — see `E2E_Integration.md`. |

## 2. Running the tests

The pure-logic tests run under Node's ESM loader:

```bash
node path/to/test.mjs     # each prints "RESULT: N passed, M failed" and exits non-zero on failure
```

Suggested layout to formalize (currently these live as scratch `.mjs` harnesses used during development):

```
tests/
  categorize.test.mjs        # M1: ids, guardrails, memory, backward-compat
  importSessions.test.mjs    # M2: approve/edit/delete/backfill
  accountingMap.test.mjs     # M3: validation + statement routing
  insightEngine.test.mjs     # M4: structured insights + exclusions
  e2e.test.mjs               # full flow
```

A `package.json` script `"test": "node tests/run.mjs"` that runs each file and sums results is the recommended next step (see Future Roadmap).

## 3. Real-world fixtures

`QA-Testing/fixtures/` contains real-shaped statements: Banco de Chile CSV + digital PDF (same statement, for dedup), BancoEstado CSV, generic tab-delimited, malformed CSV, suspicious-amount CSV, a 6-consecutive-month CSV, and a **scanned** June PDF for OCR. `QA-Testing/QA_CHECKLIST.md` is a step-by-step manual browser checklist (login, persistence, import review, duplicates, OCR, notifications, confidence banner, etc.).

## 4. Edge cases already covered (add to these, don't remove)

- Two header rows / header not on row 0; columns in any order; empty Cargo/Abono cells (PDF).
- EU `1.234,56`, US `1,234.56`, CLP `1.234`, parentheses negatives, trailing minus, leading zeros, OCR noise.
- Missing year in dates (inferred from neighbours); `3.50` not mis-read as a date.
- Duplicate detection: same statement as CSV **and** PDF imported once; recurring same-amount transfers **not** collapsed; exact within-file duplicate collapsed.
- Firestore rejects nested arrays → diagnosis stats are sanitized before persist.
- Suspicious amounts (> 1e9) flagged for review, never blindly imported.
- Transfers/Loans/Owner Contributions inflows excluded from Revenue, P&L, KPIs, insights.

## 5. Turning a bug into a test (required workflow)

1. Reproduce with the smallest input that fails.
2. Add an assertion to the relevant `*.test.mjs` (or create one) that fails on the bug.
3. Fix the code until the assertion passes.
4. Keep the assertion forever.

## 6. Known environment caveat

During development the workspace was OneDrive-synced, which lagged the sandbox's view of freshly-edited files (the in-repo Babel/`node` parser would read a **truncated** copy and report phantom syntax errors at impossible line numbers). Pure-logic was therefore validated against **byte-identical mirror bundles** plus a static import-resolution check across all modules. Before shipping, run a real build:

```bash
npm run build      # confirms every JSX/JS file compiles
npm run lint       # style + obvious errors
```

and do one manual browser pass of the import → review → approve → dashboard flow.
