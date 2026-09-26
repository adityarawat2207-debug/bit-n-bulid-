# Product Requirements Document

## Product Name

**CloudPulse — Cloud Cost Root-Cause Intelligence Platform**

### One-line pitch

**CloudPulse doesn't just tell you what is expensive. It tells you why it became expensive, which application behavior caused it, what downstream services were affected, and what you should change.**

---

# 1. Executive Summary

CloudPulse is an intelligent cloud-cost investigation platform designed to identify the root cause behind unexpected infrastructure spending.

A normal cloud billing dashboard might tell an engineering team:

> Database spending increased by $1,500.

CloudPulse should answer:

> Search Service traffic increased by 22%, causing queries per request to increase from 8 to 31. This generated 2.8× more database operations, increasing database compute and network traffic. The estimated total additional cost is $2,140/month.

The system should visualize this entire chain:

```text
Application Change
        ↓
Service Behavior Change
        ↓
Dependency Impact
        ↓
Infrastructure Usage Change
        ↓
Cloud Cost Increase
        ↓
Performance / Reliability Impact
        ↓
Recommended Action
```

For the hackathon MVP, CloudPulse will use a **simulated cloud environment and realistic telemetry dataset** rather than requiring paid AWS/GCP/Azure infrastructure.

The system should be architected so that real provider adapters can be added later.

---

# 2. Problem Statement

## Official problem

The hackathon problem is titled:

**"The Cloud Bill Nobody Can Explain"**

The problem statement describes a situation where cloud spending can increase substantially, while simply looking at the most expensive virtual machine does not reveal the cause.

One service may generate unnecessary traffic, causing multiple downstream services to consume more resources.

The requested system should connect cloud spending to application behavior and trace the impact through service dependencies.

It should also consider the trade-off between cost and performance, because reducing cost is not useful if it creates serious latency or reliability problems.

---

# 3. Core Product Question

Every incident should answer five questions:

### Q1 — What changed?

Example:

```text
Cloud cost increased 36%.
```

### Q2 — Where did it originate?

Example:

```text
Search Service
```

### Q3 — How did it propagate?

Example:

```text
Search
  ↓
API Gateway
  ↓
Database
  ↓
Network
```

### Q4 — What did it cost?

Example:

```text
Estimated additional monthly cost:
$3,200
```

### Q5 — What should we do?

Example:

```text
Optimize Search queries.

Estimated savings:
$2,200/month.

Expected latency:
-27%.

Risk:
Low.
```

---

# 4. Product Goals

## Primary goals

### Goal 1 — Detect cost anomalies

Detect when current spending deviates significantly from historical baseline.

### Goal 2 — Identify likely root cause

Determine which application service or infrastructure component most likely caused the cost change.

### Goal 3 — Show propagation

Visualize how the originating service affected dependent services.

### Goal 4 — Quantify cost impact

Estimate how much additional spending is associated with the incident.

### Goal 5 — Explain the result

Provide human-readable evidence instead of only a numerical score.

### Goal 6 — Recommend an action

Suggest a remediation strategy.

### Goal 7 — Evaluate trade-offs

Estimate whether the proposed optimization could negatively affect latency, reliability, or capacity.

---

# 5. Non-Goals for the Hackathon

Do NOT attempt to build these in the 24-hour MVP:

- Real multi-cloud billing integrations
- Real AWS production access
- Real enterprise IAM management
- Automatic infrastructure modification
- Automatic Kubernetes scaling
- Production-grade cost accounting
- Perfect causal inference
- Full ML-based forecasting
- Support for every cloud provider
- Enterprise authentication/SSO
- Complex billing contracts
- Autonomous production changes

The MVP must prove the **core intelligence**, not every future feature.

---

# 6. Product Philosophy

CloudPulse should be built around this principle:

> **Evidence first, AI second.**

The analytical engine should determine:

```text
what changed
       +
how much it changed
       +
what depends on what
       +
when it changed
       +
how costs changed
```

The AI layer should explain the already-derived evidence.

AI should NOT be responsible for inventing the root cause.

---

# 7. Target Users

## Primary persona

### Engineering Lead

Needs to know:

- Why cloud spending increased
- Which service caused it
- Whether the incident affects performance
- What engineers should investigate

