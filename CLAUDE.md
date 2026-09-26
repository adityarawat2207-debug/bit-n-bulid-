# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

The backend (`backend/`) and the frontend (`frontend/`) are both built and working end to end. What remains is deployment, QA on the deployed URLs, and the demo video (see `TASKS.md`). The user builds this alone, so don't split work by teammate. The task plan is `TASKS.md` and the API contract is `docs/api-contract.md`. The product spec is `PRD — Cloud Cost Root-Cause Intelligence Platform.md`, which is the spec for **CloudPulse**, a 24-hour hackathon MVP for the problem "The Cloud Bill Nobody Can Explain". Read the relevant PRD section before building a module. It is numbered, so cite sections as "PRD §N".

## Commands

Backend (run from `backend/`; Python 3.12+):

- Setup: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
- Run: `.venv/bin/uvicorn app.main:app --reload` (API at `http://localhost:8000/api/v1`, docs at `/docs`)
- Test: `.venv/bin/pytest -q`; one test: `.venv/bin/pytest -q tests/test_api.py::test_incident_shape`
- Regenerate frontend mocks after any engine or contract change: `.venv/bin/python -m scripts.export_mocks`
- Optional LLM explanations: set `ANTHROPIC_API_KEY` (and optionally `CLOUDPULSE_LLM_MODEL`). Without it the template is used.

Frontend (run from `frontend/`; Node 20+). It is **Next.js 16**: read `frontend/AGENTS.md` and the bundled docs in `node_modules/next/dist/docs/` before using Next APIs. Route `params` are Promises, and components that call `useSearchParams` need a `<Suspense>` boundary.

- Setup: `npm install`
- Run: `npm run dev` (http://localhost:3000). It calls `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`) and falls back to `public/mocks/` if that fails or takes more than 10s. `NEXT_PUBLIC_MOCK=1` uses only the mocks.
- Lint: `npm run lint`. The React Compiler rules reject synchronous `setState` inside effects; derive state from keys instead (see `useApi` in `lib/hooks.ts`).
- Build and type-check: `npm run build`. `PageProps`/`LayoutProps` types are generated here, so a bare `tsc` fails before the first build.

Deploy: `render.yaml` (backend, Render free plan) and Vercel for `frontend/` with `NEXT_PUBLIC_API_URL` set; see `README.md`.

## What the product does

CloudPulse runs against a **simulated** cloud environment for a fictional e-commerce company, ShopX (PRD §9–10). When a simulated incident causes a cost spike, it detects the anomaly and scores candidate root-cause services. It then traces how the problem spread through the dependency graph, estimates the cost impact, and recommends a fix. For each fix it simulates the cost vs. latency/reliability trade-off. The main demo is "Search Query Amplification" (PRD §11, §31, §58).

## Planned architecture (PRD §43–44, reduced for 24h; see TASKS.md)

Work is split into tracks A, B and C in `TASKS.md`. Frontend and backend connect only through `docs/api-contract.md`. Change that file only when both sides agree.

- **Stateless backend, no database.** Every endpoint takes `?scenario=`. The backend regenerates 30 days of data and reanalyses it on each request (about 0.06s). "Reset" means switching to `scenario=baseline`. This replaces the §37 schema and SQLite/Supabase for the MVP.
- **backend/**: Python FastAPI under `/api/v1`, using only NumPy (no Pandas or NetworkX). There are 5 endpoints instead of the 11 in §38: `/scenarios`, `/overview`, `/incident`, `/whatif`, `/explain`.
  - `simulator/`: the ShopX model and the hourly data generator. One `steady_state()` model feeds both the generator and the what-if simulator, so a simulated fix stays consistent with the data the engine analysed.
  - `engine/`: `anomaly` → `root_cause` → `attribution` → `propagation` → `tradeoff`.
  - `ai/explainer.py`: a template explanation, plus an optional LLM call with an 8s timeout. It falls back to the template when there is no API key.
- **frontend/**: Next.js 16 (App Router) + TypeScript + Tailwind 4, React Flow (`@xyflow/react`) and Recharts. There are 3 pages instead of 7: `/` (dashboard, scenario trigger and cost replay), `/incidents/[id]` (the id is the scenario id) and `/simulator`. The scenario lives in the URL (`?scenario=`, or the path on incident pages; see `useScenario`). Pages are thin server wrappers around client components in `components/`, and all API access goes through `lib/api.ts`. The dependency graph uses a hard-coded node layout in `components/DependencyGraph.tsx`.
- `backend/engine/pipeline.py` runs the stages in order; `backend/app/views.py` turns engine output into the contract's JSON. Engine modules must not name specific services (a test enforces this for `search-service`); scenario answer keys live only in `simulator/model.py` for tests.

## Engine design decisions (validated in the prototype)

These are what let the engine tell the cause of a cost spike from its victims without hard-coding service names:

- **Metric factor.** Only behaviour that starts at the service counts. For a service, that means its own user demand plus calls per request on each outbound edge. For the database, it means CPU per unit of expected work. A service that only receives extra load from its callers scores about 0.
- **Temporal factor.** Score = onset alignment × (0.6 + 0.4 if the service was deployed ≤3h before its *own* onset). A deploy with no behaviour change scores 0.
- **Dependency factor.** A service's share of the total cost increase, found by passing each node's Δcost back up to its callers in proportion to the extra calls each one sent. The same pass produces the "Estimated impact" breakdown.
- **Anomalies.** Only an anomalous run that reaches the latest day counts as an active incident. Older flagged days, such as the day-15 analytics batch decoy, are history.
- **Trade-off limits.** A fix is NOT RECOMMENDED if latency rises more than 10%, errors rise more than 0.5pp, or DB CPU exceeds 85%. Database latency is modelled as `4/(1-ρ)`.
- **Money.** Always shown as a monthly run-rate. The baseline is calibrated to PRD §16 ($10,240).
- **Decoys.** Every scenario includes one, and the tests must keep passing with it. The tests require the correct root cause with a margin of at least 0.15 on seeds 1–20.

## Rules the implementation must follow

- **Evidence first, AI second.** The deterministic engine decides the root cause. The AI only explains the engine's structured output, must never invent metrics, costs, services, or dependencies, and must never override the engine. The whole app must work with AI disabled. The prompt contract is in §52.
- **Root-cause scoring (§22–23):** score every candidate service; never hard-code `search-service`. Use this weighted sum: `0.30·temporal + 0.25·dependency + 0.20·metric + 0.15·cost + 0.10·historical`, normalized to 0–1.
- **Anomaly rule (§17):** `current > mean + 2·std` over the previous 14 days. Also compute percentage change against the baseline.
- **UI wording:** label the score "Root-cause confidence", never a causal probability. Label cost attribution "Estimated impact", never exact accounting.
- **Demo requirements (§53):** at least 3 working scenarios, the ability to reset to baseline, no manual DB edits during the demo, and no paid external services.
- **Scope:** follow the priorities in §56 (P0 before P1 before P2). Do not build auth, billing, real cloud integrations, Kubernetes, Terraform, or automatic remediation (§5, §57).
