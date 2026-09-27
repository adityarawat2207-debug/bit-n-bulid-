import type { ReactNode } from "react";
import type { Source } from "@/lib/api";

export function Card({ title, right, children, className = "" }: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-line bg-surface p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ className = "h-40" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg border border-line bg-surface ${className}`} />;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-alert-line bg-alert-soft p-4 text-sm text-alert">
      Could not load data: {message}
    </div>
  );
}

export function SourceBadge({ source }: { source: Source | null }) {
  if (source !== "mock") return null;
  return (
    <span
      title="The backend is unreachable, so saved responses are shown."
      className="rounded border border-warn-line bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn"
    >
      Offline data
    </span>
  );
}

const VERDICT = {
  RECOMMENDED: "bg-ok-soft text-ok",
  "NOT RECOMMENDED": "bg-sunk text-muted",
};
export function Verdict({ verdict }: { verdict: keyof typeof VERDICT }) {
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${VERDICT[verdict]}`}>
      {verdict === "RECOMMENDED" ? "Recommended" : "Not recommended"}
    </span>
  );
}

const LEVEL = {
  low: "text-ok",
  medium: "text-warn",
  high: "text-alert",
};
export function Level({ level, label }: { level: keyof typeof LEVEL; label: string }) {
  return (
    <span className="rounded bg-sunk px-1.5 py-0.5 text-xs text-muted">
      {label} <span className={`font-medium ${LEVEL[level]}`}>{level}</span>
    </span>
  );
}

export function Bar({ value, className = "bg-brand" }: { value: number; className?: string }) {
  return (
    <div className="h-1 w-full rounded-full bg-sunk">
      <div className={`h-1 rounded-full ${className}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}
