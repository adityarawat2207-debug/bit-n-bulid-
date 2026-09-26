import type { ReactNode } from "react";
import type { Source } from "@/lib/api";

export function Card({ title, right, children, className = "" }: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {title && <h2 className="text-sm font-medium text-slate-300">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ className = "h-40" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-900 ${className}`} />;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-300">
      Could not load data: {message}
    </div>
  );
}

export function SourceBadge({ source }: { source: Source | null }) {
  if (source !== "mock") return null;
  return (
    <span
      title="The backend is unreachable, so saved responses are shown."
      className="rounded-full border border-amber-700 bg-amber-950/60 px-2 py-0.5 text-xs text-amber-300"
    >
      offline data
    </span>
  );
}

const VERDICT = {
  RECOMMENDED: "border-emerald-700 bg-emerald-950/60 text-emerald-300",
  "NOT RECOMMENDED": "border-rose-700 bg-rose-950/60 text-rose-300",
};
export function Verdict({ verdict }: { verdict: keyof typeof VERDICT }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${VERDICT[verdict]}`}>
      {verdict === "RECOMMENDED" ? "✓ RECOMMENDED" : "✕ NOT RECOMMENDED"}
    </span>
  );
}

const LEVEL = {
  low: "border-emerald-800 text-emerald-300",
  medium: "border-amber-700 text-amber-300",
  high: "border-rose-700 text-rose-300",
};
export function Level({ level, label }: { level: keyof typeof LEVEL; label: string }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${LEVEL[level]}`}>{label}: {level}</span>;
}

export function Bar({ value, className = "bg-sky-500" }: { value: number; className?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-800">
      <div className={`h-1.5 rounded-full ${className}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}
