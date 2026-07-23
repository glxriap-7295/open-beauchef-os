# Open Beauchef — Financial Copilot (frontend)

An **accounting pipeline** for startup founders. Upload a bank document (PDF/CSV/Excel), review a draft, approve it, and get a trustworthy Income Statement, Cash Flow, KPIs and plain-language insights.

**Philosophy:** Trust > Intelligence · Correctness > Fancy AI · Explainability > Magic. Every financial fact is computed deterministically; **AI only explains verified facts.**

> This project also contains the wider "Open Beauchef OS" founder experience (Startup Profile, AI Discovery, Evidence Vault, Gap Analysis, Roadmap, Mentors). This README focuses on the Financial Copilot, which is the RC1 deliverable.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build (run this before shipping)
npm test           # regression suite (Node, no browser)
```

Full setup (env vars, Firebase, Ollama, Fintoc, Vercel) is in **`docs/Developer_Setup.md`**.

## The pipeline

```
Upload → Importer → Normalizer → Merchant Recognition → Rule Engine → Confidence
      → (AI only if low) → Review Draft → Approve → Import Session + provenance
      → Accounting Engine (ACCOUNTING_MAP) → Income Statement / Cash Flow / KPIs
      → Insight Engine → Ollama (rewrite only) → Dashboard
```

Nothing affects accounting until the founder **approves**. Transfers, loans, and owner contributions can **never** appear as Revenue or in the P&L.

## Where things live

- `src/services/finance/` — categorization (`categorize`, `merchants`), import pipeline, `accountingMap` (the canonical map), `importSessions` (draft/provenance), `insightEngine` + `insightNarrator`.
- `src/services/banking/manualProvider.js` — universal bank-statement parser.
- `src/services/{ai,notifications,persistence}/` — swappable providers behind interfaces.
- `src/utils/calculations.js` — statements & KPIs.
- `src/context/PreparacionContext.jsx` — app state + CloudSync (Firestore ⇄ LocalStorage).
- `src/components/os/ConectarDatosModal.jsx` — the draft review UI.
- `tests/` — regression suite. `QA-Testing/` — fixtures + manual QA checklist.

## Handover documentation (`docs/`)

| Doc | What it covers |
|---|---|
| `Architecture.md` | System structure, module map, data flow. |
| `Accounting_Principles.md` | Stable ids, `ACCOUNTING_MAP`, the hard guardrails. |
| `AI_Architecture.md` | AI-over-accounting; provider abstraction; narrator. |
| `DECISIONS.md` | **Architecture Decision Record — the *why*.** |
| `IMPORT_SESSION.md` | Import-session data model. |
| `Testing_Guide.md` | How to run/extend the regression suite. |
| `E2E_Integration.md` | The 9-step end-to-end flow, with proof. |
| `QA_Checklist.md` | Manual browser QA checklist (points to `QA-Testing/`). |
| `Known_Limitations.md` / `Known_Issues.md` | Honest scope + open items. |
| `Contribution_Guide.md` | Conventions for the next engineer. |
| `Developer_Setup.md` | Env vars, Firebase, Ollama, Fintoc, Vercel. |
| `V2_Roadmap.md` | Post-v1 direction (Open Banking, subcollections, forecasting…). |

## Stack

React 18 + Vite + React Router + Recharts; Tailwind (CDN); Firebase (Auth + Firestore, opt-in); Ollama as the default AI provider (free/local, swappable). CLP throughout. Deployed on Vercel; PWA-ready.

## Status

Feature-complete v1 (RC1). The manual workflow (PDF/CSV/Excel → review → approve → statements → insights) is the core and is regression-tested. Fintoc (Open Banking) is wired but best-effort until fully validated — see `Known_Limitations.md`.
