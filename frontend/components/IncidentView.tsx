"use client";

import Link from "next/link";
import { getIncident, getOverview, getScenarios } from "@/lib/api";
import { pct, time } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { ScenarioId } from "@/lib/types";
import AiPanel from "./AiPanel";
import DependencyGraph, { GraphLegend } from "./DependencyGraph";
import { Candidates, Impact, RootCause, Timeline } from "./Incident";
import { RecommendationCard, WhatIfPanel } from "./Recommendations";
import { Card, ErrorBox, Level, Skeleton, SourceBadge } from "./ui";

export default function IncidentView({ scenario }: { scenario: ScenarioId }) {
  const incident = useApi(() => getIncident(scenario), scenario);
  const overview = useApi(() => getOverview(scenario), scenario);
  const scenarios = useApi(getScenarios, "scenarios");
  const name = scenarios.data?.find((s) => s.id === scenario)?.name ?? scenario;

  if (incident.error) return <ErrorBox message={incident.error} />;
  if (!incident.data) return <Skeleton className="h-96" />;
  if (!incident.data.incident) {
    return (
      <Card>
        <div className="py-12 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">✓</span>
          <div className="text-lg text-white">No active incident</div>
          <p className="mt-1 text-sm text-slate-400">Spend is within its normal range for this scenario.</p>
          <Link href={`/simulator?scenario=${scenario}`} className="mt-5 inline-block rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500">
            Trigger an incident in the simulator
          </Link>
        </div>
      </Card>
    );
  }

  const inc = incident.data;
  const i = inc.incident;
  const current = overview.data?.kpis.current_monthly;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/?scenario=${scenario}`} className="text-xs text-slate-500 hover:text-slate-300">← Overview</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
            <Level level={i.severity} label="Severity" />
            <span>Cost <b className="font-medium text-rose-300">{pct(i.cost_change_pct)}</b> vs baseline</span>
            <span>Began {time(i.onset_at)} UTC</span>
            <span>Detected {time(i.detected_at)} UTC</span>
          </div>
        </div>
        <SourceBadge source={incident.source} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Root cause analysis" className="lg:col-span-2">
          <RootCause rc={inc.root_cause} />
        </Card>
        <Card title="Other candidates">
          <Candidates candidates={inc.candidates} />
        </Card>
      </div>

      <Card title="Propagation through the dependency graph" right={<GraphLegend />}>
        <DependencyGraph scenario={scenario} graph={inc.graph} height={460} />
      </Card>

      <Card title="Recommendations: cost vs performance"
        right={<span className="text-xs text-slate-400">Each fix is simulated against the same model the engine analysed</span>}>
        <div className="grid gap-3 lg:grid-cols-3">
          {inc.recommendations.map((r) => (
            <RecommendationCard key={r.id} rec={r} incident={inc} currentMonthly={current} />
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Timeline" className="lg:row-span-2">
          <Timeline events={inc.timeline} />
        </Card>
        <Card title="Estimated impact" className="lg:col-span-2">
          <Impact impact={inc.impact} />
        </Card>
        <Card title="Explanation" className="lg:col-span-2">
          <AiPanel scenario={scenario} />
        </Card>
      </div>

      <Card title="What-if: try your own change">
        <WhatIfPanel scenario={scenario} incident={inc} currentMonthly={current} />
      </Card>
    </div>
  );
}
