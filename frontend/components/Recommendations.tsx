"use client";

import { useEffect, useState } from "react";
import { whatIf } from "@/lib/api";
import { companyOf } from "@/lib/companies";
import { confidence, pct, pp, usd } from "@/lib/format";
import type { Action, IncidentDetail, Recommendation, ScenarioId } from "@/lib/types";
import { Level, Verdict } from "./ui";

function reasonFor(rec: Recommendation, inc: IncidentDetail | null) {
  const a = rec.action;
  if (a.type === "fix_amplification" && inc)
    return inc.root_cause.evidence.find((e) => e.toLowerCase().includes(a.target)) ?? inc.root_cause.evidence[0];
  if (a.type === "rate_limit")
    return inc?.root_cause.evidence.find((e) => e.startsWith("User requests")) ??
      "Caps traffic from this service. Only appropriate if the extra traffic is not real customer demand.";
  if (a.type === "reduce_capacity" && a.value > 1)
    return "Treats the symptom: more capacity absorbs the extra load but raises the bill.";
  return "Cuts spend by shrinking database capacity. Safe only when the database has headroom.";
}

function Metric({ label, value, good, hint }: { label: string; value: string; good: boolean | null; hint: string }) {
  const tone = good === null ? "text-ink" : good ? "text-ok" : "text-alert";
  return (
    <div className="bg-surface px-3 py-2" title={hint}>
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

export function RecommendationCard({ rec, incident, currentMonthly }: {
  rec: Recommendation;
  incident: IncidentDetail | null;
  currentMonthly?: number;
}) {
  const ok = rec.verdict === "RECOMMENDED";
  const isFix = rec.action.type !== "reduce_capacity";
  const after = currentMonthly !== undefined ? currentMonthly - rec.savings_monthly : undefined;
  return (
    <div className={`@container flex flex-col rounded-lg border p-4 ${
      ok ? "border-ok-line border-t-4 border-t-ok bg-surface" : "border-line bg-canvas/60"}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Verdict verdict={rec.verdict} />
        <Level level={rec.risk} label="Risk" />
        {isFix && incident && (
          <span className="rounded-md bg-sunk px-2 py-0.5 text-xs font-medium text-ink-2">
            Root-cause confidence {confidence(incident.root_cause.confidence)}
          </span>
        )}
      </div>
      <h3 className="mt-2.5 font-semibold leading-snug text-ink">{rec.title}</h3>
      <p className="mt-1 text-sm text-muted">{reasonFor(rec, incident)}</p>

      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line text-sm @md:grid-cols-4">
        <Metric label="Savings" hint="Estimated monthly savings" value={`${usd(rec.savings_monthly)}/mo`} good={rec.savings_monthly > 0} />
        <Metric label="Latency" hint="Latency change; limit +10%" value={pct(rec.latency_pct)}
          good={rec.latency_pct <= 10 ? (rec.latency_pct < 0 ? true : null) : false} />
        <Metric label="Error rate" hint="Reliability: error-rate change; limit +0.5pp" value={pp(rec.error_pp)}
          good={rec.error_pp <= 0.5 ? (rec.error_pp < 0 ? true : null) : false} />
        <Metric label="DB CPU" hint="Database CPU after the change; limit 85%" value={`${Math.round(rec.db_cpu * 100)}%`}
          good={rec.db_cpu <= 0.85 ? null : false} />
      </div>

      {rec.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-alert">
          {rec.reasons.map((r) => (
            <li key={r} className="flex items-baseline gap-2">
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" aria-hidden>
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {r}
            </li>
          ))}
        </ul>
      )}

      {currentMonthly !== undefined && after !== undefined && (
        <div className="mt-auto pt-4 text-xs">
          <div className="flex justify-between text-muted">
            <span>Monthly cost</span>
            <span className="tabular-nums">
              {usd(currentMonthly)} → <b className={`font-semibold ${after < currentMonthly ? "text-ok" : "text-alert"}`}>{usd(after)}</b>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunk">
            <div className={`h-full rounded-full ${ok ? "bg-ok" : "bg-faint"}`}
              style={{ width: `${Math.min(100, (100 * after) / Math.max(after, currentMonthly))}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Build a custom action and simulate it against the live backend (PRD §29). */
export function WhatIfPanel({ scenario, incident, currentMonthly }: {
  scenario: ScenarioId;
  incident: IncidentDetail | null;
  currentMonthly?: number;
}) {
  const company = companyOf(scenario);
  const ENTRY = company.entry;
  const EDGES = company.fixEdges;
  const [type, setType] = useState<Action["type"]>("reduce_capacity");
  const [capacity, setCapacity] = useState(0.75);
  const [limitTarget, setLimitTarget] = useState(incident && ENTRY.includes(incident.root_cause.service) ? incident.root_cause.service : ENTRY[0]);
  const [limit, setLimit] = useState(1.2);
  const [edge, setEdge] = useState(() => {
    const e = EDGES.find(([s]) => s === incident?.root_cause.service);
    return (e ?? EDGES[0]).join("|");
  });
  const [res, setRes] = useState<{ key: string; result: Recommendation | null; error: string | null }>(
    { key: "", result: null, error: null },
  );

  const action: Action =
    type === "reduce_capacity" ? { type, target: "database", value: capacity }
      : type === "rate_limit" ? { type, target: limitTarget, value: limit }
        : { type, source: edge.split("|")[0], target: edge.split("|")[1] };
  const key = JSON.stringify(action);

  const reqKey = `${scenario}:${key}`;
  const busy = res.key !== reqKey;
  const { result, error } = res;

  useEffect(() => {
    let live = true;
    const id = setTimeout(() => {
      whatIf(scenario, JSON.parse(key))
        .then((r) => live && setRes({ key: reqKey, result: r.data, error: null }))
        .catch((e: Error) => live && setRes({ key: reqKey, result: null, error: e.message }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [key, scenario, reqKey]);

  const tab = (t: Action["type"], label: string) => (
    <button onClick={() => setType(t)} aria-pressed={type === t}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${type === t ? "bg-surface text-ink shadow-[0_1px_2px_rgb(20_25_34/0.08),0_0_0_1px_rgb(20_25_34/0.06)]" : "text-muted hover:text-ink"}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap gap-0.5 rounded-lg bg-sunk p-1">
        {tab("reduce_capacity", "Database capacity")}
        {tab("rate_limit", "Rate-limit a service")}
        {tab("fix_amplification", "Fix call amplification")}
      </div>

      {type === "reduce_capacity" && (
        <label className="block text-sm">
          <span className="text-muted">Database capacity: </span>
          <b className="font-semibold tabular-nums text-ink">{Math.round(capacity * 100)}%</b>
          <span className="text-muted"> of today</span>
          <input type="range" min={0.5} max={1.5} step={0.05} value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))} className="mt-2 w-full" />
        </label>
      )}
      {type === "rate_limit" && (
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <label>
            <div className="text-muted">Service</div>
            <select value={limitTarget} onChange={(e) => setLimitTarget(e.target.value)}
              className="mt-1 rounded-md border border-line-strong bg-surface px-2 py-1.5 text-ink">
              {ENTRY.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="min-w-48 flex-1">
            <span className="text-muted">Max traffic: </span>
            <b className="font-semibold tabular-nums text-ink">{limit.toFixed(1)}x</b>
            <span className="text-muted"> baseline</span>
            <input type="range" min={0.8} max={3} step={0.1} value={limit}
              onChange={(e) => setLimit(Number(e.target.value))} className="mt-2 w-full" />
          </label>
        </div>
      )}
      {type === "fix_amplification" && (
        <label className="block text-sm">
          <div className="text-muted">Restore calls per request to baseline on edge</div>
          <select value={edge} onChange={(e) => setEdge(e.target.value)}
            className="mt-1 rounded-md border border-line-strong bg-surface px-2 py-1.5 text-ink">
            {EDGES.map(([s, t]) => <option key={`${s}|${t}`} value={`${s}|${t}`}>{s} → {t}</option>)}
          </select>
        </label>
      )}

      <div aria-live="polite" aria-busy={busy} className={`transition-opacity ${busy ? "opacity-60" : ""}`}>
        {error && <div className="rounded-lg border border-warn-line bg-warn-soft p-3 text-sm text-warn">{error}</div>}
        {result && <RecommendationCard rec={result} incident={incident} currentMonthly={currentMonthly} />}
        {!result && !error && (
          <div className="flex h-40 animate-pulse items-center justify-center rounded-lg border border-line bg-canvas text-sm text-muted">
            Simulating the change against the {company.name} model…
          </div>
        )}
      </div>
    </div>
  );
}
