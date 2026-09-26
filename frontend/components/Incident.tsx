"use client";

import { confidence, time, usd } from "@/lib/format";
import type { Factors, IncidentDetail } from "@/lib/types";
import { Bar } from "./ui";

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
              <span className="text-slate-400">
                {f.label} <span className="text-slate-600">×{f.weight}</span>
              </span>
              <span className="tabular-nums text-slate-300">{factors[f.key].toFixed(2)}</span>
            </div>
          )}
          <Bar value={factors[f.key]} className={compact ? "bg-slate-500" : "bg-rose-500"} />
          {compact && <div className="mt-0.5 truncate text-[10px] text-slate-600">{f.key}</div>}
        </div>
      ))}
    </div>
  );
}

export function RootCause({ rc }: { rc: IncidentDetail["root_cause"] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <div className="text-sm text-slate-400">Likely root cause</div>
        <div className="mt-0.5 flex items-center gap-2 text-2xl font-semibold tracking-tight text-rose-300">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_12px] shadow-rose-400" />
          {rc.service}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-5xl font-semibold tracking-tight tabular-nums text-white">{confidence(rc.confidence)}</span>
          <span className="text-sm text-slate-400">root-cause confidence</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Weighted score of five signals (PRD §23). It ranks candidates; it is not a probability.
        </p>
      </div>
      <FactorBars factors={rc.factors} />
      <div className="border-t border-slate-800 pt-4 md:col-span-2">
        <div className="mb-2 text-sm text-slate-400">Supporting evidence</div>
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {rc.evidence.map((e) => (
            <li key={e} className="flex gap-2">
              <span className="text-rose-400">▸</span>
              <span className="text-slate-200">{e}</span>
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
    <ul className="divide-y divide-slate-800">
      {shown.map((c) => (
        <li key={c.service} className="py-2.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-slate-200">{c.service}</span>
            <span className="tabular-nums text-slate-400">{confidence(c.confidence)}</span>
          </div>
          <div className="my-1.5">
            <Bar value={c.confidence} className="bg-slate-500" />
          </div>
          <p className="text-xs text-slate-400">
            <span className="text-slate-500">Ruled out: </span>
            {c.why_not}
          </p>
        </li>
      ))}
      {candidates.length > shown.length && (
        <li className="pt-2 text-xs text-slate-500">
          {candidates.length - shown.length} more services scored below 5%.
        </li>
      )}
    </ul>
  );
}

function dotColor(label: string, service: string | null) {
  if (label.includes("deployed")) return "bg-sky-400";
  if (!service) return "bg-rose-500";
  if (label.includes("load")) return "bg-amber-400";
  return "bg-rose-400";
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
    <ol className="relative ml-1.5 border-l border-slate-700/80">
      {groups.map((g) => (
        <li key={g.t} className="mb-5 ml-5 last:mb-0">
          <span className={`absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full ring-4 ring-slate-900 ${dotColor(g.items[0].label, g.items[0].service)}`} />
          <time className="text-xs tabular-nums text-slate-500">{time(g.t)} UTC</time>
          <ul className="mt-1 space-y-1">
            {g.items.map((e, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm text-slate-300">
                {g.items.length > 1 && <span className={`h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full ${dotColor(e.label, e.service)}`} />}
                <span>
                  {e.service && <span className="font-medium text-white">{e.service} </span>}
                  {e.service && e.label.startsWith(`${e.service} `) ? e.label.slice(e.service.length + 1) : e.label}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

const LANDED_COLORS = ["bg-rose-500", "bg-amber-500", "bg-sky-500", "bg-violet-500", "bg-emerald-500", "bg-slate-500"];

export function Impact({ impact }: { impact: IncidentDetail["impact"] }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-3xl font-semibold tracking-tight tabular-nums text-white">{usd(impact.total_monthly)}<span className="text-base font-normal text-slate-400">/mo</span></div>
        <div className="text-xs text-slate-500">Estimated impact from a contribution model, not provider billing data.</div>
      </div>
      {impact.by_cause.map((c) => (
        <div key={c.service}>
          <div className="mb-1 flex justify-between text-sm">
            <span>Traced to <b className="text-white">{c.service}</b></span>
            <span className="tabular-nums">{usd(c.amount)}/mo</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-800">
            {c.landed.map((l, i) => (
              <div key={l.service} className={LANDED_COLORS[i % LANDED_COLORS.length]}
                style={{ width: `${(100 * l.amount) / c.amount}%` }} title={`${l.service}: ${usd(l.amount)}`} />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
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
