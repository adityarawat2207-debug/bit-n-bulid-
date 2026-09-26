"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";
import { hourLabel, usd } from "@/lib/format";
import type { Overview } from "@/lib/types";

const REPLAY_LEAD_HOURS = 6; // start drawing a few hours before the anomaly
const REPLAY_POINTS = 48; // fallback when there is no onset
const REPLAY_MS = 6000;
const kUsd = (n: number) => `$${(n / 1000).toFixed(1)}k`;
const axisTick = { fill: "#667085", fontSize: 11 };
const BRAND = "#0a6c7c";
const ALERT = "#c8321f";

type TipRow = { label: string; value: string; swatch: string; strong?: boolean };

function Tip({ title, rows, note }: { title: string; rows: TipRow[]; note?: ReactNode }) {
  return (
    <div className="min-w-52 rounded-lg border border-line bg-surface px-3 py-2.5 text-xs shadow-[0_8px_24px_rgb(20_25_34/0.10)]">
      <div className="mb-2 font-semibold text-ink">{title}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 text-muted"><i className={`h-2 w-2 rounded-sm ${r.swatch}`} />{r.label}</span>
            <span className={`tabular-nums ${r.strong ? "font-semibold text-ink" : "text-ink-2"}`}>{r.value}</span>
          </div>
        ))}
      </div>
      {note && <div className="mt-2 border-t border-line pt-1.5 font-medium text-alert">{note}</div>}
    </div>
  );
}

type HourPoint = { t: string; baseline: number; cost: number | null; excess: number[] | null };

/** Monthly run-rate, hourly, last 7 days. When `replayKey` changes, the chart
 * is redrawn from just before the anomaly over ~6s so the audience watches
 * the cost climb. */
