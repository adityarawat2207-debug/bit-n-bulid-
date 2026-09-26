# CloudPulse API (backend)

FastAPI service that simulates ShopX, detects the cost anomaly, scores root-cause
candidates and simulates fixes. It is stateless: every endpoint takes
`?scenario=` and regenerates 30 days of hourly data on each request (~0.06s).
There is no database. The API contract is `../docs/api-contract.md`.

## Run

Python 3.12+.

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

- API: `http://localhost:8000/api/v1` (`/health`, `/scenarios`, `/overview`, `/incident`, `/whatif`, `/explain`)
- Interactive docs: `http://localhost:8000/docs`
- Scenarios: `baseline`, `search_query_explosion`, `traffic_spike`, `database_overload`. "Reset" = `scenario=baseline`.

Optional LLM explanations: set `ANTHROPIC_API_KEY` (and optionally
`CLOUDPULSE_LLM_MODEL`). Without it, or if the call fails, takes longer than
8s, or states a number not in the incident JSON, `/explain` returns the
deterministic template (`source: "template"`).

## Test

```bash
.venv/bin/pytest -q                                   # all tests
.venv/bin/pytest -q tests/test_api.py::test_incident_shape   # one test
```

The engine tests require the correct root cause with a margin of at least 0.15
on seeds 1–20 for every scenario, with each scenario's decoy active, and check
that no engine module names `search-service`.

## Frontend mocks

After any engine, cost-model or contract change, regenerate the mock JSON the
frontend builds against (never edit it by hand):

```bash
.venv/bin/python -m scripts.export_mocks
```

## Deploy (free tier)

- **Render**: the repo root has `render.yaml`. In Render, choose New → Blueprint
  and pick this repo. It builds from `backend/` and health-checks `/api/v1/health`.
- **Railway / Fly**: use `backend/Dockerfile` (it listens on `$PORT`).

Then point the frontend at it with
`NEXT_PUBLIC_API_URL=https://<your-api-host>` (no `/api/v1` suffix).
Free Render instances sleep when idle, so open `/api/v1/health` a minute before
the demo. If the API is unreachable, the frontend falls back to the mocks.

## Layout

| Path | What it does |
|---|---|
| `simulator/model.py` | ShopX model: dependency edges, `steady_state()`, cost model calibrated to $10,240/mo, scenarios and their decoys, hourly `generate()` |
| `engine/` | `anomaly` → `root_cause` → `attribution` → `propagation` → `tradeoff`, run in order by `pipeline.py` |
| `app/views.py` | Turns engine output into the contract's JSON |
| `app/main.py` | FastAPI routes under `/api/v1` |
| `ai/explainer.py` | Template explanation and optional LLM rewrite (PRD §52) |
| `scripts/export_mocks.py` | Writes `frontend/public/mocks/*.json` |

## Demo numbers (monthly run-rate)

| Scenario | Cost change | DB CPU | Expected root cause |
|---|---|---|---|
| `search_query_explosion` | ≈ +36% (~$10.3k → ~$14.0k) | 87% | search-service |
| `traffic_spike` | ≈ +25% | 42% | image-service |
| `database_overload` | ≈ +27% | 96% | order-service |

Exact values are in `frontend/public/mocks/overview.<scenario>.json`.