---

## Secondary persona

### DevOps / SRE Engineer

Needs:

- service dependency graph
- resource utilization
- anomalies
- timelines
- root-cause evidence
- remediation suggestions

---

## Secondary persona

### FinOps / Finance Team

Needs:

- spending trends
- cost increase explanation
- resource breakdown
- estimated savings

---

# 8. Hackathon User Journey

The judge should be able to understand the entire product in under two minutes.

```text
Open Dashboard
      ↓
See normal cloud state
      ↓
Click "Simulate Incident"
      ↓
Cloud cost suddenly increases
      ↓
System detects anomaly
      ↓
System analyzes metrics
      ↓
System traces dependency graph
      ↓
Root cause identified
      ↓
Cost impact calculated
      ↓
Recommendation generated
      ↓
Performance trade-off evaluated
```

---

# 9. Demo Company

Use one fictional company throughout the demo.

## Company

**ShopX**

An e-commerce company.

---

# 10. ShopX Architecture

```text
                         USERS
                           |
                           v
                    +--------------+
                    | API Gateway  |
                    +------+-------+
                           |
        +------------------+------------------+
        |                  |                  |
        v                  v                  v
   +---------+       +-----------+       +---------+
   |  Auth   |       |  Search   |       | Orders  |
   +---------+       +-----+-----+       +----+----+
                           |                  |
                           v                  |
                       +-------+              |
                       | Redis |              |
                       +---+---+              |
                           |                  |
                           +--------+---------+
                                    |
                                    v
                              +-----------+
                              | Database  |
                              +-----+-----+
                                    |
                                    v
                              +-----------+
                              | Analytics |
                              +-----------+
```

---

# 11. Demo Incident

The primary demonstration incident is:

## "Search Query Amplification"

A new Search Service version is deployed.

Before deployment:

```text
1 search request
→ 1–2 database queries
```

After deployment:

```text
1 search request
→ 6–10 database queries
```

Search still works.

There is no complete outage.

However:

```text
Search traffic        +20%
Queries/request       +300%
Database usage        +250%
Network usage         +80%
Cloud cost            +36%
```

CloudPulse must discover that the Search Service is the likely root cause.

---

# 12. Product Modules

The application contains seven core modules.

## Module 1 — Dashboard

Overall cloud health.

## Module 2 — Cost Explorer

Spending by service.

## Module 3 — Anomaly Center

Detect and display unusual events.

## Module 4 — Root Cause Analysis

Determine likely source of cost increase.

## Module 5 — Dependency Graph

Display service propagation.

## Module 6 — Recommendations

Suggest potential fixes.

## Module 7 — Incident Simulator

Generate controlled production scenarios for the hackathon demo.

---

# 13. Dashboard Requirements

The main dashboard should contain:

## Header

```text
CloudPulse
Cloud Cost Intelligence
```

Navigation:

```text
Overview
Costs
Dependencies
Incidents
Recommendations
Simulator
```

---

# 14. Dashboard KPI Cards

Display:

### Current Cost

```text
$13,840
```

### Baseline

```text
$10,240
```

### Change

```text
+35.1%
```

### Active Anomalies

```text
3
```

### Estimated Preventable Cost

```text
$3,200
```

---

# 15. Cost Chart

Display:

```text
Cloud Spending — Last 30 Days
```

Use a line chart.

Normal period:

```text
$9,800
$10,100
$10,250
$10,050
```

Incident:

```text
$13,200
$13,700
$13,840
```

Clearly mark the anomaly beginning.

---

# 16. Cost Breakdown

Display:

| Resource | Normal | Current | Change |
|---|---:|---:|---:|
| Compute | $3,200 | $4,350 | +35.9% |
| Database | $2,800 | $4,200 | +50.0% |
| Network | $1,500 | $2,350 | +56.7% |
| Redis | $950 | $1,240 | +30.5% |
| Storage | $1,790 | $1,700 | -5.0% |

The values are simulated for the demo.

---

# 17. Anomaly Detection

An anomaly should be generated when:

```text
current_value > baseline + threshold
```

For the MVP, use a simple statistical method.

## Baseline

Calculate:

```text
mean
standard deviation
```

