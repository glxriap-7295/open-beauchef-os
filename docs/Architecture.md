# Financial Copilot — Architecture

> Audience: the next engineer. This explains **how the system is structured and why**. Companion docs: `Accounting_Principles.md`, `AI_Architecture.md`, `Testing_Guide.md`, `E2E_Integration.md`, `IMPORT_SESSION.md`.

## 1. What this is

An **accounting pipeline** for startup founders, not an AI chatbot. A founder uploads a bank document (PDF/CSV/Excel), reviews a draft, approves it, and gets an Income Statement, Cash Flow, KPIs and plain-language insights. **Every financial fact is computed deterministically; AI only explains verified facts.**

## 2. The pipeline (single source of flow)

```
Upload → Importer(extractor + manualProvider) → Normalizer → Merchant Recognition
      → Rule Engine → Confidence → (AI only if low) → Review Draft → Approve
      → Import Session + provenance → Accounting Engine (ACCOUNTING_MAP)
      → Income Statement / Cash Flow / KPIs → Insight Engine → Ollama (rewrite only) → Dashboard
```

Each stage is a small module with one responsibility. Nothing touches accounting until **Approve**.

## 3. Module map (`src/services/finance` unless noted)

| Layer | Module | Responsibility |
|---|---|---|
| Import | `extractor.js` | File → rows (CSV/Excel/PDF text + OCR), universal detection. |
| Import | `../banking/manualProvider.js` | Rows → normalized transactions (universal table parser). |
| Import | `importPipeline.js` | Orchestrates parse → understand → normalize → validate → dedup → categorize; attaches `categoryId` + immutable `original`. |
| Import | `dedup.js`, `validation.js`, `logger.js` | Duplicate detection, structured validation warnings, structured logging. |
| Categorization | `merchants.js` | Merchant knowledge base (data only; stable `id` + `categoryId`). |
| Categorization | `normalizeDescription.js` | Description normalization + stable memory key. |
| Categorization | `categorize.js` | Rule engine + merchant recognition; **CATEGORY_REGISTRY** (stable ids); returns `{categoryId, confidence, reason, merchant, merchantId, source}`. |
| Categorization | `categorizer.js` | Backward-compat adapter (legacy Spanish labels). |
| Domain | `importSessions.js` | Import-as-draft, provenance stamping, summaries, edit/delete, idempotent backfill. |
| **Accounting** | `accountingMap.js` | **Canonical `ACCOUNTING_MAP`**: categoryId → P&L/Cash-Flow treatment; `resumenContable`; validation. |
| Accounting | `../../utils/calculations.js` | `transaccionesAMeses` (monthly P&L) + KPI helpers. |
| Insights | `insightEngine.js` | **Deterministic** structured observations from accounting facts. |
| Insights | `insightNarrator.js` | AI **rewrite-only** layer (Ollama). |
| Insights | `diagnosis.js` | Insight-driven narrative for the diagnosis banner. |
| State | `../../context/PreparacionContext.jsx` | Single source of app state; import-session actions; CloudSync. |
| UI | `../../components/os/ConectarDatosModal.jsx` | Draft review UI (edit/delete/approve + import history). |
| UI | `../../pages/DashboardPage.jsx` | Statements, KPIs, coverage banner, insight cards. |

## 4. Data model (see `IMPORT_SESSION.md` for the full spec)

- **Transaction**: `{ id, fecha, monto, descripcion, categoria, categoryId, tipo, confianza, source, importId, importFilename, importSource, importedAt, original{…}, edited? }`. The **effective** category is `categoryId`; `original` (the automatic categorization) is immutable for audit/retraining.
- **ImportSession**: `{ importId, filename, source, status, createdAt, approvedAt, institution, account, period, docHash, counts, summary, schemaVersion }`.
- Everything lives in one Firestore doc `startups/{uid}.estado` (additive, no schema migration). `CloudSync` mirrors Firestore ⇄ LocalStorage.

## 5. Key architectural decisions (the *why*)

- **Stable IDs everywhere accounting happens.** Display names change; ids (`revenue`, `bank_fees`, merchant `aws`) don't. All persisted fields and all accounting key on ids. → no data migration when we rename/localize labels.
- **One canonical `ACCOUNTING_MAP`.** The P&L, Cash Flow, KPIs, diagnosis and insights read a single map (`includeInPL`, `includeInRevenue`, `plSection`, `bucket`, `cashFlow`). → accounting rules can't drift between screens, and adding a category without a mapping trips the validator immediately.
- **Import = draft until Approve.** Protects a founder's real financial data: nothing affects statements/KPIs/insights until they explicitly approve. Drafts are in-memory (v1); persisted drafts documented as V1.1.
- **Deterministic-first, AI-assist.** Rules/merchant recognition always work offline; AI only (a) resolves low-confidence categorization and (b) rewrites verified insights. The app is fully functional with AI off.
- **Additive single-document persistence.** Firestore is schemaless; we add fields, never migrate. The documented V2 path (subcollections) is a straight copy because every transaction already carries `importId`.
- **Fault-isolated import stages.** One stage failing (e.g., AI down, OCR fails) never crashes the import; each logs and falls back.

## 6. Non-goals for v1 (documented in the roadmap)

Live Open Banking sync, forecasting/runway scenarios, benchmarking, ERP/QuickBooks/Xero/SII integrations, receipt OCR, budget tracking, an autonomous assistant. The architecture is intentionally compatible with all of them (stable ids + canonical map + event-log-ready model).
