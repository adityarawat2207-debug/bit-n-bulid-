"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { hourLabel, usd } from "@/lib/format";
import type { Overview } from "@/lib/types";

const REPLAY_LEAD_HOURS = 6; // start drawing a few hours before the anomaly
const REPLAY_POINTS = 48; // fallback when there is no onset
const REPLAY_MS = 6000;
const kUsd = (n: number) => `$${(n / 1000).toFixed(1)}k`;
const tooltipStyle = { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 };
const axisTick = { fill: "#64748b", fontSize: 11 };

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
  // fixed axis from the full series, so it does not rescale mid-replay
  const yDomain = useMemo(() => {
    const all = hourly.flatMap((p) => [p.cost_monthly, p.baseline_monthly]);
    return [Math.floor((Math.min(...all) * 0.9) / 1000) * 1000, Math.ceil((Math.max(...all) * 1.05) / 1000) * 1000];
  }, [hourly]);

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="excessFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#fb7185" stopOpacity={0.12} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1e293b" vertical={false} />
          <XAxis dataKey="t" tickFormatter={(t: string) => hourLabel(t).split(" ").slice(0, 2).join(" ")}
            interval={23} tick={axisTick} stroke="#334155" tickLine={false} />
          <YAxis tickFormatter={kUsd} tick={axisTick} stroke="#334155" width={52} tickLine={false} axisLine={false}
            domain={yDomain} allowDataOverflow />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => hourLabel(String(t))}
            formatter={(v, name) => Array.isArray(v)
              ? [`${usd(Number(v[1]) - Number(v[0]))}/mo`, name]
              : [`${usd(Number(v))}/mo`, name]} />
          <Area name="Spend above baseline" dataKey="excess" stroke="none" fill="url(#excessFill)"
            isAnimationActive={false} connectNulls={false} />
          <Line name="Baseline (same hour, prior 14 days)" dataKey="baseline" stroke="#64748b" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          <Line name="Cost run-rate" dataKey="cost" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          {onsetVisible && (
            <ReferenceLine x={onsetAt ?? undefined} stroke="#fb7185" strokeDasharray="3 3"
              label={{ value: "Anomaly begins", fill: "#fb7185", fontSize: 11, position: "insideTopLeft" }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-sky-400" />Cost run-rate</span>
        <span className="flex items-center gap-1.5"><i className="h-0 w-4 border-t border-dashed border-slate-400" />Baseline (same hour, prior 14 days)</span>
        {onsetIdx >= 0 && (
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-sm bg-rose-400/40" />Spend above baseline</span>
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
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d: string) => hourLabel(`${d}T00:00:00Z`).split(" ").slice(0, 2).join(" ")}
          interval={4} tick={axisTick} stroke="#334155" tickLine={false} />
        <YAxis tickFormatter={(n: number) => `$${n}`} tick={axisTick} stroke="#334155" width={52} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#1e293b" }}
          formatter={(v, _n, item) => [`${usd(Number(v))}/day${item.payload.anomalous ? " · anomaly" : ""}`, "Spend"]} />
        <Bar dataKey="cost" radius={[3, 3, 0, 0]} maxBarSize={18}>
          {daily.map((d) => (
            <Cell key={d.date} fill={d.anomalous ? "#fb7185" : "#334155"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
