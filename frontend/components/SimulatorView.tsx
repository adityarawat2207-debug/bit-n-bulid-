"use client";

import Link from "next/link";
import { getIncident, getOverview, getScenarios } from "@/lib/api";
import { companyOf } from "@/lib/companies";
import { pct, usd } from "@/lib/format";
import { useApi, useScenario } from "@/lib/hooks";
import { CompanySwitch } from "./Dashboard";
import { WhatIfPanel } from "./Recommendations";
import { Card, Skeleton, SourceBadge } from "./ui";

export default function SimulatorView() {
  const [scenario, setScenario] = useScenario();
  const scenarios = useApi(getScenarios, "scenarios");
  const overview = useApi(() => getOverview(scenario), scenario);
  const incident = useApi(() => getIncident(scenario), scenario);
  const inc = incident.data?.incident ? incident.data : null;
  const company = companyOf(scenario);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Incident simulator</h1>
          <p className="text-sm text-slate-400">Start an incident in the simulated {company.name} environment, then test fixes against it.</p>
        </div>
        <SourceBadge source={overview.source} />
      </div>

      <CompanySwitch active={scenario} onSelect={setScenario} />

      {!scenarios.data ? <Skeleton className="h-40" /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {scenarios.data.filter((s) => s.company === company.id).map((s) => {
            const active = s.id === scenario;
            const baseline = s.id === company.baseline;
            return (
              <div key={s.id} className={`flex flex-col rounded-xl border p-4 transition-colors ${
                active
                  ? baseline ? "border-emerald-600 bg-emerald-950/25" : "border-rose-600/80 bg-rose-950/25"
                  : "border-slate-800 bg-slate-900/60"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-white">{s.name}</div>
                  {active && (
                    <span className={`flex items-center gap-1.5 text-xs ${baseline ? "text-emerald-300" : "text-rose-300"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${baseline ? "bg-emerald-400" : "animate-pulse bg-rose-400"}`} />
                      Running
                    </span>
                  )}
                </div>
                <p className="mt-1 flex-1 text-sm text-slate-400">{company.scenarios[s.id]?.detail ?? s.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {!active && (
                    <button onClick={() => setScenario(s.id)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${baseline
                        ? "border border-emerald-700 text-emerald-300 hover:bg-emerald-950"
                        : "bg-slate-100 text-slate-900 hover:bg-white"}`}>
                      {baseline ? "↺ Reset to baseline" : "Trigger"}
                    </button>
                  )}
                  {!baseline && (
                    <Link href={`/?scenario=${s.id}&replay=1`} className="rounded-lg px-2 py-1.5 text-sm text-sky-300 hover:text-sky-200">
                      Replay on dashboard
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {overview.data && (
        <Card>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-slate-400">Current run-rate <b className="text-white">{usd(overview.data.kpis.current_monthly)}</b></span>
            <span className="text-slate-400">vs baseline <b className={overview.data.kpis.change_pct > 5 ? "text-rose-300" : "text-emerald-300"}>{pct(overview.data.kpis.change_pct)}</b></span>
            {inc ? (
              <Link href={`/incidents/${scenario}`} className="text-rose-300 hover:text-rose-200">
                Anomaly detected: likely root cause {inc.root_cause.service}. View the analysis
              </Link>
            ) : <span className="text-emerald-300">No active anomaly</span>}
          </div>
        </Card>
      )}

      <Card title="What-if: cost vs performance">
        <WhatIfPanel key={`${scenario}:${inc ? "incident" : "none"}`} scenario={scenario} incident={inc} currentMonthly={overview.data?.kpis.current_monthly} />
      </Card>
    </div>
  );
}
