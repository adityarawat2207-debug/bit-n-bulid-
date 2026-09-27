"use client";

import Link from "next/link";
import { getIncident, getOverview, getScenarios } from "@/lib/api";
import { time } from "@/lib/format";
import { isLive, STORE_URL } from "@/lib/companies";
import { useApi, useTick } from "@/lib/hooks";
import type { ScenarioId } from "@/lib/types";
import AiPanel from "./AiPanel";
import DependencyGraph, { GraphLegend } from "./DependencyGraph";
import { CausalChain, Candidates, Impact, RootCause, Timeline } from "./Incident";
import { RecommendationCard, WhatIfPanel } from "./Recommendations";
import { Card, ErrorBox, Level, Skeleton, SourceBadge } from "./ui";

export default function IncidentView({ scenario }: { scenario: ScenarioId }) {
  const key = `${scenario}:${useTick(isLive(scenario))}`;
  const incident = useApi(() => getIncident(scenario), key);
  const overview = useApi(() => getOverview(scenario), key);
  const scenarios = useApi(getScenarios, "scenarios");
  const name = scenarios.data?.find((s) => s.id === scenario)?.name ?? scenario;

  if (incident.error) return <ErrorBox message={incident.error} />;
  if (!incident.data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-80" />
        <Skeleton className="h-28" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (!incident.data.incident) {
    const cta = "mt-5 inline-block rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-2";
    return (
      <Card>
        <div className="py-12 text-center">
          <div className="text-lg font-semibold text-ink">No active incident</div>
          {isLive(scenario) ? (
            <>
              <p className="mt-1 text-sm text-muted">
                The store&apos;s recent searches look normal. Search the ShopX store and this page picks up its requests within seconds.
              </p>
              <a href={STORE_URL} target="_blank" rel="noreferrer" className={cta}>Open the ShopX store ↗</a>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">Spend is within its normal range for this scenario.</p>
              <Link href={`/simulator?scenario=${scenario}`} className={cta}>Trigger an incident in the simulator</Link>
            </>
          )}
        </div>
      </Card>
    );
  }

  const inc = incident.data;
  const i = inc.incident;
  const current = overview.data?.kpis.current_monthly;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/?scenario=${scenario}`} className="text-sm text-muted hover:text-ink">← Overview</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <Level level={i.severity} label="Severity" />
            <span>Began {time(i.onset_at)} UTC</span>
            <span>Detected {time(i.detected_at)} UTC</span>
          </div>
        </div>
        <SourceBadge source={incident.source} />
      </div>

      <CausalChain inc={inc} />

      <div className="grid gap-5 lg:grid-cols-3">
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

      <Card title="Recommended fixes"
        right={<span className="text-xs text-muted">Each fix is simulated against the same model the engine analysed</span>}>
        <div className="grid gap-3 lg:grid-cols-3">
          {inc.recommendations.map((r) => (
            <RecommendationCard key={r.id} rec={r} incident={inc} currentMonthly={current} />
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Timeline" className="lg:row-span-2">
          <Timeline events={inc.timeline} />
        </Card>
        <Card title="Estimated impact" className="lg:col-span-2">
          <Impact impact={inc.impact} />
        </Card>
        <Card title="Plain-language summary" className="lg:col-span-2">
          <AiPanel scenario={scenario} />
        </Card>
      </div>

      <Card title="What-if: try your own change">
        <WhatIfPanel scenario={scenario} incident={inc} currentMonthly={current} />
      </Card>
    </div>
  );
}
