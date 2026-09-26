"use client";

import { explain } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { ScenarioId } from "@/lib/types";
import { Skeleton } from "./ui";

export default function AiPanel({ scenario }: { scenario: ScenarioId }) {
  const { data, error, loading } = useApi(() => explain(scenario), `explain:${scenario}`);
  if (loading && !data) return <Skeleton className="h-40" />;
  if (error || !data) return <p className="text-sm text-muted">Explanation unavailable: {error}</p>;
  const s = data.sections;
  return (
    <div className="max-w-[70ch] space-y-3 text-sm leading-relaxed">
      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
        data.source === "llm" ? "bg-brand-soft text-brand" : "bg-sunk text-muted"}`}>
        {data.source === "llm" ? "Written by AI; every number is checked against the analysis" : "Template explanation (AI off or busy)"}
      </span>
      <p className="text-[15px] text-ink">{s.summary}</p>
      {s.root_cause_explanation && <p className="text-ink-2">{s.root_cause_explanation}</p>}
      {s.recommendation_explanation && <p className="text-ink-2">{s.recommendation_explanation}</p>}
      <p className="text-xs text-muted">
        The explanation only restates the engine&apos;s analysis. It cannot change the root cause.
      </p>
    </div>
  );
}