for the previous N data points.

Suggested default:

```text
N = 14 days
```

Anomaly condition:

```text
current > mean + 2 × standard_deviation
```

Also calculate percentage change:

```text
percentage_change =
((current - baseline) / baseline) × 100
```

---

# 18. Service Metrics

Every service should have:

```text
requests
latency
error_rate
cpu
memory
network_gb
database_queries
cost
```

Example:

```json
{
  "service": "search-service",
  "requests": 51000,
  "latency_ms": 390,
  "error_rate": 0.7,
  "cpu_percent": 72,
  "memory_percent": 61,
  "network_gb": 82,
  "database_queries": 1800000
}
```

---

# 19. Dependency Graph

Every service should have relationships.

Example:

```json
{
  "source": "search-service",
  "target": "database",
  "relationship": "queries"
}
```

Other examples:

```text
search-service → redis
search-service → database
order-service → database
payment-service → external-payment
api-gateway → search-service
api-gateway → order-service
```

---

# 20. Dependency Graph UI

Use an interactive node graph.

Each node displays:

```text
Service name
Cost
Requests
Health
```

Example:

```text
SEARCH SERVICE
$1,240
Requests +20%
🔴
```

Lines indicate dependencies.

When a node is selected, show:

```text
Cost
Traffic
Latency
CPU
Database Queries
```

---

# 21. Root Cause Engine

This is the most important backend module.

The engine should calculate a root-cause score for every potentially involved service.

Do not hard-code one service.

---

# 22. Root Cause Factors

Use five factors.

## Factor 1 — Temporal correlation

Did the service metric change around the same time as the cost increase?

Score:

```text
0–1
```

---

## Factor 2 — Dependency relationship

Is the service directly or indirectly related to the resource whose cost increased?

Score:

```text
0–1
```

---

## Factor 3 — Metric correlation

Did the service's behavior change consistently with the downstream resource?

Example:

```text
Search requests ↑
Database queries ↑
```

Score:

```text
0–1
```

---

## Factor 4 — Cost correlation

Did the service's activity rise alongside the cost?

Score:

```text
0–1
```

---

## Factor 5 — Historical evidence

Has similar behavior previously caused a cost increase?

Score:

```text
0–1
```

---

# 23. Root Cause Formula

For MVP:

```text
root_cause_score =
    0.30 × temporal_score
  + 0.25 × dependency_score
  + 0.20 × metric_score
  + 0.15 × cost_score
  + 0.10 × historical_score
```

The result should be normalized:

```text
0 → 1
```

Display:

```text
87%
```

as confidence.

Do not describe this internally calculated score as a mathematically proven causal probability.

Use wording:

> "Root-cause confidence"

---

# 24. Root Cause Output

Example:

```json
{
  "root_cause": "search-service",
  "confidence": 0.91,
  "evidence": [
    "requests increased 20%",
    "queries per request increased 3.4x",
    "database usage increased 250%",
    "service is directly connected to database",
    "change began immediately after deployment"
  ]
}
```

---

# 25. Propagation Analysis

Once the likely root cause is identified, traverse the dependency graph.

Example:

```text
Search Service
      ↓
Database
      ↓
Network
```

Generate:

```text
Search Service
Traffic +20%

↓

Database
Queries +250%

↓

Network
Traffic +80%

↓

Cloud Cost
+36%
```

This should be shown visually.

---

# 26. Cost Attribution

CloudPulse should estimate how much cost increase is attributable to each service.

For the MVP, use a contribution model.

Example:

```text
Total cost increase:
$3,600
```

Estimated contributors:

```text
Search Service       $2,100
Database             $700
Network              $500
Redis                $300
```

The UI must label these as:

> **Estimated impact**

Do not present them as exact provider accounting data.

---

# 27. Recommendation Engine

Recommendations should be generated from known optimization patterns.

Examples:

### Query amplification

```text
Optimize database queries.
```

### Excessive requests

```text
Investigate request amplification or retry loops.
```

### Low cache utilization

```text
Increase cache efficiency.
```

### Unused compute

```text
Consider right-sizing compute resources.
```

### Excessive network

```text
Reduce unnecessary cross-service data transfer.
```

---

