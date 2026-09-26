"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { companyOf, isBaseline, scenarioName } from "@/lib/companies";
import { useScenario } from "@/lib/hooks";

function Logo() {
  // a cost line that spikes: the thing CloudPulse explains
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
      <rect width="24" height="24" rx="6" className="fill-brand" />
      <path d="M4 14h3.5l2-4 3 7.5 3-11 2 7.5H20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-stretch gap-4 px-4 sm:gap-8 sm:px-6">
        <Link href={`/?scenario=${scenario}`} className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[17px] font-semibold tracking-tight text-ink">CloudPulse</span>
        </Link>
        <nav className="flex gap-1 text-sm sm:gap-5">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={`-mb-px flex items-center border-b-2 px-1.5 font-medium transition-colors ${
                l.active ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-3 text-sm md:flex">
          <span className="text-muted">{companyOf(scenario).name} (simulated)</span>
          <span
            className={`flex items-center gap-2 rounded-md px-2.5 py-1 font-medium ${
              incident ? "bg-alert-soft text-alert" : "bg-ok-soft text-ok"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${incident ? "animate-pulse bg-alert" : "bg-ok"}`} />
            {scenarioName(scenario)}
          </span>
        </div>
      </div>
    </header>
  );
}
