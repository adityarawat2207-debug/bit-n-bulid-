"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getIncident, getOverview, getScenarios } from "@/lib/api";
import LivePanel from "./LivePanel";
import { companyOf, isBaseline, isLive } from "@/lib/companies";
import { useApi, useScenario, useTick } from "@/lib/hooks";
import type { ScenarioId } from "@/lib/types";
import { DailyCostChart, HourlyCostChart } from "./CostCharts";
import { BreakdownTable, IncidentBanner, KpiCards, ScenarioBar, ServiceTable } from "./Dashboard";
import DependencyGraph, { GraphLegend } from "./DependencyGraph";
import { Card, ErrorBox, Skeleton, SourceBadge } from "./ui";

export default function DashboardView() {
  const [scenario, setScenario] = useScenario();
  const scenarios = useApi(getScenarios, "scenarios");
  const tick = useTick(isLive(scenario));
  const key = `${scenario}:${tick}`;
  const overview = useApi(() => getOverview(scenario), key);
  const incident = useApi(() => getIncident(scenario), key);
  const switching = overview.loading && overview.data?.scenario !== scenario;

  // Replay the cost climb once the newly triggered scenario's data arrives.
  // ?replay=1 comes from the simulator's "Watch on dashboard" link.
  const params = useSearchParams();
  const replayRequested = params.get("replay") === "1";
  const [token, setToken] = useState(() => (replayRequested ? { scenario, n: 1 } : null));
  useEffect(() => {
    if (replayRequested) setScenario(scenario); // drops ?replay=1 from the URL
  }, [replayRequested, scenario, setScenario]);
  const replayKey =
    token && token.scenario === scenario && overview.data?.scenario === scenario && !switching ? token.n : 0;

  const select = (s: ScenarioId) => {
    if (!isBaseline(s)) setToken((t) => ({ scenario: s, n: (t?.n ?? 0) + 1 }));
    setScenario(s);
  };

  const o = overview.data;
  const inc = incident.data?.incident ? incident.data : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">{companyOf(scenario).name} cloud spend</h1>
          <p className="mt-1 text-[15px] text-muted">
            {scenarios.data?.find((s) => s.id === scenario)?.description ?? "Last 30 days of simulated spend"}
          </p>
        </div>
        <SourceBadge source={overview.source} />
      </div>

      {scenarios.data && (
        <ScenarioBar scenarios={scenarios.data} active={scenario} onSelect={select} busy={switching} />
      )}
      {isLive(scenario) && <LivePanel tick={tick} />}

      {overview.error && <ErrorBox message={overview.error} />}
      {!o ? (
        <>
          <Skeleton className="h-[106px]" />
          <Skeleton className="h-[404px]" />
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </>
      ) : (
        <>
          <KpiCards kpis={o.kpis} />
          {inc && o.active_incident_id && <IncidentBanner incident={inc} scenario={scenario} />}

          <Card title="Hourly cost run-rate, last 7 days">
            <HourlyCostChart hourly={o.hourly} onsetAt={inc?.incident.onset_at ?? null} replayKey={replayKey} />
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Daily spend, last 30 days" right={
              <span className="flex items-center gap-1.5 text-xs text-muted"><i className="h-2.5 w-2.5 rounded-sm bg-alert" />Anomalous day</span>
            }>
              <DailyCostChart daily={o.daily} height={280} />
            </Card>
            <Card title="Monthly cost by resource" right={
              <span className="flex items-center gap-1.5 text-xs text-muted"><i className="h-2.5 w-0.5 rounded bg-ink/60" />Normal level</span>
            }>
              <BreakdownTable rows={o.breakdown} />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <Card title="Service dependencies" right={<GraphLegend />} className="lg:col-span-3">
              <DependencyGraph key={companyOf(scenario).id} scenario={scenario} graph={inc?.graph ?? null} height={420} />
            </Card>
            <Card title="Monthly cost by service" className="lg:col-span-2">
              <ServiceTable rows={o.services} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
