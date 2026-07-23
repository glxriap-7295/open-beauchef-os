# Developer Setup

## Prerequisites
- Node.js 18+ and npm.
- (Optional) [Ollama](https://ollama.com) for local AI wording.
- (Optional) A Firebase project for auth + cloud sync.
- (Optional) A Fintoc account for Open Banking.

## Install & run
```bash
npm install
cp .env.example .env      # optional; the app runs in demo mode with no env at all
npm run dev               # http://localhost:5173
npm run build            # production build
npm run preview          # serve the build
npm test                 # regression suite (Node ESM, no browser)
```
The app is fully functional with **no configuration** (demo dataset, LocalStorage persistence, mock AI). Each integration below is opt-in.

## Environment variables (all optional, `VITE_` prefix = exposed to the browser)

| Var | Purpose |
|---|---|
| `VITE_AI_PROVIDER` | `ollama` (default) · `claude` · `mock`. |
| `VITE_OLLAMA_URL`, `VITE_OLLAMA_MODEL` | Local Ollama endpoint + model. |
| `VITE_AUTH_PROVIDER` | `local` (default) · `firebase`. |
| `VITE_FIREBASE_*` | Firebase web config (apiKey, authDomain, projectId, …). |
| `VITE_PERSISTENCE` | `local` (default) · `firebase`. |
| `VITE_NOTIFY_PROVIDER` | `browser` (default) · `fcm` (see caveat). |
| `VITE_FINTOC_ENABLED`, `VITE_FINTOC_PUBLIC_KEY`, `VITE_FINTOC_LINK_ENDPOINT` | Open Banking (frontend). |

**Server-only (no `VITE_` prefix, set in Vercel env):**
| Var | Purpose |
|---|---|
| `FINTOC_SECRET_KEY` | Fintoc secret — **server only**, never in the frontend. |
| `FIREBASE_VAPID_KEY` / FCM config | Only if enabling push (V1.1). |

## AI (Ollama) — local wording layer
1. Install Ollama and pull a model (e.g. `ollama pull llama3.1`).
2. Set `VITE_AI_PROVIDER=ollama`, `VITE_OLLAMA_MODEL=llama3.1`.
Without Ollama, the app uses deterministic explanations (it never breaks). The AI **only rewrites** verified insights (see `AI_Architecture.md`).

## Firebase (auth + cloud sync) — opt-in
1. Create a Firebase project; enable Email/Password auth and Firestore.
2. Fill `VITE_FIREBASE_*` and set `VITE_AUTH_PROVIDER=firebase`, `VITE_PERSISTENCE=firebase`.
3. Firestore data lives in `startups/{uid}` (one document). Suggested rule: a user may read/write only their own doc. See `docs/` and the existing rules notes.

## Fintoc (Open Banking) — opt-in, best-effort
- Frontend: `VITE_FINTOC_ENABLED=true`, `VITE_FINTOC_PUBLIC_KEY=pk_...`, `VITE_FINTOC_LINK_ENDPOINT=/api/fintoc`.
- Server (Vercel): `FINTOC_SECRET_KEY=sk_...`. The serverless functions in `api/fintoc/` call Fintoc with the secret key, which never touches the browser.
- If any credential is missing, the app silently offers Manual Upload.

## Deploy (Vercel)
1. Import the repo (Vite auto-detected).
2. Set the env vars you want to enable.
3. Deploy. `vercel.json` includes the SPA rewrite so routes work on refresh.

## Sandbox note (important for whoever ran this in a cloud sandbox)
This repo was developed under a OneDrive-synced folder. In that specific setup, freshly-edited files sometimes reached a Linux sandbox **truncated** (sync lag), which makes `node`/build read partial files. On a normal local checkout this does not happen. Always run `npm run build` and `npm test` on a real checkout before shipping.
