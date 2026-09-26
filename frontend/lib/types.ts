// Mirrors docs/api-contract.md. Change both together.

export type ScenarioId = "baseline" | "search_query_explosion" | "traffic_spike" | "database_overload";

export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
}

export interface Overview {
  scenario: ScenarioId;
  kpis: {
    current_monthly: number;
    baseline_monthly: number;
    change_pct: number;
    active_anomalies: number;
    preventable_monthly: number;
  };
  hourly: { t: string; cost_monthly: number; baseline_monthly: number }[];
  daily: { date: string; cost: number; anomalous: boolean }[];
  breakdown: { category: string; baseline: number; current: number }[];
  services: { id: string; kind: NodeKind; cost_baseline: number; cost_current: number; change_pct: number }[];
  active_incident_id: ScenarioId | null;
}

export type NodeKind = "ingress" | "service" | "resource";
export type NodeState = "root" | "affected" | "normal";
export type Factors = { temporal: number; dependency: number; metric: number; cost: number; historical: number };

export interface Graph {
  nodes: { id: string; kind: NodeKind; state: NodeState; change_pct: number }[];
  edges: { source: string; target: string; calls_change_pct: number; on_propagation_path: boolean }[];
}

export type Action =
  | { type: "fix_amplification"; source: string; target: string }
  | { type: "rate_limit"; target: string; value: number }
  | { type: "reduce_capacity"; target: string; value: number };

export interface Recommendation {
  id: string;
  title: string;
  action: Action;
  savings_monthly: number;
  latency_pct: number;
  error_pp: number;
  db_cpu: number;
  risk: "low" | "medium" | "high";
  verdict: "RECOMMENDED" | "NOT RECOMMENDED";
  reasons: string[];
}

export interface IncidentDetail {
  incident: {
    id: ScenarioId;
    detected_at: string;
    onset_at: string;
    severity: "low" | "medium" | "high";
    cost_change_pct: number;
  };
  root_cause: { service: string; confidence: number; factors: Factors; evidence: string[] };
  candidates: { service: string; confidence: number; factors: Factors; why_not: string }[];
  graph: Graph;
  timeline: { t: string; service: string | null; label: string }[];
  impact: {
    total_monthly: number;
    by_cause: { service: string; amount: number; landed: { service: string; amount: number }[] }[];
  };
  recommendations: Recommendation[];
}

export type IncidentResponse = IncidentDetail | { incident: null };

export interface Explanation {
  text: string;
  source: "llm" | "template";
  sections: {
    summary: string;
    root_cause_explanation: string;
    evidence: string[];
    recommendation_explanation: string;
  };
}