# 28. Recommendation Structure

Every recommendation should have:

```text
Action
Reason
Estimated savings
Performance impact
Reliability impact
Risk
Confidence
```

Example:

```text
OPTIMIZE SEARCH QUERIES

Reason:
Queries per request increased 3.4×.

Estimated savings:
$2,200/month.

Latency impact:
Expected improvement of ~27%.

Reliability:
Positive.

Risk:
Low.

Confidence:
91%.
```

---

# 29. Cost vs Performance Simulation

This is a major differentiator.

Suppose a user wants to:

```text
Reduce database capacity
```

The simulator should estimate:

```text
Cost:
-25%

Latency:
+180%

Error rate:
+3.4%
```

Then classify:

```text
❌ NOT RECOMMENDED
```

Another action:

```text
Optimize Search queries
```

Could show:

```text
Cost:
-18%

Latency:
-27%

Error rate:
-0.3%

✅ RECOMMENDED
```

The goal is to demonstrate that CloudPulse doesn't blindly optimize for lower cost.

The official problem specifically requires this cost/performance consideration.

---

# 30. Incident Simulator

The simulator is essential to the hackathon demo.

Create a page:

```text
Incident Simulator
```

Buttons:

```text
[ Search Query Explosion ]

[ Traffic Spike ]

[ Network Traffic Spike ]

[ Database Overload ]

[ Bad Optimization ]
```

---

# 31. Incident 1 — Search Query Explosion

Initial state:

```text
Search requests:
42,000/min

Queries/request:
1.2

Database CPU:
42%

Cost:
$10,240
```

After simulation:

```text
Search requests:
50,000/min

Queries/request:
4.8

Database CPU:
87%

Cost:
$13,840
```

Expected root cause:

```text
Search Service
```

---

# 32. Incident 2 — Traffic Spike

Simulation:

```text
Image Service traffic:
+340%
```

Propagation:

```text
Image Service
 ↓
CDN
 ↓
Network
 ↓
Cloud Cost
```

Expected root cause:

```text
Image Service
```

---

# 33. Incident 3 — Database Overload

Simulation:

```text
Database query latency:
+140%

Database CPU:
95%

Cost:
+28%
```

Root cause:

```text
Order Service
```

---

# 34. Incident 4 — Bad Optimization

Simulate a recommendation that saves money but significantly hurts performance.

System should reject it.

Purpose:

Demonstrate the cost/performance trade-off.

---

# 35. AI Explanation Layer

The AI layer receives structured analysis.

Example input:

```json
{
  "root_service": "search-service",
  "confidence": 0.91,
  "cost_increase": 3600,
  "request_change": 0.20,
  "queries_per_request_change": 3.4,
  "database_cost_change": 0.50,
  "network_cost_change": 0.56
}
```

The AI generates:

### Incident Summary

A short explanation.

### Root Cause

Why the service was identified.

### Evidence

List of supporting signals.

### Recommendation

Human-readable remediation.

---

# 36. AI Safety Rules

The AI must NOT:

- invent metrics
- invent costs
- invent services
- invent dependencies
- invent incidents
- claim exact causality
- override the analysis engine

The prompt must explicitly instruct:

> "Use only the provided structured evidence. Never introduce unsupported numerical values."

---

# 37. Database Schema

Use PostgreSQL/Supabase or SQLite.

For the 24-hour hackathon, SQLite is acceptable for local development.

Suggested tables:

---

## `services`

```text
id
name
type
environment
status
created_at
```

Example:

```text
1
search-service
application
production
healthy
```

---

## `metrics`

```text
id
service_id
timestamp
requests
latency_ms
error_rate
cpu_percent
memory_percent
network_gb
database_queries
```

---

## `costs`

```text
id
service_id
timestamp
provider
resource_type
cost
```

---

## `dependencies`

```text
id
source_service_id
target_service_id
relationship
```

---

## `deployments`

```text
id
service_id
version
timestamp
change_summary
```

Example:

```text
17
search-service
v2.4
2026-09-26 09:12
query optimization update
```

---

## `incidents`

```text
id
name
type
started_at
ended_at
severity
status
```

---

## `incident_metrics`

```text
id
incident_id
service_id
metric_name
baseline_value
current_value
percentage_change
```

