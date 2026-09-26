"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { COMPANIES, companyOf } from "@/lib/companies";
import { changeColor, confidence, pct, usd } from "@/lib/format";
import type { IncidentDetail, Overview, Scenario, ScenarioId } from "@/lib/types";

export function ScenarioBar({ scenarios, active, onSelect, busy }: {
  scenarios: Scenario[];
  active: ScenarioId;
  onSelect: (s: ScenarioId) => void;
  busy?: boolean;
}) {
  const company = companyOf(active);
  const incidents = scenarios.filter((s) => s.company === company.id && s.id !== company.baseline);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <CompanySwitch active={active} onSelect={onSelect} busy={busy} />
      <div role="group" aria-label="Trigger an incident" className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
        {incidents.map((s) => {
          const on = active === s.id;
          return (
            <button
              key={s.id}
              title={s.description}
              aria-pressed={on}
              disabled={busy}
              onClick={() => onSelect(s.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors disabled:cursor-wait ${
                on ? "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/60" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-rose-400" : "bg-slate-600"}`} />
              {s.name}
            </button>
          );
        })}
      </div>
      <button
        disabled={busy || active === company.baseline}
        onClick={() => onSelect(company.baseline)}
        className="rounded-lg border border-emerald-800 px-3 py-1.5 text-sm text-emerald-300 transition-colors hover:bg-emerald-950 disabled:border-slate-800 disabled:text-slate-500 disabled:hover:bg-transparent"
      >
        ↺ Reset to baseline
      </button>
      {busy && <span className="text-xs text-slate-500">Analysing 30 days of data…</span>}
    </div>
  );
}

/** Pick which simulated company to analyse; switching starts at its healthy baseline. */
export function CompanySwitch({ active, onSelect, busy }: {
  active: ScenarioId;
  onSelect: (s: ScenarioId) => void;
  busy?: boolean;
}) {
  const current = companyOf(active);
  return (
    <div role="group" aria-label="Simulated company" className="flex w-fit gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
      {COMPANIES.map((c) => {
        const on = c.id === current.id;
        return (
          <button
            key={c.id}
            aria-pressed={on}
            disabled={busy}
            onClick={() => !on && onSelect(c.baseline)}
            className={`rounded-lg px-3 py-1.5 text-left text-sm leading-tight transition-colors disabled:cursor-wait ${
              on ? "bg-sky-500/15 text-sky-100 ring-1 ring-sky-500/60" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="font-medium">{c.name}</span>
            <span className={`ml-1.5 text-xs ${on ? "text-sky-300/80" : "text-slate-500"}`}>{c.tagline}</span>
          </button>
        );
      })}
    </div>
  );
}

function Kpi({ label, value, sub, tone = "text-white", accent, className = "" }: {
  className?: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
  accent?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-4 ${accent ? "pl-5" : ""} ${className}`}>
      {accent && <span className={`absolute inset-y-3 left-0 w-1 rounded-r ${accent}`} />}
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function KpiCards({ kpis }: { kpis: Overview["kpis"] }) {
  const up = kpis.change_pct > 5;
  const delta = kpis.current_monthly - kpis.baseline_monthly;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Kpi label="Current cost" value={usd(kpis.current_monthly)} sub="monthly run-rate"
        tone={up ? "text-rose-300" : "text-white"} accent={up ? "bg-rose-500" : "bg-sky-500"} />
      <Kpi label="Baseline" value={usd(kpis.baseline_monthly)} sub="prior 14 days" />
      <Kpi label="Change" value={pct(kpis.change_pct)} tone={up ? "text-rose-400" : "text-emerald-400"}
        sub={`${delta >= 0 ? "+" : ""}${usd(delta)}/mo vs baseline`} />
      <Kpi label="Active anomalies" value={kpis.active_anomalies} tone={kpis.active_anomalies ? "text-rose-400" : "text-white"} sub="mean + 2σ rule" />
      <Kpi label="Estimated preventable cost" value={usd(kpis.preventable_monthly)}
        sub={kpis.preventable_monthly ? "per month, with the top fix" : "nothing to fix"}
        tone={kpis.preventable_monthly ? "text-emerald-300" : "text-white"}
        accent={kpis.preventable_monthly ? "bg-emerald-500" : undefined} className="col-span-2 md:col-span-1" />
    </div>
  );
}

export function IncidentBanner({ incident, scenario }: { incident: IncidentDetail; scenario: ScenarioId }) {
  const i = incident.incident;
  return (
    <Link
      href={`/incidents/${scenario}`}
      className="group flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-rose-800/80 bg-gradient-to-r from-rose-950/70 to-rose-950/20 px-4 py-3 text-sm transition-colors hover:border-rose-600"
    >
      <span className="flex items-center gap-2 font-semibold text-rose-300">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
        Cost anomaly {pct(i.cost_change_pct)}
      </span>
      <span className="text-slate-300">
        Likely root cause <b className="text-white">{incident.root_cause.service}</b>{" "}
        <span className="text-slate-400">({confidence(incident.root_cause.confidence)} root-cause confidence)</span>
      </span>
      <span className="text-slate-400">Estimated impact <b className="font-medium text-slate-200">{usd(incident.impact.total_monthly)}/mo</b></span>
      <span className="ml-auto font-medium text-rose-300 group-hover:text-rose-200">
        View analysis <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  compute: "Compute", database: "Database", network: "Network", cache: "Cache (Redis)", storage: "Storage", cdn: "CDN",
  queue: "Event queue", maps: "Maps API (per call)",
};

export function BreakdownTable({ rows }: { rows: Overview["breakdown"] }) {
  const max = Math.max(...rows.map((r) => Math.max(r.current, r.baseline)));
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-slate-500">
          <th className="pb-2 font-normal">Resource</th>
          <th className="pb-2 text-right font-normal">Normal</th>
          <th className="pb-2 text-right font-normal">Current</th>
          <th className="pb-2 text-right font-normal">Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const change = r.baseline ? (100 * (r.current - r.baseline)) / r.baseline : 0;
          return (
            <tr key={r.category} className="border-t border-slate-800">
              <td className="py-1.5 pr-4">
                {CATEGORY_LABEL[r.category] ?? r.category}
                <div className="relative mt-1 h-1 rounded bg-slate-800">
                  <div className={`h-1 rounded ${change > 5 ? "bg-rose-500/80" : "bg-sky-600"}`} style={{ width: `${(100 * r.current) / max}%` }} />
                  <div className="absolute top-[-2px] h-2 w-px bg-slate-400" style={{ left: `${(100 * r.baseline) / max}%` }} title="Normal" />
                </div>
              </td>
              <td className="py-1.5 text-right tabular-nums text-slate-400">{usd(r.baseline)}</td>
              <td className="py-1.5 text-right tabular-nums">{usd(r.current)}</td>
              <td className={`py-1.5 text-right tabular-nums ${changeColor(change)}`}>{pct(change)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ServiceTable({ rows }: { rows: Overview["services"] }) {
  const sorted = [...rows].sort((a, b) => b.cost_current - b.cost_baseline - (a.cost_current - a.cost_baseline));
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-slate-500">
          <th className="pb-2 font-normal">Service</th>
          <th className="pb-2 text-right font-normal">Normal</th>
          <th className="pb-2 text-right font-normal">Current</th>
          <th className="pb-2 text-right font-normal">Change</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((s) => (
          <tr key={s.id} className="border-t border-slate-800">
            <td className="py-1.5">
              <span className={s.change_pct > 5 ? "text-white" : "text-slate-300"}>{s.id}</span>{" "}
              <span className="text-xs text-slate-500">{s.kind}</span>
            </td>
            <td className="py-1.5 text-right tabular-nums text-slate-400">{usd(s.cost_baseline)}</td>
            <td className="py-1.5 text-right tabular-nums">{usd(s.cost_current)}</td>
            <td className={`py-1.5 text-right tabular-nums ${changeColor(s.change_pct)}`}>{pct(s.change_pct)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
