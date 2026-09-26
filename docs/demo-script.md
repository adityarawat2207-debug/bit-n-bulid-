# CloudPulse Demo Script (TASKS.md C7)

A 3-minute live demo that follows the PRD §54 judge path, built around the single "wow" sequence from PRD §58. All numbers below come from `frontend/public/mocks/` (generated from the engine). Re-check them after any engine change with `cd backend && .venv/bin/python -m scripts.export_mocks`.

Wording rules for the presenter, same as the UI: say **"root-cause confidence"**, never "probability". Say **"estimated impact"**, never "exact cost".

---

## Before you go on stage

- [ ] Open https://cloudpulse-api.vercel.app/api/v1/health about a minute before, so the first demo request isn't a serverless cold start.
- [ ] Open the app on the dashboard with `?scenario=baseline`.
- [ ] Have a second tab ready at `/incidents/search_query_explosion` in case a click fails.
- [ ] If the API is down, the frontend falls back to the mocks automatically. The numbers are identical, and only custom what-if values need the live API.
- [ ] Browser zoom set so the dependency graph fits without scrolling.

---

## The script (about 3:00)

### 0:00–0:20 · The problem

> "Every engineering team gets this message: *the cloud bill went up 36% this month, why?* Cost tools tell you **where** the money went. Nobody tells you **which change caused it**. CloudPulse does."

### 0:20–0:40 · Healthy baseline (PRD §54 steps 1–2)

Show the dashboard on `baseline`.

> "This is ShopX, a simulated e-commerce platform with 10 services and resources. Monthly run-rate is about **$10,300**, flat against its 14-day baseline. No anomalies."

Point at the KPI cards, the cost chart with its baseline line, and the service breakdown.

### 0:40–1:10 · Trigger the incident (steps 3–6)

> "Now I'm going to simulate a deployment: Search v2.0."

Click the **Search Query Explosion** scenario.

> "Cost jumps from about **$10,300 to $14,000 a month, +36%**. The anomaly detector flags it: the latest cost is more than two standard deviations above the previous 14 days."

Point at the anomaly marker on the chart and the active-incident banner.

### 1:10–1:50 · Root cause (steps 7–10): the wow moment

Open the incident.

> "CloudPulse scored **every** service as a candidate. Nothing is hard-coded."

Point at the dependency graph: search-service is **root**, and redis, database and analytics are **affected**.

> "The root cause is **search-service**, with **95% root-cause confidence**. Here's the evidence:
> - Search v2.0 was deployed **1 hour before** its behaviour changed.
> - **Database queries per request rose from 1.20 to 4.78**, almost 4×.
> - It accounts for **100%** of the estimated cost increase through the services it calls."

Then point at the candidate list. This is the part that proves it isn't a guess:

> "Notice the database also got a lot more expensive, and it has the **most** past incidents on record. A naive tool would blame it. CloudPulse says no: *its load rose, but that load is pushed by its callers; its own behaviour did not change.*"

### 1:50–2:10 · Estimated impact (step 11)

> "Estimated impact traced to search-service: **$3,708 a month**. Most of it lands on the database (**$1,866**) and on search's own compute and network (**$1,273**)."

### 2:10–2:50 · Recommendation and trade-off (steps 12–15): the intelligence

> "The recommended fix is to **fix search-service's query amplification**. It saves an estimated **$3,171 a month**, latency drops about **70%**, and the risk is **low**."

Now simulate the tempting shortcut. Click **Simulate** on **Reduce database capacity 25%**.

> "The finance team's instinct is to cut the database. CloudPulse simulates it and says **NOT RECOMMENDED**. It would save only **$275 a month**, but latency goes up **167%**, error rate rises **17 points**, and DB CPU would hit **119%**. It saves money and breaks checkout."

### 2:50–3:00 · Close

> "The engine finds the cause; AI only explains it, and the app works with AI turned off. Three scenarios, one click to reset."

Click **Reset to baseline**. Everything goes green.

---