---

## `root_causes`

```text
id
incident_id
service_id
confidence
temporal_score
dependency_score
metric_score
cost_score
historical_score
```

---

## `recommendations`

```text
id
incident_id
title
description
estimated_savings
latency_impact
reliability_impact
risk
confidence
status
```

---

# 38. API Design

Base API:

```text
/api/v1
```

---

## GET `/services`

Returns all services.

Response:

```json
{
  "services": []
}
```

---

## GET `/services/{id}`

Returns service details.

---

## GET `/costs`

Query parameters:

```text
start_date
end_date
service_id
```

---

## GET `/metrics`

Query parameters:

```text
service_id
start_date
end_date
```

---

## GET `/dependencies`

Returns the dependency graph.

---

## GET `/incidents`

Returns detected incidents.

---

## GET `/incidents/{id}`

Returns:

```text
incident
metrics
root_cause
propagation
recommendations
```

---

## POST `/simulate`

Request:

```json
{
  "scenario": "search_query_explosion"
}
```

Response:

```json
{
  "success": true,
  "incident_id": "INC-001"
}
```

---

## POST `/analyze/{incident_id}`

Runs:

```text
anomaly detection
root-cause analysis
propagation analysis
cost attribution
recommendation engine
```

---

## GET `/recommendations`

Returns recommendations.

---

## POST `/recommendations/{id}/simulate`

Simulates the projected impact of the recommendation.

---

# 39. Frontend Routes

Use:

```text
/
```

Overview.

```text
/costs
```

Cost explorer.

```text
/dependencies
```

Dependency graph.

```text
/incidents
```

Incident list.

```text
/incidents/[id]
```

Incident detail.

```text
/recommendations
```

Optimization recommendations.

```text
/simulator
```

Incident simulator.

---

# 40. Incident Detail Page

This should be the most impressive screen.

Structure:

```text
------------------------------------------------
INCIDENT #INC-001
Search Query Explosion

Severity: HIGH
Detected: 10:42 AM
------------------------------------------------

COST IMPACT

$10,240 → $13,840
+35.1%

------------------------------------------------

ROOT CAUSE

Search Service

Confidence: 91%

------------------------------------------------

PROPAGATION GRAPH

Search
 ↓
Database
 ↓
Network
 ↓
Cloud Cost

------------------------------------------------

EVIDENCE

• Search traffic +20%
• Queries/request +300%
• Database CPU +46%
• Network +80%
• Deployment occurred 7 minutes before anomaly

------------------------------------------------

RECOMMENDATION

Optimize Search query flow

Estimated savings: $2,200/month
Risk: LOW

[View Simulation]

------------------------------------------------
```

---

# 41. Visual Design

Use a modern engineering dashboard.

Style:

```text
Dark background
High contrast
Card-based layout
Large numbers
Interactive charts
Subtle animations
```

Color semantics:

```text
Normal     Green
Warning    Amber
Critical   Red
Neutral    Gray/White
```

Do not over-animate.

Animations should communicate:

```text
change
propagation
alerts
loading
```

---

# 42. Dependency Graph Visual Language

Node states:

### Healthy

```text
🟢
```

### Impacted

```text
🟡
```

### Suspected root cause

```text
🔴
```

### Confirmed analysis target

Use highlighted border.

---

# 43. Technology Stack

## Frontend

```text
Next.js
TypeScript
Tailwind CSS
React Flow
Recharts
Framer Motion
```

---

## Backend

```text
Python
FastAPI
```

---

## Database

Recommended:

```text
Supabase PostgreSQL
```

or for completely local development:

```text
SQLite
```

---

## Analytics

Python:

```text
NumPy
Pandas
NetworkX
```

Keep dependencies minimal.

---

## AI

Use whichever LLM API/key is already available to the team.

The core system must still work without AI.

AI is the explanation layer.

---

# 44. Repository Structure

