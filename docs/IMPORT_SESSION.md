# Import Sessions — Data Model (design note for review)

Status: **approved (with refinements)** · Owner: Financial Copilot · Precedes: M2 (Import Review workflow)

This note defines the data model for turning imports into reviewable **drafts** with full provenance and safe deletion. Goal: decide the shape **once** so we never migrate Firestore twice.

**Refinements incorporated (approved):** (1) stable `categoryId` / `merchantId` alongside display names — §11; (2) preserve the **original** AI/rule categorization when a user edits — §4; (3) a denormalized **summary** on each `ImportSession` — §3; (4) the model is compatible with a future append-only **event log** — §12.

---

## 1. Principles

1. **Nothing affects accounting until `approved`.** Draft transactions are never counted in the Income Statement / Cash Flow / KPIs.
2. **Every transaction knows where it came from** (`importId` + filename + source + date), so "delete this import" and audit are trivial.
3. **Additive, not migratory.** We only *add fields* to the existing Firestore document — no new collections, no security-rule changes, no destructive migration.
4. **Deterministic + reversible.** Approving, deleting a row, and deleting an import are pure, explainable array operations.

---

## 2. Where it lives (and why)

Today the whole founder state is a **single Firestore document** `startups/{uid}`, field `estado`, synced by `CloudSync` (Firestore ⇄ LocalStorage). `estado` already holds `transacciones[]`, `categoryMappings`, `diagnostico`, `importHistory`, `fuenteFinanciera`, `fintoc`.

**Decision:** keep the single-document model for v1 and add two things inside `estado`:

- `estado.importSessions: ImportSession[]` — lightweight metadata per import (evolves the current `importHistory`).
- provenance fields on each object in `estado.transacciones` (see §4).

Why not subcollections now? A `startups/{uid}/transactions/{id}` subcollection is the "correct" long-term shape, but it forces a rewrite of `CloudSync`, the offline/LocalStorage story, and `hidratar` — days of work and risk, for a founder-scale dataset that fits comfortably in one document. We take the **additive** path now and document the subcollection migration as the single, well-understood V2 change (see §9). Because Firestore is schemaless, adding these fields is **not** a schema migration on the DB side.

---

## 3. `ImportSession` schema

```ts
type ImportSource = 'manual' | 'fintoc' | 'demo' | 'legacy';
type ImportStatus = 'draft' | 'approved' | 'discarded';

interface ImportSession {
  importId:    string;        // stable unique id: `imp-<base36(time)>-<base36(rand)>`
  filename:    string;        // "Cartola_Mayo.pdf" | "Fintoc: Banco de Chile" | "Datos previos"
  source:      ImportSource;  // how it entered the system
  status:      ImportStatus;  // lifecycle (see §6)
  createdAt:   string;        // ISO — when the import was parsed/started
  approvedAt:  string | null; // ISO — when committed to accounting (null while draft)

  // Context detected by the import pipeline (all optional / best-effort):
  institution: string | null;             // "Banco de Chile"
  account:     string | null;             // masked, e.g. "••6789"
  period:      { desde: string; hasta: string } | null; // ISO min/max tx date
  fileType:    'csv' | 'excel' | 'pdf' | 'pdf-escaneado' | null;
  docHash:     string | null;             // content fingerprint for dedup

  // Counts from the pipeline diagnostics (for the review header + audit):
  counts:      { parsed: number; imported: number; duplicates: number; review: number };

  // Denormalized financial summary (refinement 3) so the import history is
  // useful without recomputing over all transactions. Totals are in CLP.
  summary:     ImportSummary;

  schemaVersion: 1;           // lets us evolve safely later
}

interface ImportSummary {
  transactions: number;               // committed transaction count
  income:       number;               // sum of positive amounts
  expenses:     number;               // sum of |negative amounts|
  net:          number;               // income − expenses
  byCategory:   { [categoryId: string]: number }; // signed totals keyed by STABLE id (§11)
}
```

Example:

```json
{
  "importId": "imp-lxq8f2-9a3k",
  "filename": "Cartola_Mayo.pdf",
  "source": "manual",
  "status": "approved",
  "createdAt": "2026-07-23T14:10:00.000Z",
  "approvedAt": "2026-07-23T14:12:30.000Z",
  "institution": "Banco de Chile",
  "account": "••6789",
  "period": { "desde": "2025-05-02", "hasta": "2025-05-28" },
  "fileType": "pdf",
  "docHash": "doc-1a2b3c",
  "counts": { "parsed": 32, "imported": 30, "duplicates": 2, "review": 3 },
  "summary": { "transactions": 30, "income": 750000, "expenses": 1089000, "net": -339000,
               "byCategory": { "revenue": 750000, "marketing": -60000, "rent": -400000, "taxes": -120000, "payroll": -500000, "shipping": -9000 } },
  "schemaVersion": 1
}
```

> **Reconciliation with `importHistory`.** `importSessions` **supersedes** the current `importHistory` (which already stores `hash`, `importadoEl`, `institucion`, `cuenta`, `periodo`, `transacciones` count). We evolve that record: add `importId`, `filename`, `source`, `status`, `counts`; keep `docHash`/`period`. Dedup then reads hashes from `importSessions` instead of a separate list. One structure, not two.

---

## 4. Transaction: provenance + preserved original categorization

Each object in `estado.transacciones` today is `{ id, fecha, monto, descripcion, categoria, tipo, confianza, source }`. We keep those legacy fields (backward compatible) and add three things: **provenance**, a stable **effective category id**, and the immutable **original** categorization.

**Note:** the legacy `source` means *categorization source* (`reglas`/`memoria`/`signo`) — provenance uses distinct names to avoid collision.

```ts
interface TransactionAdditions {
  // ── Provenance (denormalized — see decision below) ──────────────────
  importId:       string;        // FK → ImportSession.importId  (REQUIRED)
  importFilename: string;        // copy of the session filename
  importSource:   ImportSource;  // copy of the session source
  importedAt:     string | null; // ISO; null for legacy/backfilled rows

  // ── Effective (final) category, by STABLE id (§11) ──────────────────
  categoryId:     string;        // e.g. "marketing" — the CURRENT category
  // legacy `categoria` (display name) stays in sync for the existing UI/engine.

  // ── Original categorization (refinement 2 — IMMUTABLE) ──────────────
  original: {
    categoryId:  string;         // what the engine first decided
    confidence:  number;         // 0–100
    source:      'merchant' | 'rules' | 'memory' | 'sign' | 'ai';
    merchantId:  string | null;  // stable merchant id if matched
    merchant:    string | null;  // merchant display name
    reason:      string;         // human-readable explanation
  };

  // ── Edit audit (present only if the user changed the category) ──────
  edited?: {
    fromCategoryId: string;      // previous effective category
    at:             string;      // ISO timestamp of the edit
    by:             'user';      // future: userId / 'ai-retrain'
  };
}
```

**Why keep `original`:** once a user overrides a category, we must **not** lose what the engine decided. Preserving `original` (category, confidence, source, merchant, reason) enables debugging, categorization-accuracy analytics, future model/rule retraining, and full auditability. The **effective** category (`categoryId` / `categoria`) is what the Financial Engine reads; `original` is never mutated after import.

**Decision (confirmed): denormalize all four provenance fields** onto each transaction (not just `importId`). In a document/in-memory model there are no joins, so "filter by import", "show a row's origin", and "delete an import" are pure array operations that survive even if a session record is lost. Duplication cost at founder scale is negligible.

Resulting transaction:

```json
{
  "id": "tx-...", "fecha": "2025-05-05", "monto": -60000,
  "descripcion": "PAGO META ADS", "categoria": "Marketing", "categoryId": "marketing",
  "tipo": "egreso", "confianza": 96, "source": "reglas",
  "importId": "imp-lxq8f2-9a3k", "importFilename": "Cartola_Mayo.pdf",
  "importSource": "manual", "importedAt": "2026-07-23T14:12:30.000Z",
  "original": { "categoryId": "marketing", "confidence": 96, "source": "merchant",
                "merchantId": "meta-ads", "merchant": "Meta Ads",
                "reason": "Comercio reconocido: Meta Ads" }
}
```

