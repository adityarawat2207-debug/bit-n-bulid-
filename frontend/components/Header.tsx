"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { companyOf, isBaseline, scenarioName } from "@/lib/companies";
import { useScenario } from "@/lib/hooks";

function Logo() {
  // a cost line that spikes: the thing CloudPulse explains
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <rect width="24" height="24" rx="6" className="fill-sky-500/15" />
      <path d="M3 14h4l2-4 3 8 3-12 2 8h4" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Header() {
  const [scenario] = useScenario();
  const path = usePathname();
  const incident = !isBaseline(scenario);
  const links = [
    { href: `/?scenario=${scenario}`, label: "Overview", active: path === "/" },
    { href: `/incidents/${scenario}`, label: "Incident", active: path.startsWith("/incidents") },
    { href: `/simulator?scenario=${scenario}`, label: "Simulator", active: path === "/simulator" },
  ];
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href={`/?scenario=${scenario}`} className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-semibold tracking-tight text-white">CloudPulse</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={`rounded-md px-2 py-1.5 transition-colors sm:px-3 ${l.active ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-3 text-xs md:flex">
          <span className="text-slate-500">{companyOf(scenario).name}, simulated</span>
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              incident ? "border-rose-800 bg-rose-950/50 text-rose-200" : "border-emerald-800 bg-emerald-950/40 text-emerald-200"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${incident ? "animate-pulse bg-rose-400" : "bg-emerald-400"}`} />
            {scenarioName(scenario)}
          </span>
        </div>
      </div>
    </header>
  );
}
