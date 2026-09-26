# API Contract (implemented in `backend/`; freeze at H1)

Base path `/api/v1`. The backend is **stateless**: every call names a `scenario`, and the backend regenerates and reanalyses it (about 0.06s). "Reset to baseline" means switching to `scenario=baseline`. The frontend keeps the current scenario in the page URL (`?scenario=`), so a demo link is shareable.

Scenario ids: `baseline`, `search_query_explosion`, `traffic_spike`, `database_overload`.

Money is **USD per month (run-rate)**. Percentages are numbers (`34.2` = 34.2%). Times are ISO-8601 strings on simulated days 0–29, with a fixed start date chosen by the backend.

Changing a field name after H1 needs agreement from both sides.

Real responses for every scenario are in `frontend/public/mocks/` (`overview.<scenario>.json`, `incident.<scenario>.json`, `explain.<scenario>.json`, `scenarios.json`). They are generated from the backend by `cd backend && .venv/bin/python -m scripts.export_mocks`, so treat them as the source of truth for exact values; the examples below are illustrative.

Errors: an unknown scenario returns 404, and an invalid what-if action returns 422. Both have a `detail` string.

---

## GET `/scenarios`

```json
[
  { "id": "baseline", "name": "Healthy baseline", "description": "No incident" },
  { "id": "search_query_explosion", "name": "Search Query Explosion", "description": "Search v2.0 deploy multiplies database queries per request" }
]
```

## GET `/overview?scenario=`

```json
{
  "scenario": "search_query_explosion",
  "kpis": {
    "current_monthly": 13840,
    "baseline_monthly": 10240,
    "change_pct": 35.2,
    "active_anomalies": 1,
    "preventable_monthly": 2243
  },
  "hourly": [
    { "t": "2026-08-27T00:00:00Z", "cost_monthly": 10180, "baseline_monthly": 10200 }
  ],
  "daily": [
    { "date": "2026-08-27", "cost": 341.2, "anomalous": false }
  ],
  "breakdown": [
    { "category": "database", "baseline": 2800, "current": 3900 }
  ],
  "services": [
    { "id": "search-service", "kind": "service", "cost_baseline": 1300, "cost_current": 2100, "change_pct": 61.5 }
  ],
  "active_incident_id": "search_query_explosion"
}
```

Notes:
- `hourly` covers the last 7 days, which is enough for the chart and the replay animation.
- `daily` covers all 30 days.
- `active_incident_id` is `null` for the baseline scenario.
- `breakdown` categories are `compute`, `database`, `network`, `cache`, `storage` and `cdn`.
- `services[].kind` is `ingress`, `service` or `resource`.

## GET `/incident?scenario=`

This returns everything the incident page needs in one call. For `baseline` it returns `{ "incident": null }`.