```text
cloudpulse/
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── costs/
│   │   ├── dependencies/
│   │   ├── incidents/
│   │   ├── recommendations/
│   │   └── simulator/
│   │
│   ├── components/
│   │   ├── charts/
│   │   ├── dashboard/
│   │   ├── graph/
│   │   ├── incidents/
│   │   └── recommendations/
│   │
│   ├── lib/
│   └── types/
│
├── backend/
│   ├── main.py
│   ├── api/
│   │   ├── services.py
│   │   ├── costs.py
│   │   ├── metrics.py
│   │   ├── dependencies.py
│   │   ├── incidents.py
│   │   └── recommendations.py
│   │
│   ├── engine/
│   │   ├── anomaly.py
│   │   ├── root_cause.py
│   │   ├── propagation.py
│   │   ├── attribution.py
│   │   └── optimization.py
│   │
│   ├── simulator/
│   │   ├── scenarios.py
│   │   └── generator.py
│   │
│   ├── ai/
│   │   └── explainer.py
│   │
│   ├── db/
│   │   ├── models.py
│   │   └── seed.py
│   │
│   └── tests/
│
├── data/
│   ├── services.json
│   ├── metrics.json
│   ├── costs.json
│   └── dependencies.json
│
├── README.md
└── docker-compose.yml
```

---

# 45. Seed Dataset

Create at least:

```text
8 services
30 days of historical metrics
30 days of cost data
10+ dependency relationships
4 deployment events
4 incident scenarios
```

### Services

```text
api-gateway
auth-service
search-service
order-service
payment-service
redis
database
analytics
```

---

# 46. Dataset Generation

Do not manually type thousands of records.

Create a Python generator.

Example behavior:

```text
Days 1–20:
normal

Days 21–25:
normal

Day 26:
small variation

Day 27:
Search deployment

Day 27 onward:
Search query explosion
```

Generated data should have realistic variation.

Do not make every day identical.

---

# 47. Example Metric Relationships

Normal:

```text
search requests = 40,000
queries = 48,000
```

Incident:

```text
search requests = 50,000
queries = 240,000
```

This produces:

```text
queries/request:
1.2 → 4.8
```

That relationship should be visible in the UI.

---

# 48. Incident Timeline

Show:

```text
10:15
Search v2 deployed

10:18
Query volume increases

10:20
Database CPU rises

10:22
Network traffic rises

10:25
Cost anomaly detected

10:26
Root cause analysis complete
```

This is excellent evidence for your causal explanation.

---

# 49. Real Provider Adapter Architecture

Although the hackathon uses simulated data, the backend should have this abstraction:

```python
class CostProvider:
    def get_costs(self, start_date, end_date):
        pass
```

Then:

```text
providers/
    simulated.py
    aws.py
    gcp.py
    azure.py
    anthropic.py
```

For the hackathon:

```text
simulated.py
```

is implemented.

The others can remain interfaces/placeholders.

Do NOT spend the hackathon trying to finish every provider.

---

# 50. Normalized Provider Data Model

Regardless of provider, convert data to:

```json
{
  "provider": "simulated",
  "resource_id": "db-prod",
  "resource_type": "database",
  "service_id": "database",
  "timestamp": "2026-09-26T10:00:00",
  "usage": 82.4,
  "cost": 125.20
}
```

This makes future integrations easier.

---

# 51. "Real World" Extension

After the hackathon, real providers can plug into the adapter layer.

Conceptually:

```text
AWS Billing
GCP Billing
Azure Billing
AI API Usage
Kubernetes
OpenTelemetry
        ↓
Normalized Data Layer
        ↓
CloudPulse Engine
```

The hackathon MVP should demonstrate that architecture without requiring paid accounts.

---

# 52. AI Prompt Specification

System instruction:

```text
You are CloudPulse's incident explanation engine.

You must explain incidents using only the structured
analysis supplied by the application.

Never invent:
- costs
- metrics
- services
- dependencies
- recommendations based on unsupported evidence

Never claim certainty when the root cause is uncertain.

Use phrases such as:
"likely root cause"
"estimated impact"
"supporting evidence"

Keep explanations concise and technical.
```

Input:

```json
{
  "incident": {},
  "metrics": [],
  "root_cause": {},
  "propagation": [],
  "recommendations": []
}
```

Output:

```json
{
  "summary": "",
  "root_cause_explanation": "",
  "evidence": [],
  "recommendation_explanation": ""
}
```

---

# 53. Acceptance Criteria

