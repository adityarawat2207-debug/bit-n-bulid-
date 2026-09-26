"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { COMPANIES, companyOf } from "@/lib/companies";
import { changeColor, confidence, pct, usd } from "@/lib/format";
import type { IncidentDetail, Overview, Scenario, ScenarioId } from "@/lib/types";

// light "segmented control": a sunk track with the pressed option raised in white
const TRACK = "flex flex-wrap gap-0.5 rounded-lg bg-sunk p-1";
const SEG = "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-wait";
const SEG_ON = "bg-surface shadow-[0_1px_2px_rgb(20_25_34/0.08),0_0_0_1px_rgb(20_25_34/0.06)]";

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
      <div role="group" aria-label="Trigger an incident" className={TRACK}>
        {incidents.map((s) => {
          const on = active === s.id;
          return (
            <button
              key={s.id}
              title={s.description}
              aria-pressed={on}
              disabled={busy}
              onClick={() => onSelect(s.id)}
              className={`${SEG} flex items-center gap-2 ${on ? `${SEG_ON} text-alert` : "text-muted hover:text-ink"}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-alert" : "bg-line-strong"}`} />
              {s.name}
            </button>
          );
        })}
      </div>
      <button
        disabled={busy || active === company.baseline}
        onClick={() => onSelect(company.baseline)}
        className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-ink/40 disabled:border-line disabled:bg-transparent disabled:text-faint"
      >
        Reset to baseline
      </button>
      {busy && <span className="text-sm text-muted">Analysing 30 days of data…</span>}
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
    <div role="group" aria-label="Simulated company" className={`${TRACK} w-fit`}>
      {COMPANIES.map((c) => {
        const on = c.id === current.id;
        return (
          <button
            key={c.id}
            aria-pressed={on}
            disabled={busy}
            onClick={() => !on && onSelect(c.baseline)}
            className={`${SEG} text-left leading-tight ${on ? `${SEG_ON} text-ink` : "text-muted hover:text-ink"}`}
          >
            {c.name}
            <span className={`ml-1.5 text-xs font-normal ${on ? "text-muted" : "text-faint"}`}>{c.tagline}</span>
          </button>
        );
      })}
    </div>
  );
}

