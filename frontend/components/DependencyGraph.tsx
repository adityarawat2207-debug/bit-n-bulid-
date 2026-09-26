"use client";

import { Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { pct } from "@/lib/format";
import type { Graph, NodeKind, NodeState } from "@/lib/types";

// Fixed layout (the backend never sends positions): ingress on top, services,
// then the resources they call.
const LAYOUT: Record<string, { x: number; y: number; kind: NodeKind }> = {
  "api-gateway": { x: 285, y: 0, kind: "ingress" },
  "auth-service": { x: 0, y: 125, kind: "service" },
  "search-service": { x: 190, y: 125, kind: "service" },
  "order-service": { x: 380, y: 125, kind: "service" },
  "image-service": { x: 570, y: 125, kind: "service" },
  redis: { x: 95, y: 255, kind: "resource" },
  database: { x: 285, y: 255, kind: "resource" },
  "payment-service": { x: 475, y: 255, kind: "service" },
  cdn: { x: 640, y: 255, kind: "resource" },
  analytics: { x: 285, y: 380, kind: "resource" },
};

// Used when there is no incident (baseline): same topology, everything normal.
const STATIC_EDGES: [string, string][] = [
  ["api-gateway", "auth-service"], ["api-gateway", "search-service"], ["api-gateway", "order-service"],
  ["api-gateway", "image-service"], ["search-service", "redis"], ["search-service", "database"],
  ["auth-service", "database"], ["order-service", "database"], ["order-service", "payment-service"],
  ["image-service", "cdn"], ["database", "analytics"],
];

export const HEALTHY_GRAPH: Graph = {
  nodes: Object.entries(LAYOUT).map(([id, p]) => ({ id, kind: p.kind, state: "normal", change_pct: 0 })),
  edges: STATIC_EDGES.map(([source, target]) => ({ source, target, calls_change_pct: 0, on_propagation_path: false })),
};

const STATE_STYLE: Record<NodeState, string> = {
  root: "border-rose-500 bg-rose-950 shadow-[0_0_28px_-6px] shadow-rose-500/70",
  affected: "border-amber-500/80 bg-amber-950/60",
  normal: "border-slate-700/80 bg-slate-900",
};
const STATE_LABEL: Record<NodeState, string> = { root: "Likely root cause", affected: "Impacted", normal: "Healthy" };
const STATE_TEXT: Record<NodeState, string> = { root: "text-rose-300", affected: "text-amber-300", normal: "text-slate-500" };
const KIND_LABEL: Record<NodeKind, string> = { ingress: "edge", service: "service", resource: "resource" };

type SvcData = { id: string; kind: NodeKind; state: NodeState; change_pct: number };

function ServiceNode({ data }: NodeProps<Node<SvcData>>) {
  const moved = Math.abs(data.change_pct) >= 1;
  return (
    <div className={`w-[164px] rounded-lg border px-3 py-2 text-left ${STATE_STYLE[data.state]}`}>
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-slate-600" />
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[13px] font-semibold text-white">{data.id}</span>
        {data.state === "root" && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-400" />}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className={STATE_TEXT[data.state]}>
          {data.state === "normal" ? KIND_LABEL[data.kind] : STATE_LABEL[data.state]}
        </span>
        {moved && (
          <span className={`tabular-nums ${data.change_pct > 0 ? "text-rose-300" : "text-emerald-300"}`} title="Cost change vs baseline">
            {pct(data.change_pct, 0)}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-slate-600" />
    </div>
  );
}

const nodeTypes = { svc: ServiceNode };

export default function DependencyGraph({ graph, height = 480 }: { graph: Graph | null; height?: number }) {
  const g = graph ?? HEALTHY_GRAPH;
  const nodes: Node<SvcData>[] = useMemo(
    () =>
      g.nodes.map((n) => ({
        id: n.id,
        type: "svc",
        position: LAYOUT[n.id] ?? { x: 0, y: 520 },
        data: n,
      })),
    [g],
  );
  const edges: Edge[] = useMemo(
    () =>
      g.edges.map((e) => {
        const hot = e.on_propagation_path;
        const color = hot ? "#fb7185" : Math.abs(e.calls_change_pct) >= 5 ? "#94a3b8" : "#334155";
        return {
          id: `${e.source}->${e.target}`,
          source: e.source,
          target: e.target,
          animated: hot,
          className: hot ? "hot" : undefined,
          labelBgPadding: [5, 3] as [number, number],
          labelBgBorderRadius: 4,
          label: Math.abs(e.calls_change_pct) >= 5 ? `${pct(e.calls_change_pct, 0)} calls` : undefined,
          style: { stroke: color, strokeWidth: hot ? 2.5 : 1.2 },
          markerEnd: { type: MarkerType.ArrowClosed, color },
          zIndex: hot ? 1 : 0,
        };
      }),
    [g],
  );

  return (
    // shorter on narrow screens, where the fitted graph is small anyway
    <div style={{ height: `min(${height}px, 62vw)` }} className="cp-graph w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        fitViewOptions={{ padding: 0.08 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
      />
    </div>
  );
}

export function GraphLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-400">
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-rose-500 bg-rose-950" />Likely root cause</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-amber-500 bg-amber-950" />Impacted</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-slate-600 bg-slate-900" />Healthy</span>
      <span className="flex items-center gap-1"><i className="h-0 w-4 border-t-2 border-dashed border-rose-400" />Propagation path</span>
      <span className="text-slate-500">% = cost change</span>
    </div>
  );
}