The project is considered complete only when all of these work.

## Dashboard

- [ ] Dashboard loads successfully.
- [ ] Cost KPIs display.
- [ ] Cost history chart displays.
- [ ] Current vs baseline is visible.
- [ ] Service breakdown works.

## Simulation

- [ ] User can start an incident.
- [ ] Data changes dynamically.
- [ ] Cost anomaly appears.
- [ ] Metrics change.
- [ ] Dependency nodes change state.

## Analysis

- [ ] System identifies anomaly.
- [ ] System evaluates candidate root causes.
- [ ] Root-cause confidence is calculated.
- [ ] Evidence is displayed.
- [ ] Dependency propagation is displayed.
- [ ] Estimated cost impact is calculated.

## Recommendation

- [ ] Recommendation generated.
- [ ] Estimated savings displayed.
- [ ] Latency impact displayed.
- [ ] Reliability impact displayed.
- [ ] Risk classification displayed.

## Demo

- [ ] At least 3 scenarios work.
- [ ] System can reset to baseline.
- [ ] No manual database modification is needed during demo.
- [ ] No external paid service is required.

---

# 54. Definition of Done

The MVP is finished when a judge can:

1. Open the deployed application.
2. See a healthy simulated cloud environment.
3. Navigate to Simulator.
4. Trigger a production incident.
5. Watch the cost increase.
6. See the anomaly detection.
7. Open the incident.
8. See the dependency graph.
9. See the root-cause analysis.
10. See evidence supporting the diagnosis.
11. See estimated financial impact.
12. See optimization recommendation.
13. Simulate an optimization.
14. See cost vs latency/reliability trade-off.
15. Understand why the recommendation was accepted or rejected.

---

# 55. 24-Hour Development Plan

## Hour 0–2

Project setup.

Build:

```text
Next.js
FastAPI
Database
Repository
```

Seed basic data.

---

## Hour 2–5

Build data model.

Implement:

```text
services
metrics
costs
dependencies
deployments
```

Generate 30 days of historical data.

---

## Hour 5–8

Build anomaly engine.

Implement:

```text
baseline
percentage change
anomaly detection
incident creation
```

---

## Hour 8–11

Build dependency graph.

Implement:

```text
graph
nodes
edges
service highlighting
propagation
```

---

## Hour 11–14

Build root-cause engine.

Implement:

```text
temporal score
dependency score
metric correlation
cost correlation
historical score
final score
```

---

## Hour 14–17

Build dashboard and incident page.

Prioritize:

```text
KPIs
charts
root cause
graph
timeline
```

---

## Hour 17–19

Build recommendation engine.

Add:

```text
savings
latency
reliability
risk
simulation
```

---

## Hour 19–21

Add AI explanation.

Only after the deterministic system works.

---

## Hour 21–22

Polish UI.

Fix:

```text
loading
errors
animations
responsive layout
```

---

## Hour 22–23

Prepare three scenarios.

Test entire flow.

---

## Hour 23–24

Deployment.

Final testing.

Record explanation video.

Prepare GitHub README.

---

# 56. Priority System

If time is running out:

## P0 — Absolutely required

```text
Cost anomaly
Root cause
Dependency graph
Cost impact
Incident simulator
Dashboard
```

## P1 — Strongly recommended

```text
Recommendation engine
Timeline
Performance trade-off
AI explanation
```

## P2 — Nice to have

```text
Provider adapters
Login
Advanced filtering
Historical incidents
Beautiful animations
Export
```

Never sacrifice P0 to build P2.

---

# 57. What NOT to Build

Do not build:

```text
❌ Authentication
❌ Billing system
❌ Payment system
❌ Real AWS deployment
❌ Kubernetes cluster
❌ Multi-cloud integrations
❌ Complex ML models
❌ Real-time infrastructure monitoring
❌ Terraform automation
❌ Automatic remediation
```

These are distractions for the hackathon MVP.

---

# 58. The "Wow" Moment

The demo should have exactly one major wow sequence.

Start:

```text
Cloud Health
$10,240
🟢 Healthy
```

Say:

> "Now I'm going to simulate a deployment."

Click:

```text
Deploy Search v2
```

Then the screen changes:

