"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getIncident, getOverview, getScenarios } from "@/lib/api";
import { companyOf, isBaseline } from "@/lib/companies";
import { useApi, useScenario } from "@/lib/hooks";
import type { ScenarioId } from "@/lib/types";
import { DailyCostChart, HourlyCostChart } from "./CostCharts";
import { BreakdownTable, IncidentBanner, KpiCards, ScenarioBar, ServiceTable } from "./Dashboard";
import DependencyGraph, { GraphLegend } from "./DependencyGraph";
import { Card, ErrorBox, Skeleton, SourceBadge } from "./ui";

export default function DashboardView() {
  const [scenario, setScenario] = useScenario();
  const scenarios = useApi(getScenarios, "scenarios");
  const overview = useApi(() => getOverview(scenario), scenario);
  const incident = useApi(() => getIncident(scenario), scenario);

  // Replay the cost climb once the newly triggered scenario's data arrives.
  // ?replay=1 comes from the simulator's "Watch on dashboard" link.
  const params = useSearchParams();
  const replayRequested = params.get("replay") === "1";
  const [token, setToken] = useState(() => (replayRequested ? { scenario, n: 1 } : null));
  useEffect(() => {
    if (replayRequested) setScenario(scenario); // drops ?replay=1 from the URL
  }, [replayRequested, scenario, setScenario]);
  const replayKey =
    token && token.scenario === scenario && overview.data?.scenario === scenario && !overview.loading && !incident.loading ? token.n : 0;

  const select = (s: ScenarioId) => {
    if (!isBaseline(s)) setToken((t) => ({ scenario: s, n: (t?.n ?? 0) + 1 }));
    setScenario(s);
  };

  const o = overview.data;
  const inc = incident.data?.incident ? incident.data : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Overview</h1>
          <p className="text-sm text-slate-400">
            {scenarios.data?.find((s) => s.id === scenario)?.description ?? `${companyOf(scenario).name} cloud spend`}
          </p>
        </div>
        <SourceBadge source={overview.source} />
      </div>

      {scenarios.data && (
        <ScenarioBar scenarios={scenarios.data} active={scenario} onSelect={select} busy={overview.loading} />
      )}

      {overview.error && <ErrorBox message={overview.error} />}
      {!o ? (
        <>
          <Skeleton className="h-24" />
          <Skeleton className="h-72" />
        </>
      ) : (
        <>
          <KpiCards kpis={o.kpis} />
          {inc && o.active_incident_id && <IncidentBanner incident={inc} scenario={scenario} />}

          <Card title="Cost run-rate — last 7 days (hourly)">
            <HourlyCostChart hourly={o.hourly} onsetAt={inc?.incident.onset_at ?? null} replayKey={replayKey} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Cloud spending — last 30 days" right={
              <span className="flex items-center gap-1.5 text-xs text-slate-400"><i className="h-2.5 w-2.5 rounded-sm bg-rose-400" />Anomalous day</span>
            }>
              <DailyCostChart daily={o.daily} height={280} />
            </Card>
            <Card title="Cost breakdown by resource (monthly)" right={
              <span className="flex items-center gap-1.5 text-xs text-slate-400"><i className="h-2.5 w-px bg-slate-400" />Normal level</span>
            }>
              <BreakdownTable rows={o.breakdown} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card title="Service dependencies" right={<GraphLegend />} className="lg:col-span-3">
              <DependencyGraph key={companyOf(scenario).id} scenario={scenario} graph={inc?.graph ?? null} height={420} />
            </Card>
            <Card title="Cost by service (monthly)" className="lg:col-span-2">
              <ServiceTable rows={o.services} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
