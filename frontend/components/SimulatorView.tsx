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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Incident simulator</h1>
          <p className="mt-1 text-sm text-muted">Start an incident in the simulated {company.name} environment, then test fixes against it.</p>
        </div>
        <SourceBadge source={overview.source} />
      </div>

      <CompanySwitch active={scenario} onSelect={setScenario} />

      {!scenarios.data ? <Skeleton className="h-80" /> : (
        // one list rather than a card grid, so any number of scenarios lines up;
        // the right-hand slot is either the action or the "Running" status
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {scenarios.data.filter((s) => s.company === company.id).map((s) => {
            const active = s.id === scenario;
            const baseline = s.id === company.baseline;
            return (
              <li key={s.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-6 ${active ? "bg-canvas" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{s.name}</div>
                  <p className="mt-0.5 text-sm text-muted">{company.scenarios[s.id]?.detail ?? s.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-5">
                  {!baseline && (
                    <Link href={`/?scenario=${s.id}&replay=1`} className="text-sm text-brand hover:underline hover:underline-offset-4">
                      Replay on dashboard
                    </Link>
                  )}
                  <div className="flex sm:w-36 sm:justify-end">
                    {active ? (
                      <span className={`flex items-center gap-1.5 py-1 text-sm font-medium ${baseline ? "text-ok" : "text-alert"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${baseline ? "bg-ok" : "bg-alert"}`} />
                        Running
                      </span>
                    ) : (
                      <button onClick={() => setScenario(s.id)}
                        className={`rounded-md px-3 py-1 text-sm transition-colors ${baseline
                          ? "border border-line-strong bg-surface text-ink-2 hover:border-faint hover:text-ink"
                          : "bg-ink font-medium text-white hover:bg-ink-2"}`}>
                        {baseline ? "Reset to baseline" : "Trigger incident"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {overview.data && (
        <Card>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-muted">Current run-rate <b className="font-medium tabular-nums text-ink">{usd(overview.data.kpis.current_monthly)}</b></span>
            <span className="text-muted">vs baseline <b className={`font-medium tabular-nums ${overview.data.kpis.change_pct > 5 ? "text-alert" : "text-ok"}`}>{pct(overview.data.kpis.change_pct)}</b></span>
            {inc ? (
              <Link href={`/incidents/${scenario}`} className="font-medium text-alert underline decoration-alert-line underline-offset-4 hover:decoration-alert">
                Anomaly detected: likely root cause {inc.root_cause.service}. View the analysis
              </Link>
            ) : <span className="font-medium text-ok">No active anomaly</span>}
          </div>
        </Card>
      )}

      <Card title="What-if: test a fix">
        <WhatIfPanel key={`${scenario}:${inc ? "incident" : "none"}`} scenario={scenario} incident={inc} currentMonthly={overview.data?.kpis.current_monthly} />
      </Card>
    </div>
  );
}