export function HourlyCostChart({ hourly, onsetAt, replayKey }: {
  hourly: Overview["hourly"];
  onsetAt: string | null;
  replayKey: number;
}) {
  const onsetIdx = onsetAt ? hourly.findIndex((p) => p.t === onsetAt) : -1;
  const start = onsetIdx >= 0 ? Math.max(0, onsetIdx - REPLAY_LEAD_HOURS) : Math.max(0, hourly.length - REPLAY_POINTS);
  const steps = hourly.length - start;

  // frame of the current replay; a new replayKey restarts at frame 0
  const [frame, setFrame] = useState({ key: 0, n: 0 });
  useEffect(() => {
    if (!replayKey) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setFrame({ key: replayKey, n });
      if (n >= steps) clearInterval(id);
    }, REPLAY_MS / steps);
    return () => clearInterval(id);
  }, [replayKey, steps]);
  const visible = !replayKey ? hourly.length : start + (frame.key === replayKey ? frame.n : 0);

  const data = useMemo(
    () =>
      hourly.map((p, i) => {
        const shown = i < visible;
        return {
          t: p.t,
          baseline: p.baseline_monthly,
          cost: shown ? p.cost_monthly : null,
          // band between the baseline and the cost line, from the anomaly onward
          excess: shown && onsetIdx >= 0 && i >= onsetIdx
            ? [p.baseline_monthly, Math.max(p.cost_monthly, p.baseline_monthly)]
            : null,
        };
      }),
    [hourly, visible, onsetIdx],
  );
  const onsetVisible = onsetIdx >= 0 && onsetIdx < visible;
  const last = visible > 0 ? hourly[visible - 1] : null; // the newest drawn hour, marked with a dot
  // fixed axis from the full series, so it does not rescale mid-replay
  const yDomain = useMemo(() => {
    const all = hourly.flatMap((p) => [p.cost_monthly, p.baseline_monthly]);
    return [Math.floor((Math.min(...all) * 0.9) / 1000) * 1000, Math.ceil((Math.max(...all) * 1.05) / 1000) * 1000];
  }, [hourly]);

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="excessFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ALERT} stopOpacity={0.22} />
              <stop offset="100%" stopColor={ALERT} stopOpacity={0.06} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#eef1f4" vertical={false} />
          <XAxis dataKey="t" tickFormatter={(t: string) => hourLabel(t).split(" ").slice(0, 2).join(" ")}
            interval={23} tick={axisTick} stroke="#cdd3db" tickLine={false} />
          <YAxis tickFormatter={kUsd} tick={axisTick} stroke="#cdd3db" width={52} tickLine={false} axisLine={false}
            domain={yDomain} allowDataOverflow />
          <Tooltip cursor={{ stroke: "#cdd3db" }} content={({ active, payload }) => {
            const p = active && payload?.[0] ? (payload[0].payload as HourPoint) : null;
            if (!p) return null;
            const rows: TipRow[] = [];
            if (p.cost != null) rows.push({ label: "Cost run-rate", value: `${usd(p.cost)}/mo`, swatch: "bg-brand", strong: true });
            rows.push({ label: "Baseline", value: `${usd(p.baseline)}/mo`, swatch: "bg-faint" });
            const over = p.excess ? p.excess[1] - p.excess[0] : 0;
            return <Tip title={`${hourLabel(p.t)} UTC`} rows={rows} note={over >= 1 ? `${usd(over)}/mo above baseline` : undefined} />;
          }} />
          <Area name="Spend above baseline" dataKey="excess" stroke="none" fill="url(#excessFill)"
            isAnimationActive={false} connectNulls={false} />
          <Line name="Baseline (same hour, prior 14 days)" dataKey="baseline" stroke="#98a2b3" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          <Line name="Cost run-rate" dataKey="cost" stroke={BRAND} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false}
            activeDot={{ r: 4, fill: BRAND, stroke: "#fff", strokeWidth: 2 }} />
          {last && (
            <ReferenceDot x={last.t} y={last.cost_monthly} r={4} fill={BRAND} stroke="#fff" strokeWidth={2} />
          )}
          {onsetVisible && (
            <ReferenceLine x={onsetAt ?? undefined} stroke={ALERT} strokeDasharray="3 3"
              label={{ value: "Anomaly begins", fill: ALERT, fontSize: 11, fontWeight: 600, position: "insideTopLeft" }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-brand" />Cost run-rate</span>
        <span className="flex items-center gap-1.5"><i className="h-0 w-4 border-t border-dashed border-faint" />Baseline (same hour, prior 14 days)</span>
        {onsetIdx >= 0 && (
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-sm bg-alert/20" />Spend above baseline</span>
        )}
      </div>
    </div>
  );
}

/** Cloud spending, last 30 days (PRD §15). Anomalous days (§17) in red. */
export function DailyCostChart({ daily, height = 240 }: { daily: Overview["daily"]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={daily} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#eef1f4" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d: string) => hourLabel(`${d}T00:00:00Z`).split(" ").slice(0, 2).join(" ")}
          interval={4} tick={axisTick} stroke="#cdd3db" tickLine={false} />
        <YAxis tickFormatter={(n: number) => `$${n}`} tick={axisTick} stroke="#cdd3db" width={52} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "#eef1f4" }} content={({ active, payload }) => {
          const d = active && payload?.[0] ? (payload[0].payload as Overview["daily"][number]) : null;
          if (!d) return null;
          return (
            <Tip title={hourLabel(`${d.date}T00:00:00Z`).split(" ").slice(0, 2).join(" ")}
              rows={[{ label: "Spend", value: `${usd(d.cost)}/day`, swatch: d.anomalous ? "bg-alert" : "bg-[#b9c7d0]", strong: true }]}
              note={d.anomalous ? "Above mean + 2σ of the prior 14 days" : undefined} />
          );
        }} />
        <Bar dataKey="cost" radius={[3, 3, 0, 0]} maxBarSize={18}>
          {daily.map((d) => (
            <Cell key={d.date} fill={d.anomalous ? ALERT : "#b9c7d0"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
