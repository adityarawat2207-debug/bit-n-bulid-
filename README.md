# CloudPulse

**An explainable cloud-cost investigation engine.** When the cloud bill jumps, CloudPulse finds the service that caused it, traces how the problem spread through the dependency graph, estimates what it costs, and recommends a fix. It also shows whether the fix would hurt latency or reliability.

Built for the hackathon problem *"The Cloud Bill Nobody Can Explain"*. It runs against a simulated e-commerce company, ShopX, so the whole workflow can be demonstrated without a paid cloud account. The spec is in `PRD — Cloud Cost Root-Cause Intelligence Platform.md`.

## How it works

```text
 ShopX simulator (10 services, 30 days of hourly cost + metrics, decoys in every scenario)
        │
        ▼
 Anomaly detection      daily cost > mean + 2σ of the previous 14 days (PRD §17)
        │
        ▼
 Root-cause engine      scores EVERY service on 5 signals, no hard-coded answer:
        │               0.30 temporal + 0.25 dependency + 0.20 own-metric change
        │               + 0.15 cost correlation + 0.10 historical evidence
        ├──────────────► Propagation   walks the graph along edges whose calls rose
        ├──────────────► Attribution   pushes each node's extra cost back to the callers
        │                              that sent the extra load ("estimated impact")
        └──────────────► Trade-off     re-runs the same system model with a fix applied:
                                       cost, latency, error rate, DB CPU → verdict
        │
        ▼
 AI explanation         restates the engine's JSON; any number not in the analysis
                        is rejected and the template is used instead
        │
        ▼
 Next.js dashboard      overview · incident analysis · simulator
```

What separates the cause from its victims is that the engine only credits **behaviour that starts at a service**: its own user demand, its calls per request to each dependency, or (for the database) CPU per unit of work. A database that is simply being hammered by a caller scores near zero on that signal, even though its cost rises the most.

| Scenario | Likely root cause | Decoy the engine must ignore |
|---|---|---|
| Search Query Explosion | search-service (queries/request 1.2 → 4.8 after the v2.0 deploy) | database has the most incident history |
| Traffic Spike | image-service (+340% traffic) | an unrelated search-service deploy 2h earlier |
| Database Overload | order-service (N+1 queries after the v3.0 deploy) | search traffic +10% at the same time |

The tests check that each scenario's root cause wins by a margin of at least 0.15 on 20 random seeds, and that the healthy baseline never raises an incident.

## Run locally

Backend (Python 3.12+):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload        # http://localhost:8000/api/v1, docs at /docs
.venv/bin/pytest -q                             # 112 tests
```

Frontend (Node 20+):

```bash
cd frontend
npm install
npm run dev                                     # http://localhost:3000
```

The frontend calls `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). If the backend is unreachable or takes longer than 10s, it falls back to saved responses in `frontend/public/mocks/` and shows an "offline data" badge. Set `NEXT_PUBLIC_MOCK=1` to use only the mocks. After any engine change, regenerate them with `cd backend && .venv/bin/python -m scripts.export_mocks`.

AI explanations are optional. Set `ANTHROPIC_API_KEY` on the backend to enable them. Without it, the app uses a deterministic template and everything else works the same.

## Deploy (free tiers)

Everything runs on Vercel's free plan as three projects. Every push to the `varun's` branch redeploys all three through `.github/workflows/deploy.yml`:

| Project | Folder | Live URL |
|---|---|---|
| `cloudpulse` (Next.js) | `frontend/` | https://cloudpulse-indol.vercel.app |
| `cloudpulse-api` (FastAPI, serverless) | `backend/` | https://cloudpulse-api.vercel.app/api/v1/health |
| `shopx-store` (FastAPI, serverless) | `store/` | https://shopx-store-kappa.vercel.app |

1. **Backend:** the `cloudpulse-api` project is deployed from `backend/` with `npx vercel deploy --prod` (Vercel's git integration isn't used; the workflow above deploys it). Vercel detects FastAPI from `app/main.py`. Check `https://cloudpulse-api.vercel.app/api/v1/overview?scenario=baseline`.
2. **Frontend:** the `cloudpulse` project has `NEXT_PUBLIC_API_URL=https://cloudpulse-api.vercel.app` and is deployed from `frontend/` with `npx vercel deploy --prod`. The variable is read at build time, so redeploy after changing it.
3. **Store:** the `shopx-store` project has `CLOUDPULSE_URL=https://cloudpulse-api.vercel.app`. The backend keeps the store's telemetry in a Supabase table (`SUPABASE_URL`, `SUPABASE_KEY`; schema in `docs/live-telemetry.sql`), because serverless instances share no memory. A daily Vercel cron (`backend/vercel.json`) reads `/api/v1/live` so the free Supabase project never pauses for inactivity.
4. The backend is stateless and doesn't sleep. The first request after a quiet spell is a cold start of a second or two; warm requests take about 0.4s.

`render.yaml` and `backend/Dockerfile` are kept as a fallback (Render, Railway or Fly) if Vercel is unavailable.

## API

Stateless: every call names a scenario, and the backend regenerates and reanalyses it in about 40ms. Full contract: `docs/api-contract.md`.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/scenarios` | the 4 scenarios |
| `GET /api/v1/overview?scenario=` | KPIs, hourly and daily cost, breakdown, per-service cost |
| `GET /api/v1/incident?scenario=` | root cause, candidates with reasons, graph, timeline, impact, 3 recommendations |
| `POST /api/v1/whatif` | simulate one action: `fix_amplification`, `rate_limit` or `reduce_capacity` |
| `POST /api/v1/explain` | natural-language explanation (`source`: `llm` or `template`) |

## Live storefront

`store/` is a real, small ShopX shop (FastAPI + SQLite). Its search-service v2.0 has an N+1 query bug: it fetches the matching ids, then loads each product with its own query. Every request reports the queries it really ran to `POST /api/v1/telemetry`. The **Live storefront** scenario turns the latest 50 searches into the search → database queries-per-request ratio and replays it at ShopX's production volume, so the engine analyses real behaviour.

To try it: open the store, search for anything (for example "running shoes"), then open the dashboard's Live storefront scenario. Within a few seconds it shows the cost anomaly with search-service as the likely root cause. "Clear telemetry" on the dashboard resets it for everyone. Run the store locally with `store/run.sh` (port 8100, reports to `http://localhost:8000`).

## Demo

The full 3-minute script with timings and judge Q&A is in [`docs/demo-script.md`](docs/demo-script.md). In short: start healthy on the Overview, trigger **Search Query Explosion**, and watch the cost climb +36%. Then open the incident: search-service is the likely root cause at 95% root-cause confidence, and the database is ruled out as a victim. Show the estimated impact and the recommended fix. Finally, show that "Reduce database capacity 25%" is rejected on latency, errors and DB CPU, then **Reset to baseline**.

## Repo layout

```text
backend/    FastAPI + NumPy: simulator/, engine/, ai/, app/, tests/ (details in backend/README.md)
frontend/   Next.js 16 + Tailwind + React Flow + Recharts
docs/       API contract
TASKS.md    build checklist
```