## If you have extra time: the other two scenarios

Each scenario has a deliberate **decoy** to show the engine isn't pattern-matching.

**Traffic Spike (+25.2%, about $12,900/mo)**
- Root cause: **image-service**, 78% confidence. User requests rose 4.42× (about 20,300 → 90,000/min). CDN is affected.
- Decoy: search-service **was deployed 2h earlier**, but its behaviour didn't change, so it isn't blamed. A deploy alone isn't evidence.
- Fix: rate-limit image-service to 1.2× baseline, saving about $2,467/mo. Here, reducing DB capacity **is** RECOMMENDED (+6.6% latency, CPU 58%). The same action gets a different verdict depending on the system's state.

**Database Overload (+27.4%, about $13,100/mo)**
- Root cause: **order-service**, 86% confidence. v3.0 N+1 bug: queries per request 3.00 → 10.48. Database CPU is about 96%.
- Decoy: search traffic also rose 10%. That's real, but it explains only 16% of the increase, so search comes second at 43%.
- Fix: fix order-service query amplification, saving about $2,543/mo with latency −85.2%. Reducing capacity is rejected: latency +127%, error rate +25.2pp and DB CPU 132%.

---

## Judge Q&A (PRD §59, plus likely follow-ups)

**"Why not just use AWS Cost Explorer?"**
> Cost Explorer tells you *where* spending occurred. CloudPulse explains the *application behaviour and service dependencies* that caused it: which deploy, which call pattern, and how it spread.

**"Are you actually connected to AWS?"**
> No. The MVP uses a provider-agnostic simulated environment so we can show the full workflow without a paid cloud account. Ingestion is designed around provider adapters that normalize billing into one schema, so real integrations don't change the analysis engine.

**"How do you determine root cause?"**
> A weighted score over five factors: temporal alignment and deploy timing (30%), share of the cost increase traced through the dependency graph (25%), whether the service's *own* behaviour changed (20%), correlation with the cost curve (15%), and incident history (10%). The result is a root-cause confidence from 0 to 1. It's a ranking, not a causal probability.

**"Is AI finding the root cause?"**
> **No.** The deterministic engine decides. AI only rewrites the engine's structured output in plain English. If the LLM states any number that isn't in the engine's output, times out after 8s, or there's no API key, we fall back to a deterministic template. The whole app works with AI disabled.

**"How do you avoid blaming the service that just got more expensive?"**
> By separating *changed behaviour* from *received load*. A service scores on the metric factor only if its own demand or its own calls per request changed. The database in the Search scenario got 3.5× the load but scores 0 there, because its callers pushed that load onto it.

**"Isn't the deploy timing doing all the work?"**
> No. A deploy with no behaviour change scores 0 on timing. In the Traffic Spike scenario, search-service is deployed 2 hours before the spike and is still correctly ruled out.

**"How do you know it's not overfitted to the demo?"**
> Every scenario ships with a decoy. Our tests require the correct root cause with a margin of at least 0.15 on 20 random seeds per scenario. A test also checks that the engine code never names the demo's answer, `search-service`.

**"Can this work with AWS, Azure and GCP?"**
> Yes, conceptually. We normalize provider billing into a common schema. The MVP demonstrates the normalized analysis layer with simulated data.

**"What if a recommendation saves money but hurts performance?"**
> We simulate every fix through the same system model that generated the data. A fix is rejected if latency rises more than 10%, errors rise more than 0.5 percentage points, or DB CPU goes above 85%. You saw that with the database capacity cut.

**"Where does the data come from?"**
> A Python generator produces 30 days of hourly data for 10 services, with daily cycles, noise, a slow auth-traffic growth trend and a one-off analytics batch spike on day 15. Nothing is hand-typed, and the backend regenerates and reanalyses it on every request in about 60ms.

---

## Recording the video

- Record the 3-minute path above in one take at 1080p, with the browser in full-screen.
- Keep the cursor still while talking; move it only to point.
- End on the reset to baseline so the video loops cleanly.
