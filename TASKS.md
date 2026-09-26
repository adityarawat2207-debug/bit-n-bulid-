# CloudPulse Build Tasks (24h)

**One person builds all of it.** The A/B/C letters are kept only as task IDs. Tracks A, B and C connect only through the JSON in `docs/api-contract.md`:
- **A**: backend and engine
- **B**: dashboard and incident pages
- **C**: dependency graph, recommendations, and the demo

**Status:** everything that can be built locally is done. What's left:
1. **A7: deploy.** Create the Render service from `render.yaml` and the Vercel project with root `frontend`. Both need you to log in.
2. **C6: run the QA path on the deployed URLs.**
3. **C7: record the video.**

Tick a box when its **Done when** is true, not when the code merely exists.

## Milestones

| Hour | Milestone | Owner |
|---|---|---|
| H1 | API contract frozen; renames after this need both sides to agree | A + C |
| H3 | Engine ported, and `pytest` passes for all 3 scenarios and the baseline | A |
| H8 | **Integration 1**: the local frontend renders the real `/overview` and `/incident` | All |
| H13 | Backend deployed; the frontend uses the deployed API | A |
| H16 | **Feature freeze**: every P0 and P1 item works end to end | All |
| H20 | **Code freeze**: bug fixes only | All |
| H24 | Submitted: deployed URL, README, video | C |

At every milestone, stop for 10 minutes. Run the demo path from PRD §54, then re-plan. If you are behind, cut in this order:
1. C5 (simulator page); move its buttons onto the dashboard
2. B5 (replay animation)
3. A8 (number tuning)
4. The LLM half of A6; the template stays

Never cut a P0 item (PRD §56).

---

## Track A: Backend and engine

- [x] **A1 · H0–1 · Backend scaffold**
  - Build: `backend/app/main.py` (FastAPI, CORS open, `/api/v1/health`) and `requirements.txt` listing fastapi, uvicorn, numpy, pytest and httpx. No pandas or networkx.
  - Done when: `uvicorn app.main:app --reload` returns `{"ok": true}` from `/api/v1/health`.
- [x] **A2 · H1–3 · Port the prototype engine**
  - Build: copy `model.py` into `backend/simulator/` and add the `baseline` scenario. Split `engine.py` into `backend/engine/` modules:
    - `anomaly.py`
    - `root_cause.py`
    - `attribution.py`
    - `propagation.py`
    - `tradeoff.py`
  - Done when:
    - `pytest` asserts the correct root cause with a margin of at least 0.15 for each of the 3 scenarios, on seeds 1–20.
    - `baseline` returns no incident.
    - `search-service` appears nowhere in `engine/` (CLAUDE.md rule).
- [x] **A3 · H3–5 · `GET /scenarios` and `GET /overview`**
  - Done when: the response matches the contract for all 4 scenarios.
    - Baseline KPIs read about $10,240.
    - `daily` marks the anomalous days.
    - `breakdown` sums to `current_monthly`.
- [x] **A4 · H5–8 · `GET /incident`**
  - Build: the incident response from the contract:
    - root cause
    - evidence strings
    - `why_not` for each candidate
    - graph node states
    - timeline from each service's onset hour plus deployments
    - impact
    - 3 recommendations with risk
  - Done when: all 3 scenarios return the full shape, and baseline returns `{"incident": null}`.
- [x] **A5 · H8–9 · `POST /whatif`**
  - Build: support the 3 action types.
  - Done when:
    - `reduce_capacity 0.75` is NOT RECOMMENDED in `search_query_explosion` and `database_overload`.
    - The same action is RECOMMENDED in `traffic_spike`.
- [x] **A6 · H9–11 · `POST /explain`**
  - Build: `backend/ai/explainer.py` with:
    - a template built from `/incident`
    - an optional LLM call, used only if the key env var is set
    - an 8s timeout that falls back to the template
    - the prompt from PRD §52
  - Done when:
    - With no key it returns `source: "template"`.
    - It never states a number that isn't in the incident JSON.
- [ ] **A7 · H11–13 · Deploy the backend**
  - Build: deploy to a free tier (Render, Railway or Fly). No paid services (PRD §53).
  - Done when: the public URL serves `/overview?scenario=baseline`.
  - Prepared: `render.yaml` (Render blueprint, free plan) and `backend/Dockerfile` (Railway/Fly). Remaining: create the service in a free account and set `NEXT_PUBLIC_API_URL` on the frontend.
- [x] **A8 · H16–18 · Tune the numbers**
  - Build: adjust the cost coefficients so the Search incident lands at about +35% (PRD §11).
  - Done: the database budget is now mostly I/O-billed (`DB_CAPACITY_COST, DB_IO_COST = 1100, 1700`, same $2,800 total), so DB cost tracks load. Values: search_query_explosion +36.1%, traffic_spike +25.2%, database_overload +27.4% (PRD §11 table: +36%; §33: +28%). Mocks regenerated.
  - Done when: A2's tests still pass and the demo numbers match what the script says.
- [ ] **A9 · H18–20 · Bug fixes from C6; backend README section**
  - Build: fix what C6's bug list turns up, and write the backend part of the README (run, test and deploy commands).
  - README done: `backend/README.md`. Bug fixes wait on C6.

