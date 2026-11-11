"use client";

import { useMemo, useState } from "react";
import { CqaIcon, cqaCard } from "@/components/dashboard/ui";
import type { GraphifyKind, GraphifyMap, GraphifyNode } from "@/lib/graphify";
import { cn } from "@/lib/utils";

const KIND_META: Record<GraphifyKind, { label: string; icon: string; color: string; fill: string }> = {
  url: { label: "Crawled URLs", icon: "travel_explore", color: "#0284c7", fill: "#e0f2fe" },
  dom: { label: "DOM components", icon: "widgets", color: "#7c3aed", fill: "#f3e8ff" },
  requirement: { label: "Requirements", icon: "description", color: "#d97706", fill: "#fef3c7" },
  test: { label: "Test Cases", icon: "fact_check", color: "#059669", fill: "#d1fae5" },
  pr: { label: "Pull Requests", icon: "merge", color: "#e11d48", fill: "#ffe4e6" },
};

const LAYERS: GraphifyKind[] = ["url", "requirement", "test", "dom", "pr"];
const NODE_WIDTH = 196;
const NODE_HEIGHT = 54;
const COLUMN_X: Record<GraphifyKind, number> = { url: 108, requirement: 352, test: 596, dom: 840, pr: 1084 };

function truncate(value: string, max = 30) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Interactive SVG rendering of the Graphify quality graph.
 * Filter by node kind, zoom with the controls and click any node for details.
 */
