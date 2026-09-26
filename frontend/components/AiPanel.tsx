"use client";

import { explain } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { ScenarioId } from "@/lib/types";
import { Skeleton } from "./ui";

export default function AiPanel({ scenario }: { scenario: ScenarioId }) {
  const { data, error, loading } = useApi(() => explain(scenario), `explain:${scenario}`);
  if (loading && !data) return <Skeleton className="h-40" />;
  if (error || !data) return <p className="text-sm text-slate-400">Explanation unavailable: {error}</p>;
  const s = data.sections;
  return (
    <div className="max-w-[70ch] space-y-3 text-sm leading-relaxed">
      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${
        data.source === "llm" ? "border-violet-600 text-violet-300" : "border-slate-600 text-slate-400"}`}>
        {data.source === "llm" ? "Written by AI · every number checked against the analysis" : "Template explanation (AI off)"}
      </span>
      <p className="text-slate-200">{s.summary}</p>
      {s.root_cause_explanation && <p className="text-slate-300">{s.root_cause_explanation}</p>}
      {s.recommendation_explanation && <p className="text-slate-300">{s.recommendation_explanation}</p>}
      <p className="text-xs text-slate-500">
        The explanation only restates the engine&apos;s analysis. It cannot change the root cause.
      </p>
    </div>
  );
}