If the founder later re-categorizes this row to `software`, we set `categoryId:"software"`, sync `categoria:"Software"`, add `edited:{ fromCategoryId:"marketing", at, by:"user" }`, and **leave `original` untouched**.

---

## 5. How transactions reference the session

A plain foreign key: `transaction.importId === importSession.importId`. There is no nesting — transactions stay in the flat `estado.transacciones` array they already live in. This keeps the Financial Engine (`transaccionesAMeses`, etc.) unchanged; it reads the same array.

---

## 6. Status lifecycle

```
        upload + parse + categorize
                    │
                    ▼
                 [draft] ───── discard ─────▶ [discarded]  (not persisted; dropped)
                    │
                approve
                    │
                    ▼
               [approved] ───── delete import ─────▶ (session + its tx removed)
```

- **draft**: lives only in the review UI (React state), **not** written to Firestore. Accounting ignores it entirely.
- **approved**: on Approve we (a) write the `ImportSession` with `status:'approved'` + `approvedAt`, and (b) stamp each kept transaction with provenance and append to `estado.transacciones`.
- **discarded**: user cancels the review → nothing persisted.

> **Draft persistence is intentionally out of scope for v1.** Because drafts are in-memory, closing the tab mid-review loses the draft — acceptable for v1 and far simpler/safer. If we later want "resume review," add a single `estado.draftSession` slot (one active draft) — additive, documented as a V1.1 enhancement.

---

## 7. Referential-integrity operations (pure, deterministic)

| Action | Effect |
|---|---|
| **Approve import** | push `ImportSession(status:approved)`; stamp + append its transactions to `estado.transacciones`; record `docHash` for dedup. |
| **Edit a category** | mutate `transaccion.categoria`; if user override, also write `categoryMappings` (learned forever, as today). Never touches the session. |
| **Delete a transaction** | remove by `tx.id`; decrement `session.counts.imported`. |
| **Delete an import** | remove the `ImportSession`; `transacciones = transacciones.filter(t => t.importId !== importId)`; remove its `docHash` so the file can be re-imported. |

All four are O(n) array operations over one in-memory document → instant, offline-safe, and trivially unit-testable.

---

## 8. Backfill for existing data (one-time, idempotent)

Founders already have `transacciones` from before this feature (no `importId`). On hydration we run a **one-time, idempotent** migration:

- Any transaction lacking `importId` → assign `importId:'imp-legacy'`, `importFilename:'Datos previos'`, `importSource: fuenteFinanciera || 'manual'`, `importedAt:null`.
- Ensure one `ImportSession { importId:'imp-legacy', status:'approved', filename:'Datos previos', … }` exists.

Idempotent because it only touches rows without `importId`; re-running is a no-op. Lives in `hidratar`/init so it applies on every device after CloudSync.

---

## 9. Firestore / CloudSync impact & scaling boundary

- **Structural impact: none.** Same document, same `CloudSync`, same LocalStorage mirror. We add fields; Firestore is schemaless, so **no rules change and no DB migration**. This is the whole point of choosing the additive model.
- **Serialization guardrail:** keep `ImportSession` free of nested arrays (Firestore rejects arrays-of-arrays — the bug we already hit with diagnosis stats). `counts` and `period` are flat objects → safe.
- **Known limit:** the `startups/{uid}` document must stay under Firestore's **1 MB**. Rough budget: a transaction ≈ 0.2–0.3 KB → ~3,000–4,000 transactions before we approach the limit. That's plenty for a piloting startup, but it **is** the ceiling.
- **V2 migration (documented, not now):** when volume approaches the limit, move `transacciones` (and optionally `importSessions`) to subcollections `startups/{uid}/transactions/{id}` and `…/imports/{importId}`. Because every transaction already carries `importId` + provenance, that migration is a straight copy — **no reshaping**, which is exactly what this design buys us.