function Kpi({ label, value, sub, tone = "text-ink", className = "" }: {
  className?: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
}) {
  return (
    <div className={`bg-surface px-5 py-4 ${className}`}>
      <div className="text-[13px] font-medium text-muted">{label}</div>
      <div className={`mt-1 font-figure text-[32px] font-semibold leading-none tracking-tight tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="mt-2 text-xs text-muted">{sub}</div>}
    </div>
  );
}

/** One ledger strip rather than five floating cards; the hairlines come from the gap. */
export function KpiCards({ kpis }: { kpis: Overview["kpis"] }) {
  const up = kpis.change_pct > 5;
  const delta = kpis.current_monthly - kpis.baseline_monthly;
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-5">
      <Kpi label="Current cost" value={usd(kpis.current_monthly)} sub="Monthly run-rate" tone={up ? "text-alert" : "text-ink"} />
      <Kpi label="Baseline" value={usd(kpis.baseline_monthly)} sub="Prior 14 days" />
      <Kpi label="Change" value={pct(kpis.change_pct)} tone={up ? "text-alert" : kpis.change_pct < -5 ? "text-ok" : "text-ink"}
        sub={`${delta >= 0 ? "+" : ""}${usd(delta)}/mo vs baseline`} />
      <Kpi label="Active anomalies" value={kpis.active_anomalies} tone={kpis.active_anomalies ? "text-alert" : "text-ink"} sub="Mean + 2σ rule" />
      <Kpi label="Estimated preventable cost" value={usd(kpis.preventable_monthly)}
        sub={kpis.preventable_monthly ? "Per month, with the top fix" : "Nothing to fix"}
        tone={kpis.preventable_monthly ? "text-ok" : "text-ink"} className="col-span-2 md:col-span-1" />
    </div>
  );
}

export function IncidentBanner({ incident, scenario }: { incident: IncidentDetail; scenario: ScenarioId }) {
  const i = incident.incident;
  return (
    <Link
      href={`/incidents/${scenario}`}
      className="group flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-alert-line border-l-4 border-l-alert bg-surface px-5 py-3.5 text-sm transition-colors hover:bg-alert-soft/60"
    >
      <span className="flex items-center gap-2 font-semibold text-alert">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-alert opacity-40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-alert" />
        </span>
        Cost anomaly {pct(i.cost_change_pct)}
      </span>
      <span className="text-ink-2">
        Likely root cause <b className="font-semibold text-ink">{incident.root_cause.service}</b>{" "}
        <span className="text-muted">({confidence(incident.root_cause.confidence)} root-cause confidence)</span>
      </span>
      <span className="text-muted">Estimated impact <b className="font-semibold text-ink">{usd(incident.impact.total_monthly)}/mo</b></span>
      <span className="ml-auto font-semibold text-alert underline decoration-alert-line underline-offset-4 group-hover:decoration-alert">
        View analysis
      </span>
    </Link>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  compute: "Compute", database: "Database", network: "Network", cache: "Cache (Redis)", storage: "Storage", cdn: "CDN",
  queue: "Event queue", maps: "Maps API (per call)",
};

function Head({ first }: { first: string }) {
  return (
    <thead>
      <tr className="text-left text-xs text-muted">
        <th className="pb-2 font-medium">{first}</th>
        <th className="pb-2 text-right font-medium">Normal</th>
        <th className="pb-2 text-right font-medium">Current</th>
        <th className="pb-2 text-right font-medium">Change</th>
      </tr>
    </thead>
  );
}

export function BreakdownTable({ rows }: { rows: Overview["breakdown"] }) {
  const max = Math.max(...rows.map((r) => Math.max(r.current, r.baseline)));
  return (
    <table className="w-full text-sm">
      <Head first="Resource" />
      <tbody>
        {rows.map((r) => {
          const change = r.baseline ? (100 * (r.current - r.baseline)) / r.baseline : 0;
          return (
            <tr key={r.category} className="border-t border-line transition-colors hover:bg-canvas">
              <td className="py-2 pr-4 text-ink">
                {CATEGORY_LABEL[r.category] ?? r.category}
                <div className="relative mt-1.5 h-1 rounded bg-sunk">
                  <div className={`h-1 rounded ${change > 5 ? "bg-alert" : "bg-brand/70"}`} style={{ width: `${(100 * r.current) / max}%` }} />
                  <div className="absolute top-[-3px] h-2.5 w-0.5 rounded bg-ink/60" style={{ left: `${(100 * r.baseline) / max}%` }} title="Normal" />
                </div>
              </td>
              <td className="py-2 text-right tabular-nums text-muted">{usd(r.baseline)}</td>
              <td className="py-2 text-right tabular-nums text-ink">{usd(r.current)}</td>
              <td className={`py-2 text-right font-medium tabular-nums ${changeColor(change)}`}>{pct(change)}</td>
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
      <Head first="Service" />
      <tbody>
        {sorted.map((s) => (
          <tr key={s.id} className="border-t border-line transition-colors hover:bg-canvas">
            <td className="py-2">
              <span className={s.change_pct > 5 ? "font-medium text-ink" : "text-ink-2"}>{s.id}</span>{" "}
              <span className="text-xs text-faint">{s.kind}</span>
            </td>
            <td className="py-2 text-right tabular-nums text-muted">{usd(s.cost_baseline)}</td>
            <td className="py-2 text-right tabular-nums text-ink">{usd(s.cost_current)}</td>
            <td className={`py-2 text-right font-medium tabular-nums ${changeColor(s.change_pct)}`}>{pct(s.change_pct)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