```text
🚨 COST ANOMALY
$10,240 → $13,840
```

The graph animates:

```text
Search 🔴
   ↓
Database 🟠
   ↓
Network 🟠
```

Then:

```text
ROOT CAUSE IDENTIFIED

Search Service

Queries/request:
1.2 → 4.8

Estimated cost impact:
$3,200/month
```

Then:

```text
RECOMMENDED FIX

Optimize Search query amplification

Savings:
$2,200/month

Latency:
-27%

Risk:
LOW
```

Then simulate:

```text
Reduce database capacity
```

Your system responds:

```text
❌ NOT RECOMMENDED

Savings: $1,500/month

Latency: +180%
Error rate: +3.4%
```

This demonstrates the **actual intelligence** of the platform.

---

# 59. Judge Questions and Answers

## "Why not just use AWS Cost Explorer?"

Answer:

> Cost Explorer tells you where spending occurred. CloudPulse focuses on explaining the application behavior and service dependencies that caused the increase.

---

## "Are you actually connected to AWS?"

Answer:

> The hackathon MVP uses a provider-agnostic simulated cloud environment so we can demonstrate the complete root-cause workflow without depending on a paid cloud account. The ingestion layer is designed around provider adapters so real billing integrations can be added without changing the analysis engine.

---

## "How do you determine root cause?"

Answer:

> We combine temporal correlation, service dependency relationships, metric changes, cost correlation, and historical evidence into a root-cause confidence score.

---

## "Is AI finding the root cause?"

Answer:

> No. The analytical engine determines the evidence and candidate root cause. AI is used to explain the findings in natural language.

This is an important answer.

---

## "Can this work with AWS, Azure and GCP?"

Answer:

> Yes conceptually. We normalize provider-specific billing data into a common schema. The current MVP demonstrates the normalized analysis layer with simulated data.

---

## "What happens if your recommendation saves money but hurts performance?"

Answer:

> We simulate its effect on cost, latency and reliability and can reject an optimization when the performance trade-off is unacceptable.

---

# 60. Future Roadmap

## Version 1

Simulated environment.

## Version 2

AWS billing integration.

## Version 3

OpenTelemetry integration.

## Version 4

Kubernetes integration.

## Version 5

AWS + Azure + GCP.

## Version 6

AI-powered anomaly investigation.

## Version 7

Automated remediation suggestions.

## Version 8

Enterprise FinOps platform.

---

# 61. Final Product Architecture

```text
                        ┌─────────────────────────┐
                        │       CLOUDPULSE        │
                        └────────────┬────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
       Cost Data                 App Metrics          Dependency Data
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │ Normalization Layer │
                          └──────────┬──────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │ Anomaly Detection   │
                          └──────────┬──────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │ Root Cause Engine   │
                          └──────────┬──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
               Propagation       Attribution     Trade-off
                 Engine            Engine         Simulator
                    │                │                │
                    └────────────────┼────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │ Recommendation      │
                          │ Engine              │
                          └──────────┬──────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │ AI Explanation      │
                          └──────────┬──────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │ Next.js Dashboard   │
                          └─────────────────────┘
```

---

# 62. Final Product Definition

CloudPulse is **not**:

> "A dashboard showing cloud costs."

CloudPulse is:

> **An explainable cloud-cost investigation engine that connects application behavior with infrastructure spending and identifies the most likely cause of unexpected cost increases.**

The central intelligence loop is:

```text
COST SPIKE
    ↓
WHAT CHANGED?
    ↓
WHICH SERVICE CHANGED?
    ↓
WHAT DOES THAT SERVICE DEPEND ON?
    ↓
WHAT DOWNSTREAM RESOURCES CHANGED?
    ↓
HOW MUCH DID THAT COST?
    ↓
WHAT PERFORMANCE IMPACT OCCURRED?
    ↓
WHAT SHOULD WE CHANGE?
    ↓
IS THE CHANGE SAFE?
```

That loop is the entire product.

---

# 63. The MVP in One Sentence

**"Simulate a cloud-cost incident, detect the anomaly, trace it through the service graph, identify the likely root cause, calculate its financial impact, and recommend a fix while proving whether the fix hurts performance."**

That is the behavior your judges should experience end-to-end.