"use client";

import { Background, BackgroundVariant, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { companyOf } from "@/lib/companies";
import { pct } from "@/lib/format";
import type { Graph, NodeKind, NodeState, ScenarioId } from "@/lib/types";

// Used when there is no incident (baseline): the company's topology, everything normal.
function healthyGraph(scenario: ScenarioId): Graph {
  const c = companyOf(scenario);
  return {
    nodes: Object.entries(c.layout).map(([id, p]) => ({ id, kind: p.kind, state: "normal", change_pct: 0 })),
    edges: c.edges.map(([source, target]) => ({ source, target, calls_change_pct: 0, on_propagation_path: false })),
  };
}

const STATE_STYLE: Record<NodeState, string> = {
  root: "border-alert bg-alert-soft ring-1 ring-alert",
  affected: "border-warn-line bg-warn-soft",
  normal: "border-line-strong bg-surface",
};
const STATE_LABEL: Record<NodeState, string> = { root: "Likely root cause", affected: "Impacted", normal: "Healthy" };
const STATE_TEXT: Record<NodeState, string> = { root: "text-alert", affected: "text-warn", normal: "text-faint" };
const KIND_LABEL: Record<NodeKind, string> = { ingress: "entry point", service: "service", resource: "resource" };

const ICON_TONE: Record<NodeState, string> = { root: "text-alert", affected: "text-warn", normal: "text-faint" };

/** entry point: arrow into a gate; service: a server box; resource: a data cylinder */
function KindIcon({ kind }: { kind: NodeKind }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      {kind === "ingress" && <><path d="M2 8h8M7 5l3 3-3 3" {...common} /><path d="M13 3v10" {...common} /></>}
      {kind === "service" && <><rect x="2.5" y="3" width="11" height="10" rx="2" {...common} /><path d="M5 6.5h6M5 9.5h3.5" {...common} /></>}
      {kind === "resource" && <><ellipse cx="8" cy="4" rx="5" ry="1.8" {...common} /><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8" {...common} /></>}
    </svg>
  );
}

type SvcData = { id: string; kind: NodeKind; state: NodeState; change_pct: number };

function ServiceNode({ data }: NodeProps<Node<SvcData>>) {
  const moved = Math.abs(data.change_pct) >= 1;
  return (
    <div className={`w-[164px] rounded-md border px-3 py-2 text-left ${STATE_STYLE[data.state]}`}>
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-line-strong" />
      <div className="flex items-center gap-2">
        <span className={`flex shrink-0 items-center ${ICON_TONE[data.state]}`}>
          <KindIcon kind={data.kind} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{data.id}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className={STATE_TEXT[data.state]}>
          {data.state === "normal" ? KIND_LABEL[data.kind] : STATE_LABEL[data.state]}
        </span>
        {moved && (
          <span className={`font-medium tabular-nums ${data.change_pct > 0 ? "text-alert" : "text-ok"}`} title="Cost change vs baseline">
            {pct(data.change_pct, 0)}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-line-strong" />
    </div>
  );
}

const nodeTypes = { svc: ServiceNode };

export default function DependencyGraph({ scenario, graph, height = 480 }: {
  scenario: ScenarioId;
  graph: Graph | null;
  height?: number;
}) {
  const g = useMemo(() => graph ?? healthyGraph(scenario), [graph, scenario]);
  // fixed layout per company (the backend never sends positions)
  const layout = companyOf(scenario).layout;
  const nodes: Node<SvcData>[] = useMemo(
    () =>
      g.nodes.map((n) => ({
        id: n.id,
        type: "svc",
        position: layout[n.id] ?? { x: 0, y: 640 },
        data: n,
      })),
    [g, layout],
  );
  const edges: Edge[] = useMemo(
    () =>
      g.edges.map((e) => {
        const hot = e.on_propagation_path;
        const color = hot ? "#c3372c" : Math.abs(e.calls_change_pct) >= 5 ? "#8a919c" : "#cfd4db";
        return {
          id: `${e.source}->${e.target}`,
          source: e.source,
          target: e.target,
          className: hot ? "hot" : undefined,
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 3,
          label: Math.abs(e.calls_change_pct) >= 5 ? `${pct(e.calls_change_pct, 0)} calls` : undefined,
          style: { stroke: color, strokeWidth: hot ? 1.75 : 1 },
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
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e4e7eb" />
      </ReactFlow>
    </div>
  );
}

export function GraphLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted">
      <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-alert bg-alert-soft" />Likely root cause</span>
      <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-warn-line bg-warn-soft" />Impacted</span>
      <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-line-strong bg-surface" />Healthy</span>
      <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-alert" />Propagation path</span>
      <span className="text-faint">% = cost change</span>
    </div>
  );
}