## Track B: Pages

- [x] **B1 · H0–2 · Frontend scaffold**
  - Build:
    - `frontend/` with Next.js App Router, TypeScript and Tailwind
    - a nav with Dashboard and Incident links
    - `lib/api.ts`, which reads `NEXT_PUBLIC_API_URL`, or `/public/mocks/*.json` when `NEXT_PUBLIC_MOCK=1`
  - Done when: `npm run dev` shows the layout, and the API client returns the mock overview.
  - Done: Next.js 16 (App Router, TS, Tailwind 4), a nav (Overview, Incident, Simulator), and `lib/api.ts` with a live→mock fallback and a 10s timeout.
- [x] **B2 · H2–3 · Mock JSON**
  - Done: `frontend/public/mocks/` holds real responses for every endpoint and all 4 scenarios, generated by `backend/scripts/export_mocks.py`. Regenerate them after engine changes instead of editing by hand.
- [x] **B3 · H3–8 · Dashboard `/`**
  - Build:
    - KPI cards (PRD §14)
    - a Recharts cost chart with the baseline line and anomaly markers (§15)
    - the breakdown by category and the service table (§16)
    - scenario trigger buttons and **Reset to baseline**, which set `?scenario=`
    - an active-incident banner that links to the incident page
  - Done when: every Dashboard and Simulation checkbox in PRD §53 passes on mocks.
  - Done: KPI cards, the hourly run-rate chart with a baseline line and onset marker, the 30-day chart with anomalous days in red, the breakdown and service tables, scenario triggers plus Reset, the incident banner, and the graph.
- [x] **B4 · H8–13 · Incident page `/incidents/[id]`**
  - Build:
    - the header (severity, onset, cost change)
    - a root-cause card showing the confidence and 5 factor bars
    - the candidate list with `why_not`
    - the evidence list
    - the estimated impact breakdown
    - an AI explanation panel with a "template/AI" badge
    - slots for C2, C3 and C4
  - Done when: every Analysis checkbox in PRD §53 passes against the real API.
  - Done: `components/IncidentView.tsx`.
- [x] **B5 · H13–16 · Cost replay animation, and switch fully to the real API**
  - Build: when a scenario is triggered, the chart replays the last 48 hourly points over about 5s.
  - Done when: PRD §54 step 5, "watch the cost increase", is visible.
  - Done: the replay starts 6h before onset and draws to now over about 6s, on a fixed axis. It is triggered from the dashboard buttons or the simulator's "Watch on dashboard" link (`?replay=1`).
- [x] **B6 · H16–20 · Polish**
  - Build:
    - loading skeletons and API error states
    - responsive layout
    - a wording check: "Root-cause confidence" and "Estimated impact", never "probability" or "exact"
  - Done: skeletons, error box, offline badge, a check at phone width, and the wording ("Root-cause confidence", "Estimated impact").

## Track C: Graph, recommendations, demo

- [x] **C1 · H0–1 · Write the API contract with A**
  - Build: finish `docs/api-contract.md` and freeze it.
- [x] **C2 · H1–7 · `DependencyGraph` component**
  - Build:
    - React Flow with a hard-coded x/y map for the 10 nodes (no auto-layout)
    - node colour by state: root, affected or normal
    - edge labels showing the calls change %
    - animated edges when `on_propagation_path` is true
  - Done when: it renders from mock `/incident` and from mock baseline (all nodes normal). It is used on both pages.
- [x] **C3 · H7–9 · `Timeline` component**
  - Build: a vertical timeline from `timeline[]` (PRD §48).
- [x] **C4 · H9–13 · Recommendations and what-if panel**
  - Build:
    - a card for each recommendation: savings, latency, error rate, risk, verdict, and the reasons it was accepted or rejected
    - a "Simulate" button that calls `/whatif`
    - a before/after comparison
  - Done when: every Recommendation checkbox in PRD §53 passes, and the "reduce DB capacity" card shows its rejection reasons (PRD §34).
  - Done: 3 cards (savings, latency, reliability, DB CPU, risk, confidence, rejection reasons, before→after cost), plus a live what-if panel (capacity slider, rate-limit, fix edge) that calls `/whatif`.
- [x] **C5 · H13–16 · `/simulator` page**
  - Build: scenario cards and reset. If time runs out, fold this into the dashboard.
- [ ] **C6 · H16–20 · End-to-end QA**
  - Build: run the PRD §54 path for all 3 scenarios, plus a reset, on the deployed URLs. File each bug with its owner's track letter.
  - Done when: 3 clean runs in a row with nobody touching the database or code.
- [ ] **C7 · H20–24 · Submission**
  - Build: the demo script (PRD §58, with judge Q&A from §59), the recorded video, and the top-level README with its architecture diagram.
  - Demo script and Q&A done: `docs/demo-script.md`. Remaining: the video and the top-level README.

---

## Who depends on whom

- A2 → A3/A4 → A7 is the only backend chain. Everything in B and C runs on mocks until **H8**.
- C4's "Simulate" button needs A5 by H9. Until then it reads the precomputed `recommendations[]`.
- B4 and C4 need A6 by H11. Until then the AI panel shows a static template string.
