# Architecture Decision Record (ADR)

> Why the Financial Copilot is built the way it is. Each decision lists the context, the choice, the alternatives considered, and the trade-off accepted. Read this before changing anything structural.

---

## ADR-001 — Merchant recognition as the foundation of categorization

**Context.** Bank descriptions are noisy (`AWS EMEA`, `AmazonAWS`, `AWS*billing`). Classifying directly from them with keywords is brittle and un-explainable.

**Decision.** Categorization goes: raw → normalized description → **merchant recognition** (a data-only knowledge base with aliases) → accounting category. Merchants carry a stable `id` and a `categoryId`.

**Alternatives.** (a) Pure keyword rules — brittle, collides across categories. (b) AI-first classification — non-deterministic, can't be audited, costs money.

**Trade-off.** The merchant list must be maintained, but it's *data* — adding a merchant never touches logic, and recognition is stable and explainable (`reason: "Comercio reconocido: Meta Ads"`).

---

## ADR-002 — Stable category & merchant IDs, separate from display names

**Context.** Display names change and get localized; if accounting keys on the display string, every rename is a data migration and a source of subtle bugs (e.g., `porCat.Marketing` hard-coded to English).

**Decision.** `CATEGORY_REGISTRY = [{id, name}]`. **Ids** (`revenue`, `bank_fees`, merchant `aws`) are the source of truth stored in every transaction, summary, and map. Names are display-only via `categoryName(id)`. `resolveCategoryId()` maps any legacy/English/Spanish label back to an id.

**Alternatives.** Keep using Spanish display labels (status quo before M1) — couples storage to presentation.

**Trade-off.** A little indirection (id ↔ name), repaid immediately: labels can be renamed/translated with zero migration, and legacy data keeps working.

---

## ADR-003 — One canonical `ACCOUNTING_MAP` as the single source of truth

**Context.** Income Statement, Cash Flow, KPIs, diagnosis and insights each need to know how a category is treated. If each computes that independently, rules drift between screens.

**Decision.** A single `ACCOUNTING_MAP` (categoryId → `{statement, plSection, plLine, bucket, cashFlow, includeInPL, includeInRevenue}`) drives **all** accounting. `validateAccountingMap()` asserts full coverage and the hard rules at module load and in tests.

**Alternatives.** Per-consumer logic (what existed) — inconsistent and unenforceable.

**Trade-off.** All accounting funnels through one file; that file is now load-bearing (mitigated by validation + tests). Adding a category without a mapping fails loudly.

---

## ADR-004 — Deterministic accounting before AI (AI only explains)

**Context.** Founders must trust the numbers. An AI that "concludes" financial facts can hallucinate and can't be audited.

**Decision.** The accounting engine computes every fact deterministically; the **Insight Engine** derives structured observations; **Ollama only rewrites** the wording. AI never sees raw transactions and never emits a number, id, or severity.

**Alternatives.** `Transactions → LLM → conclusions` — fast to build, impossible to trust.

**Trade-off.** More code than "ask the LLM", but the product is correct and works fully offline; AI is a wording enhancement, not a dependency.

---

## ADR-005 — Imports are drafts until explicitly approved

**Context.** This is a founder's real money data. Silent, immediate imports (the original behavior) are unsafe and un-reviewable.

**Decision.** Upload → parse → categorize → **draft review** (edit category, delete row, see duplicates) → **Approve**. Nothing affects statements/KPIs/insights until approval. Drafts live in memory (v1).

**Alternatives.** Auto-import (status quo) — no chance to correct before accounting changes. Persisted drafts — more storage/complexity; deferred to V1.1.

**Trade-off.** One extra step for the user, and a mid-review browser refresh loses the draft (acceptable for v1, documented). Buys trust and correctness.

---

## ADR-006 — Preserve the original categorization on every transaction

**Context.** Once a user overrides a category, we must not lose what the engine decided (for debugging, analytics, retraining, audit).

**Decision.** Each transaction stores an immutable `original {categoryId, confidence, source, merchantId, merchant, reason}`; the effective `categoryId` may change; edits record `edited {fromCategoryId, at, by}`.

**Trade-off.** Small per-row duplication; enables audit and future model/rule improvement.

---

## ADR-007 — Ollama as the v1 AI provider, behind an interface

**Context.** We need an AI wording layer without API cost or vendor lock-in during a research preview.

**Decision.** Default provider is **Ollama** (free, local, no key). All AI goes through `getAIProvider().json()`. Adding OpenAI/Claude/Gemini/Azure = implement the same interface and register it — zero business-logic change. A `mock` fallback guarantees the app runs with no AI.

**Trade-off.** Ollama requires a local runtime for the founder to get AI wording; without it the deterministic explanations are used (fully functional). Provider abstraction makes swapping trivial.

---

## ADR-008 — Single Firestore document model (additive), with a documented migration path

**Context.** Everything (profile, transactions, sessions, mappings, diagnosis) is stored in one Firestore document `startups/{uid}.estado`, mirrored to LocalStorage by `CloudSync`.

**Decision.** Keep the single-document model for v1 and **add fields** (import sessions, provenance) rather than introduce subcollections. Firestore is schemaless, so this is not a DB migration and needs no rules change.

**Alternatives.** Move transactions to a `startups/{uid}/transactions` subcollection now — correct long-term, but a `CloudSync`/offline rewrite that's high-risk for the timeline.

**Trade-off / limit.** The document must stay under Firestore's **1 MB** (~3–4k transactions). This is the known ceiling. Because every transaction already carries `importId` + provenance, the V2 migration to subcollections is a **straight copy**, not a reshape (see `V2_Roadmap.md`). Firestore rejects nested arrays, so diagnosis stats are flattened before persist (learned the hard way — see `Known_Issues.md`).

---

## ADR-009 — Fault-isolated import pipeline

**Context.** Real files fail in many ways (bad OCR, AI down, weird encodings).

**Decision.** Each import stage runs isolated; a failure is logged and falls back (AI→rules, OCR→scanned message, etc.) rather than crashing the import.

**Trade-off.** A degraded run can succeed partially; every fallback is logged so it's visible.