export function GraphifyMapView({ data, compact = false }: { data: GraphifyMap; compact?: boolean }) {
  const [zoom, setZoom] = useState(1);
  const [enabled, setEnabled] = useState<Record<GraphifyKind, boolean>>({
    url: true,
    requirement: true,
    test: true,
    dom: true,
    pr: true,
  });
  const [selected, setSelected] = useState<string | null>(null);

  const visibleNodes = useMemo(() => data.nodes.filter((node) => enabled[node.kind]), [data.nodes, enabled]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => data.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    [data.edges, visibleIds],
  );

  const { positions, height } = useMemo(() => {
    const grouped: Record<GraphifyKind, GraphifyNode[]> = { url: [], dom: [], requirement: [], test: [], pr: [] };
    for (const node of visibleNodes) grouped[node.kind].push(node);
    const rows = Math.max(1, ...LAYERS.map((kind) => grouped[kind].length));
    const computedHeight = 84 + rows * 78;
    const map = new Map<string, { x: number; y: number }>();
    for (const kind of LAYERS) {
      grouped[kind].forEach((node, index) => {
        map.set(node.id, { x: COLUMN_X[kind], y: 70 + index * 78 });
      });
    }
    return { positions: map, height: computedHeight };
  }, [visibleNodes]);

  const selectedNode = data.nodes.find((node) => node.id === selected) ?? null;
  const selectedEdges = selectedNode
    ? data.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
    : [];
  const width = 1200;

  function toggleKind(kind: GraphifyKind) {
    setEnabled((prev) => ({ ...prev, [kind]: !prev[kind] }));
  }

  return (
    <section className={cn(cqaCard, "overflow-hidden")} data-testid="graphify-map">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0f1f3] px-4 py-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-[#111827]">
            <CqaIcon name="hub" className="text-[18px] text-[#5b4ee8]" /> Graphify Map
          </h3>
          <p className="mt-0.5 text-[11.5px] text-[#6b7280]">
            {data.nodes.length} nodes · {data.edges.length} edges · crawled URLs, DOM, requirements, tests and PRs
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="graphify-zoom-out"
            aria-label="Zoom out"
            className="flex size-8 items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f9fafb]"
            onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.15).toFixed(2))))}
          >
            <CqaIcon name="remove" className="text-[17px]" />
          </button>
          <span className="w-11 text-center font-mono text-[11px] text-[#6b7280]">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            data-testid="graphify-zoom-in"
            aria-label="Zoom in"
            className="flex size-8 items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f9fafb]"
            onClick={() => setZoom((value) => Math.min(2, Number((value + 0.15).toFixed(2))))}
          >
            <CqaIcon name="add" className="text-[17px]" />
          </button>
          <button
            type="button"
            data-testid="graphify-zoom-reset"
            className="ml-1 rounded-md border border-[#e5e7eb] bg-white px-2 py-1.5 text-[11px] font-medium text-[#4b5563] hover:bg-[#f9fafb]"
            onClick={() => setZoom(1)}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-[#f0f1f3] px-4 py-2">
        {LAYERS.map((kind) => {
          const meta = KIND_META[kind];
          return (
            <button
              key={kind}
              type="button"
              data-filter={kind}
              aria-pressed={enabled[kind]}
              onClick={() => toggleKind(kind)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition",
                enabled[kind] ? "border-[#e5e7eb] bg-white text-[#374151]" : "border-[#f3f4f6] bg-[#f9fafb] text-[#9ca3af] line-through",
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
              {meta.label} ({data.stats[kind]})
            </button>
          );
        })}
      </div>

      {visibleNodes.length === 0 ? (
        <div className="px-4 py-14 text-center">
          <p className="text-[13px] font-medium text-[#374151]">No graph nodes for this filter</p>
          <p className="mt-1 text-[12px] text-[#9ca3af]">Run a crawl or create test cases to populate the map.</p>
        </div>
      ) : (
        <div className={cn("overflow-auto bg-[#fcfcfd]", compact ? "max-h-[420px]" : "max-h-[640px]")}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width * zoom}
            height={height * zoom}
            role="img"
            aria-label="Graphify map connecting crawled URLs, requirements, tests, DOM components and pull requests"
          >
            <defs>
              <marker id="graphify-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
              </marker>
            </defs>

            {LAYERS.map((kind) => {
              const meta = KIND_META[kind];
              return (
                <text key={kind} x={COLUMN_X[kind] - NODE_WIDTH / 2} y={24} className="fill-[#6b7280] text-[11px] font-semibold uppercase tracking-wide">
                  {meta.label}
                </text>
              );
            })}

            {visibleEdges.map((edge) => {
              const from = positions.get(edge.source);
              const to = positions.get(edge.target);
              if (!from || !to) return null;
              const x1 = from.x + NODE_WIDTH / 2;
              const y1 = from.y + NODE_HEIGHT / 2;
              const x2 = to.x - NODE_WIDTH / 2;
              const y2 = to.y + NODE_HEIGHT / 2;
              const control = Math.max(40, Math.abs(x2 - x1) / 2);
              return (
                <path
                  key={edge.id}
                  d={`M ${x1} ${y1} C ${x1 + control} ${y1}, ${x2 - control} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="#d7dce3"
                  strokeWidth={1.2}
                  markerEnd="url(#graphify-arrow)"
                />
              );
            })}

            {visibleNodes.map((node) => {
              const position = positions.get(node.id);
              if (!position) return null;
              const meta = KIND_META[node.kind];
              const active = selected === node.id;
              return (
                <g
                  key={node.id}
                  data-node-kind={node.kind}
                  data-node-id={node.id}
                  transform={`translate(${position.x - NODE_WIDTH / 2}, ${position.y})`}
                  onClick={() => setSelected(active ? null : node.id)}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`${meta.label}: ${node.label}`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setSelected(active ? null : node.id);
                  }}
                >
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={10}
                    fill={active ? meta.fill : "#ffffff"}
                    stroke={meta.color}
                    strokeWidth={active ? 2 : 1}
                  />
                  <rect width={4} height={NODE_HEIGHT} rx={2} fill={meta.color} />
                  <text x={12} y={21} className="fill-[#111827] text-[11.5px] font-semibold">
                    {truncate(node.label, 32)}
                  </text>
                  <text x={12} y={38} className="fill-[#6b7280] text-[10px]">
                    {truncate(node.detail, 36)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {selectedNode && (
        <div className="border-t border-[#f0f1f3] bg-[#fafafa] px-4 py-3" data-testid="graphify-detail">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#111827]">
              <span className="size-2 rounded-full" style={{ backgroundColor: KIND_META[selectedNode.kind].color }} />
              {selectedNode.label}
            </p>
            <button type="button" className="text-[11px] text-[#6b7280] hover:text-[#111827]" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <p className="mt-0.5 text-[11.5px] text-[#6b7280]">
            {KIND_META[selectedNode.kind].label} · {selectedNode.detail}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {selectedEdges.slice(0, 8).map((edge) => {
              const other = data.nodes.find((node) => node.id === (edge.source === selectedNode.id ? edge.target : edge.source));
              if (!other) return null;
              return (
                <li key={edge.id} className="rounded-full border border-[#e5e7eb] bg-white px-2 py-0.5 text-[10.5px] text-[#4b5563]">
                  {edge.relation} · {truncate(other.label, 26)}
                </li>
              );
            })}
            {selectedEdges.length === 0 && <li className="text-[10.5px] text-[#9ca3af]">No connected edge.</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
