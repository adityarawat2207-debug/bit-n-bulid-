"use client";

import { useEffect, useState } from "react";
import { whatIf } from "@/lib/api";
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
  const tone = good === null ? "text-slate-200" : good ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="bg-slate-950/40 px-3 py-2" title={hint}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`font-medium tabular-nums ${tone}`}>{value}</div>
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
    <div className={`flex flex-col rounded-xl border p-4 ${
      ok ? "border-emerald-700/80 bg-emerald-950/25 shadow-[0_0_32px_-12px] shadow-emerald-500/40" : "border-slate-800 bg-slate-900/40"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-medium leading-snug text-white">{rec.title}</h3>
        <Verdict verdict={rec.verdict} />
      </div>
      <p className="mt-1.5 text-sm text-slate-400">{reasonFor(rec, incident)}</p>

      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800 text-sm sm:grid-cols-4">
        <Metric label="Savings" hint="Estimated monthly savings" value={`${usd(rec.savings_monthly)}/mo`} good={rec.savings_monthly > 0} />
        <Metric label="Latency" hint="Latency change; limit +10%" value={pct(rec.latency_pct)}
          good={rec.latency_pct <= 10 ? (rec.latency_pct < 0 ? true : null) : false} />
        <Metric label="Error rate" hint="Reliability: error-rate change; limit +0.5pp" value={pp(rec.error_pp)}
          good={rec.error_pp <= 0.5 ? (rec.error_pp < 0 ? true : null) : false} />
        <Metric label="DB CPU" hint="Database CPU after the change; limit 85%" value={`${Math.round(rec.db_cpu * 100)}%`}
          good={rec.db_cpu <= 0.85 ? null : false} />
      </div>

      {currentMonthly !== undefined && after !== undefined && (
        <div className="mt-3 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Monthly cost</span>
            <span className="tabular-nums">
              {usd(currentMonthly)} → <b className={`font-medium ${after < currentMonthly ? "text-emerald-300" : "text-rose-300"}`}>{usd(after)}</b>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className={`h-full rounded-full ${ok ? "bg-emerald-500/80" : "bg-slate-500"}`}
              style={{ width: `${Math.min(100, (100 * after) / Math.max(after, currentMonthly))}%` }} />
          </div>
        </div>
      )}

      {rec.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-rose-300">
          {rec.reasons.map((r) => (
            <li key={r} className="flex gap-2"><span aria-hidden>✕</span>{r}</li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <Level level={rec.risk} label="Risk" />
        {isFix && incident && (
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
            Root-cause confidence {confidence(incident.root_cause.confidence)}
          </span>
        )}
      </div>
    </div>
  );
}

const ENTRY = ["search-service", "order-service", "image-service", "auth-service"];
const EDGES: [string, string][] = [
  ["search-service", "database"], ["search-service", "redis"], ["order-service", "database"],
  ["order-service", "payment-service"], ["auth-service", "database"], ["image-service", "cdn"],
];

/** Build a custom action and simulate it against the live backend (PRD §29). */
export function WhatIfPanel({ scenario, incident, currentMonthly }: {
  scenario: ScenarioId;
  incident: IncidentDetail | null;
  currentMonthly?: number;
}) {
  const [type, setType] = useState<Action["type"]>("reduce_capacity");
  const [capacity, setCapacity] = useState(0.75);
  const [limitTarget, setLimitTarget] = useState(incident && ENTRY.includes(incident.root_cause.service) ? incident.root_cause.service : "image-service");
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
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${type === t ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white"}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
        {tab("reduce_capacity", "Database capacity")}
        {tab("rate_limit", "Rate-limit a service")}
        {tab("fix_amplification", "Fix call amplification")}
      </div>

      {type === "reduce_capacity" && (
        <label className="block text-sm">
          <span className="text-slate-400">Database capacity: </span>
          <b className="tabular-nums text-white">{Math.round(capacity * 100)}%</b>
          <span className="text-slate-500"> of today</span>
          <input type="range" min={0.5} max={1.5} step={0.05} value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))} className="mt-2 w-full accent-sky-500" />
        </label>
      )}
      {type === "rate_limit" && (
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <label>
            <div className="text-slate-400">Service</div>
            <select value={limitTarget} onChange={(e) => setLimitTarget(e.target.value)}
              className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5">
              {ENTRY.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="min-w-48 flex-1">
            <span className="text-slate-400">Max traffic: </span>
            <b className="tabular-nums text-white">{limit.toFixed(1)}x</b>
            <span className="text-slate-500"> baseline</span>
            <input type="range" min={0.8} max={3} step={0.1} value={limit}
              onChange={(e) => setLimit(Number(e.target.value))} className="mt-2 w-full accent-sky-500" />
          </label>
        </div>
      )}
      {type === "fix_amplification" && (
        <label className="block text-sm">
          <div className="text-slate-400">Restore calls per request to baseline on edge</div>
          <select value={edge} onChange={(e) => setEdge(e.target.value)}
            className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5">
            {EDGES.map(([s, t]) => <option key={`${s}|${t}`} value={`${s}|${t}`}>{s} → {t}</option>)}
          </select>
        </label>
      )}

      <div aria-live="polite" aria-busy={busy} className={`transition-opacity ${busy ? "opacity-60" : ""}`}>
        {error && <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-300">{error}</div>}
        {result && <RecommendationCard rec={result} incident={incident} currentMonthly={currentMonthly} />}
        {!result && !error && (
          <div className="flex h-40 animate-pulse items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-sm text-slate-500">
            Simulating the change against the ShopX model…
          </div>
        )}
      </div>
    </div>
  );
}