---

## 10. Decisions (confirmed)

1. **Denormalize all four provenance fields onto each transaction.** ✅ Approved.
2. **In-memory drafts for v1**; persisted `draftSession` = documented V1.1. ✅ Approved.
3. **Evolve `importHistory` into `importSessions`** (one structure). ✅ Approved.

M2 implements exactly this: pipeline emits a `draft` session → review UI (edit category, delete row, resolve duplicates) → **Approve** commits session + provenance-stamped transactions (with preserved `original`); plus delete-transaction, delete-import, and the idempotent legacy backfill.

---

## 11. Stable identifiers (refinement 1)

Display names change; **IDs must not.** Both categories and merchants carry a stable slug id plus a mutable display name.

- **Categories** live in a registry `CATEGORY_REGISTRY = [{ id, name }]` (`categorize.js`). The id is the source of truth used everywhere data is stored or keyed: `transaction.categoryId`, `original.categoryId`, `ImportSummary.byCategory`, and `edited.fromCategoryId`. Display names (`Revenue`, `Marketing`, …) are looked up via `categoryName(id)` and may be renamed or localized freely without a data migration.

  | id | name |
  |----|------|
  | `revenue` | Revenue |
  | `marketplace` | Marketplace |
  | `marketing` | Marketing |
  | `shipping` | Shipping |
  | `inventory` | Inventory |
  | `payroll` | Payroll |
  | `rent` | Rent |
  | `utilities` | Utilities |
  | `software` | Software |
  | `taxes` | Taxes |
  | `bank_fees` | Bank Fees |
  | `transfers` | Transfers |
  | `owner_contributions` | Owner Contributions |
  | `loans` | Loans |
  | `other` | Other |

- **Merchants** in `merchants.js` carry a stable `id` (e.g. `aws`, `meta-ads`, `mercado-libre`). `transaction.original.merchantId` stores the id; the display name is denormalized alongside for convenience.

- **Legacy resolution.** `resolveCategoryId(value)` maps any historical label — English name, Spanish legacy label (`Ventas`→`revenue`, `Envíos`→`shipping`, …), or an id — back to a stable id, so pre-existing `categoryMappings` and stored categories keep working. Unknown values are handled gracefully (kept as-is; never silently dropped).

This is why `ImportSummary.byCategory` and all persisted fields key on **id**, never on the display string.

---

## 12. Future auditability: append-only event log (documented, not implemented)

The model is intentionally compatible with a future **append-only event log** without any reshaping. Today's operations (approve, edit, delete) are already discrete, deterministic state transitions — the exact shape events want.

When we add it (V2), we introduce an `estado.importEvents[]` (or a subcollection) of immutable records:

```ts
type ImportEvent =
  | { type: 'ImportCreated';   importId; at; source; filename }
  | { type: 'CategoryChanged'; importId; txId; fromCategoryId; toCategoryId; at; by }
  | { type: 'TransactionDeleted'; importId; txId; at; by }
  | { type: 'ImportCommitted'; importId; at; summary }
  | { type: 'ImportArchived';  importId; at; by };   // "delete import" becomes archive
```

Why the current design already supports it:

- Every mutating action maps 1:1 to an event (`Approve → ImportCommitted`, category edit → `CategoryChanged`, etc.), so we can emit events by instrumenting the same context actions M2 introduces — no data reshaping.
- Transactions already carry `importId` + `original`, so `CategoryChanged` events can be **reconstructed/verified** against `original.categoryId` and the current `categoryId`.
- "Delete import" can become "**archive**" (soft-delete) trivially: add `status:'archived'` to the session and filter archived transactions out of accounting, keeping the event trail intact.

**Not implemented now.** v1 keeps hard deletes for simplicity; the note exists so the next engineer knows the schema was chosen to make the event log a pure addition, not a rewrite.
