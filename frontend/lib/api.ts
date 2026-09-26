// API client. NEXT_PUBLIC_MOCK=1 reads public/mocks/*.json (generated from the
// real backend by backend/scripts/export_mocks.py). Otherwise it calls the
// backend and, if that fails, falls back to the mocks so a demo never shows a
// blank page. `source` tells the UI which one answered.
import type { Action, Explanation, IncidentResponse, Overview, Recommendation, Scenario, ScenarioId } from "./types";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "") + "/api/v1";
const MOCK_ONLY = process.env.NEXT_PUBLIC_MOCK === "1";
// A sleeping free-tier backend can take ~50s to wake; don't leave the demo on a skeleton.
const LIVE_TIMEOUT_MS = 10_000;

export type Source = "live" | "mock";
export interface Result<T> {
  data: T;
  source: Source;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const live = url.startsWith(API);
  const res = await fetch(url, { cache: "no-store", ...(live && { signal: AbortSignal.timeout(LIVE_TIMEOUT_MS) }), ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.detail ?? `${res.status} ${res.statusText}`, res.status);
  }
  return res.json();
}

export class ApiError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

async function withFallback<T>(live: () => Promise<T>, mockFile: string): Promise<Result<T>> {
  if (!MOCK_ONLY) {
    try {
      return { data: await live(), source: "live" };
    } catch (e) {
      // a 4xx is a real answer from the backend; only fall back when it is unreachable
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e;
    }
  }
  return { data: await json<T>(`/mocks/${mockFile}`), source: "mock" };
}

export const getScenarios = () =>
  withFallback(() => json<Scenario[]>(`${API}/scenarios`), "scenarios.json");

export const getOverview = (s: ScenarioId) =>
  withFallback(() => json<Overview>(`${API}/overview?scenario=${s}`), `overview.${s}.json`);

export const getIncident = (s: ScenarioId) =>
  withFallback(() => json<IncidentResponse>(`${API}/incident?scenario=${s}`), `incident.${s}.json`);

export const explain = (s: ScenarioId) =>
  withFallback(
    () => json<Explanation>(`${API}/explain`, post({ scenario: s })),
    `explain.${s}.json`,
  );

export async function whatIf(s: ScenarioId, action: Action): Promise<Result<Recommendation>> {
  if (!MOCK_ONLY) {
    try {
      return { data: await json<Recommendation>(`${API}/whatif`, post({ scenario: s, action })), source: "live" };
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e;
    }
  }
  // offline: only the precomputed recommendations can be answered
  const inc = await json<IncidentResponse>(`/mocks/incident.${s}.json`);
  const match = inc.incident && inc.recommendations.find((r) => JSON.stringify(r.action) === JSON.stringify(action));
  if (!match) throw new ApiError("Custom simulations need the backend to be running.");
  return { data: match, source: "mock" };
}

function post(body: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
