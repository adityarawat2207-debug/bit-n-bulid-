"use client";

import type { ReactNode } from "react";
import { confidence, pct, time, usd } from "@/lib/format";
import type { Factors, IncidentDetail } from "@/lib/types";
import { Bar } from "./ui";

type Event = IncidentDetail["timeline"][number];

/** "search-service v2.0 deployed" → service in bold, the rest plain (labels may or may not repeat the service). */
function EventText({ e }: { e: Event }) {
  const rest = e.service && e.label.startsWith(`${e.service} `) ? e.label.slice(e.service.length + 1) : e.label;
  return (
    <>
      {e.service && <span className="font-semibold text-ink">{e.service} </span>}
      {rest}
    </>
  );
}

/** The whole incident in one line, from what changed to what fixes it. Everything is read
 * from the engine's output; nothing here is inferred on the client. */
export function CausalChain({ inc }: { inc: IncidentDetail }) {
  const rc = inc.root_cause.service;
  const own = inc.timeline.filter((e) => e.service === rc);
  const trigger = own.find((e) => e.label.includes("deployed")) ?? own[0];
  const spread = inc.graph.nodes.filter((n) => n.state === "affected").map((n) => n.id);
  const fix = inc.recommendations.find((r) => r.verdict === "RECOMMENDED");

  const steps: { name: string; dot: string; value: ReactNode; detail: ReactNode }[] = [
    {
      name: "What changed",
      dot: "bg-brand",
      value: trigger ? <EventText e={trigger} /> : "No change event recorded",
      detail: trigger ? `${time(trigger.t)} UTC` : null,
    },
    {
      name: "Likely root cause",
      dot: "bg-alert",
      value: <span className="font-semibold text-alert">{rc}</span>,
      detail: `${confidence(inc.root_cause.confidence)} root-cause confidence`,
    },
    {
      name: "Spread to",
      dot: "bg-warn",
      value: spread.length ? `${spread.length} downstream ${spread.length === 1 ? "service" : "services"}` : "No downstream services",
      detail: spread.join(", ") || `Contained to ${rc}`,
    },
    {
      name: "Estimated impact",
      dot: "bg-alert",
      value: <span className="font-figure text-2xl font-semibold tabular-nums text-ink">+{usd(inc.impact.total_monthly)}/mo</span>,
      detail: `Total cost ${pct(inc.incident.cost_change_pct)} vs baseline`,
    },
    {
      name: "Fix",
      dot: fix ? "bg-ok" : "bg-faint",
      value: fix ? fix.title : "No fix passes the safety limits",
      detail: fix ? (
        <span>Saves <b className="font-semibold text-ok">{usd(fix.savings_monthly)}/mo</b> within latency and error limits</span>
      ) : "Compare the simulated options below",
    },
  ];

  return (
    <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
      {steps.map((s, i) => (
        <li key={s.name} className={`relative flex flex-col bg-surface px-5 py-4 ${i === 4 ? "sm:col-span-2 lg:col-span-1" : ""}`}>
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.name}
          </div>
          <div className="mt-2 text-[15px] leading-snug text-ink-2">{s.value}</div>
          {s.detail && <div className="mt-1.5 text-[13px] leading-snug text-muted">{s.detail}</div>}
          {i < steps.length - 1 && (
            <span aria-hidden className="absolute top-1/2 -right-[9px] z-10 hidden h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-faint lg:flex">
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5"><path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

const FACTORS: { key: keyof Factors; label: string; weight: number }[] = [
  { key: "temporal", label: "Temporal correlation", weight: 0.3 },
  { key: "dependency", label: "Dependency relationship", weight: 0.25 },
  { key: "metric", label: "Own metric change", weight: 0.2 },
  { key: "cost", label: "Cost correlation", weight: 0.15 },
  { key: "historical", label: "Historical evidence", weight: 0.1 },
];

export function FactorBars({ factors, compact = false }: { factors: Factors; compact?: boolean }) {
  return (
    <div className={compact ? "grid grid-cols-5 gap-2" : "space-y-2"}>
      {FACTORS.map((f) => (
        <div key={f.key} title={`${f.label}: ${factors[f.key].toFixed(2)} × weight ${f.weight}`}>
          {!compact && (
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-ink-2">
                {f.label} <span className="text-faint">×{f.weight}</span>
              </span>
              <span className="font-medium tabular-nums text-ink">{factors[f.key].toFixed(2)}</span>
            </div>
          )}
          <Bar value={factors[f.key]} className={compact ? "bg-faint" : "bg-ink-2"} />
          {compact && <div className="mt-0.5 truncate text-[10px] text-faint">{f.key}</div>}
        </div>
      ))}
    </div>
  );
}

export function RootCause({ rc }: { rc: IncidentDetail["root_cause"] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <div className="text-sm text-muted">Likely root cause</div>
        <div className="mt-0.5 flex items-center gap-2 text-2xl font-semibold tracking-tight text-alert">
          <span className="h-2.5 w-2.5 rounded-full bg-alert ring-4 ring-alert-soft" />
          {rc.service}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-figure text-6xl font-semibold leading-none tracking-tight tabular-nums text-ink">{confidence(rc.confidence)}</span>
          <span className="text-sm text-muted">root-cause confidence</span>
        </div>
        <p className="mt-3 text-xs text-muted">
          Weighted score of five signals (PRD §23). It ranks candidates; it is not a probability.
        </p>
      </div>
      <FactorBars factors={rc.factors} />
      <div className="border-t border-line pt-4 md:col-span-2">
        <div className="mb-2 text-sm font-semibold text-ink">Supporting evidence</div>
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {rc.evidence.map((e) => (
            <li key={e} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-alert" />
              <span className="text-ink-2">{e}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Candidates({ candidates }: { candidates: IncidentDetail["candidates"] }) {
  const shown = candidates.filter((c) => c.confidence >= 0.05);
  return (
    <ul className="divide-y divide-line">
      {shown.map((c) => (
        <li key={c.service} className="py-2.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-ink">{c.service}</span>
            <span className="tabular-nums text-muted">{confidence(c.confidence)}</span>
          </div>
          <div className="my-1.5">
            <Bar value={c.confidence} className="bg-faint" />
          </div>
          <p className="text-xs text-muted">
            <span className="font-medium text-ink-2">Ruled out: </span>
            {c.why_not}
          </p>
        </li>
      ))}
      {candidates.length > shown.length && (
        <li className="pt-2 text-xs text-faint">
          {candidates.length - shown.length} more services scored below 5%.
        </li>
      )}
    </ul>
  );
}

function dotColor(label: string, service: string | null) {
  if (label.includes("deployed")) return "bg-brand";
  if (!service) return "bg-alert";
  if (label.includes("load")) return "bg-warn";
  return "bg-alert/70";
}

export function Timeline({ events }: { events: IncidentDetail["timeline"] }) {
  // events that share an hour are shown under one timestamp
  const groups: { t: string; items: IncidentDetail["timeline"] }[] = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last && last.t === e.t) last.items.push(e);
    else groups.push({ t: e.t, items: [e] });
  }
  return (
    <ol className="relative ml-1.5 border-l border-line-strong">
      {groups.map((g) => (
        <li key={g.t} className="mb-5 ml-5 last:mb-0">
          <span className={`absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full ring-4 ring-surface ${dotColor(g.items[0].label, g.items[0].service)}`} />
          <time className="text-xs tabular-nums text-muted">{time(g.t)} UTC</time>
          <ul className="mt-1 space-y-1">
            {g.items.map((e, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm text-ink-2">
                {g.items.length > 1 && <span className={`h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full ${dotColor(e.label, e.service)}`} />}
                <span><EventText e={e} /></span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

const LANDED_COLORS = ["bg-alert", "bg-warn", "bg-brand", "bg-[#6b5bd2]", "bg-ok", "bg-faint"];

export function Impact({ impact }: { impact: IncidentDetail["impact"] }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="font-figure text-4xl font-semibold tracking-tight tabular-nums text-ink">{usd(impact.total_monthly)}<span className="font-sans text-base font-normal text-muted">/mo</span></div>
        <div className="mt-1 text-xs text-muted">Estimated impact from a contribution model, not provider billing data.</div>
      </div>
      {impact.by_cause.map((c) => (
        <div key={c.service}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-ink-2">Traced to <b className="font-semibold text-ink">{c.service}</b></span>
            <span className="font-medium tabular-nums text-ink">{usd(c.amount)}/mo</span>
          </div>
          <div className="flex h-2.5 gap-px overflow-hidden rounded-full bg-sunk">
            {c.landed.map((l, i) => (
              <div key={l.service} className={LANDED_COLORS[i % LANDED_COLORS.length]}
                style={{ width: `${(100 * l.amount) / c.amount}%` }} title={`${l.service}: ${usd(l.amount)}`} />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {c.landed.map((l, i) => (
              <span key={l.service} className="flex items-center gap-1">
                <i className={`h-2 w-2 rounded-sm ${LANDED_COLORS[i % LANDED_COLORS.length]}`} />
                {l.service} {usd(l.amount)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
