"use client";

import { getLive, resetLive, type LiveStatus } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useState } from "react";
import { STORE_URL } from "@/lib/companies";

const BUTTON = "rounded-md border border-line-strong px-3 py-1 text-xs font-medium text-ink-2 hover:border-ink/40 hover:text-ink";

/** Live telemetry from the connected ShopX store (backend app/live.py). */
export default function LivePanel({ tick }: { tick: number }) {
  const [resets, setResets] = useState(0);
  const live = useApi(() => getLive().then((data) => ({ data, source: "live" as const })), `${tick}:${resets}`);
  const s: LiveStatus | null = live.data;
  const qpr = s?.db_queries_per_request;
  const hot = qpr != null && qpr > s!.baseline_queries_per_request * 1.05;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-line bg-surface px-5 py-3 text-sm">
      <span className="flex items-center gap-2 font-semibold text-ink">
        <span className={`h-2 w-2 rounded-full ${s ? "animate-pulse bg-ok" : "bg-line-strong"}`} />
        {s ? "Connected: ShopX store" : live.error ? "Store telemetry unavailable" : "Connecting…"}
      </span>
      {s && (
        <>
          <span className="text-muted">Requests seen <b className="font-semibold tabular-nums text-ink">{s.requests_total}</b></span>
          <span className="text-muted">
            DB queries / search{" "}
            <b className={`font-semibold tabular-nums ${hot ? "text-alert" : "text-ink"}`}>{qpr != null ? qpr.toFixed(1) : "—"}</b>
            <span className="text-faint"> (normal {s.baseline_queries_per_request})</span>
          </span>
          {s.latency_ms != null && (
            <span className="text-muted">Latency <b className="font-semibold tabular-nums text-ink">{Math.round(s.latency_ms)} ms</b></span>
          )}
          {s.versions["search-service"] && (
            <span className="text-muted">search-service <b className="font-semibold text-ink">{s.versions["search-service"]}</b></span>
          )}
        </>
      )}
      <span className="ml-auto flex gap-2">
        <a href={STORE_URL} target="_blank" rel="noreferrer" className={BUTTON}>Open store ↗</a>
        <button onClick={() => resetLive().finally(() => setResets((n) => n + 1))} className={BUTTON}>
          Clear telemetry
        </button>
      </span>
    </div>
  );
}