```json
{
  "incident": {
    "id": "search_query_explosion",
    "detected_at": "2026-09-22T12:00:00Z",
    "onset_at": "2026-09-22T10:00:00Z",
    "severity": "high",
    "cost_change_pct": 34.2
  },
  "root_cause": {
    "service": "search-service",
    "confidence": 0.95,
    "factors": { "temporal": 1.0, "dependency": 0.92, "metric": 1.0, "cost": 0.97, "historical": 0.5 },
    "evidence": [
      "queries/request to database rose x4.0 (1.20 -> 4.80)",
      "Deployed v2.0 1h before its own behaviour changed",
      "Accounts for 92% of the cost increase through its dependencies"
    ]
  },
  "candidates": [
    { "service": "analytics", "confidence": 0.38, "factors": { "...": 0 }, "why_not": "Load increase is pushed by callers; its own behaviour did not change" }
  ],
  "graph": {
    "nodes": [ { "id": "database", "kind": "resource", "state": "affected", "change_pct": 190.0 } ],
    "edges": [ { "source": "search-service", "target": "database", "calls_change_pct": 380.0, "on_propagation_path": true } ]
  },
  "timeline": [
    { "t": "2026-09-22T09:00:00Z", "service": "search-service", "label": "search-service v2.0 deployed" },
    { "t": "2026-09-22T10:00:00Z", "service": "search-service", "label": "queries/request increases" },
    { "t": "2026-09-22T10:00:00Z", "service": "database", "label": "database load rises" },
    { "t": "2026-09-22T12:00:00Z", "service": null, "label": "Cost anomaly detected" }
  ],
  "impact": {
    "total_monthly": 2735,
    "by_cause": [
      { "service": "search-service", "amount": 2735,
        "landed": [ { "service": "search-service", "amount": 1273 }, { "service": "database", "amount": 893 } ] }
    ]
  },
  "recommendations": [
    {
      "id": "fix_amplification:search-service:database",
      "title": "Fix search-service query amplification to database",
      "action": { "type": "fix_amplification", "source": "search-service", "target": "database" },
      "savings_monthly": 2243,
      "latency_pct": -71.0,
      "error_pp": 0.0,
      "db_cpu": 0.44,
      "risk": "low",
      "verdict": "RECOMMENDED",
      "reasons": []
    },
    {
      "id": "reduce_capacity:database:0.75",
      "title": "Reduce database capacity 25%",
      "action": { "type": "reduce_capacity", "target": "database", "value": 0.75 },
      "savings_monthly": 500,
      "latency_pct": 192.0,
      "error_pp": 17.1,
      "db_cpu": 1.16,
      "risk": "high",
      "verdict": "NOT RECOMMENDED",
      "reasons": ["latency +192% > +10% limit", "error rate +17.1pp > +0.5pp limit", "DB CPU 116% > 85% headroom limit"]
    }
  ]
}
```

Notes:
- `graph` node `state` is `root`, `affected` or `normal`.
- Node **positions are owned by the frontend** as a fixed layout map. The backend never sends x/y.
- `candidates` lists every scored service except the root, sorted by confidence.
- `risk` is `low`, `medium` or `high`.
- `severity` is `high` at a cost change of 25% or more, `medium` from 10%, and `low` below that.
- There are always 3 recommendations, in this order:
  1. Fix the cause: `fix_amplification` when the root multiplied its calls to a dependency, otherwise `rate_limit` of the root to 1.2x baseline.
  2. Treat the symptom: add database capacity (`reduce_capacity` with value 1.25). It costs more, so it is NOT RECOMMENDED.
  3. The "bad optimization" (PRD §34): cut database capacity 25%. It is NOT RECOMMENDED when the database is already busy, and RECOMMENDED when it has headroom (traffic_spike).
- `savings_monthly` is negative when an action costs more.

## POST `/whatif`

```json
{ "scenario": "search_query_explosion",
  "action": { "type": "reduce_capacity", "target": "database", "value": 0.75 } }
```

It returns one recommendation object, in the same shape as `recommendations[]` above.

Action types:
- `fix_amplification` (`source`, `target`)
- `rate_limit` (`target`, `value` = max demand multiplier vs baseline)
- `reduce_capacity` (`target`, `value` = capacity multiplier)

## POST `/explain`

```json
{ "scenario": "search_query_explosion" }
```

```json
{ "text": "Cloud cost is running 26.7% above ...", "source": "template",
  "sections": { "summary": "...", "root_cause_explanation": "...", "evidence": ["..."], "recommendation_explanation": "..." } }
```

- `source` is `llm` or `template`.
- `sections` is the PRD §52 output shape; `text` is the same content joined for simple display.
- The LLM runs only when `ANTHROPIC_API_KEY` is set on the backend. Its answer is discarded in favour of the template if it states any number that is not in the `/incident` JSON.
- A template is used when there is no API key, or when the LLM call errors or takes more than 8s.
- The text may only use numbers present in `/incident` (PRD §36, §52).
