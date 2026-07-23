# AI Architecture

> Principle: **AI is built on top of the accounting engine, never instead of it.** The AI never discovers financial facts; it only explains verified ones.

## 1. The rule

```
Transactions → Accounting Engine → ACCOUNTING_MAP → Verified Financial Summary
            → Deterministic Metrics → Insight Engine → Ollama → Natural-language explanation
```

NOT `Transactions → Ollama → Financial conclusions`. Ollama never sees raw transactions and never produces a number, id, or severity.

## 2. Where AI is (and isn't) used

| Stage | AI? | Guardrail |
|---|---|---|
| Parsing / normalization | **No** | Fully deterministic (`extractor`, `manualProvider`). |
| Merchant recognition | **No** | Data-driven (`merchants.js`). |
| Categorization | **Only if confidence < threshold** | AI picks from the fixed category list; result is capped and marked `source:'ai'`; the deterministic `original` is preserved. |
| Business understanding | Optional enrich | Falls back to a heuristic; never blocks import. |
| **Facts / metrics / statements** | **No** | 100% deterministic (`accountingMap`, `calculations`, `insightEngine`). |
| **Insight wording** | **Yes — rewrite only** | `insightNarrator` accepts only the `explanation` text; `value/severity/metric/id` are immutable. |

## 3. Provider abstraction (`services/ai/index.js`)

`getAIProvider()` returns a `SmartProvider` chosen by `VITE_AI_PROVIDER` (default `ollama`), with automatic fallback to a `mock` on any error. Adding OpenAI/Claude/Gemini/Azure = implement the same interface (`json`, `chat`, …) and register it — **zero business-logic changes**. Ollama is the default because it's free, local and has no API cost.

Every AI call goes through `ai.json(prompt)`, which returns parsed JSON or `null`. Callers must treat `null` (and malformed output) as "AI unavailable" and use the deterministic result.

## 4. The Insight Engine (`insightEngine.js`)

`computeInsights(transacciones)` → an array of **structured** observations, computed from the accounting summary and monthly P&L. Each is:

```ts
{ id, severity: 'info'|'warning'|'critical', metric, value, title, explanation, data? }
```

Observations include: revenue MoM, expense change by category, top expense categories, largest merchants, recurring subscriptions, cash burn, gross margin, EBITDA trend, unusual transactions, missing categorization, excessive "Other", data-quality warnings. `explanation` is a founder-ready Spanish sentence with **real numbers** — it works with AI off.

Because insights read the same `ACCOUNTING_MAP`, transfers/loans/owner contributions can never appear in any insight figure.

## 5. The Narrator (`insightNarrator.js`) — rewrite-only

- `narrarInsights(insights)`: sends only `{id, title, explanation}` to Ollama and asks it to rewrite the wording. It merges back **only** the `explanation` for matching ids; hallucinated fields/new items are ignored. On any failure → returns the deterministic insights unchanged.
- `narrarResumen(insights)`: writes a 3–4 sentence diagnosis from the top insights' verified explanations. Deterministic fallback = the concatenated explanations.

`generarDiagnostico()` is now insight-driven: compute facts → narrate. The dashboard shows **deterministic** insight cards directly (always correct); the diagnosis banner shows the narrated summary.

## 6. Learning (user memory)

Founder category corrections are stored by stable `categoryId` in `categoryMappings` (keyed by a stable description key). Memory is checked **before** rules and AI, so a correction is honored forever and reduces future AI calls.

## 7. Failure posture

Every AI touchpoint degrades gracefully: categorization → rules; business model → heuristic; insight wording → deterministic text; diagnosis → deterministic narrative. There is no code path where an AI failure produces a wrong number, because AI never produces numbers.
